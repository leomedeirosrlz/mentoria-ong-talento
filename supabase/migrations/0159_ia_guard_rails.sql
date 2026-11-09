-- 0159 ia_guard_rails — pacote Liza nov/2026 (docs/planos/liza-pacote-2026-11).
--
-- D2: registrar_ia_evento — p_profile_id só é honrado quando o caller é
--   service_role (canal MCP pré-impersonation); um autenticado comum não pode
--   mais gravar evento em nome de outro (era: envenenar auditoria + estourar o
--   rate limit alheio, que conta por profile_id).
-- D3: consumir_limite_ia — check+insert do evento 'mensagem' sob advisory lock
--   por profile: o TOCTOU que deixava um burst paralelo furar o teto vira
--   veredictos sequenciais. Request negado não insere (abuso não infla contagem)
--   e nem chega a abrir stream/provider na rota.
-- D2: ia_mcp_tokens.expira_em — PAT deixa de ser credencial eterna (90d);
--   ia_mcp_autorizar honra a expiração, devolve user_id pra impersonation e
--   deixa de ser oráculo de validação chamável por anon.
-- D4: telemetria de modelo em ia_eventos (colunas nullable + p_* novos na RPC)
--   — quem respondeu (slug da cadeia), tier roteado, tokens por tipo, custo e
--   allowance do plano Go, request_id correlacionando mensagem↔tools.

begin;

-- ---- D4: colunas de telemetria (nullable — retro-compatível) ----
alter table public.ia_eventos
  add column if not exists modelo text,
  add column if not exists tier text,
  add column if not exists tokens_in int,
  add column if not exists tokens_out int,
  add column if not exists tokens_reasoning int,
  add column if not exists cache_read int,
  add column if not exists custo_usd numeric(10,6),
  add column if not exists allowance_usd numeric(10,6),
  add column if not exists billing_source text,
  add column if not exists request_id uuid,
  add column if not exists iteracoes int;

create index if not exists ia_eventos_request_idx
  on public.ia_eventos (request_id) where request_id is not null;

-- ---- D2+D4: registrar_ia_evento com guard de autor e campos de uso ----
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
  if p_canal not in ('chat', 'mcp') then
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

-- assinatura 0154 sai — um único caminho de escrita
drop function if exists public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid);

revoke all on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  from public, anon;
grant execute on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  to authenticated;

-- ---- D3: limite atômico — reserva o slot 'mensagem' sob lock por profile ----
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
  if v_uid is null or p_canal not in ('chat', 'mcp') then
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

-- ---- D2: PAT com expiração + autorizar devolve user_id (impersonation) ----
alter table public.ia_mcp_tokens
  add column if not exists expira_em timestamptz;
-- existentes ganham 90d a partir de agora (backfill — feature é nova, ninguém
-- perde token ativo); novos nascem com default de 90d
update public.ia_mcp_tokens set expira_em = now() + interval '90 days'
  where expira_em is null;
alter table public.ia_mcp_tokens
  alter column expira_em set default (now() + interval '90 days');

drop function if exists public.ia_mcp_autorizar(text);
create or replace function public.ia_mcp_autorizar(p_token text)
returns table (
  profile_id uuid,
  user_id uuid,
  papel public.app_role,
  papeis public.app_role[]
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_pid uuid;
begin
  if p_token is null or char_length(p_token) < 20 then return; end if;

  update public.ia_mcp_tokens t
     set ultimo_uso_em = now()
   where t.token_hash = v_hash
     and t.revogado_em is null
     and (t.expira_em is null or t.expira_em > now())
  returning t.profile_id into v_pid;
  if v_pid is null then return; end if;

  -- pessoa desativada não autoriza mesmo com token vivo (paridade com o
  -- gate `ativo` do has_papel/my_papeis)
  if not exists (
    select 1 from public.profiles p where p.id = v_pid and p.ativo
  ) then
    return;
  end if;

  return query
    select
      v_pid,
      p.user_id,
      p.role,
      coalesce(
        (select array_agg(pp.papel) from public.profile_papeis pp
          where pp.profile_id = v_pid),
        array[]::public.app_role[]
      )
    from public.profiles p
    where p.id = v_pid;
end $$;

comment on function public.ia_mcp_autorizar(text) is
  'Valida PAT do MCP: sha256 → profile ativo + user_id (pra impersonation) + '
  'papeis efetivos, honrando expira_em e carimbando ultimo_uso_em. Vazio = '
  'token inválido/revogado/expirado/pessoa desativada.';

-- oráculo fechado: anon não pode mais sondar validade de token por RPC
revoke all on function public.ia_mcp_autorizar(text) from public, anon;
grant execute on function public.ia_mcp_autorizar(text) to authenticated;

commit;
