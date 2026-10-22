# REALIZA-182 — plano de implementação

Descrição essencial: criar `dupla_saude_snapshots` (1 row/dupla/dia) populada
por Vercel Cron diário → route handler autenticado que chama `saudadeDaDupla`
(mesma função pura de `src/lib/ciclo.ts:1245`) e faz upsert idempotente em
`(dupla_id, dia)`. Backfill via `?desde=`. Sem pg_cron. Habilita 56 e 52.

## Passo 0 — referências

- `src/lib/ciclo.ts:1245` — `saudadeDaDupla(dupla, eventos, hoje)`; type
  `DuplaSaude` (:808) com `semaforo/motivos/sinais/esperado/feitos/
  registroPendente/pediuApoio/apoioJovem/avaliacaoJovemPendente`.
- `src/lib/queries.ts:347` — `DUPLA_SELECT` (`encontros(*,registro:registros(
  *,autor:profiles!…(nome)))`) — a carga completa que o semáforo consome.
- `src/lib/agenda-coordenacao.ts:399` — exemplo de consumo em lote
  (`for d of ativas → saudadeDaDupla(d, eventos, hoje)`).
- `ciclo_eventos` — calendário por `cronograma_id` (`eventosDoCronograma`).
- Vercel Cron docs + `vercel.json` do repo (verificar se já existe).

## Passo 1 — migration `0106_dupla_saude_snapshots.sql` (número indicativo —
coordinar com 183/170 que também querem 0106/0107: ordenar no merge, todas
idempotentes)

DDL + índice `(dia)` + unique `(dupla_id, dia)` (sdd §1).
Grants: `revoke all from public, anon`; `grant select to authenticated`;
RLS select = coord ∪ supervisor-da-dupla (sdd §2). Sem policies de escrita.

## Passo 2 — `src/app/api/jobs/saude-snapshots/route.ts` [NOVO]

- `export const dynamic = "force-dynamic"`; `GET` only (cron da Vercel chama
  GET; se quiser POST manual, aceitar os dois com o mesmo handler).
- Auth: bearer `CRON_SECRET` → 401. Sem a env: 503 `{erro:'CRON_SECRET nao
  configurado'}`.
- `desde = params.get('desde')` → `hojeBrt` (helper `hojeData()` em ciclo.ts
  — verificar o export; senão criar `dataHojeBrt()` em `src/lib/jobs.ts`
  [NOVO] com `toLocaleDateString('en-CA', {timeZone:'America/Sao_Paulo'})`).
- Loop `for dia of eachDay(desde, hojeBrt)`:
  - `createAdminClient()` → `duplas.select(DUPLA_SELECT).in('status',
    ['ativa','pausada'])` + `ciclo_eventos` de cada `cronograma_id` distinto
    (um fetch, groupby em memória — como `eventosDoCronograma` faz).
  - `saude = saudadeDaDupla(d, eventosDoCrono, new Date(dia+'T12:00:00'))` —
    meio-dia evita edge DST.
  - upsert rows `{dupla_id, dia, ...mapear(saude), fonte}` em lotes de ~200
    (supabase upsert em batch).
- Retorna `{ok:true, dias, duplas, upserts, erros}` + `console.info` resumo.
- `fonte`: `'cron'` no disparo diário; `'backfill'` quando `desde < hoje-1`;
  `'lazy'` reservada pro passo 4.

## Passo 3 — `vercel.json` + env

- `crons: [{"path":"/api/jobs/saude-snapshots","schedule":"0 6 * * *"}]`
- `CRON_SECRET` em Vercel: Production + Preview (e `.env.staging` pra teste
  local). Sem o env a rota devolve 503 — não roda "aberta".
- Verificar tier do plano Vercel: Hobby permite 1 cron 1×/dia — se já houver
  outro cron ativo ou plano não permitir, documentar e adaptar
  (alternativa: GitHub Actions schedule chamando a URL — mesmo handler,
  secret no repo secrets. Escolher no PR com base no plano real).

## Passo 4 — (opcional, recomendado) capture lazy

- `src/lib/jobs.ts` exporta `snapshotDuplaHoje(duplaId, fonte)` — o handler
  chama a mesma função (fonte de verdade única).
- Nos pontos de write quente (`salvarRegistro` em `actions.ts`,
  `resolver_apoio`, encerramento): `void snapshotDuplaHoje(id, 'lazy').catch()`
  — fire-and-forget, nunca bloqueia a action.
- **Não** colocar em `queries.ts` (React.cache + leitura).

## Passo 5 — testes

- `tests/saude-snapshots.test.ts` [NOVO] ou estender `tests/ciclo.test.ts`:
  - dupla com 2 atrasos → row `semaforo='risco'`, `sinais` contém `atraso`;
  - dupla ok → `ok` sem sinais;
  - upsert 2× mesmo `(dupla,dia)` → 1 row, último valor ganha;
  - `desde` de 3 dias → 3 rows/dupla;
  - cron fora de autorização → 401.
- O cálculo já tem suite própria — aqui só se testa orquestração/mapeamento.

## Passo 6 — gates + rollout

1. Migration → staging (`db push --db-url`) → validador REST
   `_valida_0106b_rest.mjs` [NOVO]: mentor não lê, supervisor lê as suas,
   coord lê tudo, anon nega.
2. `CRON_SECRET` nas envs; `vercel.json` mergeado → primeiro deploy manual
   `vercel curl /api/jobs/saude-snapshots -H "Authorization: Bearer …"` ou
   trigger manual no dashboard → conferir rows em staging.
3. Aplicar migration em prod antes do merge (schema-contract).
4. Pós-deploy: backfill inicial opcional `?desde=<início do ciclo>` — só se a
   56 quiser série histórica desde já; senão deixa começar do dia D.

## Rollback

Remover a entrada `crons` do `vercel.json` (para de escrever). A tabela pode
ficar (inerte) ou `drop table` — consumidores ainda não existem.

## Questões em aberto

- Tier Vercel × nº de crons — verificar no painel antes do PR (BLOCKER só se
  já houver cron concorrente).
- `hojeData()` — confirmar o helper exato em `ciclo.ts` (há `toDateStr` e
  helpers de data; usar o que normaliza pra BRT ou criar um).
- Se `sinais[].texto`/`detalhe` contiverem nomes (verificar no PR): manter só
  `{tipo,tom}` no snapshot — sdd §8.
