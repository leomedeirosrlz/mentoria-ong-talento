# REALIZA-103 — Editar cronograma de turma existente

- **Jira:** [REALIZA-103](https://kelyng.atlassian.net/browse/REALIZA-103)
- **Tier:** A (implementada)
- **Veredito da auditoria:** **FEITO** — falta só fechar o Jira.

## Evidências de implementação

### Editor do cronograma

- `src/components/cronograma-editor.tsx` — superfície completa de edição em `/turmas/[id]`:
  - `StatusBadge` (`:82`) — rascunho/ativo/encerrado;
  - `CronogramaAcoes` (`:182`) — ações do cronograma (editar metadados, excluir com regras);
  - `CronogramaEventos` (`:441`) — lista de eventos com reordenar/editar/excluir;
  - `CronogramaDuplas` (`:750`) — vínculos de duplas ao cronograma (`VinculoCronograma`).
- `src/components/evento-cronograma-dialog.tsx` — dialog de criação/edição de evento individual.

### Actions (padrão `{error}`/`{ok}`)

- `src/lib/actions-cronogramas.ts`:
  - `atualizarCronograma` (`:190`) — metadados (nome, turma-label, datas, status);
  - `excluirCronograma` (`:233`) — com guarda de vínculos;
  - `salvarEventoCronograma` (`:292`) — upsert de evento;
  - `moverEvento` (`:363`) — reordenação (a `ordem` canônica da 0062);
  - `excluirEvento` (`:392`).

### Leitura

- `src/lib/queries-cronogramas.ts` — `getVinculosCronogramas()` usado pela lista `/turmas` (`src/app/(app)/turmas/page.tsx:34`) e pelo editor.

## Ação

Fechar o Jira apontando `cronograma-editor.tsx` + `actions-cronogramas.ts` como entrega. Nada a replanejar — a edição cobre metadados, eventos (criar/editar/mover/excluir) e vínculos.
