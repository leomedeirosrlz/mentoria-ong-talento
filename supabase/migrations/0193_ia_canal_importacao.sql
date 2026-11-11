-- 0193 ia_canal_importacao — canal 'importacao' na auditoria da camada de IA
-- (REALIZA-180 fase 1: match semântico sobre as linhas 'manual' do import CSV).
--
-- A importação assistida grava ia_eventos como todo canal: um evento
-- 'mensagem' de reserva (consumir_limite_ia) + um por chamada
-- match_semantico (registrar_ia_eventos_lote), agrupados por args->>'lote'.
-- Até aqui o vocabulário era ('chat','mcp') em 5 pontos — o CHECK da tabela
-- e o guard das 4 funções de escrita/limite. Esta migration escreve a UNIÃO
-- dos canais conhecidos ('chat','mcp','importacao'): spec futura que adicione
-- canal estende pela mesma régua, nunca remove. As 4 funções voltam
-- verbatim (0159/0160) — só a lista de canais muda; assinaturas intactas.
--
-- Blast radius: zero pra dados (CHECK só valida insert novo; 'chat'/'mcp'
-- seguem valendo). As funções são security definer internas — mesmos grants.

begin;

-- ---- CHECK da coluna ----
alter table public.ia_eventos drop constraint if exists ia_eventos_canal_check;
alter table public.ia_eventos
  add constraint ia_eventos_canal_check
  check (canal in ('chat', 'mcp', 'importacao'));

