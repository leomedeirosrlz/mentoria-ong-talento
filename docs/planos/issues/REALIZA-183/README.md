# REALIZA-183 — `resumo_acessos`: log de acesso do /resumo público

**Jira:** [REALIZA-183] "resumo_acessos — log de acesso do /resumo público (independe do modelo de turmas)"
**Tier:** A (sem design.md — não toca UI; a superfície de leitura do log chega na REALIZA-170)
**Status:** ABERTO — hoje `/resumo/[slug]` não grava nada (`src/app/resumo/[slug]/page.tsx` só lê via `createAdminClient`).

## Resumo

O link público `/resumo/<slug>` (hoje slug fixo `RESUMO_SLUG_T2`, `src/lib/relatorio.ts:5`)
expõe dados de pessoas — inclusive mentorados menores — por obscuridade. Não existe
nenhum rastro de quem abriu, quando e de onde. A issue cria a tabela
`resumo_acessos` (append-only) e a escrita fire-and-forget no server component da
página, com IP **hasheado** (LGPD — não guarda IP cru).

## Escopo (5-10 bullets)

- Tabela `public.resumo_acessos`: `id`, `slug` (text — ainda não existe tabela de
  links pra FK), `acessado_em`, `ip_hash`, `user_agent`, `params jsonb`.
- Append-only: insert só via service role (admin client) — nenhum grant de
  escrita pra `anon`/`authenticated`; select coord-only via policy.
- Escrita fire-and-forget no `page.tsx` do `/resumo/[slug]`, **depois** do gate
  do slug (só loga acesso a slug válido — crawler errando slug não enche a tabela).
- IP: `x-forwarded-for`[0] → `x-real-ip` (padrão `ipUa()` de
  `src/lib/actions-assinaturas.ts:46-52`), hasheado com SHA-256 + salt de env.
- `params` guarda o recorte pedido (`turma`, `gran`, `col`) — útil pra saber se
  o link circulou com colunas de contato.
- Falha do insert **não pode derrubar a página** — `void`/`.then()` com catch
  (RPC/insert no supabase-js é lazy; ver nota em AGENTS.md).
- Sem retenção automática nesta issue — proposta de poda lazy fica registrada no
  sdr (reuso quando a 170 criar a RPC de abertura).

## Dependências / bloqueios

- **Alimenta:** REALIZA-170 (relatórios públicos com senha) — a auditoria do
  link protegido usa esta tabela; a 170 adiciona colunas `ok`/`motivo` pra
  registrar tentativas de senha (rate limit conta falhas por `slug`+`ip_hash`).
- **Env nova:** `RESUMO_ACESSO_SALT` (salt do hash de IP) — documentar em
  Vercel prod/preview + `.env.local`.
- Nenhuma dep de schema além de `pgcrypto` já habilitado (0001).

## Esforço: PP

1 migration (~40 linhas) + ~30 linhas no page.tsx + regen de types.

## Riscos

- **LGPD:** IP cru é dado pessoal — mitigado por hash com salt (detalhes no sdr.md).
- **Cardinality:** tráfego de crawler no slug → crescimento da tabela. Volume real
  é baixo (link interno, noindex); poda lazy sugerida no sdr.
- **Ordem com a 170:** esta issue deve aterrissar antes ou junto — a 170 assume a
  tabela pra rate limit de senha.

> DECIDIDO (Thiago): retenção 13 meses; prod falha visível sem RESUMO_SALT.
