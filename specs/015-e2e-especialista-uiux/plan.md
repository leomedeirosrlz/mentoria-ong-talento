# Plano — Revisão e2e UI/UX das trilhas de especialista

**Spec:** `specs/015-e2e-especialista-uiux/spec.md` · **Status:** Draft

## Resumo técnico

- Executar o roteiro com Playwright e inspeção visual, usando o servidor local e o Supabase local.
- Aproveitar os specs existentes de especialista e criar apenas os que cobrem lacunas de UI/UX.
- Entregar relatório de review com prints e classificação P0/P1/P2; não corrigir produto aqui.

## Contexto técnico do repo

- Playwright: `tests/e2e/app/especialista-agenda.spec.ts` e correlatos; `tests/e2e/helpers.ts`.
- UI: `/jovem/especialistas`, home do jovem, ficha da dupla, mural do especialista, `/materiais/instrumentos`.
- Supabase local; nunca staging.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Roteiro + evidência + specs | relatório |
| A2 RLS | Papéis negados testados | casos |
| A3 escritas/domínio | Sem escrita de produto | — |
| A4 rota pública | Sem rota nova | — |
| A5 LGPD | Fixtures, sem PII | — |
| A6 UI | review de a11y/visual | prints |
| A7 demo | Pode usar demo para estados | prints |
| A8 gates | `pnpm test:e2e:app` afetado | CI local |
| A9 migrations | Nenhuma | — |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
tests/e2e/app/especialista-agenda.spec.ts   # existente
tests/e2e/app/especialista-uiux.spec.ts     # novo, se necessário
tests/e2e/demo/...                          # estados públicos, se houver
/tmp/opencode/review/015/                    # prints e relatório temporário
docs/planos/issues/REALIZA-510/review.md     # relatório versionado
```

## Dados e migrations

Nenhuma. Fixtures do seed local; se faltar perfil completo, usar `seed:e2e` local.

## Autorização (matriz)

Cobrir permitido e negado para coordenação, supervisor, mentor DPP, especialista e mentorado.

## Superfícies e rotas

Sem rota nova. A revisão cobre as rotas existentes e os links entre elas.

## Paridade demo

Usar demo para estados sem login quando possível; app para escrita e permissão.

## Testes

- **E2E app:** fluxo completo com um especialista e um jovem.
- **Visual:** 1440×900 e 390×844.
- **A11y:** teclado, foco, nomes acessíveis.

## Observabilidade e erro

Relatório registra console/network failures e requests 4xx/5xx, sem mascarar.

## Rollout

1. roteiro; 2. execução local; 3. relatório; 4. correções em spec própria; 5. reexecução; 6. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| | | |
