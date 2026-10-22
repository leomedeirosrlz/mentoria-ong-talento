# Ops map — CI/CD, testes, observabilidade, segurança e operação

> Recon do repo (cópia local `~/nb/realiza.vc`, sem git/build). Tudo citado
> `path:linha`. Nada aqui executou contra remoto.

## 1. CI/CD — `.github/workflows/`

Quatro workflows, nenhum workflow de deploy próprio (o deploy é a integração
Git→Vercel do projeto). Node 24 + pnpm via `pnpm/action-setup@v4` (versão sai
de `packageManager`, nunca pinada no workflow — `e2e-app.yml:22-24`).

### `ci.yml` (`.github/workflows/ci.yml`)

- **Triggers:** `push` + `workflow_dispatch` (`ci.yml:7-9`). Sem `pull_request`
  de propósito: o status cai no commit e aparece no PR (comentário `:3-6`).
- **Concurrency:** `ci-${{ github.ref }}`, `cancel-in-progress: true` (`:11-13`).
- **Job `gates`** (`:19-35`, timeout 15min): checkout → pnpm → `pnpm install
  --frozen-lockfile` → `pnpm exec next typegen` (LayoutProps/PageProps gerados
  em `.next/types`, sem ele o tsc quebra em checkout limpo) → `npx tsc
  --noEmit` → `npx eslint src/` → `pnpm test` (Vitest).
- **Job `schema-contract`** (`:39-53`, timeout 5min): roda
  `scripts/check-schema-contract.mjs` — compara colunas declaradas em
  `src/lib/database.types.ts` (bloco `public.Tables`) com o OpenAPI do
  PostgREST remoto (`GET /rest/v1/`); **falha se o código declara coluna que o
  remoto não tem** (avisa, não falha, no sentido inverso). Aponta pra
  **produção** de propósito (`:42` — é o schema que o deploy usa). Se os
  secrets estiverem ausentes, pula com `::notice::` (`:49-53`).
- **Secrets usados:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (prod).

### `e2e-app.yml` — manual, stack local (`e2e-app.yml`)

- **Trigger:** só `workflow_dispatch` (`:9-10`). A cobertura do dia a dia é o
  e2e-preview; este valida migration/stack local à mão — um `supabase start`
  quebrado falha aqui antes de qualquer apply remoto.
- **Job `e2e`** (timeout 25min): `pnpm exec supabase start` no runner (Docker
  funciona lá) → `supabase status -o env` desquotado pro `$GITHUB_ENV`
  (`:36-39`) → **gate de freshness de types**: `supabase gen types
  typescript --db-url $DB_URL`, extrai o bloco `public:` dos dois arquivos e
  `diff` contra `src/lib/database.types.ts` — divergir = erro com instrução
  de regen (`:44-68`) → `pnpm build` + `pnpm start` em `:3000` com
  `NEXT_PUBLIC_*`/service do stack local + `RESEND_API_KEY` placeholder +
  `EMAIL_FROM` (`:69-79`) → `playwright install --with-deps chromium` →
  `node scripts/seed-e2e-staging.mjs` → `pnpm test:e2e` (demo + app).
- **Secrets:** `E2E_COORD_PASSWORD` (opcional — fallback `e2e-senha-teste`,
  `:89`). Todo o resto vem do `supabase status` local.
- Upload do `playwright-report/` só em `failure()` (`:104-108`).

### `e2e-preview.yml` — o gate real (`e2e-preview.yml`)

- **Trigger:** `deployment_status` (`:9-10`) — roda quando o Vercel marca um
  deploy como `success`.
- **`if` do job** (`:37-40`): `state == 'success'` E environment ∈ {`Preview`,
  `Preview – realiza.vc`} — tolera os dois formatos de nome conforme o nº de
  projetos Vercel conectados (comentário `:32-36`).
- **Concurrency** (`:20-23`): grupo `e2e-preview-<environment>`,
  `cancel-in-progress: false` — serializa a suite por environment (fixtures
  compartilhadas colidiriam entre branches; histórico do deployment órfão no
  comentário `:12-19`).
- **Guard de secret primeiro** (`:43-51`): sem `VERCEL_AUTOMATION_BYPASS` o
  run pula inteiro com notice — não gasta ~1min de checkout/install.
- **Não re-seeda** (`:65-69`): pisos `convergirPiso` re-criam estado volátil;
  re-seed a cada push derrubava o PostgREST do free tier. Staging recriado →
  `pnpm seed:e2e` manual com `.env.staging`.
- `pnpm test:e2e` contra `deployment_status.target_url`, timeout 25min (suite
  ~89 specs em 1 worker, ~14min — `:28-31`).
- **Secrets:** `VERCEL_AUTOMATION_BYPASS`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_COORD_PASSWORD` (opcional). Emails/
  senhas de teste são literais no env (`:78-85`).

### `e2e-nightly.yml` — smoke em prod (`e2e-nightly.yml`)

- **Triggers:** `cron: "0 12 * * *"` (09:00 BRT) + `workflow_dispatch` (`:5-8`).
- **Job `demo-smoke`** (timeout 15min): `E2E_BASE_URL=https://realizavc.vercel.app`,
  roda só `pnpm test:e2e:demo` — superfície pública, não escreve nada.
  **Sem secrets.**

### Vercel — deploy, Ignored Build Step, previews

