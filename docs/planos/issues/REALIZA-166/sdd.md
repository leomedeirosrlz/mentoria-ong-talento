# REALIZA-166 — software design

## 1. Gatilhos — decisão

```yaml
on:
  push:
    branches-ignore: [main]       # main só muda via merge de PR verde
  pull_request:                   # head sha = o que o check protege
    branches: [main]
  schedule:
    - cron: "0 13 * * *"          # 10:00 BRT — depois do demo-smoke (09:00)
  workflow_dispatch:              # mantém o disparo manual
```

- `pull_request` é o evento que alimenta o required check do PR (o check
  precisa existir no contexto do PR). `push` cobre commits diretos em
  branches de feature (fluxo atual do repo: push → Vercel preview → merge
  quando verde). Os dois juntos não duplicam run pra um mesmo sha no mesmo
  contexto — e se duplicarem (push + PR aberto), a fila serializa e o custo
  é só tempo.
- `main` fora do push: cada merge já foi verde no PR. Se o Thiago quiser o
  pós-merge também, `branches-ignore` sai — registrado como opção.

## 2. Alvo: staging real, app buildado no runner

O `e2e-app` de hoje sobe `supabase start` local — isso **continua valendo
como modo** (sem secrets, valida migrations frescas). O novo modo padrão dos
triggers automáticos aponta pro staging:

```yaml
env:
  E2E_BASE_URL: http://localhost:3000           # app do runner
  E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
  E2E_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_ROLE_KEY }}
```

- `pnpm build`/`start` no runner com `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`
  = staging (`secrets.E2E_*` — os mesmos do e2e-preview, que já apontam pro
  projeto `realiza-staging`). O app sob teste é o código do push — é isso
  que o check protege.
- `seed-e2e-staging.mjs`/`seed-demo-staging.mjs`: **não rodar a cada push**
  — fixtures são convergentes (`convergirPiso`, comentário e2e-preview:65);
  re-seed manual quando staging for recriado. O push-run só garante que o
  seed existe? Um pre-step `node scripts/seed-e2e-staging.mjs` é idempotente
  mas pesado (recria pisos); **decisão: não rodar** — se staging perder
  fixtures o primeiro spec falha com erro claro e o runbook diz
  `pnpm seed:e2e`.
- Hard-stop prod: `helpers.ts:173` compara `E2E_SUPABASE_URL` com o ref de
  prod — continua valendo; adicionar também um check de CI no step
  (defesa em profundidade: `if [[ "$E2E_SUPABASE_URL" == *yhjzmxleotahijinjepl*
  ]]; exit 1`).

## 3. Modo dual no mesmo workflow

`workflow_dispatch` com input `backend: staging|local`:

- `staging` (default): o caminho acima — é o que push/PR/schedule usam.
- `local`: o fluxo atual `supabase start` preservado atrás de `if:
  github.event_name == 'workflow_dispatch' && inputs.backend == 'local'`
  nos steps de stack local. Mantém a capacidade "validar migration fresca
  sem secrets" que o header do arquivo documenta.

Isso evita criar um 2º workflow e preserva a feature que o arquivo atual
entrega. Steps ganham `if` por modo — ~6 steps condicionais, legível.

## 4. Concorrência — serialização global com o preview

```yaml
concurrency:
  group: e2e-staging-${{ github.ref }}
  cancel-in-progress: false
```

**Por ref, não global:** serializa runs do mesmo ref mas deixa branches
diferentes... colidirem nos fixtures! Fixtures `e2e00000-*` são globais no
staging — dois branches concorrentes = mesmo problema que o comentário do
e2e-preview:16-19 descreve. Correto é **um grupo global**:

```yaml
concurrency:
  group: e2e-staging
  cancel-in-progress: false
```

Mas groups são por workflow — `e2e-preview` usa outro grupo
(`e2e-preview-<env>`). Groups são **repo-wide por nome**: renomear o grupo
do preview pra `e2e-staging` também → push-run e preview-run serializam
entre si. Custo: preview espera push-run terminar (até ~18min). Aceitável —
é o preço de fixtures compartilhadas; a alternativa (fixtures por ref) é
refactor dos seeds, fora de escopo.

`cancel-in-progress: false` — cancelar mid-run deixa fixture em estado
parcial (mesmo raciocínio do preview).

## 5. Required check — semântica

- Nome do check: `e2e-app / e2e` (workflow/job). O Thiago marca em
  Settings → Branches → `main` → required status checks. Documentar no PR
  (o YAML não configura branch protection — é passo manual com print no PR).
- **Skip ≠ required:** um `if` que pula o job marca o check "Success"
  (skipped counts) — por isso o guard de secrets **falha** (`exit 1` com
  `::error::` explicando) em vez de output+skip quando `E2E_SUPABASE_URL`/
  `E2E_SUPABASE_SERVICE_ROLE_KEY`/`E2E_MENTOR_PASSWORD`/`E2E_COORD_PASSWORD`
  estão vazios em contexto de push/PR. Em PR de fork os secrets não vêm → o
  check fica vermelho com mensagem clara (documenta "single-dev repo: PR de
  fork precisa de override manual do maintainer" — comportamento aceito).
- nightly (`schedule`) não é check — a mesma falha vira alerta (failed run
  visível na aba Actions; sem gate).

## 6. Flaky-test — política

Já existe a base: `workers:1`, `retries: CI?1`, `trace:'on-first-retry'`,
`screenshot:'only-on-failure'` (`playwright.config.ts`), asserts com
`timeout:15_000` pós-write (AGENTS.md), `convergirPiso`.

Adições desta issue (baratas):

- **Artifacts sempre** em falha: `playwright-report/` + `test-results/`
  (traces ficam em test-results) — hoje só report; adicionar o segundo path
  (traces são o que debugga flake).
- **Nightly = canário de flake:** runs agendados sem push novo isolam "suite
  instável" de "meu código quebrou" — o histórico de falhas no Actions é o
  termômetro.
- Retry de nível de spec fica como está (1). **Não** subir pra 2+ — mascara
  flake sistêmico e dobra runtime.

## 7. O que muda no `e2e-app.yml` — mapa

| Trecho atual | Vira |
|---|---|
| `on: workflow_dispatch` | push (≠main) + PR→main + schedule + dispatch c/ input `backend` |
| steps supabase local + status env | `if: modo local` (dispatch) |
| envs do stack local nos steps | `secrets.E2E_*` no modo staging; local envs só no modo local |
| `concurrency` por ref, cancel true | `e2e-staging` global, cancel false |
| guard nenhum | step guard: secrets ausentes → `::error::` + exit 1 (push/PR); dispatch com `backend=local` passa sem secrets |
| artifact: report | artifact: report + test-results |
| `test:e2e` | idem (demo + app) — demo contra runner é válido (superfície pública local) |

`e2e-nightly.yml`: **sem mudança** (demo-em-prod permanece). O schedule do
e2e-app é a parte "estender app" do Jira.

## 8. Alternativas rejeitadas

- **Rodar contra o preview deploy em vez de build no runner:** o trigger de
  push não tem URL de preview (deploy pode nem existir — Ignored Build Step).
  Polling de deployment_status reinventa o e2e-preview com o mesmo buraco.
- **Suíte paralela:** fixtures compartilhadas — serial é desenho do projeto.
- **Nightly contra prod:** specs app escrevem — jamais (hard-stop existe por
  isso).
- **Re-seed a cada run:** contra-indicado pelo histórico (e2e-preview:65-69 —
  derrubava PostgREST free tier e gerava flake em massa).
