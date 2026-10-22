# REALIZA-39 — acceptance.md (QA-executável)

## Unidade (Vitest — `turmasDe`)

1. Mentor com dupla ativa T1 → `{T1}`; mentor com duplas T1+T2 → `{T1,T2}`.
2. Mentorado nunca pareado (só fila) → `∅` (aparece em "Sem turma").
3. Staff com `profile_papeis.escopo_turma='T2'` → `{T2}` mesmo sem dupla.
4. Dupla especialista sem turma (`turma null`) → não contamina; especialista puro cai em "Sem turma" se não tiver outro vínculo.
5. Com `turma_inscricoes` (pós-167): inscrição vence derivação por dupla encerrada.

## UI / e2e demo

6. Demo coord em `/pessoas`: chips "Turma 1"/"Turma 2"/"Sem turma" aparecem (demo tem T1+T2); clicar "Turma 2" reduz as seções aos vínculos T2; contadores batem com o filtro.
7. "Sem turma" mostra os livres/nunca-pareados (e staff global).
8. Chip ativo + busca → interseção funciona; "Limpar busca" preserva o chip de turma.
9. Uma turma só no sistema → nenhum chip aparece (regra de silêncio).
10. Auxiliar demo (se a 32 estiver aplicada): vê só chip(s) do próprio escopo; não vê contagem de turmas fora dele.

## Edge cases

11. Mentor multi-turma aparece nos dois filtros (contagem de chips pode somar > total — aceito/documentado).
12. Pessoa que sai da turma (dupla encerrada): some do chip na próxima carga (derivado de dupla ativa — documentado).
13. `/pessoas` sem `searchParams`: comportamento default "Todas" — nenhuma regressão.

## Rollout

14. Sem migration; demo data já tem T1/T2 — verificável no preview sem staging.