- **Sem `vercel.json` no repo.** O Ignored Build Step é config do projeto na
  Vercel (não versionada — a verificar no dashboard). O contrato documentado
  em `AGENTS.md:52`: o deploy é gated pela tag **`[deploy]` na mensagem do
  commit** — sem a tag o Ignored Build Step cancela o build. Consequência
  registrada em `_issues.json` (desc. da 166): hoje `e2e-preview` "sai
  skipped" quando não há deploy.
- Dia a dia sem deploy: push roda `ci.yml` + e2e local (`supabase db reset` →
  `pnpm seed:e2e`+`seed:demo` → `pnpm build`/`start` em `:3100` com
  `NEXT_PUBLIC_*` locais exportadas **antes** do build — são embutidas no
  bundle — → `pnpm test:e2e`, ~148 specs ~6min; `AGENTS.md:52`).
- `ssoProtection = null`: previews `.vercel.app` abrem sem SSO da Vercel;
  alias por branch `realizavc-git-<branch>-thisux1s-projects.vercel.app`;
  `x-robots-tag: noindex` em previews (`AGENTS.md:65`). O bypass
  `VERCEL_AUTOMATION_BYPASS` é mantido mesmo com SSO desligado.
- Branch `staging` permanente + `staging.realiza.vc` (gitBranch na Vercel):
  merge `main → staging` atualiza o ambiente com backend de staging; depende
  de DNS `A staging → 76.76.21.21` DNS-only na Cloudflare (`AGENTS.md:66`).
- Ordens duras (`AGENTS.md:53-54`): nada vai pra prod sem preview verde;
  migration nova aplica em staging antes/junto do push e em prod antes do
  merge (senão `schema-contract` e `e2e-preview` quebram).

## 2. E2E — `tests/e2e/`

`playwright.config.ts`: `testDir tests/e2e`, timeout 30s, `retries: 1` só em
CI, **`workers: 1` sempre** (specs app dividem fixtures; `:14-17`), reporter
github+html em CI, trace `on-first-retry`, screenshot `only-on-failure`,
locale pt-BR, `baseURL = E2E_BASE_URL ?? http://localhost:3000` (`:8`). Nunca
sobe servidor — sempre contra um deploy/dev server já no ar. Projetos:
`demo` (`demo/**/*.spec.ts`) e `app` (`app/**/*.spec.ts`, timeout 60s —
preview frio com 2+ logins estourava os 30s; `:37`). Scripts:
`pnpm test:e2e` / `:demo` / `:app`.

### `tests/e2e/helpers.ts` (compartilhado)

- `test` estendido (`:7-25`): injeta `x-vercel-protection-bypass` **só na
  origem do baseURL** via `page.route` — `extraHTTPHeaders` vazaria o token
  pras chamadas browser→supabase.
- `apiGetApp` (`:34-39`): GET fora do browser com o header explícito (o
  `APIRequestContext` não passa pelo route).
- `pularOnboarding` (`:45-68`), `entrarNaDemo` (`:74-92` — seta cookies
  `demo_role` + `demo_onboarded_<papel>` sem passar pela UI).
- `loginComSenha` (`:99-119` — login por senha existe só pra teste; magic
  link não é automatizável), `relogar` (`:123`), `agirComConfirma`
  (`:133-149` — clique com retry pra pré-hidratação de RSC), `isoDoRotulo`
  (`:156-168` — "terça 14/10 às 19:30" → ISO -03:00).
- **Hard-stop anti-prod** (`:170-186`): `PROD_REF = "yhjzmxleotahijinjepl"` —
  `appEnvOk()` exige `E2E_MENTOR_EMAIL`/`PASSWORD` + `E2E_SUPABASE_URL` sem o
  ref de prod + service key; sem credenciais o spec **pula**, não falha.
