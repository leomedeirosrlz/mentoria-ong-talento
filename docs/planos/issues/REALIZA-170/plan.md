# REALIZA-170 — plano de implementação

Descrição essencial: transformar `/resumo/[slug]` (hoje slug fixo por
obscuridade) em relatório público com senha. `relatorio_links` guarda
slug+senha_hash+config+filtros+revogação+expiração; acesso via RPCs definer
(anon tem zero grants); rate limit de senha contando falhas em
`resumo_acessos`; UI coord em `/relatorios` pra gerir links; seed migra o slug
T2 atual. Ordem sugerida de entrega: **167 (se criar a tabela mínima) → 183 →
170** — cada um funciona sozinho; se a 170 aterrissar primeiro, a migration
cria `resumo_acessos` completa (ver passo 1).

## Passo 0 — arquivos de referência lidos

- `src/app/resumo/[slug]/page.tsx` — gate atual por `RESUMO_SLUG_T2` (:34),
  selects admin, poda `permitidas`, `RelatorioCanvas`.
- `src/lib/relatorio.ts` — `montarLinhas`, `parseConfig`, catálogos,
  `FILA_T2_*`, `COLUNAS_CONTATO`.
- `src/app/(app)/relatorios/relatorio-builder.tsx` — builder, `linkCompartilhavel`
  (:187) que hoje monta a URL com query.
- `src/app/api/export/route.ts` — os 4 tipos e os filtros `turma`/`cronograma`
  (`filtraCsvCiclo` :183).
- `supabase/migrations/0049_login_handoff.sql` (zero policy + RPCs definer),
  `0094_lembrete.sql` (advisory lock + grant pattern), `0103` (token público +
  grants/revokes), `0106_resumo_acessos.sql` (183).
- `src/lib/supabase/middleware.ts` — `/resumo/*` já público (:70).
- `src/lib/actions-assinaturas.ts:46-52` — padrão `ipUa()`.

## Passo 1 — migration `0107_relatorio_links.sql` (número indicativo)

Conteúdo (ordem):

1. `create table if not exists public.resumo_acessos` **igual à 0106** se a 183
   não aterrissou (idempotente — a 0106 posterior não conflita) **+ colunas
   `link_id`, `ok`, `motivo`** e o índice parcial `resumo_acessos_falhas`. Se a
   183 já foi, só `alter table add column if not exists` + índice.
2. `create table public.relatorio_links` (DDL no sdd §1).
3. Grants: `revoke all ... from public, anon` nas duas; `revoke insert, update,
   delete on relatorio_links from authenticated`; `grant select on
   relatorio_links to authenticated` — a UI de gestão lê a lista via client
   normal. Policy `for select using (my_role()='coordenacao')`.
4. RPCs públicas: `relatorio_link_info`, `abrir_relatorio` (sdd §2 —
   `security definer`, `revoke all from public, anon` depois `grant execute to
   anon, authenticated`).
5. RPCs de gestão: `criar_relatorio_link`, `revogar_relatorio_link`,
   `redefinir_senha_relatorio_link` — `grant execute to authenticated`,
   gate interno `has_papel('coordenacao')` (mesmo ramo das outras).
6. Seed do slug T2 (sdd §4) + `senha_hash null`.

## Passo 2 — `src/lib/relatorio.ts`

- `RelatorioLinkConfig`, `configLinkOk`, `catalogoDeTipo`,
  `COLUNAS_CICLO`/`COLUNAS_ASSINATURAS`/`COLUNAS_GRADE` público,
  `montarLinhasCiclo`, `montarLinhasAssinaturas` — funções puras com testes
  Vitest (`tests/relatorio-publico.test.ts` [NOVO]: config inválida rejeitada;
  coluna sensível nunca no catálogo público; linhas ciclo sem texto livre).
- Manter `montarLinhas`/`parseConfig`/`configParaSearch` intactos (o builder
  interno os usa); `FILA_T2_*` fica até a 167 migrar pra `turma_inscricoes`.

