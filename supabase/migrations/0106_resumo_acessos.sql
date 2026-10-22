-- 0106 resumo_acessos (REALIZA-183): log append-only de acessos ao /resumo
-- público. O link por obscuridade expõe dados de pessoas (inclusive menores)
-- sem nenhum rastro de quem abriu — esta tabela é a primeira telemetria.
--
--   * slug é TEXT livre, não FK: a tabela de links (relatorio_links,
--     167/170) ainda não existe e o log precisa sobreviver à revogação/
--     exclusão do link — mesmo raciocínio de emails_enviados.ref_id (0056).
--   * IP nunca em claro: o app grava só ip_hash = SHA-256(salt:ip), com o
--     salt fora do banco (env RESUMO_ACESSO_SALT). Dump da tabela não
--     re-identifica visitante sem o salt (LGPD — minimização).
--   * append-only por omissão de grants: nenhum UPDATE/DELETE existe pra
--     papel nenhum. O insert vem do server component via service role
--     (admin client) — a página publica, ninguém mais. Não há writer com
--     JWT: por isso não entra RPC definer (diferente de login_handoffs,
--     onde o público precisava escrever — aqui quem escreve é o servidor).
--   * leitura/auditoria: select coord-only (supervisor não lê — log de
--     acesso a relatório é dado de auditoria, não operação de dupla). A UI
--     de gestão de links chega na REALIZA-170; até lá a consulta é manual:
--       select * from resumo_acessos
--        where slug = 't2-x7k4m9qf2w8j' order by acessado_em desc;
--   * retenção: 13 meses (decisão do Thiago em _decisoes.md). Sem poda
--     nesta issue — a RPC de abertura da 170 varre `acessado_em <
--     now() - interval '13 months'` junto com o rate-limit (poda lazy por
--     uso, molde login_handoffs 0049).
--
-- `if not exists`/`drop policy if exists`: DDL order-agnóstica — a 170
-- altera esta tabela (colunas ok/motivo p/ rate-limit) e pode mergir antes
-- (review dba: 183 → 170 era ordem travada; idempotência destrava).

begin;

create table if not exists public.resumo_acessos (
  id uuid primary key default gen_random_uuid(),
  -- slug textual (não FK): o link pode ser revogado/apagado e o rastro fica
  slug text not null check (char_length(slug) between 1 and 120),
  acessado_em timestamptz not null default now(),
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 16 and 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  -- o recorte pedido (?turma=&gran=&col=), allowlist no app — revela se o
  -- link circulou com colunas de contato ligadas; query extra não entra
  params jsonb not null default '{}'::jsonb
);
comment on table public.resumo_acessos is
  'Log de acesso ao /resumo público (REALIZA-183). Append-only: insert por '
  'service_role; select coord-only. ip_hash = SHA-256(salt+ip), nunca IP cru. '
  'Retenção 13 meses — poda lazy chega com a RPC de abertura (REALIZA-170).';

create index if not exists resumo_acessos_slug_em
  on public.resumo_acessos (slug, acessado_em desc);

alter table public.resumo_acessos enable row level security;

-- revogos explícitos mesmo com o alter default privileges da 0032: grant
-- é a primeira linha de defesa e a tabela guarda metadado de visitante
revoke all on public.resumo_acessos from public, anon;
-- authenticated não escreve nem apaga — select abaixo é o único grant
revoke insert, update, delete on public.resumo_acessos from authenticated;
grant select on public.resumo_acessos to authenticated;

drop policy if exists resumo_acessos_select on public.resumo_acessos;
create policy resumo_acessos_select on public.resumo_acessos
  for select to authenticated
  using (public.my_role() = 'coordenacao');

commit;
