-- 0237 — autoria da notificação de plano no banco (REALIZA-518)
--
-- A 0225 gravava a mesma frase genérica ("Tem um plano pra vocês...") pra
-- todo plano; a leitura da UI reescrevia só a proposta de membro. Agora o
-- próprio plano_propor resolve quem combinou/propôs (nome social, Liza ou
-- "A equipe") e grava a copy certa no sino. A UI mantém a reescrita só como
-- fallback de linhas antigas.
begin;

CREATE OR REPLACE FUNCTION public.plano_propor(p_dupla uuid, p_escopo jsonb, p_via text DEFAULT 'app'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_d record;
  v_vers int;
  v_id uuid;
  v_max int;
  v_ritmo int;
  v_ini date;
  v_fim date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_eu uuid := public.my_profile_id();
  v_mentor_propoe boolean;
  v_mentorado_propoe boolean;
  v_propoe_parceiro boolean;
  v_jovem uuid;
  v_quem text;
  v_titulo text;
  v_corpo text;
  v_passo record;
begin
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;

  select d.id, d.status, d.trilha, d.cronograma_id, d.mentor_id, d.mentorado_id
    into v_d
    from public.duplas d
   where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;
  v_mentor_propoe := v_d.mentor_id is not distinct from v_eu;
  v_mentorado_propoe := v_d.mentorado_id is not distinct from public.my_mentorado_id();
  v_propoe_parceiro := v_mentor_propoe or v_mentorado_propoe;
  if not (
    public.has_papel('coordenacao'::public.app_role)
    or v_mentor_propoe
    or v_mentorado_propoe
    or public.supervisiona_dupla(p_dupla)
  ) then
    return jsonb_build_object('error', 'sem permissão pra propor plano desta dupla');
  end if;
  if v_d.trilha is distinct from 'dpp' then
    return jsonb_build_object('error', 'plano em dia é da trilha DPP');
  end if;
  if v_d.status <> 'ativa' then
    return jsonb_build_object('error', 'só dá pra propor plano de dupla ativa');
  end if;
  if v_d.cronograma_id is null then
    return jsonb_build_object('error', 'essa dupla está sem cronograma');
  end if;
  if exists (select 1 from public.dupla_planos p
      where p.dupla_id = p_dupla and p.status in ('proposto','aceito','ativo')) then
    return jsonb_build_object('error', 'já existe um plano aberto. Conteste ou conclua antes de propor outro');
  end if;

  if p_escopo is null
     or jsonb_typeof(p_escopo->'numeros') is distinct from 'array'
     or jsonb_array_length(p_escopo->'numeros') = 0 then
    return jsonb_build_object('error', 'escolha ao menos um encontro pro plano');
  end if;
  select max(ev.numero) into v_max
    from public.ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if exists (
    select 1 from jsonb_array_elements_text(p_escopo->'numeros') n
     where n::int < 1 or n::int > coalesce(v_max, 16)
  ) then
    return jsonb_build_object('error', 'encontro fora da trilha desta dupla');
  end if;
  if exists (
    select 1 from public.encontros e
     where e.dupla_id = p_dupla and e.status = 'realizado'
       and e.numero in (select n::int from jsonb_array_elements_text(p_escopo->'numeros') n)
  ) then
    return jsonb_build_object('error', 'encontro já realizado não entra no plano');
  end if;

  v_ritmo := coalesce((p_escopo->>'ritmo')::int, 2);
  if v_ritmo < 1 then
    return jsonb_build_object('error', 'o ritmo precisa ser de pelo menos 1 encontro por semana');
  end if;
  begin
    v_ini := (p_escopo->'janela'->>'inicio')::date;
    v_fim := (p_escopo->'janela'->>'fim')::date;
  exception when others then
    return jsonb_build_object('error', 'janela do plano inválida');
  end;
  if v_ini is null or v_fim is null or v_ini > v_fim then
    return jsonb_build_object('error', 'janela do plano inválida');
  end if;
  if v_ini < v_hoje then
    return jsonb_build_object('error', 'a janela do plano não pode começar no passado');
  end if;

  -- a dupla precisa ter decidido cada recesso que cruza a janela
  if exists (
    select 1 from public.ciclo_eventos ev
     where ev.cronograma_id = v_d.cronograma_id
       and ev.tipo = 'recesso'
       and ev.data is not null
       and ev.data <= v_fim
       and coalesce(ev.data_fim, ev.data) >= v_ini
       and not exists (
         select 1 from public.dupla_recessos r
          where r.dupla_id = p_dupla
            and r.ciclo_evento_id = ev.id)
  ) then
    return jsonb_build_object('error', 'falta a dupla confirmar o recesso');
  end if;

  -- cada data sugerida: do escopo, dentro da janela, nunca no passado e
  -- fora de recesso que a dupla vai usar (a decisão usa=false libera)
  if jsonb_typeof(p_escopo->'passos') is distinct from 'array'
     or jsonb_array_length(p_escopo->'passos') = 0 then
    return jsonb_build_object('error', 'o plano precisa das datas sugeridas de cada encontro');
  end if;
  begin
    for v_passo in
      select (x->>'numero')::int as numero, (x->>'data')::date as data
        from jsonb_array_elements(p_escopo->'passos') x
    loop
      if v_passo.numero is null or not exists (
        select 1 from jsonb_array_elements_text(p_escopo->'numeros') n
         where n::int = v_passo.numero) then
        return jsonb_build_object('error', 'cada data do plano precisa ser de um encontro do plano');
      end if;
      if v_passo.data is null or v_passo.data < v_hoje then
        return jsonb_build_object('error', 'nenhuma data do plano pode ficar no passado');
      end if;
      if v_passo.data < v_ini or v_passo.data > v_fim then
        return jsonb_build_object('error', 'as datas do plano precisam ficar dentro da janela');
      end if;
      if exists (
        select 1 from public.ciclo_eventos ev
         where ev.cronograma_id = v_d.cronograma_id
           and ev.tipo = 'recesso'
           and ev.data is not null
           and v_passo.data between ev.data and coalesce(ev.data_fim, ev.data)
           and not exists (
             select 1 from public.dupla_recessos r
              where r.dupla_id = p_dupla
                and r.ciclo_evento_id = ev.id
                and r.usa = false)
      ) then
        return jsonb_build_object('error', 'uma das datas cai no recesso que a dupla vai usar');
      end if;
    end loop;
  exception when invalid_text_representation or datetime_field_overflow
                 or invalid_datetime_format then
    return jsonb_build_object('error', 'datas do plano inválidas');
  end;

  v_vers := 1 + coalesce((
    select max(p.versao) from public.dupla_planos p where p.dupla_id = p_dupla), 0);

  insert into public.dupla_planos
    (dupla_id, escopo, versao, proposto_por, proposto_via, expira_em,
     status, aceito_mentor_em, aceito_mentorado_em,
     aprovado_por, aprovado_lado, aprovado_em)
  values (p_dupla, p_escopo, v_vers, v_eu, p_via, now() + interval '14 days',
          case when v_propoe_parceiro then 'aceito' else 'proposto' end,
          case when v_mentor_propoe then now() end,
          case when v_mentorado_propoe then now() end,
          case when v_propoe_parceiro then v_eu end,
          case when v_mentor_propoe then 'mentor'
               when v_mentorado_propoe then 'mentorado' end,
          case when v_propoe_parceiro then now() end)
  returning id into v_id;

  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, para, por, meta)
  values (v_id, p_dupla, 'proposto', 'proposto', v_eu,
          jsonb_build_object('versao', v_vers, 'via', p_via));
  if v_propoe_parceiro then
    insert into public.dupla_plano_eventos
      (plano_id, dupla_id, tipo, de, para, por, meta)
    values (v_id, p_dupla, 'aceito', 'proposto',
            case when v_propoe_parceiro then 'aceito' else 'proposto' end, v_eu,
            jsonb_build_object('lado', case when v_mentor_propoe then 'mentor'
                                             when v_mentorado_propoe then 'mentorado' end,
                               'na_proposta', true));
  end if;

  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;

  -- A copy nasce com autoria no banco (não só na leitura da UI): o outro
  -- lado vê "{Fulano} combinou" quando a proposta de membro já nasce em
  -- vigor, ou "{Fulano} propôs" quando é a equipe que propõe. A Liza fala
  -- por si quando a via é ela; staff sem nome resolvido cai em "A equipe".
  if p_via = 'liza' then
    v_quem := 'A Liza';
  else
    if v_mentorado_propoe then
      select coalesce(m.nome_social, m.nome) into v_quem
        from public.mentorados m where m.id = v_d.mentorado_id;
    else
      select coalesce(pr.nome_social, pr.nome) into v_quem
        from public.profiles pr where pr.id = v_eu;
    end if;
    v_quem := coalesce(
      nullif(split_part(coalesce(v_quem, ''), ' ', 1), ''),
      'A equipe');
  end if;

  if v_propoe_parceiro then
    v_titulo := 'Plano "ficar em dia" em vigor';
    v_corpo := v_quem || ' combinou o plano. Ele já está em vigor; veja as datas combinadas.';
  else
    v_titulo := 'Plano "ficar em dia" proposto';
    v_corpo := v_quem || ' propôs um plano pra vocês. Veja as datas e responda: um aceite da dupla já coloca o combinado em vigor.';
  end if;

  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'plano_proposto', v_titulo, v_corpo,
           case when dest.role = 'mentorado' then '/jovem/agenda#plano'
                else '/duplas/' || p_dupla || '#plano-em-dia' end,
           v_eu
      from public.profiles dest
     where dest.id = any (array[v_d.mentor_id, v_jovem])
       and dest.id is distinct from v_eu;

  return jsonb_build_object('ok', true, 'id', v_id, 'versao', v_vers,
                            'status', case when v_propoe_parceiro then 'aceito' else 'proposto' end);
end $function$;

revoke all on function public.plano_propor(uuid, jsonb, text) from public, anon;
grant execute on function public.plano_propor(uuid, jsonb, text) to authenticated;

commit;
