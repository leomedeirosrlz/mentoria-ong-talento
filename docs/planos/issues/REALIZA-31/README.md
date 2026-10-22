# REALIZA-31 — Importar Turma 2 (cronograma T2 + duplas do relatório)

- **Jira:** [REALIZA-31](https://kelyng.atlassian.net/browse/REALIZA-31)
- **Tier:** A (implementada)
- **Veredito da auditoria:** **FEITO** — falta só fechar o Jira.

## Evidências de implementação

### Backfill estrutural

- `supabase/migrations/0061_cronogramas.sql:55-78` — a T1 foi materializada como cronograma pela união dos domínios `duplas.ciclo` ∪ `ciclo_eventos.ciclo`; `ciclo_eventos` e `duplas` ganharam `cronograma_id` com backfill por label de turma.

### Script de importação da T2 (Gov.BR)

- `scripts/importar-turma2.ts` — importa o cronograma oficial da T2 + as 26 duplas do relatório de pareamento:
  - dry-run por padrão; `--apply` grava (`:4-8`);
  - idempotente: cronograma T2 existente é reutilizado, eventos só entram se o cronograma estiver vazio, mentorado com dupla ativa é pulado (`:9-13`);
  - split confirmado com a coordenação: duplas 1–10 → T1 (início 08/set), 11–26 → T2 (início 06/out); `demanda` recebe o "Eixo da mentoria" (`:15-20`);
  - resolve pessoas via `src/lib/importar.ts` (`normEmail`, `normNome`, `parseCsv`).

### Convivência T1 × T2 no produto

- `src/lib/ciclo.ts:870-886` — identidade de encontro oficial é `(cronograma_id, numero)`; `eventosDoCronograma` faz o recorte.
- `src/components/nova-dupla-dialog.tsx:656-680` — pareamento escolhe o cronograma da turma.
- `src/lib/demo/data.ts` — dataset demo já roda com T1+T2 simultâneas (cronogramas `:2100`, eventos `:365+`).

## Limite conhecido (não replanejar aqui)

- A T2 entrou via **script dedicado** — a parametrização genérica "nova turma sem código" (T3 em diante) é **REALIZA-167** (`turma_inscricoes`, `resumo_links`, semáforo multi-turma). A 31 cobria só a T2 e está entregue.

## Ação

Fechar o Jira apontando `scripts/importar-turma2.ts` + `0061_cronogramas.sql` (backfill) como entrega.
