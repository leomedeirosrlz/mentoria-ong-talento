-- 0224 — plano "ficar em dia": aceite dos dois lados, ritmo até 1 encontro
-- por dia, supervisor propõe e prazo de aceite (REALIZA-513, spec 013).
--
-- A 0219 guardava um lado só (aprovado_lado) e o primeiro "aceitar" já
-- levava o plano a 'aceito', o que liberava plano_aplicar_passo. Aqui cada
-- lado ganha o próprio carimbo e o plano só sai de 'proposto' quando os
-- dois aceitam. plano_aplicar_passo não muda: segue exigindo 'aceito' ou
-- 'ativo', que agora quer dizer os dois de acordo. aprovado_* continua
-- gravando o PRIMEIRO lado que aceitou (leitura antiga segue valendo).
--
-- Também:
--   · plano_propor aceita o supervisor da dupla (matriz da spec 013) e
--     ritmo 1..7 (7 = 1 por dia); o mentor que propõe já conta como o
--     aceite do lado dele; as datas sugeridas não podem estar no passado
--     nem cair em recesso que a dupla vai usar; o prazo pra aceitar é de
--     14 dias;
--   · o aceite final estende expira_em até 7 dias depois do fim da janela:
--     com os 28 dias da 0219, um plano de 23/11 até 15/01 expirava ativo
--     em 21/12 pelo plano_ciclo;
--   · jovem_plano devolve os dois aceites e a data da proposta.
--
-- Retroativo: os planos existentes ganham o carimbo do lado gravado na
-- 0219 e o do segundo aceite que só ficou no histórico; status de plano
-- já aceito/ativo não regride.

begin;

alter table public.dupla_planos
  add column aceito_mentor_em timestamptz,
  add column aceito_mentorado_em timestamptz;

comment on column public.dupla_planos.aceito_mentor_em is
  'Quando o mentor aceitou o plano (0224). Mentor que propõe aceita na proposta.';
comment on column public.dupla_planos.aceito_mentorado_em is
  'Quando o mentorado aceitou o plano (0224). O plano só vira aceito com os dois carimbos.';

update public.dupla_planos p
   set aceito_mentor_em = coalesce(
         case when p.aprovado_lado = 'mentor' then p.aprovado_em end,
         (select min(e.em) from public.dupla_plano_eventos e
           where e.plano_id = p.id and e.tipo = 'aceito'
             and e.meta->>'lado' = 'mentor')),
       aceito_mentorado_em = coalesce(
         case when p.aprovado_lado = 'mentorado' then p.aprovado_em end,
         (select min(e.em) from public.dupla_plano_eventos e
           where e.plano_id = p.id and e.tipo = 'aceito'
             and e.meta->>'lado' = 'mentorado'))
 where p.aprovado_lado is not null
    or exists (select 1 from public.dupla_plano_eventos e
                where e.plano_id = p.id and e.tipo = 'aceito');

-- ============ plano_propor ============
create or replace function public.plano_propor(
  p_dupla uuid,
  p_escopo jsonb,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  v_jovem uuid;
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
  if not (
    public.my_role() = 'coordenacao'
    or v_mentor_propoe
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
  if v_ritmo < 1 or v_ritmo > 7 then
    return jsonb_build_object('error', 'o ritmo precisa ficar entre 1 e 7 encontros por semana');
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
     aceito_mentor_em, aprovado_por, aprovado_lado, aprovado_em)
  values (p_dupla, p_escopo, v_vers, v_eu, p_via, now() + interval '14 days',
          case when v_mentor_propoe then now() end,
          case when v_mentor_propoe then v_eu end,
          case when v_mentor_propoe then 'mentor' end,
          case when v_mentor_propoe then now() end)
  returning id into v_id;

  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, para, por, meta)
  values (v_id, p_dupla, 'proposto', 'proposto', v_eu,
          jsonb_build_object('versao', v_vers, 'via', p_via));
  if v_mentor_propoe then
    insert into public.dupla_plano_eventos
      (plano_id, dupla_id, tipo, de, para, por, meta)
    values (v_id, p_dupla, 'aceito', 'proposto', 'proposto', v_eu,
            jsonb_build_object('lado', 'mentor', 'na_proposta', true));
  end if;

  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'plano_proposto',
           'Plano "ficar em dia" proposto',
           'Tem um plano pra vocês ficarem em dia. Veja as datas e responda: ele começa a valer quando os dois aceitarem.',
           case when dest.role = 'mentorado' then '/jovem/agenda#plano'
                else '/duplas/' || p_dupla || '#plano-em-dia' end,
           v_eu
      from public.profiles dest
     where dest.id = any (array[v_d.mentor_id, v_jovem])
       and dest.id is distinct from v_eu;

  return jsonb_build_object('ok', true, 'id', v_id, 'versao', v_vers,
                            'status', 'proposto');
