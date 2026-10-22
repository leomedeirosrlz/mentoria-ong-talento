# REALIZA-182 — software design

## 1. Modelo — `dupla_saude_snapshots` [NOVO]

```sql
create table public.dupla_saude_snapshots (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  dia date not null,
  semaforo text not null check (semaforo in ('ok','atencao','risco')),
  motivos jsonb not null default '[]',
  sinais jsonb not null default '[]',   -- [{tipo,tom,texto,detalhe?}]
  esperado int not null default 0,
  feitos int not null default 0,
  registro_pendente boolean not null default false,
  pediu_apoio boolean not null default false,
  apoio_jovem boolean not null default false,
  avaliacao_jovem_pendente int not null default 0,
  fonte text not null default 'cron'
    check (fonte in ('cron','lazy','backfill')),
  computado_em timestamptz not null default now(),
  unique (dupla_id, dia)
);
create index dupla_saude_snapshots_dia_idx
  on public.dupla_saude_snapshots (dia);
```

- `dia` em **America/Sao_Paulo** (`(now() at time zone 'America/Sao_Paulo')::date`
  no SQL; no TS `hoje` já vem do caller — a route passa a data BRT explícita).
- `motivo` (string única) não vira coluna — deriva de `motivos[0]` no read.
- Sem `status`/`trilha`/`turma` denormalizados: quem lê junta em `duplas`
  (o join é barato e evita divergência quando a dupla muda de turma).
- Upsert: `on conflict (dupla_id, dia) do update set` — o último cálculo do
  dia ganha. Razão: um cron atrasado que rode 2× ou um backfill não duplica
  nem trava; o semáforo do dia é "o último estado conhecido daquele dia",
  não o primeiro. `computado_em` diz quando a row foi (re)escrita.

## 2. RLS / grants

- `revoke all from public, anon`; `grant select to authenticated`.
- Policy `for select`: `my_role()='coordenacao'` **ou** supervisor da dupla
  (`exists duplas where supervisor_id=my_profile_id()` — mesmo desenho das
  policies de `duplas`/`registros`). Saúde do semáforo já é visível a esses
  papéis na UI viva; o histórico não amplia escopo.
- Sem policy insert/update/delete: a escrita é só do route handler com
  **service role** (`createAdminClient` server-side — nunca vaza ao client).

## 3. Estratégia de captura — decisão

### Escolhida: Vercel Cron → route handler + backfill lazy

**`src/app/api/jobs/saude-snapshots/route.ts` [NOVO]**

```ts
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("unauthorized", { status: 401 });
  // ?desde=YYYY-MM-DD (default = hoje BRT) → pra cada dia em [desde..hoje]:
  //   carregar duplas (DUPLA_SELECT) + ciclo_eventos do cronograma de cada
  //   saudadeDaDupla(d, eventos, dia) → upsert (dupla_id, dia)
}
```

- Auth: `CRON_SECRET` [NOVO env] — padrão documentado pela Vercel (ela injeta
  `Authorization: Bearer <secret>` quando a env existe). Sem secrets → 503
  com mensagem clara (mesmo espírito do hard-stop dos specs e2e).
- Idempotência: upsert na unique natural — rodar N× no mesmo dia é inócuo.
- Quais duplas: `status in ('ativa','pausada')` no dia — concluída/encerrada
  não ganha snapshot novo (o semáforo delas é congelado; a última row viva já
  registra). Decisão alternativa registrada: snapshot de encerrada com
  `fonte` da row final — **não fazer**: duplicação sem informação nova.
- `vercel.json`:

```json
{ "crons": [{ "path": "/api/jobs/saude-snapshots", "schedule": "0 6 * * *" }] }
```

(06:00 UTC = 03:00 BRT — fora de uso, antes do dia útil; verificar limite de
crons do plano — Hobby=1 job/dia, Pro=mais. Se a conta for Hobby e já tiver
outro cron, BLOCKER: escolher qual roda ou subir tier.)

### Rejeitada: `pg_cron` + `pg_net`

