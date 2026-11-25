# Plano — <nome>

**Spec:** `specs/NNN-<slug>/spec.md` · **Status:** Draft | Approved

## Resumo técnico

- Abordagem em 3 bullets; o que reutiliza do que já existe.
- O que **não** será criado (evita duplicar módulo).

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- Supabase (Postgres + Auth + Storage + RPC); local só para e2e via `supabase start`.
- Testes: Vitest (domínio puro) · Playwright `demo` (sem login) e `app` (backend real) · schema-contract no CI.
- Antes de codar: `pnpm exec next typegen` (senão `tsc` falha em checkout limpo).

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | | |
| A2 RLS | | |
| A3 escritas/domínio | | |
| A4 rota pública | | |
| A5 LGPD | | |
| A6 UI | | |
| A7 demo | | |
| A8 gates | | |
| A9 migrations | | |
| A10 spec | | |

Violação consciente vai na tabela de desvios no fim, com a alternativa simples rejeitada.

## Arquitetura da mudança (paths reais)

```text
src/app/(app)/...             # telas
src/app/(jovem)/...           # superfície do mentorado
src/components/...            # componentes
src/lib/queries*.ts           # leitura server-side
src/lib/actions*.ts           # escrita ({ ok } | { error })
src/lib/ciclo.ts              # domínio puro, se aplicável
src/lib/demo/...              # paridade demo
supabase/migrations/NNNN_...  # próxima migration livre
tests/...                     # vitest
tests/e2e/{app,demo}/...      # playwright
```

## Dados e migrations

- Número, ordem e dependências; colunas, enums e policies.
- RPC nova: assinatura, `security definer`, grants, teste por papel.
- Retroativo: o que acontece com dados existentes.
- Rollback: o que é reversível e o que exige janela.
- Aplicação: staging antes do push; produção antes do merge; `pnpm schema:check`.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| ler ... | | | | | | ❌ |

Toda célula ✅ precisa de um caso e2e; toda célula ❌ também.

## Superfícies e rotas

- Rota nova? pública? entrada em `isPublic`? CSP? metadata/robots?
- Ação de IA/MCP nova? entra na allowlist de tools e no teste de papel.

## Paridade demo

- Dataset (`src/lib/demo/data.ts`), query (`queries.ts`), mutação bloqueada (`DEMO_MSG`), persona.

## Testes

- **Unit:** regra de domínio nova e regressão do invariante tocado.
- **E2E demo:** caminho principal sem login.
- **E2E app:** papel permitido + papel negado + escrita real.
- **Schema:** contrato contra o ambiente alvo.

## Observabilidade e erro

- Evento no Sentry, mensagem pt-BR, estado vazio e estado de erro.

## Rollout

1. migration no staging → 2. código + testes → 3. PR (e2e-app) → 4. merge em `staging` → 5. `[deploy]` só com autorização.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| | | |