end $$;

revoke all on function public.plano_propor(uuid, jsonb, text) from public, anon;
grant execute on function public.plano_propor(uuid, jsonb, text) to authenticated;

-- ============ plano_responder ============
-- Só a dupla responde. Aceitar carimba o lado de quem responde; o segundo
-- carimbo leva o plano a 'aceito'. Contestar segue terminal e só vale até
-- um encontro do escopo acontecer.
create or replace function public.plano_responder(
  p_plano uuid,
  p_acao text,
  p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p public.dupla_planos%rowtype;
  v_d record;
  v_lado text;
  v_jovem uuid;
  v_mentor_em timestamptz;
  v_mentorado_em timestamptz;
  v_final boolean;
  v_status text;
  v_nome text;
begin
  if p_acao not in ('aceitar','contestar') then
    return jsonb_build_object('error', 'ação inválida');
  end if;

  select * into v_p from public.dupla_planos p where p.id = p_plano for update;
  if not found then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;
  select d.mentor_id, d.mentorado_id into v_d
    from public.duplas d where d.id = v_p.dupla_id;

  v_lado := case
    when v_d.mentor_id = public.my_profile_id() then 'mentor'
    when v_d.mentorado_id = public.my_mentorado_id() then 'mentorado'
  end;
  if v_lado is null then
    return jsonb_build_object('error', 'só a dupla responde o plano');
  end if;
  if v_p.status not in ('proposto','aceito','ativo') then
    return jsonb_build_object('error', 'esse plano não está mais aberto');
  end if;

  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;

  if p_acao = 'aceitar' then
    if (v_lado = 'mentor' and v_p.aceito_mentor_em is not null)
       or (v_lado = 'mentorado' and v_p.aceito_mentorado_em is not null) then
      return jsonb_build_object('ok', true, 'idempotente', true, 'status', v_p.status);
    end if;
    v_mentor_em := coalesce(v_p.aceito_mentor_em,
                            case when v_lado = 'mentor' then now() end);
    v_mentorado_em := coalesce(v_p.aceito_mentorado_em,
                               case when v_lado = 'mentorado' then now() end);
    v_final := v_mentor_em is not null and v_mentorado_em is not null;
    v_status := case when v_p.status = 'proposto' and v_final then 'aceito'
                     else v_p.status end;

    update public.dupla_planos
       set status = v_status,
           aceito_mentor_em = v_mentor_em,
           aceito_mentorado_em = v_mentorado_em,
           aprovado_por = coalesce(aprovado_por, public.my_profile_id()),
           aprovado_lado = coalesce(aprovado_lado, v_lado),
           aprovado_em = coalesce(aprovado_em, now()),
           -- combinado fechado vale a janela inteira e mais uma semana de
           -- folga pro último registro, contada no fuso do programa
           expira_em = case when v_final then greatest(
                         expira_em,
                         ((escopo->'janela'->>'fim')::date + 8)::timestamp
                           at time zone 'America/Sao_Paulo')
                       else expira_em end,
           updated_at = now()
     where id = p_plano;
    insert into public.dupla_plano_eventos
      (plano_id, dupla_id, tipo, de, para, por, meta)
    values (p_plano, v_p.dupla_id, 'aceito', v_p.status, v_status,
            public.my_profile_id(),
            jsonb_build_object('lado', v_lado, 'final', v_final));

    if v_final then
      insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
        select dest.id, 'plano_aceito',
               'Plano "ficar em dia" combinado',
               'Vocês dois aceitaram o plano. Agora é marcar cada encontro nas datas combinadas.',
               case when dest.role = 'mentorado' then '/jovem/agenda#plano'
                    else '/duplas/' || v_p.dupla_id || '#plano-em-dia' end,
               public.my_profile_id()
          from public.profiles dest
         where dest.id = any (array[v_d.mentor_id, v_jovem])
           and dest.id is distinct from public.my_profile_id();
    else
      if v_lado = 'mentor' then
        select coalesce(pr.nome_social, pr.nome) into v_nome
          from public.profiles pr where pr.id = v_d.mentor_id;
      else
        select coalesce(m.nome_social, m.nome) into v_nome
          from public.mentorados m where m.id = v_d.mentorado_id;
      end if;
      insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
        select dest.id, 'plano_aceito',
               'Falta o seu aceite no plano "ficar em dia"',
               coalesce(split_part(v_nome, ' ', 1), 'A outra parte da dupla')
                 || ' já aceitou. O plano começa a valer quando você aceitar também.',
               case when dest.role = 'mentorado' then '/jovem/agenda#plano'
                    else '/duplas/' || v_p.dupla_id || '#plano-em-dia' end,
               public.my_profile_id()
          from public.profiles dest
         where dest.id = case when v_lado = 'mentor' then v_jovem
                              else v_d.mentor_id end;
    end if;
    return jsonb_build_object('ok', true, 'status', v_status, 'final', v_final);
  end if;

  -- contestar: só até um encontro do escopo acontecer de fato
  if exists (
    select 1 from public.encontros e
     where e.dupla_id = v_p.dupla_id and e.status = 'realizado'
       and e.numero in (select n::int from jsonb_array_elements_text(v_p.escopo->'numeros') n)
       and e.realizado_em >= coalesce(v_p.aprovado_em, v_p.created_at)
  ) then
    return jsonb_build_object('error', 'o plano já teve encontro acontecendo. Fale com a coordenação');
  end if;

  update public.dupla_planos
     set status = 'contestado',
         contestado_por = public.my_profile_id(),
         contestado_motivo = nullif(btrim(p_motivo), ''),
         contestado_em = now(),
         updated_at = now()
   where id = p_plano;
  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, de, para, motivo, por, meta)
  values (p_plano, v_p.dupla_id, 'contestado', v_p.status, 'contestado',
          nullif(btrim(p_motivo), ''), public.my_profile_id(),
          jsonb_build_object('lado', v_lado));
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'plano_contestado',
           'Plano "ficar em dia" contestado',
           'O plano não combinou com um dos lados. Conversem e, se fizer sentido, uma nova versão pode ser proposta.',
           case when dest.role = 'mentorado' then '/jovem/agenda#plano'
                else '/duplas/' || v_p.dupla_id || '#plano-em-dia' end,
           public.my_profile_id()
      from public.profiles dest
     where dest.id = any (array[v_d.mentor_id, v_jovem])
       and dest.id is distinct from public.my_profile_id();
  return jsonb_build_object('ok', true, 'status', 'contestado');
