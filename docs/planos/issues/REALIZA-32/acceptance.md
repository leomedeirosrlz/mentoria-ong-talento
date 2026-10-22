# REALIZA-32 — acceptance.md (QA-executável)

Pré-condição: BLOCKER respondido (ver `sdd.md`). Critérios abaixo assumem **Opção A** (turma inteira); marcar os que mudam na Opção B.

## Schema / RLS (staging, via REST com JWT de cada papel)

1. **Dado** profile auxiliar com `profile_papeis(papel='supervisor', escopo_turma='T1 · 2026/2027')` e `supervisor_id` **nulo** em todas as duplas, **quando** `GET /rest/v1/duplas?select=id,turma`, **então** retorna todas as duplas T1 e **nenhuma** T2.
2. Idem `encontros`, `registros`, `mentorados`: só linhas de duplas T1.
3. `GET /rest/v1/profiles` como esse auxiliar: vê mentores/mentorados-com-conta das duplas T1; **não** vê `dados_civis`/`*_pessoal` (colunas ausentes/erro de grant — verificar contrato atual de colunas).
4. `PATCH /rest/v1/duplas` numa dupla T1 **sem** `supervisor_id=me` → 0 rows/403 (edição segue por dupla designada).
5. `PATCH` numa dupla T1 **com** `supervisor_id=me` → 200 (regressão do escopo atual).
6. `insert into profile_papeis` como auxiliar → 403 (só coord designa).
7. Auxiliar com `escopo_turma` de label inexistente → vê zero duplas (falha fechada).
8. **Opção B (se decidida)**: auxiliar com escopo T1 mas sem nenhuma designação vê apenas as duplas com `supervisor_id=me` — critérios 1-2 invertem.

## Unidade

9. `escopoTurmasDe`/`has_papel` com escopo — casos: papel global (null) supervisiona todas; supervisor sem escopo não ganha turma nenhuma.

## E2E / demo

10. Demo: persona supervisor (Paulo) com `escopo_turma` na T1 — `/duplas` mostra turma T1 inteira agrupada; T2 ausente; home/agenda refletem.
11. App staging: coord designa auxiliar à turma pela UI → auxiliar loga e vê as duplas; coord remove escopo → acesso some no refresh.
12. Notificações/supervisões do auxiliar continuam funcionando (sessão em dupla supervisionada registra e aparece ao mentor — regressão de `queries-supervisao`).

## Edge cases

13. Auxiliar com escopo em 2 turmas (`profile_papeis` duas linhas) → vê ambas, agrupadas por turma.
14. Dupla especialista dentro da turma (herda `turma` da DPP — `0061:220-221`) entra no escopo; especialista sem turma não entra.
15. Mentor que também tem papel supervisor escopado → vê próprias duplas (como mentor) + turma do escopo (como auxiliar), sem duplicatas na UI.

## Rollout / rollback

16. Migration em staging antes do merge; rollback = `drop` das policies novas + function (rodapé da migration) — verificar que escopo volta ao comportamento por dupla sem downtime.
