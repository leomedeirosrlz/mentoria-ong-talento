# REALIZA-178 — sdd.md

Arquitetura técnica: 4 blocos independentes (exports, hub, digest+cron,
narrativa). Cada bloco cita as peças reais que reusa e o que é `[NOVO]`.

## 1. Camadas e responsabilidades

```
src/lib/relatorios/            [NOVO dir]
  csv-core.ts        extrai celula/csvResponse/nomeCsv* de api/export/route.ts
  csv.ts             csvAderencia … csvAssinaturasPendentes  (puras)
  dados.ts           fetchers server-side por tipo (client da sessão)
  agregados.ts       agregadosDoCiclo() → AgregadosCiclo (sem campos de texto livre)
  digest.ts          montarDigestSemanal(supabase) → {assunto, html, nDuplasRisco…}
  narrativa.ts       prompt do ciclo + chamada via ia/provider.ts (dep 179)
(src/lib/saude-snapshots.ts NÃO entra aqui — a escrita dos snapshots é
 da 182, via job diário próprio `/api/jobs/saude-snapshots` em
 vercel.json; a 178 só LÊ a tabela na seção Tendência)

src/app/api/export/route.ts        +8 ramos no dispatcher; demo parity
src/app/api/jobs/digest-semanal/     [NOVO] route GET cron
src/app/(app)/relatorios/page.tsx  hub: nav de seções + filtros
src/app/(app)/relatorios/secoes/   [NOVO] saude.tsx aderencia.tsx pendencias.tsx
                                   operacao.tsx encerramento.tsx (grade = builder atual)
src/lib/actions-email.ts           + enviarDigestSemanal() (botão manual)
src/lib/actions-relatorios.ts      [NOVO] gerarNarrativaCiclo() (server action)
vercel.json                        [NOVO] crons
src/lib/supabase/middleware.ts     + "/api/jobs/" na lista pública
supabase/migrations/0107_emails_digest.sql   [NOVO] CHECK tipo += 'digest'
supabase/migrations/0108_ia_canais.sql       [NOVO] canal CHECK += 'narrativa','importacao'
```

A migration 0108 escreve o **superset** `('chat','mcp','narrativa','importacao')`
tanto no CHECK da tabela quanto na validação de `registrar_ia_evento` — a
REALIZA-180 carrega a mesma convergência; qualquer ordem de apply converge.
Acompanha no TS: `CanalIa = "chat" | "mcp"` (`tools.ts:36`) ganha os dois
valores novos — tipo local, não gerado do banco.
Convenção de migration: `begin/commit`, `drop constraint if exists`,
`create or replace function`, grants explícitos, header explicando
(0083:1-8 é o modelo).

**Regra antes de escrever as migrations**: conferir no banco o constraint
name e o conjunto atual (`pg_get_constraintdef`) — o doc cita o que as
migrations versionadas declaram (0084:1053-1054, 0083), mas o schema real
manda.

## 2. Exports — contrato

Todos seguem o padrão de `route.ts`:

- `GET /api/export?tipo=<t>&turma=<slug>` → 401 sem sessão, 403 sem
  `papeisDoUsuario` incluir `coordenacao` (`route.ts:127-134`), 200 com
  `text/csv; charset=utf-8` + `Content-Disposition` com filename datado.
- Delimitador `;`, BOM `\ufeff`, células sempre com aspas e `celula()`
  anti formula-injection (`route.ts:10-19`). Reusar — não reescrever.
- Filtro `?turma=`/`?cronograma=` nos fetchers: join `duplas.cronograma_id
  → cronogramas.turma` igual `filtraCsvCiclo` (`route.ts:183-191`); o
  fetcher recebe `{ turma?: string; cronogramaId?: string }` e aplica no
  `.in("dupla_id", …)`/`duplas` antes de explodir linhas.
- Demo: bloco `if (demo)` da rota (`route.ts:36-109`) ganha os 8 ramos;
  dados vêm de `getDemoData()`/`demoDuplas("coordenacao")`
  (`src/lib/demo/data.ts`, `demo/queries.ts`). Tipo sem cobertura demo →
  CSV header-only.
- **Colunas com nome**: os exports operacionais carregam primeiro nome /
  nome completo de adultos (mentor/supervisor/autor) — mesmo padrão do
  `ciclo` atual; mentorado aparece como primeiro nome onde a linha é
  identificável (ver sdr.md §digest para a regra de nome no e-mail).

Assinatura das funções puras:

