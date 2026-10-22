# REALIZA-182 — critérios de aceite

## Modelo / RLS (validador REST)

1. `anon`/`authenticated` sem papel: `POST/PUT/DELETE` em
   `dupla_saude_snapshots` → negado (sem grant/policy de escrita).
2. Mentor autenticado: `GET` → `[]`. Supervisor: vê só snapshots das duplas
   em que `duplas.supervisor_id = me`. Coord: vê tudo.
3. `unique(dupla_id, dia)`: segundo insert na mesma chave → conflito (a
   camada usa upsert — o REST puro devolve erro, provando a constraint).

## Job — auth

4. `GET /api/jobs/saude-snapshots` sem header → 401. Com bearer errado → 401.
5. Sem `CRON_SECRET` configurado → 503 com mensagem clara (não roda aberto).

## Job — captura

6. Dadas 3 duplas ativas + 1 pausada + 1 encerrada, então o run do dia
   gera **4** snapshots (ativa+pausada) e nenhum da encerrada.
7. Dada dupla com 2 encontros esperados vencidos e não realizados, então a
   row tem `semaforo='risco'` e `sinais` contém `{tipo:'atraso'}`.
8. Dada dupla em dia, então `semaforo='ok'`, `sinais='[]'`,
   `motivos=['Em dia']` (ou o rótulo real de `motivos[0]`).
9. Idempotência: rodar o job 2× no mesmo dia → mesmas 4 rows, `computado_em`
   atualizado, nenhuma duplicada (count estável).
10. Rodar o job no dia D e D+1 → rows distintas por `dia` (a série cresce).

## Backfill

11. `?desde=<hoje-2>` → 3 rows/dupla (hoje-2, hoje-1, hoje), `fonte='backfill'`
    nas rows retroativas e `'cron'` na de hoje.
12. `?desde=<hoje-90>` sem `confirm` → 4xx com aviso de limite.

## Timezone

13. Rodando o job às 23:30 UTC (20:30 BRT) e às 03:30 UTC (00:30 BRT do dia
    seguinte) → `dia` BRT correto em ambos (20:30 BRT grava o dia D, 00:30
    grava D+1 — nunca UTC).

## Qualidade

14. `npx tsc --noEmit` + `eslint` limpos; `database.types.ts` regen.
15. Vitest: mapeamento `DuplaSaude→row` coberto (semaforo/sinais/contadores);
    `saudadeDaDupla` não foi copiada — handler chama o import de `ciclo.ts`
    (grep no arquivo confirma o import, não reimplementação).

## Rollout

16. Migration aplicada em staging → validador → prod → merge (schema-contract).
17. `vercel.json` com o cron mergeado → job executa no próximo ciclo
    (verificar nos logs da Vercel `crons` ou disparo manual com bearer).
18. Consumidores veem `max(dia)` — a 56 exibe "dados até <data>".
