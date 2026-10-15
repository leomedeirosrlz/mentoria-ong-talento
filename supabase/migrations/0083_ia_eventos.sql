-- 0083: ia_eventos — trilha de auditoria da camada de IA (chatbot + MCP)
--
-- A fase 0 da camada de IA (docs/planos/ia-chatbot-mcp.md) é um registry de
-- tools tipadas que o modelo chama no lugar de gerar SQL. Toda tool call —
-- sucesso ou falha, validação rejeitada ou executada — grava uma linha aqui:
-- quem agiu (profile_id), por qual canal (chat interno ou MCP externo), qual
-- tool, com que args canônicos, o resultado e a latência. É o mesmo padrão
-- de `interacoes` (a ação fica, não a resposta): guardar o payload de dados
-- retornados criaria um transcript com PII e um problema de retenção — o que
-- se audita é a AÇÃO.
--
-- Desenho:
--   · select: o próprio profile revê seu rastro + coordenação lê tudo
--     (auditoria é instrumento dela);
--   · insert: SEM policy/grant — só pela RPC security definer
--     `registrar_ia_evento`, que carimba profile_id = my_profile_id() e
--     valida o canal no vocabulário fechado;
--   · update/delete: pra ninguém — log de auditoria não se edita.

begin;

create table public.ia_eventos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  canal text not null check (canal in ('chat', 'mcp')),
  tool text not null,
  args jsonb not null default '{}',
  ok boolean not null,
  erro text,
  duracao_ms int,
  created_at timestamptz not null default now()
);

create index ia_eventos_profile_idx
  on public.ia_eventos (profile_id, created_at desc);
create index ia_eventos_created_idx
  on public.ia_eventos (created_at desc);

alter table public.ia_eventos enable row level security;

-- o auto-grant daria ALL pra authenticated — revoga tudo e devolve só o
-- select: a escrita é exclusiva da RPC definer (policy de insert nem faz
-- sentido sem grant de tabela)
revoke all on public.ia_eventos from public, anon, authenticated;
grant select on public.ia_eventos to authenticated;

drop policy if exists ia_eventos_select on public.ia_eventos;
create policy ia_eventos_select on public.ia_eventos for select
  using (
    profile_id = public.my_profile_id()
    or public.my_role() = 'coordenacao'
  );

-- Único caminho de escrita: roda como dono da função (acima da RLS), mas o
-- profile_id vem de my_profile_id() — que lê o JWT do CALLER, não do dono.
-- Ninguém planta evento em nome de outra pessoa; usuário sem profile não
-- loga (o FK/NOT NULL barra) — e também não tem papel pra rodar tool.
-- p_erro/p_duracao_ms com default null: a tool que falhou na validação pode
-- não ter latência útil e o retorno tipado marca os dois como opcionais.
create or replace function public.registrar_ia_evento(
  p_canal text,
  p_tool text,
  p_args jsonb,
  p_ok boolean,
  p_erro text default null,
  p_duracao_ms int default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_canal not in ('chat', 'mcp') then
    raise exception 'canal inválido';
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, erro, duracao_ms)
    values (public.my_profile_id(), p_canal, p_tool, coalesce(p_args, '{}'::jsonb), p_ok, p_erro, p_duracao_ms)
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int)
  from public, anon;
grant execute on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int)
  to authenticated;

commit;