```ts
// src/lib/relatorios/csv.ts — cada uma devolve o CSV completo (BOM+linhas)
export function csvAderencia(linhas: LinhaAderencia[]): string;
export type LinhaAderencia = {
  turma: string; trilha: string; mentor: string; mentorado: string;   // 1º nome
  esperados: number; realizados: number; atrasoMedioRegistroDias: number|null;
  avaliacaoMedia: number|null; semaforo: Semaforo; motivos: string;
};
```

`LinhaAderencia` é computada sobre `encontros`×`registros`×`ciclo_eventos`
via `encontroEsperado`, `diasAtrasoRegistro`, `saudadeDaDupla`
(`src/lib/ciclo.ts:948, 2005, 1245`) — zero lógica nova de semáforo.

## 3. Hub — estrutura

- `page.tsx` (server): `PageHeader` + `<RelatoriosNav secao>` (chips com
  `filterChipCls`, padrão `duplas-lista`) + `<FiltroTurmaCronograma>`
  (component novo — dois `Select` existentes de `ui/select`) + seção.
- `secao` vem de `searchParams`; default `saude`. `grade` renderiza o
  `RelatorioBuilder` atual **sem mudança** — o builder continua sendo o
  export livre.
- Cada seção nova = server component que chama o fetcher de `dados.ts` com
  o recorte e renderiza: (a) cards de destaque (`ui/card`, `ui/badge`),
  (b) preview `RelatorioCanvas` **read-only** com `linhas.slice(0,8)` +
  contador "+N linhas no CSV", (c) `Button`/`a` "Baixar CSV completo".
- `RelatorioCanvas` (`src/components/relatorio-canvas.tsx`) tem prop
  `editavel` default `false` (edição inline só com `__alvos` +
  `onSalvarCampo`) — previews passam sem ela; `storageKey` única por
  seção+recorte pra persistir larguras.
- Tendência do semáforo (só se 182 landed): série de `dupla_saude_snapshots`
  agregada por dia → mini-tabela/bars em CSS (sem lib de charts — padrão
  do app, `telas-mapa.md` confirma que não há recharts/d3). Feature-detect:
  se a query falhar com tabela ausente (42P01/PGRST205) omite o bloco —
  **não declarar a tabela em `database.types.ts` antes de aplicada**
  (schema-contract).

## 4. Tick semanal + digest

`src/app/api/jobs/digest-semanal/route.ts`:

```ts
export const dynamic = "force-dynamic";
export async function GET(request: Request) {  // Vercel cron chama GET
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  // helper novo pequeno (2 linhas): seg 00:00 da semana corrente em BRT —
  // mesma derivação de dow que resumoSemanaDe usa (ciclo.ts:987-989)
  const semana = semanaISODaSegunda(new Date());
  // dedup: digest já ENVIADO esta semana? (só rows com enviados>0 —
  // tick que rodou com envio desligado não bloqueia o envio real)
  const { count } = await supabase.from("emails_enviados").select("id",
    { count: "exact", head: true }).eq("tipo", "digest")
    .gt("enviados", 0).gte("created_at", semana.inicioISO);
  if (count) return Response.json({ ok: true, skipt: "digest já enviado" });
  // snapshots NÃO são escritos aqui — o job diário da 182 cobre
  const digest = await montarDigestSemanal(supabase, semana);
  // enviarEmailsIndividuais({mensagens:[{to,subject,html}]}) — email.ts:134,
  // respeita o kill switch e não recebe client (o insert no log é nosso)
  const res = await enviarEmailsIndividuais({ mensagens: digest.mensagens });
  await supabase.from("emails_enviados").insert({ autor_id: null,
    tipo: "digest", assunto: digest.assunto, audiencia: ["coordenacao"],
    destinatarios: digest.mensagens.length, enviados: res.enviados,
    falhas: res.falhas });
  return Response.json({ ok: true, enviados: res.enviados });
}
```

- **Dedup** via `emails_enviados` (`tipo='digest'`, 0056 + check da 0107)
  — sem tabela nova. `autor_id` é nullable (0056:9) → `null` no cron.
- `montarDigestSemanal` compartilhado com a action manual
  `enviarDigestSemanal()` (mesma função, `autor_id` = coord quando manual).
- Conteúdo do digest (pt-BR): `textoResumoSemana` (`ciclo.ts:1227`) +
  seções: "duplas em risco" (mentorado = primeiro nome + motivo),
  "registros pendentes", "presenças de formação", "assinaturas vencendo
  ≤14d", CTA `https://realizavc.vercel.app/relatorios`. Layout via
  `emailLayout` (`src/lib/email-templates.ts`).
- **Falha parcial**: se `enviarEmailsIndividuais` retornar `falhas`, o log
  registra (mesmo padrão dos disparos atuais, `actions-email.ts`).
