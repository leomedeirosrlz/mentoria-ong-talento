# REALIZA-73 — acceptance.md (QA-executável)

## Contexto — precedência e persistência

1. **Dado** coord sem cookie, **quando** abre `/`, **então** vê "Todas" (hub + resumos de todas as turmas).
2. `/?turma=T2…` → home filtrada + cookie `turma_foco=T2…` escrito; navegar pra `/duplas` abre já com chip/contexto T2.
3. Cookie=T1 + `?turma=T2` → URL vence (T2 mostrada, cookie reescrito pra T2).
4. `?turma=todas` → limpa cookie, mostra tudo.
5. `?turma=lixo-inexistente` → "Todas", sem erro (falha fechada).
6. 1 turma no sistema → nenhum hub/seletor renderiza.

## Superfícies

7. Home com contexto T2: cards/resumos só de cronogramas T2; faixa "Mostrando: Turma 2 · 2026/2027 — ver todas" presente.
8. `/agenda` com contexto: `cronogramaVigente` é da turma do foco (a semana destacada é T2, não T1).
9. `/duplas` com contexto: chega com chip da turma ativo; usuário ainda pode trocar chip localmente (contexto é inicial, não trava).
10. `/registros?turma=T2…`: só registros de duplas T2; filtro visível no UI.
11. `/api/export?...&turma=T2…`: CSV só com linhas da T2 (quando o param for implementado).
12. Auxiliar (após 32): seletor lista só suas turmas; mono-turma → faixa sem seletor.

## Demo / e2e

13. Demo coord: hub com cards T1+T2 na home; clicar T2 filtra; cookie persiste entre páginas; "ver todas" restaura.
14. `demo_role` continua funcionando junto (persona troca papel; turma_foco independente).
15. Spec demo novo cobre 1-6 e 13 contra produção/preview (público, sem writes).

## Edge cases

16. Turma encerrada com contexto ativo: hub ainda mostra card (status "encerrado"); home filtra normalmente.
17. Mentores/jovens nunca veem seletor/hub (papel ≠ coord/auxiliar) — verificar render ausente.

## Rollout

18. Sem migration; demo verificável em preview. Rollback = esconder seletor + ignorar params.
