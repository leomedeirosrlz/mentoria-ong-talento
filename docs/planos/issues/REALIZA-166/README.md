# REALIZA-166 — E2E app no pipeline: push + nightly + check obrigatório

**Jira:** [REALIZA-166] "Rodar suite e2e-app em push + nightly; tornar check
obrigatório antes de merge"
**Tier:** B — README, plan, sdd, sdr (leve: secrets + proteção de prod),
acceptance. Sem design.md.
**Status:** ABERTO — `.github/workflows/e2e-app.yml:9` é `workflow_dispatch`
apenas; o gate real hoje é `tsc`/`eslint`/`vitest` + schema-contract.

## Resumo

Hoje a suíte app (login real + writes, ~89 specs seriais, `workers:1`) só
roda em dois lugares: **manual** (`e2e-app.yml` contra Supabase local do
runner) e **pós-deploy** (`e2e-preview.yml` no `deployment_status` do
Vercel). O segundo falha quando a Vercel pula o build (Ignored Build Step →
sem deployment → sem check): nesses pushes **zero** e2e executa.

Decisão registrada no Jira (agents): Playwright **contra o staging real**
(fixtures `seed-e2e` + `seed-demo`), aproveitando o hard-stop `PROD_REF` de
`tests/e2e/helpers.ts:173`. O e2e-app deixa de ser "stack local manual" e
vira o gate do dia a dia.

## O desenho proposto (resumo — detalhes no sdd)

- **`e2e-app.yml`** ganha gatilhos `push` (branches de feature, não `main` —
  `main` só recebe merge de PR já validado) + `pull_request` se o fluxo for
  via PR + `schedule` nightly. Build do app no runner (`pnpm build && pnpm
  start`) apontando pro Supabase de **staging** via secrets `E2E_*` —
  mesma variáveis do e2e-preview.
- **Não** depende de deploy Vercel → imune ao Ignored Build Step.
- Concorrência: serializar com o e2e-preview — mesma `concurrency.group`
  (`e2e-staging`) porque os dois dividem os fixtures `e2e00000-*`/`de*` do
  staging. Sem isso, push-run e preview-run se apagam (é o motivo do
  `cancel-in-progress:false` + fila por environment no e2e-preview).
- **Check obrigatório:** nome `e2e-app / e2e` marcado como required no branch
  protection do `main` (ação do Thiago no GitHub — documentar no PR e no
  AGENTS.md). Workflow skipado conta como "passou" → nenhum `if` pode
  pular o job em push; guard de secrets fica **falhando** (não skipando)
  quando os secrets não estão configurados — required check não pode ser
  verde-gratuito.
- **e2e-preview segue existindo** (valida o artefato deployado, incluindo
  env/middleware do Vercel) — vira redeundância saudável; não remover.
- **e2e-nightly**: estender pra suíte app **contra staging**, não prod —
  os specs escrevem. O demo-smoke contra prod permanece como está (specs
  demo não escrevem). Opção: adicionar job `app-staging` no mesmo workflow
  nightly ou schedule no e2e-app — **decisão: schedule no e2e-app** (um
  workflow, um alvo; nightly já é "demo em prod").

## Escopo / fora de escopo

- IN: triggers, apontar staging, concurrency compartilhada, artifacts,
  hard-stop prod reforçado, docs (AGENTS.md §CI).
- OUT: paralelizar a suíte (viola compartilhamento de fixtures — serial é
  desenho), re-seed por push (seeds são convergentes por desenho — ver
  e2e-preview.yml:65-69), trocar Playwright, criar ambiente de teste novo.

## Runtime esperado

Setup (install+build+supabase-status-free) ~3–4min + suíte ~14min = **~18min
por push** — dentro do timeout de 25min já calibrado. No nightly idem.
Sem mudança de custo de infra (staging já existe).

## Riscos

- **Flake de staging compartilhado** — mitigado por: mesmo `concurrency`
  group que o preview (serialização global), `retries:1` já ativo no CI
  (`playwright.config.ts`), `convergirPiso` nos specs, artifacts
  trace+report em falha.
- **Required check verde-gratuito** — se os secrets sumirem o job deve
  **falhar**, não skipar (senão o gate vira teatro). Ver sdr.
- **Push em `main`** — `main` só recebe merge; se o trigger incluir `main`,
  cada merge roda a suíte contra staging de novo (~18min, inofensivo).
  Recomendado incluir (pega drift entre branches), documentado no sdd.
- **Secrets em fork** — PRs de fork não recebem secrets → job falharia como
  required check em PR externo. Hoje o repo é single-dev; documentar o
  comportamento (falha explícita) em vez de skip silencioso.