- CRUD via service role (cada função re-confere o hard-stop):
  `limparViaServiceRole` (`:190`), `limparEncontrosDaDupla` (`:208` — filhos
  da 0071/0084 antes do pai: chamados→avaliações→links→encontro),
  `buscarViaServiceRole` (`:251`), `inserirViaServiceRole` (`:270`),
  `atualizarViaServiceRole` (`:297`), `rpcViaServiceRole` (`:323`),
  `jwtDoUsuario` (`:350` — grant password do GoTrue) e `restComoUsuario`
  (`:377` — apikey service + Bearer do usuário: assert de RLS "na pele do
  papel", quer o status cru, não throw).

### Convenção `convergirPiso` (specs app)

Spec que depende de fixture compartilhada **re-cria** o estado no beforeEach
(e muitas vezes no afterEach): apaga encontros fora da lista de fixture por
exclusão, re-insere/re-carimba as rows-âncora, zera sinos de notificação —
ver `tests/e2e/app/jovem-agenda.spec.ts:93-152` (molde canônico),
`agenda-views.spec.ts:99`, `avaliacao.spec.ts:144`,
`especialista-agenda.spec.ts:109`, `agenda-coordenacao.spec.ts:22`,
`operacional.spec.ts:19`, `jovem.spec.ts:17`. Razão (`AGENTS.md:64`):
PATCH-only morre em retry quando o afterAll de outro arquivo deleta a row;
o insert dispara triggers (mint de `avaliacao_links`, notificações) que o
piso precisa cobrir. Asserts pós-write com `{ timeout: 15_000 }` (roundtrip
server action + `router.refresh()` em preview frio > 5s default).

### Inventário de specs

**`demo/` — 17 arquivos, ~68 testes.** Públicos/seguros em qualquer ambiente
(não escrevem; cookie `demo_role`). Cobrem: entrada+onboarding+stub
(`smoke.spec.ts` — inclui checagem de dataset demo sem aviso no console),
agenda por papel (dpp, extras, coordenação, auxiliar, especialista,
disponibilidade, views, grade-dia), chamados, currículo do mentorado,
matriz de disponibilidade, híbrido, instrumentos, especialistas/jornada do
jovem, remanejo-capacidade.

**`app/` — 20 arquivos, ~94 testes.** Login real por senha + writes em
staging/stack local (pulam sem `appEnvOk`). Cobrem: agenda coord
(monitoramento, escopo supervisor × coord, **lembrete real com cap 48h** —
`agenda-coordenacao.spec.ts`), overlay de disponibilidade, agenda híbrida,
visões Semana/Horários com agendamento por clique no slot, avaliação estrela
do jovem (link público consumido de verdade, "Preciso de ajuda"→chamado),
agenda do especialista (grade+exceções→projeção de slots), guarda de
instrumentos em "Enviar formulário", agenda livre do jovem (agendar/
remarcar c/ motivo/desmarcar/não aconteceu — `timezoneId: America/Sao_Paulo`
por causa do datetime-local naïve, `jovem-agenda.spec.ts:183`), auto-emissão
de instrumentos da jornada, pedido de especialista pelo jovem (dedup por
par, broadcast pro mural, contra-proposta), WP6/WP6-R2 (sugestão do mentor,
devolutivas, catálogo), onboarding do jovem, diretório do jovem (opt-in de
contato, 404 de não-autorizado, staff fora da dupla), shell /jovem
(combinado via RPC, chamado nunca vai pro mentor), painel /materiais,
fluxos do mentor DPP (link da chamada, remarcação), operacional da coord
(fila "Aguardando par", remanejo+sucessora, import CSV de pareamento,
builder de cronograma, remanejo sugerido por risco), solicitação de
especialista v2 staff (expirado, aceite, justificativa de recusa), e
terceiros (convite→resposta pública→consolidado).

### Fixtures

- `scripts/seed-e2e-staging.mjs` (`pnpm seed:e2e`, 1676 linhas): idempotente,
  IDs fixos `e2e00000-*` (`:65-135`). Cria mentor DPP+auth user (com
  `senha_em` → pula definir-senha), mentorado, dupla DPP, coord+auth, mentor
  reserva + 2ª dupla, mentorado livre (fila/remanejo), par livre p/ import,
  shell /jovem (profile+auth+jovem vinculado, combinados, encontro futuro, 2
  assinaturas), encontro realizado nº16 s/ avaliação (trigger minta link
  /avaliar), especialista+trilha+grade (ter 19–21h), 2º especialista, jovem
  sem DPP (triagem `aguardando_coord`), colega c/ conta e DPP pausada
  (diretório), jovem do onboarding, supervisor c/ login ligado por
  `duplas.supervisor_id`, mentor híbrido (DPP+esp) e 3 chamados. Blocos
  `profile_papeis`/`chamados` são defensivos (pulam se a tabela não existe).
  Hard-stop de prod em `:54-60`. Requer `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_MENTOR_PASSWORD` (`E2E_COORD_PASSWORD`
  opcional).
- `scripts/seed-demo-staging.mjs` (`pnpm seed:demo`, ~89k): dataset realista
  `de000000-*` (24 profiles, 16 duplas, ~94 encontros, avaliações, mural,
  supervisões, assinaturas, formulários — `AGENTS.md:63`), cleanup só do
  range `de*`, preserva `e2e00000-*` e dados manuais. Senha `DEMO_PASSWORD`
  (default `realiza123`, `:24`). Contas `coord@/supervisora@/mentor@/
  especialista@/jovem@realiza.test`. Mesmo hard-stop de prod.
- `supabase/seed.sql`: **só domínio** — cronograma oficial `ciclo_eventos`
  (modelo 0062: `ordem` explícita, tipos `etapa_preparacao|formacao|
  encontro|recesso|evento_encerramento`, CHECK de data null) + materiais.

## 3. Vitest — funções puras

`vitest.config.mts`: `environment: "node"`, `TZ: "America/Sao_Paulo"`
(fixtures âncoram em meio-dia SP), alias `@→src`, include
`tests/**/*.test.ts` + `src/**/*.test.ts` (spec colocada:
`src/lib/jornada.test.ts`). `pnpm test` = `vitest run`, roda no job `gates`.

`tests/helpers.ts` — factories tipadas (`mkProfile`, `dt()`, `dth()`),
datas do ciclo fixas (2025-10-07→2026-01-20), `hoje`/`agora` sempre por
parâmetro — nada depende do relógio.

Cobertura por arquivo (40 arquivos + 1 colocada, ~750 `it/test`):

- **Semáforo/ciclo**: `ciclo-semaforo.test.ts` (saudadeDaDupla: congelamento
  por status, apoio como eixo separado, risco/atenção, pendência de
  registro, preventivo, combinado, sinais da avaliação do jovem 0071),
  `ciclo-semana.test.ts`, `ciclo-agendamento.test.ts` (passo oficial,
  alvoAgendamento, especialista numero=tentativa 0074),
  `ciclo-cronogramas.test.ts` + `ciclo-eventos-0062.test.ts` (sequência por
  `ordem`, denominador só `encontro`, isolamento entre cronogramas),
  `ciclo-formatacao.test.ts` (datas/fuso, disponibilidade grid e
  cruzamento por hora REALIZA-25), `ciclo-jornada.test.ts` (marcos, âncora,
  acervo progressivo), `gerador-cronograma.test.ts` (espelho dos CHECKs 0062).
- **Agenda por papel**: `agenda-minha/auxiliar/coordenacao/especialista`
  (bucketing Hoje/Amanhã/Próximos, warnrows, escopo, grade do especialista
  c/ exceções datadas e sessões).
- **Forms/instrumentos**: `forms-schema.test.ts` (validaCampos, agregação,
  extração Roda da Vida/metas), `instrumentos.test.ts` (dispatcher /f,
  geometria da roda, coleta sob medida × genérica).
- **Importação**: `importar.test.ts` (parseCsv, normalizadores),
  `importar-duplas.test.ts` (resolução de pares), `importar-registros.test.ts`
  (maior, ~28k), `normaliza.test.ts` (texto/email/telefone/url/data/enums
  fuzzy), `bench-import.test.ts` (`describe.skipIf` sem `BENCH_ROSTER`/`BENCH_CSV`).
- **Matching/fila**: `remanejo.test.ts` (afinidadeScore, teto por trilha,
  ranqueamento), `fila.test.ts` (carimboFormBruto serial Excel, esperaDesde,
  filas de mentorados/mentores), `saida-mentorado.test.ts`.
- **E-mail/assinatura**: `email-fanout.test.ts` (rolesParaAudiencias +
  kill-switch), `email-templates.render.test.ts` (EMAIL_PREVIEW grava HTMLs
  em /tmp), `assinatura-lote.test.ts` (faltantes, msg de link), `avatar-documentos.test.ts`.
- **IA**: `ia-tools.test.ts` (registry: validação zod, gate de papel,
  allowlist, auditoria ia_eventos — ~18k).
- **Segurança**: `sentry-scrub.test.ts` (evento+span), `utils.test.ts`
  (`pathInterno` anti-open-redirect, erroAmigavel, cpfValido, máscaras).
- **Demo/jovem**: `demo-datas.test.ts` (dataset evergreen),
  `diretorio-jovem.test.ts`, `jovem-especialista.test.ts`,
  `trilhas-coord.test.ts`, `chamados.test.ts`, `encerramento.test.ts`,
  `curriculo-mentorado.test.ts`, `relatorio.test.ts` (montarLinhas,
  parseConfig do resumo público).

## 4. Sentry

`@sentry/nextjs` (dep em `package.json`). **3 runtimes, mesmo desenho**:

- `src/instrumentation.ts` — `register()` carrega `sentry.server.config`
  (nodejs) / `sentry.edge.config` (edge); exporta
  `onRequestError = Sentry.captureRequestError`.
- `src/instrumentation-client.ts` — init do browser:
  `environment = NEXT_PUBLIC_VERCEL_ENV ?? NODE_ENV` (`:12`),
  `tracesSampleRate` 1 dev / 0.1 prod (`:15`), `onRouterTransitionStart`.
- `sentry.server.config.ts` — `environment = VERCEL_ENV ?? NODE_ENV` (`:12`),
  `debug = SENTRY_DEBUG === "1"` (`:55`).
- `sentry.edge.config.ts` — idem server.
- DSN público inline nos 3 (não é segredo; org `realizavc`, projeto
  `realizamentoria-nextjs`).

**`dataCollection` (idêntico nos 3, client `:19-46`):** `userInfo:false`,
`graphQL` off, `genAI.inputs/outputs:false`, `databaseQueryData:false`,
`queues:false`, `stackFrameVariables:false` (locais carregam dados_civis/
tokens), `httpBodies:[]`, `httpHeaders.deny` = forwarded/-ip/remote-/via/
-user/cookie/authorization/referer/bypass/protection, `cookies.deny`,
`urlQueryParams.deny` (+ `next`, `token`, `code`). Client ainda tem
`ignoreErrors` (ResizeObserver, AbortError) e `denyUrls` (extensões de
browser) (`:49-59`). **Sem Session Replay** (menores — decisão registrada
em `_contexto-agentes.md:43` e AGENTS.md:83).

**`src/lib/sentry-scrub.ts`** (104 linhas, usado nos 3 via `beforeSend` +
`beforeSendSpan`): regex `BEARER_PATH` redacta tokens do path de
`/f|t|assinar|avaliar|resumo|api/assinar-token/` (`:14-15`); `SECRET_PARAM`
redacta `access_token|refresh_token|token_hash|id_token|code|h|state|next|
to|error_code|error_description` em query/fragment (`:17-18`); `scrubUrl`
remove o fragment inteiro (`:22`). Aplica em `request.url`, `query_string`,
header `referer`, `transaction`, `message`, breadcrumbs (message+data —
eco de input inválido do PostgREST) e `exception.values` (`:26-72`).
`scrubSentrySpan` cobre name + attributes + span links — necessário porque
`traceLifecycle: 'stream'` ignora `beforeSendTransaction` (`:74-94`).

**Tunnel `/monitoring`**: `withSentryConfig` em `next.config.ts:75-97`
(`org`, `project`, `widenClientFileUpload: true`, `tunnelRoute:
"/monitoring"`). O path está excluído do matcher do proxy
(`src/proxy.ts:24` — sem a exclusão o POST do browser virava redirect pra
/login). CSP não precisa de domínio Sentry por causa do tunnel.

**Proxy**: `src/proxy.ts` wrap manual `try/catch → Sentry.captureException`
(`:9-14`) — `onRequestError` não recebe erros do proxy (bug upstream
vercel/next.js#85261); um Supabase fora do ar viraria 500 silencioso.

**Source maps**: `withSentryConfig` sem seção `sourcemaps` — upload via
plugin quando `SENTRY_AUTH_TOKEN` existe: `.env.sentry-build-plugin` local
(chave `SENTRY_AUTH_TOKEN`) e env var na Vercel (AGENTS.md:83). Sem o token
o build segue e **skipa upload silenciosamente** — é o caso do job
`e2e-app` (nenhum env Sentry). `widenClientFileUpload: true` já sobe set
maior. Não há `deleteSourcemapsAfterUpload` configurado (a verificar se os
mapas ficam públicos — o servidor de prod serve `.map`? — item de SDR).

## 5. Segurança/privacidade atual

### Headers + CSP (`next.config.ts`)

- `poweredByHeader: false` (`:40`); `allowedDevOrigins` pra dev por LAN/
  Tailscale (`:45-49`).
- Headers em `/:path*` (`:50-72`): **CSP** (`:7-36`) —
  `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'`
  só em dev); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:
  *.supabase.co *.gravatar.com`; `connect-src 'self' https://+wss://
  *.supabase.co` (+ origem não-supabase.co quando `NEXT_PUBLIC_SUPABASE_URL`
  é loopback local, `:22-27`); `font-src 'self'`; `frame-src 'self'
  *.supabase.co` (iframe do Acervo c/ signed URL); `object-src 'none'`;
  `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. Sem
  nonce — `'unsafe-inline'` é trade-off consciente do hydration/RSC.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy:
  camera=(),microphone=(),geolocation=(),browsing-topics=()`,
  `X-Frame-Options: DENY` (fallback p/ browsers sem frame-ancestors), HSTS
  `max-age=63072000; includeSubDomains` (a Vercel já injeta na borda).

### Auth na borda — `src/proxy.ts` + `src/lib/supabase/middleware.ts`

- `proxy.ts:17-25` matcher exclui estáticos, `manifest`, `robots`, `sitemap`,
  `llms.txt`, **`monitoring`** (tunnel), `*opengraph-image*`,
  `*twitter-image*` e extensões de imagem/txt.
- `updateSession` (`middleware.ts`): cookie `demo_role` válido → bypass
  total (`:12-14`); cookie com `secure` conforme o **scheme do request**
  (`:27-30`); `auth.getClaims()` valida JWT local (`:46`).
- Rotas públicas (`:50-75`): `/login`, `/auth/*`, `/demo/*`, `/assinar/*`
  (só com token — `/assinar` sozinho é protegido), `/api/assinar-token/*`,
  `/f/*`, `/t/*`, `/avaliar/*`, `/resumo/*`, `/privacidade`.
- Deslogado fora disso → redirect `/login?next=<path+query>` (`:77-85`);
  logado em `/login` → `pathInterno(next)` sanitizado (guard de open
  redirect — `src/lib/utils.ts`, testado em `utils.test.ts`).
- Signup é **allowlist**: trigger `guard_signup_allowlist` (0045) — só entra
  quem já está pré-cadastrado em `profiles`; magic link de e-mail novo
  falha (login-form.tsx:280-284 mapeia o 500 pra "e-mail não cadastrado").

### Magic link + `login_handoffs`

- Fluxo implícito via `createOtpClient` (`flowType: "implicit"`), destino
  `/auth/link?next=…&h=<nonce>` (login-form.tsx:290). A aba do e-mail
  publica os tokens via RPC `registrar_login_handoff` e cai em
  `/auth/confirmado`; a aba que pediu poll `pegar_login_handoff` →
  `setSession`; link queimado (`#error=`) → `falhar_login_handoff` (0050).
- Tabela `login_handoffs` (0049:7-16): `nonce uuid` PK (128 bits — a
  credencial), `access_token`, `refresh_token`, `expires_at` default
  **+10 min**. RLS on, **zero policies, revoke all** — acesso só pelas duas
  RPCs `security definer` (grants a anon+authenticated, `:53-56`).
- `pegar_login_handoff`: **uso único via DELETE** + varre expirados
  (`:41-46`). `registrar_login_handoff`: `on conflict do nothing`
  (`:29-31`) — anon de propósito (exigir sessão consumiria o refresh).
- Cooldown client 60s no reenvio de link (`login-form.tsx:19`); 429 do
  GoTrue (`over_email_send_rate_limit`/"after N seconds") vira painel de
  cooldown honesto (`:293-311`).

### Tokens públicos — bearer como fator de posse

Modelo comum: **anon não tem grant de tabela nenhuma** (0032 — `revoke all
on all tables from anon` + default revoke; acesso exclusivo via RPCs
`security definer` com gate de status/expiração). Sem tentativa-limit por
token nas RPCs (a verificar — a força é a entropia: uuid v4 ou ≥192 bits).

| Superfície | Token | Single-use | Expiração |
|---|---|---|---|
| `/f/<token>` forms | `formulario_links.token` text ≥20c base64url (~192b, 0036:47); regex `^[A-Za-z0-9_-]{20,128}$` (`forms/actions.ts:27`) | `usado_em` + update atômico `where usado_em is null` (0036:340) — dois submits simultâneos, só um insere | `expira_em` opcional (0036:56); estados link inválido/expirado/encerrado/outra pessoa (`formulario_por_token`) |
| `/t/<token>` terceiros | `terceiros_contatos.token` ≥20c (0103:39) | status `pendente→respondido`, `respondido_em`; update `where status='pendente'` (0103:248) | `expira_em` default **+30d**; expiração lazy no read/submit (0103:215-217,243-244) |
| `/avaliar/<token>` | `avaliacao_links.token` ≥20c (0071:49); mintado pelo trigger encontro→realizado (0071:131) | status `pendente/respondido/expirado`, `respondido_em`, `respondido_por_profile_id` | `expira_em` NOT NULL; lazy expiry (0071:211-213); "expira quando a dupla encerra" (spec autoemit) |
| `/assinar/<token>` + `/api/assinar-token/<token>` | `assinaturas.token` uuid v4, regex `^[0-9a-f-]{36}$` | `status='assinado'` fecha (a via PDF só sai assinada); `regenerar_token_assinatura` coord-only reemite (+30d) | `token_expira_em` +30d; pendente vencida regenera na mesma row (`actions-assinaturas.ts:200-212`) |
| `?h=` handoff | `login_handoffs.nonce` uuid | DELETE no resgate | 10min |

Outros inputs endurecidos: `UUID_RE` em todo id (`forms/actions.ts:23`),
`TOKEN_RE` nos submits, caps de payload — respostas de form ≤200KB serializado
(`forms/actions.ts:448`), terceiros ≤4000c/campo
(`actions-terceiros.ts:213`), consolidado ≤8000c (`:184`), comentário de
avaliação ≤2000c (`actions-avaliacao.ts:32`), import CSV ≤500 linhas
(`actions.ts:2033`, `actions-importar-registros.ts:28`).

### Honeypots anti-spam (finge sucesso, não grava)

- `/f`: campo invisível `website` (`formulario-publico.tsx:472-485`) →
  `submeterRespostaFormulario` retorna `{ok:true}` se preenchido
  (`forms/actions.ts:435-436`).
- `/t`: mesmo molde (`terceiro-publico.tsx:206`) → `actions-terceiros.ts:209-210`.
- `/avaliar`: idem (`avaliacao-encontro-form.tsx:400-410`) →
  `actions-avaliacao.ts:88-89`.
- `/assinar` e `/resumo` **não têm** honeypot (`/assinar` exige dados civis
  válidos; `/resumo` é obscuridade — slug fixo `RESUMO_SLUG_T2` em
  `src/lib/relatorio.ts:5`, mismatch → 404; rotação = redeploy; REALIZA-170
  troca por senha).

### Rate limits existentes (esparsos — não há rate limiter genérico)

- **App**: cap **48h por dupla** pra lembretes tipo `nudge` —
  `LEMBRETE_INTERVALO_MS` (`ciclo.ts:2123`), régua dura na RPC
  `enviar_lembrete` com `pg_advisory_xact_lock(hashtextextended(dupla,94))`
  (0094:89-104, anti-TOCTOU); `/api/nudge` repete o check pra UX
  (`api/nudge/route.ts:79-99`) + dedup 60s por autor/tipo (`:101-109`).
- **Login**: cooldown 60s client + rate limit do GoTrue.
- **GoTrue** (local `supabase/config.toml:207-219` — hosted fica no
  dashboard, a verificar paridade): `email_sent 30/h`, `sign_in_sign_ups
  30/5min`, `token_verifications 30/5min`, `token_refresh 150/5min`,
  `anonymous_users 30/h`; `max_frequency 30s` entre magic links; `otp_expiry
  3600`; `enable_confirmations`/`enable_signup` on; `double_confirm_changes
  false` (`:239`). Sem captcha.
- **Open-redirect guards**: `waMeValido` — destino obrigatoriamente
  `https://wa.me/<dígitos>` (`api/nudge/route.ts:14-25`); `pathInterno` no
  `next` do login.

### `/api/*` routes

`/api/nudge` (log+redirect wa.me, auth ou demo, dedup/cap),
`/api/material/[id]`, `/api/anexo/[id]`, `/api/chamado-anexo/[id]`,
`/api/documento/[id]` — todas: sessão+RLS/ownership → `createSignedUrl(path,
300)` → redirect 302 (signed URL **300s**; `Cache-Control` das vias PDF é
`private, no-store`). `/api/assinar-token/[token]` — pública por token, RPC
`assinatura_completa_por_token` (devolve só o recorte `AssinaturaVia`,
0053). `/api/assinatura/[id]` — via assinada do dono/coord. `/api/export` —
coord-only (403 caso contrário), CSVs `tipo=ciclo|pessoas|assinaturas|…`
(com `?turma=`/`?cronograma=`).

## 6. Scripts operacionais (`scripts/`)

| Script | O que faz |
|---|---|
| `check-schema-contract.mjs` | Ver §1 — types × OpenAPI PostgREST remoto; falha com código à frente do remoto (`pnpm schema:check`). |
| `seed-e2e-staging.mjs` / `seed-demo-staging.mjs` | Ver §2 — fixtures `e2e00000-*` e dataset `de000000-*`, ambos idempotentes c/ hard-stop de prod. |
| `importar-registros.mjs` | CSV do form semanal externo → encontros realizados + registros via RPC `importar_registros` (0082). **Dry-run sem `--apply`**; linhas `revisar` só entram com `--resolve <n>=<dupla_id>`; reuso de `src/lib/importar-registros.ts` via type-stripping Node 22.18+ (header `:1-27`). |
| `importar-avaliacoes.ts` | Versão anterior/mesma tarefa: avaliações semanais → encontros+registros, dry-run default, resolve conflito de numeração por data (header `:1-12`). Rodar com `jiti`. |
| `importar-intake.ts` | Intake real: `equipe.csv` → profiles+mentor_profiles, `mentorados.csv`, `manifest-anexos.json` → bucket `documentos` (row antes do upload, exigência da policy) e fotos → `avatares`. Idempotente, dry-run default (header `:1-14`). |
| `importar-turma2.ts` | Turma 2 Gov.BR: cronograma oficial T2 + 26 duplas do relatório de pareamento; T1/T2 splitado por faixa de dupla; dry-run default (header `:1-16`). |
| `transformar-intake.py` | Google Forms brutos → CSVs canônicos (`equipe.csv`, `mentorados.csv`, `manifest-anexos.json`, `relatorio.txt` de auditoria). Só reorganiza — não inventa dado; o que não mapeia vai pro `form_bruto` (docstring `:1-23`). |
| `limpar-interesses.ts` | Re-deriva `interesses` do `form_bruto` com `normLista` atual; respeta `interesses_ok` (≤20 itens, 1-60c); dry-run default. |
| `render-templates-auth.ts` | Renderiza `emailLayout` → `supabase/templates/{magic-link,recovery}.html` c/ variáveis GoTrue (`{{ .ConfirmationURL }}`); no hosted o conteúdo vai colado em Authentication→Emails (header `:1-11`). Templates commitados existem em `supabase/templates/`. |
| `capture-page.mjs` | Screenshot de rota em modo demo: `node scripts/capture-page.mjs <papel> <rota> <saida.png>`; seta cookies demo; `CAPTURE_BASE` (default `http://127.0.0.1:3100`). |
| `mockup-shots.mjs` | Screenshots desktop 1280 + mobile 390 dos mockups standalone `docs/mockups/<tela>/v*.html`. |
| `_valida_0101.sql` / `_valida_0102.sql` / `_valida_0103.sql` | Validadores psql no stack local: `begin` … `rollback`, claims JWT simulados via `set_config('request.jwt.claims')`/`set role`, personas das fixtures demo/e2e. Cobrem especialistas globais (0101), encerramento automático no último encontro (0102) e avaliação por terceiros (0103). |
| `_valida_0103_rest.mjs` / `_valida_0104_rest.mjs` / `_valida_0105_rest.mjs` | Mesma função via REST real: `supabase status -o json` resolve apikeys (ou `PGRST_URL`/`PGRST_ANON_KEY`/`PGRST_SERVICE_KEY`), logins GoTrue com senhas de fixture, asserts de RLS/RPC "na pele do papel", restaura fixtures no final. Só stack local. |
| `__pycache__/` | Resíduo do transformar-intake. |

Não existem no repo: worker/queue dedicada, edge functions
(`supabase/functions/` não existe), crons HTTP (`/api/cron` não existe),
script de backup/restore, rotate de secrets.

## 7. Env vars (nomes apenas)

**`.env.local` (dev — aponta pra nuvem/prod):**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`EMAIL_FROM`, `VERCEL_OIDC_TOKEN` (presente no arquivo; **sem consumidor
`process.env` no código** — a verificar uso; provável token da CLI Vercel).

**`.env.staging` (gitignored — credenciais locais p/ seeds/e2e):**
`E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_MENTOR_EMAIL`,
`E2E_MENTOR_PASSWORD`, `E2E_DUPLA_ID`, `E2E_COORD_EMAIL`,
`E2E_COORD_PASSWORD`, `E2E_DUPLA2_ID`, `STAGING_DB_URL` (usado pelo
`supabase db push --db-url` manual do AGENTS.md:54 — não tem consumidor em
código), `NEXT_PUBLIC_SUPABASE_URL_STAGING`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING` (para o build local `:3100` apontar
pro staging — idem, uso manual).

**`.env.sentry-build-plugin`:** `SENTRY_AUTH_TOKEN`.

**Consumidos em código (`process.env`):**
- App: `NEXT_PUBLIC_SUPABASE_URL` (middleware.ts:19; CSP `next.config.ts:23`),
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (middleware.ts:20),
  `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/admin.ts:11` — client admin
  server-only), `RESEND_API_KEY` + `EMAIL_FROM` (`lib/email.ts:4,88,97,153,162`),
  `NEXT_PUBLIC_SITE_URL` + `VERCEL_PROJECT_PRODUCTION_URL` (`lib/site.ts:7-8`),
  `VERCEL_ENV`/`NEXT_PUBLIC_VERCEL_ENV`/`SENTRY_DEBUG` (Sentry),
  `NODE_ENV`/`NEXT_RUNTIME`/`CI` (framework).
- E2E/testes: `E2E_BASE_URL`, `VERCEL_AUTOMATION_BYPASS`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_{MENTOR,COORD,JOVEM,JOVEM2,JOVEM3,
  ESP,ESP2,HIB}_{EMAIL,PASSWORD}`, `E2E_DUPLA{,2}_ID`,
  `E2E_DEMO_JOVEM_PASSWORD`, `DEMO_PASSWORD`, `PGRST_{URL,ANON_KEY,
  SERVICE_KEY}` (`_valida_*_rest.mjs`), `CAPTURE_BASE`, `BENCH_{ROSTER,CSV,
  HOJE}`, `EMAIL_PREVIEW`, `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`
  (schema-contract + scripts de import), `OPENAI_API_KEY`
  (`config.toml:101` — Studio AI local, a verificar se usado).
- CI secrets (GitHub): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `VERCEL_AUTOMATION_BYPASS`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_COORD_PASSWORD`.

## 8. Storage/arquivos

Buckets (`insert into storage.buckets`):

| Bucket | Público | Migration | Acesso |
|---|---|---|---|
| `avatares` | **sim** (único público) | 0014:9-10 | escrita só na própria pasta — `(foldername(name))[1] = my_profile_id()` (insert/update/delete) |
| `materiais` | não | 0010:17-18 | select espelha audiência do material; insert/update/delete coord-only |
| `registro-anexos` | não | 0009:56-57 | select/insert exigem row `registro_anexos.path = name` + escopo da dupla (coord, mentor, supervisor) |
| `documentos` | não | 0012:22-23 | **coord-only**, e só de objeto cujo `name` já é `documento_path` de profile/mentorado |
| `chamado-anexos` | não | 0084:1059-1061 | insert/select exigem row `chamado_anexos.path=name` + visibilidade (interno→equipe, público→quem vê o chamado); delete coord-only |

Rotas de signed URL (todas `createSignedUrl(path, 300)` → redirect):
`/api/material/[id]` (`route.ts:70-77`), `/api/anexo/[id]` (`:61-68`),
`/api/chamado-anexo/[id]` (`:42-48`), `/api/documento/[id]` (`:127-134`).

Caps de upload (client-side + server checks):
- avatar/foto: **2 MB** (`AVATAR_MAX_BYTES` `lib/avatar.ts:4`; `FOTO_MAX`
  `actions.ts:89,106`).
- assinatura (PNG desenhado): `image/png` ≤ **1 MB**
  (`actions-assinaturas.ts:637-639`).
- registro-anexos e chamado-anexos: **10 MB** (`anexos-registro.tsx:13`,
  `chamado-anexos.tsx:9`).
- documentos de pessoa, currículo, material novo: **20 MB**
  (`documento-pessoa.tsx:12`, `documentos-pessoa.tsx:30`,
  `curriculo-mentorado.tsx:29`, `novo-material-dialog.tsx:37`).
- Gateway local: `file_size_limit = "50MiB"` (`config.toml:117` — cap duro
  do storage no stack local; hosted tem o próprio limite do plano —
  storage free 1 GB total é dívida conhecida, `_contexto-agentes.md:71`).

## 9. Verificações pontuais

- **pg_cron habilitado?** **Não.** Nenhuma migration cria a extensão; a
  única menção é comentário em `0074_solicitacao_v2.sql:25`: "pg_cron não
  existe em prod" (status_efetivo fica sem writer). REALIZA-169 prevê
  lembretes via pg_cron — ainda não existe.
- **`EMAIL_ENVIO_LIBERADO` usado onde?** Constante em `src/lib/email.ts:60`
  (`false` — kill-switch do envio de notificações). Gates:
  `enviarEmailsLote` (`:81-87`) e `enviarEmailsIndividuais` (`:146-152`) —
  devolvem `{enviados:0, falhas:[todos], error:"Envio de e-mail
  desativado…"}`; `critico:true` fura o bloqueio só pra e-mail de
  auth/conta (senha/e-mail alterado — magic link já passa por fora, SMTP
  `auth@` do Supabase). Testado em `tests/email-fanout.test.ts:51-53`.
- **Fila de e-mail?** **Não existe.** `emails_enviados` (0056) é **log** de
  disparos (insert da action c/ JWT da coord, select coord-only,
  `0056:26-39`; +0057 p/ assinaturas). Envio é síncrono na server action:
  Resend `batch.send` em lotes de 100 (`email.ts:7,101,166`),
  `batchValidation:"permissive"`, um envelope por destinatário (ninguém vê
  o e-mail de ninguém). Sem retry agendado, sem dead-letter — falha vira
  `falhas[]` no retorno e o caller decide (toast honesto).
- **Cron/edge function?** Nenhuma. Sem `supabase/functions/`, sem rota
  `/api/cron`, sem `net.http_post`. Único agendamento = `e2e-nightly.yml`
  (GitHub cron). "Jobs" são RPCs `security definer` chamadas por actions ou
  triggers (ex.: mint de `avaliacao_links` em encontro→realizado, 0071;
  `enviar_lembrete` com advisory lock, 0094).
- **Divergência doc × código**: `AGENTS.md:58` diz que e2e-preview
  "re-seeda fixtures" — **o workflow não re-seeda mais**
  (`e2e-preview.yml:65-69`); pisos convergentes substituíram. Doc
  desatualizada (corrigir quando tocar o AGENTS.md).
- **`openwa/`**: cópia vendorada do gateway WhatsApp OpenWA — referência
  pra futura API WA (não integrada; "não há API WA ainda"). Fora do
  workspace pnpm (`pnpm-workspace.yaml` não declara `packages`), fora do
  CI. `brag-output/`, `intake-out/`, `videos/`, `test-results/` são artefatos.