- **`EMAIL_ENVIO_LIBERADO=false`** (hoje): `enviarEmailsIndividuais`
  retorna `{enviados:0, falhas:[...], error:"Envio de e-mail
  desativado…"}` (`email.ts:146-153`). Regra do tick: **sempre** grava a
  row `emails_enviados` (é a auditoria de que o tick rodou — com
  `enviados:0`+`falhas` quando desligado), mas o **dedup conta só rows
  com `enviados > 0`** — "digest enviado" ≠ "tick rodou". Assim, quando a
  flag ligar no meio da semana, o envio real ainda acontece. O tick
  responde `{ok:true, enviados:0}` — sem tratar como falha do job. Ligar
  envio em prod é decisão separada (flag + Resend já ok).
  Atenção: `dispararParaRoles` tem `tipo: "comunicado"|"material"` fechado
  — **não** reusar; o digest chama `enviarEmailsIndividuais` + insert
  direto em `emails_enviados` (admin client burla RLS no cron; `autor_id`
  null).
- Middleware: adicionar `p.startsWith("/api/jobs/")` à lista pública de
  `updateSession` (`src/lib/supabase/middleware.ts:51-74`) — sem isso o
  proxy redireciona pra `/login` antes da rota ver o Bearer.
- Horário: `schedule: "0 12 * * 1"` (seg 09:00 BRT). Vercel agenda em UTC;
  sem DST no Brasil desde 2019 — estável.

## 5. Narrativa LLM (fase 2)

```ts
// src/lib/relatorios/narrativa.ts
export async function gerarNarrativaCiclo(supabase): Promise<
  { error: string } | { ok: true; texto: string }> {
  if (process.env.IA_NARRATIVA_OK !== "1") return { error: "Narrativa desligada." };
  const ag = await agregadosDoCiclo(supabase);           // só números
  const t0 = Date.now();
  const r = await chamarModelo({                          // de src/lib/ia/provider.ts (179)
    system: PROMPT_NARRATIVA,                             // "escreva prosa executiva em pt-BR…"
    user: JSON.stringify(ag),                             // agregados JSON, zero PII
  });
  await supabase.rpc("registrar_ia_evento", { p_canal: "narrativa",
    p_tool: "narrativa_ciclo", p_args: { agregados: true, ciclo: ag.cicloId },
    p_ok: !r.error, p_erro: r.error ?? null, p_duracao_ms: Date.now() - t0 });
  …
}
```

- `AgregadosCiclo` **por construção não tem campo de texto livre** — o tipo
  só declara `number`/`{enum:number}`/distribuições. O review de LGPD é
  verificável olhando o tipo (listado no sdr).
- Botão na seção Saúde: `NarrativaCicloButton` (client) → server action →
  `sonner` toast + renderiza prosa num `Card` com rodapé "gerado por IA
  sobre números agregados do ciclo — confira antes de compartilhar".
- Provider: mesmo `src/lib/ia/provider.ts` da 179 (`IA_API_BASE`,
  `IA_API_KEY`, `IA_MODEL`, `IA_TIMEOUT_MS`). Sem provider configurado →
  botão nem renderiza (`providerConfigurado()`).
- `canal='narrativa'` exige a migration 0108.

## 6. Decisões registradas

| # | Decisão | Alternativa rejeitada |
|---|---|---|
| 1 | Digest e página convivem (e-mail = empurrão + link) | só página — decisão 10 antiga está superada pela doc-fonte |
| 2 | Vercel cron + `CRON_SECRET` | pg_cron (não existe), edge function (não existe), GitHub Actions cron (acopla CI a runtime; fica como fallback se Vercel cron falhar) |
| 3 | Dedup por `emails_enviados.tipo='digest'` + semana | tabela `digest_envios` nova — log existente basta |
| 4 | Narrativa só sobre `AgregadosCiclo` tipado | mandar linhas de CSV — violaria zero-PII por construção |
| 5 | Canal `narrativa`/`importacao` via CHECK superset convergente | tabela de canais / canal genérico 'app' — CHECK existente é a fonte, superset evita conflito de ordem de migration com a 180 |
| 6 | Snapshot **não** é escrito nesta rota — o job diário `/api/jobs/saude-snapshots` da 182 (já planejado) cobre; o digest só lê | gravar no tick semanal — duplicaria a escrita e o cron diário dela tem cadência própria |
| 7 | Filtro turma/cronograma reusa `filtraCsvCiclo` pattern | filtros novos por data/livre — YAGNI na fase 1 |
