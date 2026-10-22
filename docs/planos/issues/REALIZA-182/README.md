# REALIZA-182 — `dupla_saude_snapshots` (1 snapshot/dupla/dia, sem pg_cron)

**Jira:** [REALIZA-182] — absorve REALIZA-74 (snapshot diário do semáforo)
**Tier:** B — README, plan, sdd, sdr (leve), acceptance. Sem design.md
(não cria superfície própria — 56/52 consomem).
**Status:** ABERTO — o semáforo é sempre calculado vivo (`saudadeDaDupla`,
`src/lib/ciclo.ts:1245`); não existe persistência histórica.

## Resumo

Hoje o "semáforo" (`DuplaSaude`) é derivado a cada render — não há como
responder "como estava a dupla semana passada?" nem plotar tendência.
A issue cria `dupla_saude_snapshots` [NOVO]: uma row por `(dupla_id, dia)`
com o resultado de `saudadeDaDupla` (semaforo + motivos + sinais + contadores),
idempotente via `upsert` na unique natural.

O problema central: **não existe scheduler no ambiente** — `pg_cron` ausente,
`pg_net` ausente, sem Edge Functions, sem `/api/cron`. O SDD compara as três
rotas viáveis e **recomenda Vercel Cron → route handler autenticado** como
estratégia primária, com backfill lazy quando a rota falhar um dia.

## Escopo

- Tabela `dupla_saude_snapshots` [NOVO]: `dupla_id`, `dia date`, `semaforo`,
  `motivos jsonb`, `sinais jsonb`, `esperado`, `feitos`, `registro_pendente`,
  `pediu_apoio`, `apoio_jovem`, `avaliacao_jovem_pendente`, `computado_em`,
  `fonte` (`'cron'|'lazy'|'backfill'`) — unique `(dupla_id, dia)`.
- Route handler `[NOVO] /api/jobs/saude-snapshots` protegido por bearer
  secret (`CRON_SECRET` — mesmo padrão Vercel Cron documentado), carrega
  duplas+cronogramas via `DUPLA_SELECT` (`queries.ts:347`) e chama
  `saudadeDaDupla(d, eventos, hoje)` — **mesma função pura**, nunca uma cópia.
- `vercel.json` [NOVO ou editar se existir] com `crons: [{path, schedule}]`.
- Backfill: o mesmo handler aceita `?desde=YYYY-MM-DD` para preencher buracos
  (recalcula com dados atuais — limitação registrada: é aproximação, não replay).
- Consumidores (56 dashboards, 52 score) leem a tabela — fora de escopo aqui.

## Decisão do SDD (resumo)

| Rota | Veredito |
|---|---|
| **Vercel Cron → `/api/jobs/saude-snapshots`** | **Recomendada.** Zero infra nova de banco, roda no deploy que já existe, secret único, retry manual trivial. Contra: Hobby tier permite 1 cron/dia (checar plano — se Pro, pode agendar mais fino). |
| `pg_cron`/`pg_net` na Supabase | Rejeitada: exige `create extension` + `db push` fora do pipeline + job em SQL puro recalculando o semáforo (a lógica mora em TS — duplicar em PL/pgSQL é o anti-padrão). Só com refactor "compute via RPC" — caro. |
| Lazy/on-write | Complemento recomendado, não substituto: snapshots só nascem quando alguém abre a página → furados em dias sem uso. Útil como **backfill** e como fonte `'lazy'` em escrita manual (ex.: resolução de apoio). |

Recomendação final: **Vercel Cron diário 06:00 UTC (03:00 BRT) + backfill
lazy idempotente** — se o cron falhar um dia, a primeira leitura da 56 dispara
o preenchimento do buraco (ou o próprio cron do dia seguinte cobre com
`?desde`).

## Dependências

- `saudadeDaDupla` (`src/lib/ciclo.ts:1245`) — fonte única do cálculo.
- `DUPLA_SELECT` (`src/lib/queries.ts:347`) — carrega `encontros+registros`
  embutidos que o semáforo consome.
- Habilita: **REALIZA-56** (tendência/histórico) e **REALIZA-52** (score com
  janela temporal).
- `CRON_SECRET` env [NOVO] em Vercel (prod+preview) e `.env.staging` local.

## Esforço: S–M

Migration curta + route handler + vercel.json + testes do handler com fake
`hoje`. O cálculo já existe — o trabalho é orquestração + idempotência.

## Riscos

- **Falha silenciosa do cron** — se Vercel não disparar, ninguém percebe até
  a 56 mostrar buraco: o handler loga `console.info` + `ia_eventos`? Não —
  `ia_eventos` exige profile (FK). Logar via `console` + retorno JSON; a 56
  mostra "dados até <dia>" (stale state visível — mitigação no plano da 56).
- **Recalc histórico não é replay** — backfill de dia D com dados de hoje dá o
  semáforo *de hoje* para eventos que já existiam em D. Aceitável pra buracos
  curtos; `fonte='backfill'` deixa isso explícito no dado.
- **Volume:** ~40 duplas × 365 = ~15k rows/ano — trivial.

> DECISÃO DERIVADA: idem 169 — middleware allowlist + 401 JSON + vercel.json compartilhado.
