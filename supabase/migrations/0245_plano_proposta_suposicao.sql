-- 0245 — proposta de plano com suposição de recesso (proposta-sem-recesso)
--
-- Até aqui ninguém propunha plano "ficar em dia" enquanto a dupla não
-- decidisse o recesso: a plano_propor recusava e a declarar_recesso só
-- aceita mentor/mentorado. Propor não é decidir pela dupla — a equipe
-- propõe com suposição explícita no escopo
-- (decisoes.recessos[].origem='proposta'), nada entra em dupla_recessos na
-- proposta e a decisão real se grava no aceite, com autoria de quem
-- respondeu. Sem DDL: tudo no jsonb do escopo.
--
-- plano_propor (reemite a 0237 com o delta):
--   · suposição válida = origem='proposta' + recesso com data do
--     cronograma da dupla + proponente fora da dupla (equipe). Membro da
--     dupla cobrindo pendência por suposição é recusado — a decisão dele
--     se declara de verdade (declarar_recesso).
--   · recesso pendente na janela deixa de bloquear quando suposição
--     válida cobre; a validação de datas usa a decisão efetiva (row
--     usa=false ou suposição usa=false libera; usa=true/ausente bloqueia
--     como antes).
--   · proposta que assumiu recesso grava assumido:true na raiz do escopo
--     e a notificação explica a suposição pra dupla.
-- plano_responder (assinatura ganha p_decisoes — dropa o overload e
-- recria): no aceite resolve cada suposição ainda pendente (usa final =
-- decisão do aceite quando veio, senão a suposição), revalida as datas
-- do escopo sob a decisão final antes de qualquer escrita e grava cada
-- pendência em dupla_recessos com autoria de quem aceitou.
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
  v_s record;
  v_ev_id uuid;
  v_sup jsonb := '{}'::jsonb;
  v_assumiu boolean := false;
  v_sup_pausa boolean := true;
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
  v_mentorado_propoe := public.my_mentorado_id() is not null
                    and v_d.mentorado_id is not distinct from public.my_mentorado_id();
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

  -- suposições da proposta: a equipe "assume" o recesso pra destravar a
  -- proposta SEM gravar decisão — quem decide é a dupla, no aceite (a
  -- plano_responder persiste). Só vale origem='proposta' em recesso com
  -- data do cronograma da dupla e ainda sem decisão; entrada inválida (id
  -- que não vira uuid ou evento que não é recesso) é ignorada e a
  -- checagem de pendência abaixo continua recusando.
  if jsonb_typeof(p_escopo->'decisoes'->'recessos') = 'array' then
    for v_s in
      select x from jsonb_array_elements(p_escopo->'decisoes'->'recessos') x
    loop
      if coalesce(v_s.x->>'origem', '') <> 'proposta' then
        continue;
      end if;
      begin
        v_ev_id := (v_s.x->>'cicloEventoId')::uuid;
      exception when others then
        continue;
      end;
      if v_ev_id is null then
        continue;
      end if;
      perform 1
        from public.ciclo_eventos ev
       where ev.id = v_ev_id
         and ev.cronograma_id = v_d.cronograma_id
         and ev.tipo = 'recesso'
         and ev.data is not null;
      if not found then
        continue;
      end if;
      if exists (
        select 1 from public.dupla_recessos r
         where r.dupla_id = p_dupla and r.ciclo_evento_id = v_ev_id
      ) then
        continue;
      end if;
      if v_propoe_parceiro then
        return jsonb_build_object('error',
          'a decisão do recesso é da dupla. Declare o recesso em vez de assumir na proposta');
      end if;
      v_sup := jsonb_set(v_sup, array[v_ev_id::text],
        to_jsonb(case when jsonb_typeof(v_s.x->'usa') = 'boolean'
                      then (v_s.x->>'usa')::boolean
                      else true end));
    end loop;
  end if;

  -- a dupla precisa ter decidido cada recesso que cruza a janela — ou a
  -- proposta cobre a pendência com suposição válida da equipe
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
       and not (v_sup ? ev.id::text)
  ) then
    return jsonb_build_object('error', 'falta a dupla confirmar o recesso');
  end if;

  -- a proposta nasce "assumida" quando ao menos uma suposição válida cobre
  -- recesso pendente que cruza a janela; v_sup_pausa diz se ela considera
  -- pausa (algum usa=true) ou seguir no recesso, pra copy da notificação
  select bool_or(true),
         coalesce(bool_or((v_sup->>ev.id::text)::boolean), true)
    into v_assumiu, v_sup_pausa
    from public.ciclo_eventos ev
   where ev.cronograma_id = v_d.cronograma_id
     and ev.tipo = 'recesso'
     and ev.data is not null
     and ev.data <= v_fim
     and coalesce(ev.data_fim, ev.data) >= v_ini
     and not exists (
       select 1 from public.dupla_recessos r
        where r.dupla_id = p_dupla and r.ciclo_evento_id = ev.id)
     and v_sup ? ev.id::text;
  v_assumiu := coalesce(v_assumiu, false);
  v_sup_pausa := coalesce(v_sup_pausa, true);

  -- cada data sugerida: do escopo, dentro da janela, nunca no passado e
  -- fora de recesso em pausa — a decisão efetiva é a row da dupla quando
  -- existe, senão a suposição válida (usa=false libera a data no recesso)
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
           and coalesce(
                 (select r.usa
                    from public.dupla_recessos r
                   where r.dupla_id = p_dupla
                     and r.ciclo_evento_id = ev.id),
                 (v_sup->>ev.id::text)::boolean,
                 true)
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

  -- quem propõe não decide pela dupla: assumido marca na raiz do escopo
  -- que a proposta nasceu coberta por suposição (o aceite grava a decisão
  -- real em dupla_recessos com autoria de quem respondeu)
  if v_assumiu then
    p_escopo := jsonb_set(p_escopo, '{assumido}', 'true'::jsonb, true);
  else
    -- escopo montado fora da RPC não pode forjar o carimbo: só a validação
    -- acima decide se a proposta realmente assumiu recesso pendente
    p_escopo := p_escopo - 'assumido';
  end if;

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

  -- proposta que assumiu recesso pendente avisa a suposição no sino: a
  -- dupla confirma ou troca a decisão no aceite
  if v_assumiu then
    v_corpo := v_corpo || ' '
      || case when v_sup_pausa
           then 'A proposta considera pausa no recesso; confirme ou troque antes de aceitar.'
           else 'A proposta considera seguir no recesso; confirme ou troque antes de aceitar.'
         end;
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


