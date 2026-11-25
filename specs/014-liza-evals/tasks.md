# Tasks — Evals das novas tools da Liza

## Fase 1 — Inventário

- [x] T001 listar tools e mapear quais já têm caso em `tests/evals/casos.json`.
- [x] T002 classificar as novas: instrumentos, agenda/registro, plano em dia, leitura de jornada.
- [x] T003 publicar a matriz tool × caso × papel no Jira REALIZA-514.

## Fase 2 — Corpus

- [x] T004 adicionar casos felizes com `tools_esperadas`.
- [x] T005 adicionar casos de recusa/permissão com `tools_nao_pode`.
- [x] T006 remover PII e usar fixtures do seed local.
- [x] T007 validar JSON e IDs únicos.

## Fase 3 — Execução

- [x] T008 rodar run staff local.
- [x] T009 rodar run mentorado local.
- [x] T010 conferir histórico/motivo de falha no painel `/ia`.
- [x] T011 rodar CLI `eval-ia` se aplicável.

## Fase 4 — Gates e evidências

- [x] T012 `pnpm exec next typegen && npx tsc --noEmit`
- [x] T013 `npx eslint src/`
- [x] T014 `pnpm test`
- [x] T015 prints/resultados e comentário no Jira REALIZA-514.