- Habilitar exige `create extension pg_cron` no projeto Supabase — fora do
  pipeline de migrations versionadas (Supabase gerencia via Dashboard; o
  `db push` não cobre `cron.schedule` sem extensão em migration própria —
  na real cobre via `create extension if not exists pg_cron` + `cron.schedule`
  em migration… mas **o semáforo não existe em SQL**: `saudadeDaDupla` é ~280
  linhas de TS puro. Portar pra PL/pgSQL duplica a lógica mais sensível do
  domínio e diverge. `pg_net` chamando o route handler de dentro do banco é
  um Vercel Cron pior (sem retry, sem logs na Vercel, segredo no banco).

### Complemento: lazy/on-write (opcional, recomendado)

- Quando uma action **humana** muda estado que o semáforo lê (`salvarRegistro`,
  `resolver_apoio`, encerramento), chamar `void snapshotDuplaHoje(duplaId,
  fonte='lazy')` fire-and-forget — mesma função do handler, mesmo upsert.
- Efeito: o dia ganha snapshot no momento do evento, não só às 03h — a série
  fica mais fiel. Custo: uma chamada a mais por write quente. Se scope apertar,
  deixar como follow-up — a issue se sustenta só com o cron.
- **Nunca** captura lazy na leitura pública/coord das páginas (queries.ts é
  `React.cache` + RLS do caller — escrever dentro de query é anti-padrão e
  quebraria o cache; escrita só via action ou service role).

## 4. Backfill

- O handler aceita `?desde=<data>`: itera `for dia of range(desde, hoje)`
  recalculando com os dados **atuais** (não replay point-in-time — registros
  e encontros não são versionados). Marca `fonte='backfill'`.
- Uso: primeiro deploy (`desde=<início do ciclo>` — opcional; valor limitado
  porque as datas passadas mudam menos) e recuperação de dias perdidos.
- Limite: `desde` > 60 dias atrás → exige confirmação (`&confirm=1`) pra não
  varrer o ano por engano.

## 5. O que vai no JSON `sinais`

`DuplaSaude.sinais` serializa direto (`Sinal[]` tipado). `proximo`/`motivo`
não entram — `proximo` é derivado por data (stale rápido) e `motivo` =
`motivos[0]`. Tamanho: < 2KB/row na prática.

## 6. Falhas e observabilidade

- Handler retorna `{ok, dia, duplas, inseridos, erros[]}` JSON — visível nos
  logs da Vercel (`pnpm dlx vercel logs` ou dashboard).
- Falha parcial (uma dupla quebra) não aborta o lote: `try` por dupla, erros
  coletados e retornados — um registro ruim não deixa o dia inteiro em branco.
- Sem Sentry automático em route handler? Se `sentry.server.config` cobrir
  (projeto usa Sentry 11 — verificar `instrumentation`), erro vira issue; se
  não, `console.error` basta v1.
- **Stale visível:** consumidores (56) devem mostrar `max(dia)` do dataset —
  "dados até 14/10". Se `hoje - max(dia) > 2`, exibir como stale. Isso é
  instrução pra 56, não código aqui.

## 7. Timezone

O semáforo depende de `hoje` (datas de encontro esperadas). Decisão: **dia
civil America/Sao_Paulo** — o cron das 03:00 BRT já passa da virada; `hoje` no
handler = `new Date()` normalizado pra data BRT (`hojeData()` de
`ciclo.ts` se existir — senão `toLocaleDateString('en-CA',{timeZone})` — usar
o helper do projeto, nunca `toISOString().slice(0,10)` que é UTC e erra entre
21h–00h BRT).

## 8. Invariantes

- A row é o *último* cálculo do dia — nunca "primeiro estado do dia".
- A escrita nunca altera o cálculo vivo: `saudadeDaDupla` continua sendo a
  fonte das telas; a tabela é histórico, não cache.
- Nenhum dado novo de menor: o snapshot guarda o que a UI já mostra pra
  coord/supervisor — sem texto livre (`motivos` são os textos prontos do
  semáforo — curtos, sem PII de menor por construção? **verificar:**
  `s.texto` pode citar nome da dupla/mentor? `saudadeDaDupla` gera textos tipo
  "2 encontros atrasados" — motivos são sobre contagem, não nomes. Sinais
  idem. Conferir no PR; se algum `texto` citar nome, guardar `tipo`+`tom` e
  dropar `texto`/`detalhe` — o sinal sem nome é suficiente).
