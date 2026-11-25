# Plano — Evals das novas tools da Liza

**Spec:** `specs/014-liza-evals/spec.md` · **Status:** Draft

## Resumo técnico

- Inventariar `src/lib/ia/tools.ts` × `tests/evals/casos.json`; adicionar casos live por domínio e papel.
- Reutilizar o executor de `src/lib/ia/evals.ts` e o painel `/ia`; não criar runner novo.
- Rodar localmente com fixtures; nenhuma tool nova.

## Contexto técnico do repo

- Tools em `src/lib/ia/tools.ts`; corpus em `tests/evals/casos.json`; executor em `src/lib/ia/evals.ts`; CLI em `scripts/eval-ia.mjs`.
- Auth de eval por `EVAL_EMAIL`/`EVAL_SENHA` e `EVAL_EMAIL_JOVEM`/`EVAL_SENHA_JOVEM`; ambiente local.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Corpus + execução + histórico | run local |
| A2 RLS | Papel respeitado no run | casos negados |
| A3 escritas/domínio | Nenhuma tool nova | — |
| A4 rota pública | Sem rota nova | — |
| A5 LGPD | Fixtures sem PII | revisão |
| A6 UI | Painel existente | — |
| A7 demo | N/A | — |
| A8 gates | DoD | — |
| A9 migrations | Nenhuma | — |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
tests/evals/casos.json        # casos live
src/lib/ia/evals.ts           # executor (só se faltar campo)
src/lib/ia/tools.ts           # inventário/descrições (sem tool nova)
src/components/ia-evals*.tsx  # painel/histórico
scripts/eval-ia.mjs           # CLI
```

## Dados e migrations

Nenhuma migration. Se o corpus precisar de um campo de rubrica, usar o schema existente `ia_eval_itens.rubrica`.

## Autorização (matriz)

Os casos de staff e mentorado usam as sessões de eval; tool proibida por papel é o teste.

## Superfícies e rotas

Sem rota nova. O painel `/ia` continua coordenação.

## Paridade demo

Não se aplica (eval é operacional).

## Testes

- **Unit:** `casosDoPapel`/`julgar` se mudar.
- **Live local:** um run staff + um mentorado.
- **Schema:** `pnpm schema:check` se tocar dados de eval.

## Observabilidade e erro

- Falha de provider/rate limit é registrada no item, não derruba o run.
- Segredo ausente falha antes de chamar o provider.

## Rollout

1. inventário; 2. casos; 3. run local; 4. gates; 5. review; 6. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| | | |