-- ---- registrar_ia_evento (definição vigente: 0159) ----
create or replace function public.registrar_ia_evento(
  p_canal text,
  p_tool text,
  p_args jsonb,
  p_ok boolean,
  p_erro text default null,
  p_duracao_ms int default null,
  p_profile_id uuid default null,
  p_modelo text default null,
  p_tier text default null,
  p_tokens_in int default null,
  p_tokens_out int default null,
  p_tokens_reasoning int default null,
  p_cache_read int default null,
  p_custo_usd numeric default null,
  p_allowance_usd numeric default null,
  p_billing_source text default null,
  p_request_id uuid default null,
  p_iteracoes int default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_dono uuid;
begin
  if p_canal not in ('chat', 'mcp', 'importacao') then
    raise exception 'canal inválido';
  end if;
  -- o autor declarado só vale pra service_role (MCP legado); caller comum
  -- carimba o próprio JWT — sem forjar evento no nome de outro
  v_dono := case
    when auth.jwt() ->> 'role' = 'service_role'
      then coalesce(p_profile_id, public.my_profile_id())
    else public.my_profile_id()
  end;
  insert into public.ia_eventos (
      profile_id, canal, tool, args, ok, erro, duracao_ms,
      modelo, tier, tokens_in, tokens_out, tokens_reasoning, cache_read,
      custo_usd, allowance_usd, billing_source, request_id, iteracoes
    )
    values (
      v_dono, p_canal, p_tool, coalesce(p_args, '{}'::jsonb), p_ok, p_erro,
      p_duracao_ms, p_modelo, p_tier, p_tokens_in, p_tokens_out,
      p_tokens_reasoning, p_cache_read, p_custo_usd, p_allowance_usd,
      p_billing_source, p_request_id, p_iteracoes
    )
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  from public, anon;
grant execute on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  to authenticated;

-- ---- consumir_limite_ia (definição vigente: 0159) ----
create or replace function public.consumir_limite_ia(
  p_args jsonb default '{}'::jsonb,
  p_limite int default 20,
  p_canal text default 'chat'
)
returns table (permitido boolean, usados int, request_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.my_profile_id();
  v_usados int;
  v_req uuid := gen_random_uuid();
begin
  if v_uid is null or p_canal not in ('chat', 'mcp', 'importacao') then
    return query select false, 0, v_req; return;
  end if;
  -- serializa o par check+insert por profile: dois requests paralelos viram
  -- veredictos sequenciais — o segundo já conta o evento do primeiro
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_usados
    from public.ia_eventos e
   where e.profile_id = v_uid
     and e.tool = 'mensagem'
     and e.created_at > now() - interval '60 seconds';
  if v_usados >= p_limite then
    return query select false, v_usados, v_req; return;
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, duracao_ms, request_id)
    values (v_uid, p_canal, 'mensagem', coalesce(p_args, '{}'::jsonb), true, 0, v_req);
  return query select true, v_usados + 1, v_req;
end $$;

revoke all on function public.consumir_limite_ia(jsonb, int, text) from public, anon;
grant execute on function public.consumir_limite_ia(jsonb, int, text) to authenticated;

-- ---- ia_contexto_e_limite (definição vigente: 0160) ----
create or replace function public.ia_contexto_e_limite(
  p_args jsonb default '{}'::jsonb,
  p_limite int default 20,
  p_canal text default 'chat'
)
returns table (
  profile_id uuid,
  role public.app_role,
  papeis public.app_role[],
  permitido boolean,
  usados int,
  request_id uuid
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  -- my_profile_id() já filtra ativo: desativado/desconhecido sai null
  v_uid uuid := public.my_profile_id();
  v_role public.app_role;
  v_papeis public.app_role[];
  v_usados int;
  v_req uuid := gen_random_uuid();
begin
  if v_uid is null then
    return query select null::uuid, null::public.app_role,
      array[]::public.app_role[], false, 0, null::uuid;
    return;
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  -- mesma ordem de precedência do my_papeis (0085): primeiro = mais alto
  select coalesce(array_agg(pp.papel order by
           case pp.papel
             when 'coordenacao' then 1
             when 'supervisor' then 2
             when 'mentor_dpp' then 3
             when 'mentor_especialista' then 4
             when 'mentorado' then 5
           end,
           pp.created_at, pp.id),
         array[]::public.app_role[])
    into v_papeis
    from public.profile_papeis pp
   where pp.profile_id = v_uid;

  if p_canal not in ('chat', 'mcp', 'importacao') then
    return query select v_uid, v_role, v_papeis, false, 0, null::uuid;
    return;
  end if;

  -- mesma chave do consumir_limite_ia: chat e MCP disputam o mesmo lock
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_usados
    from public.ia_eventos e
   where e.profile_id = v_uid
     and e.tool = 'mensagem'
     and e.created_at > now() - interval '60 seconds';
  if v_usados >= p_limite then
    return query select v_uid, v_role, v_papeis, false, v_usados, null::uuid;
    return;
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, duracao_ms, request_id)
    values (v_uid, p_canal, 'mensagem', coalesce(p_args, '{}'::jsonb), true, 0, v_req);
  return query select v_uid, v_role, v_papeis, true, v_usados + 1, v_req;
end $$;

revoke all on function public.ia_contexto_e_limite(jsonb, int, text) from public, anon;
grant execute on function public.ia_contexto_e_limite(jsonb, int, text) to authenticated;

-- ---- registrar_ia_eventos_lote (definição vigente: 0160) ----
create or replace function public.registrar_ia_eventos_lote(p_eventos jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_service boolean := auth.jwt() ->> 'role' = 'service_role';
  v_eu uuid := public.my_profile_id();
begin
  if p_eventos is null or jsonb_typeof(p_eventos) <> 'array' then
    raise exception 'lote inválido';
  end if;
  v_n := jsonb_array_length(p_eventos);
  if v_n = 0 then return 0; end if;
  -- teto do lote: uma mensagem gera no máximo ~6 rodadas de tools + o resumo
  if v_n > 50 then
    raise exception 'lote acima de 50 eventos';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_eventos) e
     where coalesce(e ->> 'canal', '') not in ('chat', 'mcp', 'importacao')
  ) then
    raise exception 'canal inválido';
  end if;

  -- mesma regra do registrar_ia_evento (0159): autor declarado só vale pra
  -- service_role; caller comum carimba o próprio JWT
  insert into public.ia_eventos (
      profile_id, canal, tool, args, ok, erro, duracao_ms,
      modelo, tier, tokens_in, tokens_out, tokens_reasoning, cache_read,
      custo_usd, allowance_usd, billing_source, request_id, iteracoes
    )
  select
    case when v_service
      then coalesce((e ->> 'profile_id')::uuid, v_eu)
      else v_eu
    end,
    e ->> 'canal',
    e ->> 'tool',
    coalesce(e -> 'args', '{}'::jsonb),
    (e ->> 'ok')::boolean,
    e ->> 'erro',
    (e ->> 'duracao_ms')::int,
    e ->> 'modelo',
    e ->> 'tier',
    (e ->> 'tokens_in')::int,
    (e ->> 'tokens_out')::int,
    (e ->> 'tokens_reasoning')::int,
    (e ->> 'cache_read')::int,
    (e ->> 'custo_usd')::numeric,
    (e ->> 'allowance_usd')::numeric,
    e ->> 'billing_source',
    (e ->> 'request_id')::uuid,
    (e ->> 'iteracoes')::int
  from jsonb_array_elements(p_eventos) e;

  return v_n;
end $$;

revoke all on function public.registrar_ia_eventos_lote(jsonb) from public, anon;
grant execute on function public.registrar_ia_eventos_lote(jsonb) to authenticated;

commit;