end $$;

revoke all on function public.plano_responder(uuid, text, text) from public, anon;
grant execute on function public.plano_responder(uuid, text, text) to authenticated;

-- ============ jovem_plano — recorte do mentorado ============
-- Mesmo recorte da 0219 (sem semáforo nem motivo interno), mais os dois
-- aceites e a data da proposta: o card do jovem diz "falta você" ou
-- "falta seu mentor" sem ler dupla_plano_eventos.
create or replace function public.jovem_plano()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
  v_p record;
begin
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  select d.id into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  select p.* into v_p
    from dupla_planos p
   where p.dupla_id = v_dupla.id
   order by (p.status in ('proposto','aceito','ativo')) desc,
            p.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'status', v_p.status,
    'versao', v_p.versao,
    'ritmo', v_p.escopo->>'ritmo',
    'janela', v_p.escopo->'janela',
    'passos', v_p.escopo->'passos',
    'aprovado_lado', v_p.aprovado_lado,
    'aceito_mentor', v_p.aceito_mentor_em is not null,
    'aceito_mentorado', v_p.aceito_mentorado_em is not null,
    'proposto_em', v_p.created_at,
    'expira_em', v_p.expira_em,
    'concluido_em', v_p.concluido_em,
    'passos_aplicados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', s.numero, 'data_nova', s.data_nova,
               'aplicado_em', s.aplicado_em) order by s.numero)
        from dupla_plano_passos s
       where s.plano_id = v_p.id), '[]'::jsonb)
  );
end $$;

revoke all on function public.jovem_plano() from public, anon;
grant execute on function public.jovem_plano() to authenticated;

commit;
