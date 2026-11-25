-- 0160 ia_contexto_e_lote — menos round-trips por mensagem do chat da Liza.
--
-- E1: ia_contexto_e_limite — identidade (profile ativo, papel primário,
--   papéis efetivos na ordem do my_papeis) + a reserva do limite numa RPC
--   só. Antes eram três (select em profiles, my_papeis, consumir_limite_ia).
--   O limite tem a MESMA semântica do consumir_limite_ia (0159): mesmo
--   advisory lock por profile (chat e MCP seguem serializados entre si),
--   mesma contagem de 'mensagem' em 60s, reserva só quando permitido.
--   consumir_limite_ia fica intacta: a rota MCP continua usando.
-- E2: registrar_ia_eventos_lote — N eventos num insert só (tools da
--   mensagem + o resumo 'resposta' saem juntos no fim do stream), com a
--   mesma regra de autor do registrar_ia_evento.

begin;

-- ---- E1: identidade + limite numa ida ao banco ----
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

  if p_canal not in ('chat', 'mcp') then
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

comment on function public.ia_contexto_e_limite(jsonb, int, text) is
  'Chat da Liza: profile ativo + papel + papeis (ordem do my_papeis) + reserva '
  'atômica do limite (mesma régua do consumir_limite_ia). profile_id null = '
  'sem cadastro ativo.';

revoke all on function public.ia_contexto_e_limite(jsonb, int, text) from public, anon;
grant execute on function public.ia_contexto_e_limite(jsonb, int, text) to authenticated;

-- ---- E2: auditoria em lote ----
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
     where coalesce(e ->> 'canal', '') not in ('chat', 'mcp')
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

comment on function public.registrar_ia_eventos_lote(jsonb) is
  'Grava até 50 eventos de ia_eventos num insert (tools + resumo do chat). '
  'Autor = my_profile_id(), exceto service_role (profile_id do item).';

revoke all on function public.registrar_ia_eventos_lote(jsonb) from public, anon;
grant execute on function public.registrar_ia_eventos_lote(jsonb) to authenticated;

commit;