## Passo 3 — página pública

`src/app/resumo/[slug]/page.tsx` rewrite:

- `relatorio_link_info` → 404 / card revogado / fluxo senha.
- `ResumoSenhaForm` [NOVO `src/components/resumo-senha-form.tsx`]: client
  component com `PasswordInput` (`src/components/ui/password-input.tsx`),
  submit → `abrirResumo` action; estados erro/limite (`retry_em` →
  "Tente de novo em N min").
- `abrirResumo(slug, senha)` em `src/lib/actions-resumo.ts` [NOVO]: RPC →
  cookie → `redirect`. Retorna `{error}` amigável (mesma regra das actions).
- Render de dados: `abrir_relatorio` via admin? **Não** — RPC é `grant anon`:
  a página chama com o client server normal (createClient sem sessão = anon
  key) — `supabase.rpc('abrir_relatorio', {...})`. `ipUaParams` da 183 produz
  `ip_hash`/`ua`.
- `montarLinhas*` server-side conforme `config.tipo` → `RelatorioCanvas` com a
  mesma poda `permitidas` (mantém `__status`/`__papel` nos chips).
- `export const dynamic = "force-dynamic"` mantido; `metadata.robots` noindex.

## Passo 4 — UI coord em `/relatorios`

- `src/app/(app)/relatorios/relatorio-links-card.tsx` [NOVO]: lista (nome,
  tipo, criado, expira, acessos, estado) + ações.
- `src/app/(app)/relatorios/novo-link-dialog.tsx` [NOVO]: título, tipo (+recorte
  quando não capturado), validade opcional → mostra `{link, senha}` uma vez.
- `relatorio-builder.tsx`: botão "Copiar link de compartilhamento" (:297) vira
  "Publicar como link" → abre o dialog com `cfg` corrente; "Abrir a versão
  pública" some (o link agora é por row, não URL fixa).
- `src/lib/actions-relatorio-links.ts` [NOVO]: `criarLinkRelatorio`,
  `revogarLinkRelatorio`, `redefinirSenhaLink` — gate coord + `DEMO_MSG` em
  demo; listagem em `page.tsx` (server, `getMe` já gateia coord).
- Query `getRelatorioLinks` em `src/lib/queries.ts` (cache; count de acessos
  por link via `resumo_acessos`).

## Passo 5 — demo

- `src/lib/demo/data.ts`: 1-2 `relatorio_links` canned (slug `demo-resumo`,
  config grade T2 sem senha) pra UI de gestão renderizar; ações → `DEMO_MSG`.
- A página pública não precisa de modo demo (superfície já pública; e2e cobre
  em staging/local).

## Passo 6 — gates + rollout

1. Migration → staging (`db push --db-url`) → validador REST
   `scripts/_valida_0107_rest.mjs` [NOVO] (anon consegue `info`/`abrir` com
   senha certa; errada → `ok:false`; 6 falhas → `limite`; revogado →
   `revogado`; coord cria/revoga).
2. `gen types` → `database.types.ts`.
3. `tsc`/`eslint`/`vitest` verdes; e2e spec `tests/e2e/app/resumo-publico.spec.ts`
   [NOVO] — fluxo senha completo (criar link via action coord → abrir anônimo
   → senha errada → certa → dados; revogar → card).
4. Aplicar em **prod antes do merge** (schema-contract).
5. Após merge: coord define senha no link T2 (UI) quando quiser endurecer.

## Rollback

Página volta ao gate `RESUMO_SLUG_T2` (revert); tabelas ficam inertes (sem
leitores). `drop` só se necessário — o legado convive.

## Questões em aberto

- `respostas` público fica de fora em v1 (sdr §escopo) — se o Thiago quiser
  reabrir, é flag `config.tipo` + allowlist nova, não refactor.
- Duração do cookie de acesso: proposta 7d (sdd §3) — ajustável sem migration.
