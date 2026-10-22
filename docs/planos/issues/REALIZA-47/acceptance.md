# REALIZA-47 — acceptance.md (QA-executável)

## Schema / migration

1. **Dado** staging com T1/T2 existentes, **quando** `010x_programas_turmas.sql` aplica, **então** `turmas` tem ≥2 linhas, `programas` ≥1, e `select count(*) from cronogramas where turma_id is null` = 0 e `... from duplas where turma is not null and turma_id is null` = 0.
2. **Dado** uma `duplas.turma` com label que não casa nenhum `cronogramas.turma`, **então** a migration cria turma `planejada` com esse rótulo exato (não falha, não inventa id).
3. Reaplicar a migration é no-op (idempotente: `if not exists`/`on conflict do nothing`).
4. `mentorados_turma`: jovem da T1 segue vendo só colegas T1 (teste RLS via `seed-e2e` + query como o usuário jovem).

## Unidade (Vitest)

5. `partesTurma("T1 · 2026/2027")` → `{nome:"Turma 1", ano:"2026/2027"}` e `partesTurma("livre")` → `{nome:"livre", ano:null}` — seguem passando.
6. Helper novo de projeção label↔id coberto (match exato, case/acentos preservados).

## REST / RLS

7. `GET /rest/v1/turmas` autenticado como mentor → 200; como `anon` → erro/vazio.
8. `POST /rest/v1/turmas` como mentor → 403; como coordenação → 201.
9. `POST /rest/v1/duplas` com `turma_id` de turma inexistente → FK error (400).

## E2E / demo

10. Demo (`demo_role=coordenacao`): `/turmas` lista T1 e T2 como cards de turma; `/turmas/novo` oferece "Nova turma"; `/duplas` chips por turma filtram (mesmo visual de hoje).
11. App real (staging): criar turma "T3 · 2027" via UI → aparece em `/turmas`; criar cronograma pra ela no builder; nova dupla DPP nesse cronograma grava `turma_id` da T3 (verificar via REST como coord).
12. `/api/export?tipo=...` retorna coluna `turma` com o rótulo correto por dupla.
13. `/registros?turma=<id>` filtra só registros de duplas daquela turma.

## Edge cases

14. Turma sem cronograma → card mostra empty state + CTA (não quebra).
15. Dupla especialista sem turma → lista normalmente, chip de turma ausente (não crash em `d.turma` null).
16. Renomear `turmas.rotulo` não afeta vínculos (FK por id) — UI reflete novo rótulo em `/duplas`, agenda e pílulas.

## Rollout / rollback

17. Migration em staging antes do merge; em prod antes do merge (schema-contract verde).
18. Reverter PR de código: sistema volta a ler texto legado (PRs 1-3 mantêm colunas) — verificar `/duplas` e agenda sem regressão.