-- plano_responder ganha p_decisoes: o overload antigo não pode ficar vivo
-- (duas assinaturas divergindo), então dropa e recria com revoke/grant
drop function public.plano_responder(uuid, text, text);

create or replace function public.plano_responder(
  p_plano uuid,
  p_acao text,
  p_motivo text default null,
  p_decisoes jsonb default null
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
  v_ativou boolean;
  v_status text;
  v_nome text;
  v_s record;
  v_passo record;
  v_ev_id uuid;
  v_ev_ini date;
  v_ev_fim date;
  v_usa boolean;
  v_dec jsonb := '{}'::jsonb;
  v_pends jsonb := '[]'::jsonb;
begin
  if p_acao not in ('aceitar','contestar') then
    return jsonb_build_object('error', 'ação inválida');
  end if;

  select * into v_p from public.dupla_planos p where p.id = p_plano for update;
  if not found then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;
  select d.mentor_id, d.mentorado_id, d.cronograma_id into v_d
    from public.duplas d where d.id = v_p.dupla_id;

  v_lado := case
    when v_d.mentor_id = public.my_profile_id() then 'mentor'
    when public.my_mentorado_id() is not null
         and v_d.mentorado_id = public.my_mentorado_id() then 'mentorado'
  end;
  if v_lado is null then
    return jsonb_build_object('error', 'só a dupla responde o plano');
  end if;
  if v_p.status not in ('proposto','aceito','ativo') then
    return jsonb_build_object('error', 'esse plano não está mais aberto');
  end if;

  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;

  if p_acao = 'aceitar' then
    -- retry do mesmo lado é idempotente antes de qualquer revalidação ou
    -- escrita: quem já carimbou não troca a resposta repetindo o gesto
    if (v_lado = 'mentor' and v_p.aceito_mentor_em is not null)
       or (v_lado = 'mentorado' and v_p.aceito_mentorado_em is not null) then
      return jsonb_build_object('ok', true, 'idempotente', true, 'status', v_p.status);
    end if;

    -- decisões explícitas do aceite ({cicloEventoId, usa}): entrada sem
    -- uuid ou sem usa booleano não conta e a suposição decide
    if jsonb_typeof(p_decisoes) = 'array' then
      for v_s in
        select x from jsonb_array_elements(p_decisoes) x
      loop
        begin
          v_ev_id := (v_s.x->>'cicloEventoId')::uuid;
        exception when others then
          continue;
        end;
        if v_ev_id is not null
           and jsonb_typeof(v_s.x->'usa') = 'boolean' then
          v_dec := jsonb_set(v_dec, array[v_ev_id::text], v_s.x->'usa');
        end if;
      end loop;
    end if;

    -- suposições da proposta ainda pendentes: a decisão final é a do
    -- aceite quando veio, senão a própria suposição (usa default true).
    -- A revalidação roda ANTES de qualquer escrita: usa=true final com
    -- passo dentro da janela do recesso muda as datas — aí a saída é
    -- contestar e recalcular, não gravar combinado que já não vale
    if jsonb_typeof(v_p.escopo->'decisoes'->'recessos') = 'array' then
      for v_s in
        select x from jsonb_array_elements(v_p.escopo->'decisoes'->'recessos') x
      loop
        if coalesce(v_s.x->>'origem', '') <> 'proposta' then
          continue;
        end if;
        begin
          v_ev_id := (v_s.x->>'cicloEventoId')::uuid;
        exception when others then
          continue;
        end;
        if v_ev_id is null then
          continue;
        end if;
        if exists (
          select 1 from public.dupla_recessos r
           where r.dupla_id = v_p.dupla_id
             and r.ciclo_evento_id = v_ev_id
        ) then
          continue;
        end if;
        select ev.data, coalesce(ev.data_fim, ev.data)
          into v_ev_ini, v_ev_fim
          from public.ciclo_eventos ev
         where ev.id = v_ev_id
           and ev.cronograma_id = v_d.cronograma_id
           and ev.tipo = 'recesso'
           and ev.data is not null;
        if not found then
          continue;
        end if;
        v_usa := coalesce(
          (v_dec->>v_ev_id::text)::boolean,
          case when jsonb_typeof(v_s.x->'usa') = 'boolean'
               then (v_s.x->>'usa')::boolean end,
          true);
        if v_usa and jsonb_typeof(v_p.escopo->'passos') = 'array' then
          begin
            for v_passo in
              select (sp->>'data')::date as data
                from jsonb_array_elements(v_p.escopo->'passos') sp
            loop
              if v_passo.data is not null
                 and v_passo.data between v_ev_ini and v_ev_fim then
                return jsonb_build_object('error',
                  'essa decisão muda as datas do plano. Conteste e proponha a versão recalculada');
              end if;
            end loop;
          exception when invalid_text_representation or datetime_field_overflow
                       or invalid_datetime_format then
            return jsonb_build_object('error', 'datas do plano inválidas');
          end;
        end if;
        v_pends := v_pends || jsonb_build_object(
          'evento', v_ev_id, 'usa', v_usa);
      end loop;
    end if;

    -- revalidação final de TODA data persistida sob a decisão efetiva de
    -- cada recesso da janela: rows que já existiam (inclusive declaradas
    -- entre proposta e aceite) + as pendências que este aceite resolve.
    -- Sem isso, virar usa=true depois de uma proposta que assumiu seguir
    -- aceitaria datas combinadas dentro do recesso pausado. Valida antes
    -- do primeiro write; conflito pede contestação/recálculo, não aceite.
    if jsonb_typeof(v_p.escopo->'passos') = 'array' then
      begin
        if exists (
          select 1
            from public.ciclo_eventos ev
            join jsonb_array_elements(v_p.escopo->'passos') sp on true
           where ev.cronograma_id = v_d.cronograma_id
             and ev.tipo = 'recesso'
             and ev.data is not null
             and ev.data <= (v_p.escopo->'janela'->>'fim')::date
             and coalesce(ev.data_fim, ev.data) >=
                   (v_p.escopo->'janela'->>'inicio')::date
             and (sp->>'data')::date between ev.data and coalesce(ev.data_fim, ev.data)
             and coalesce(
                   (select r.usa
                      from public.dupla_recessos r
                     where r.dupla_id = v_p.dupla_id
                       and r.ciclo_evento_id = ev.id),
                   (select (x->>'usa')::boolean
                      from jsonb_array_elements(v_pends) x
                     where (x->>'evento')::uuid = ev.id
                     limit 1),
                   true)
        ) then
          return jsonb_build_object('error',
            'essa decisão muda as datas do plano. Conteste e proponha a versão recalculada');
        end if;
      exception when invalid_text_representation or datetime_field_overflow
                   or invalid_datetime_format then
        return jsonb_build_object('error', 'datas do plano inválidas');
      end;
    end if;

    -- validação completa: agora grava cada decisão pendente com a autoria
    -- de quem aceitou, sem tocar em decisões que já existiam
    if jsonb_array_length(v_pends) > 0 then
      insert into public.dupla_recessos
        (dupla_id, ciclo_evento_id, usa, declarado_por, declarado_em)
      select v_p.dupla_id, (x->>'evento')::uuid, (x->>'usa')::boolean,
             public.my_profile_id(), now()
        from jsonb_array_elements(v_pends) x
      on conflict (dupla_id, ciclo_evento_id) do nothing;
    end if;

    v_mentor_em := coalesce(v_p.aceito_mentor_em,
                            case when v_lado = 'mentor' then now() end);
    v_mentorado_em := coalesce(v_p.aceito_mentorado_em,
                               case when v_lado = 'mentorado' then now() end);
    v_final := v_mentor_em is not null or v_mentorado_em is not null;
    v_ativou := v_p.status = 'proposto' and v_final;
    v_status := case when v_ativou then 'aceito' else v_p.status end;

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

    if v_lado = 'mentor' then
      select coalesce(pr.nome_social, pr.nome) into v_nome
        from public.profiles pr where pr.id = v_d.mentor_id;
    else
      select coalesce(m.nome_social, m.nome) into v_nome
        from public.mentorados m where m.id = v_d.mentorado_id;
    end if;
    if v_ativou then
      insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
        select dest.id, 'plano_aceito',
               'Plano "ficar em dia" em vigor',
               coalesce(split_part(v_nome, ' ', 1), 'A outra parte da dupla')
                 || ' aceitou o plano. Ele já está em vigor; veja as datas combinadas.',
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

revoke all on function public.plano_responder(uuid, text, text, jsonb) from public, anon;
grant execute on function public.plano_responder(uuid, text, text, jsonb) to authenticated;

-- jovem_plano (reemite a 0232): o recorte do mentorado também carrega as
-- decisões do escopo e o carimbo `assumido`. Sem isso o mentor vê o aviso
-- da suposição e o jovem não — os dois são a dupla que confirma ou troca.
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
    'decisoes', v_p.escopo->'decisoes',
    'assumido', coalesce((v_p.escopo->>'assumido')::boolean, false),
    'aprovado_lado', v_p.aprovado_lado,
    'proposto_por', v_p.proposto_por,
    'proposto_via', v_p.proposto_via,
    'aceito_mentor', v_p.aceito_mentor_em is not null,
    'aceito_mentorado', v_p.aceito_mentorado_em is not null,
    'proposto_em', v_p.created_at,
    'aprovado_em', v_p.aprovado_em,
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
