-- 0149 ia_mcp_tokens — PATs do servidor MCP /api/mcp (REALIZA-326, plano
-- ia-chatbot-mcp §6). Token de longa duração ligado ao profile, revogável
-- e com último_uso_em — a coordenação gera na aba de ajustes da bolha e
-- cola no cliente MCP (Claude, Cursor). O token só é mostrado uma vez:
-- no banco fica só o sha256, mesmo padrão dos hashes de 0053.
--
-- Fase 1 é coord-only: o gate de papel mora na autorização (a RPC
-- devolve os papéis e a rota exige coordenacao) — a RLS da tabela só
-- garante "dono gerencia os próprios tokens". Token em si não carrega
-- papel: quem revoga/expira resolve o acesso.

begin;

create table public.ia_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  token_hash text not null unique,
  rotulo text not null check (char_length(btrim(rotulo)) between 1 and 80),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.ia_mcp_tokens is
  'PATs do servidor MCP (/api/mcp): sha256 do token + profile dono; '
  'revogacao por revogado_em, auditoria por ultimo_uso_em.';

alter table public.ia_mcp_tokens enable row level security;

create policy ia_mcp_tokens_dono on public.ia_mcp_tokens
  for all to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());

-- resolve o token pra identidade: hash → profile ativo + papeis efetivos.
-- Definer porque o caller é a rota com service role (PAT não é JWT —
-- não existe sessão Supabase pra ele; o service chama a RPC, que valida
-- e carimba ultimo_uso_em na mesma viagem).
create or replace function public.ia_mcp_autorizar(p_token text)
returns table (
  profile_id uuid,
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
  'Valida PAT do MCP: sha256 → profile ativo + papeis efetivos, carimbando '
  'ultimo_uso_em. Vazio = token inválido/revogado/pessoa desativada; o gate '
  'de papel (coord-only na fase 1) fica na rota.';

commit;
