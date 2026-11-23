# Tasks — Evals das novas tools da Liza

## Fase 1 — Inventário

- [ ] T001 listar tools e mapear quais já têm caso em `tests/evals/casos.json`.
- [ ] T002 classificar as novas: instrumentos, agenda/registro, plano em dia, leitura de jornada.
- [ ] T003 publicar a matriz tool × caso × papel no Jira REALIZA-514.

## Fase 2 — Corpus

- [ ] T004 adicionar casos felizes com `tools_esperadas`.
- [ ] T005 adicionar casos de recusa/permissão com `tools_nao_pode`.
- [ ] T006 remover PII e usar fixtures do seed local.
- [ ] T007 validar JSON e IDs únicos.

## Fase 3 — Execução

- [ ] T008 rodar run staff local.
- [ ] T009 rodar run mentorado local.
- [ ] T010 conferir histórico/motivo de falha no painel `/ia`.
- [ ] T011 rodar CLI `eval-ia` se aplicável.

## Fase 4 — Gates e evidências

- [ ] T012 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T013 `npx eslint src/`
- [ ] T014 `pnpm test`
- [ ] T015 prints/resultados e comentário no Jira REALIZA-514.
