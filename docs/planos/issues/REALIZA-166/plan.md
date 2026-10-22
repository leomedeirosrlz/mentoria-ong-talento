# REALIZA-166 — plano de implementação

Descrição essencial: `e2e-app.yml` sai de manual-only pra push+PR+nightly
contra o staging real (decisão do Jira), com check obrigatório `e2e-app/e2e`
no `main`, serialização global compartilhada com o e2e-preview (`concurrency:
e2e-staging`), e o modo `supabase start` local preservado atrás de
`workflow_dispatch` input `backend=local`.

## Passo 0 — referências

- `.github/workflows/e2e-app.yml` — arquivo atual (108 linhas).
- `.github/workflows/e2e-preview.yml:20-23` — grupo de concorrência atual
  (`e2e-preview-<environment>`) a renomear pra `e2e-staging`.
- `tests/e2e/helpers.ts:173` — `PROD_REF` hard-stop.
- `playwright.config.ts` — `workers:1`, `retries:CI?1`, timeouts.
- `scripts/seed-e2e-staging.mjs` — fixtures convergentes.
- AGENTS.md §"CI & e2e" — trecho a atualizar após a mudança (a linha que diz
  "e2e-app.yml — manual").

## Passo 1 — reescrever `e2e-app.yml`

Estrutura final (resumo — o YAML completo é ~140 linhas):

```yaml
name: e2e-app
on:
  push: { branches-ignore: [main] }
  pull_request: { branches: [main] }
  schedule: [{ cron: "0 13 * * *" }]      # 10:00 BRT
  workflow_dispatch:
    inputs:
      backend:
        type: choice
        options: [staging, local]
        default: staging

concurrency:
  group: e2e-staging          # compartilhado com e2e-preview — fixtures globais
  cancel-in-progress: false
```

Job `e2e` — ordem dos steps:

1. **Guard** (`if: github.event_name != 'workflow_dispatch' || inputs.backend != 'local'`):
   secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY` presentes?
   Não → `::error::` + `exit 1` (nunca skip silencioso — required check).
   **E** `E2E_SUPABASE_URL` contém `yhjzmxleotahijinjepl` → `::error::` +
   `exit 1` (defesa em profundidade sobre o hard-stop do helpers).
2. checkout / pnpm / node / install — sempre.
3. **Modo local** (`if: backend == 'local'`): `pnpm exec supabase start` +
   captura envs (steps atuais :31-39 verbatim) + types-freshness (:44-68
   verbatim).
4. **Modo staging**: nada de supabase local; envs de staging nos steps.
5. build+start (`NEXT_PUBLIC_*`/`SUPABASE_SERVICE_ROLE_KEY` por modo).
6. playwright install.
7. Fixtures: **só modo local** roda `seed-e2e-staging.mjs` (staging depende
   de `pnpm seed:e2e` manual — comentário no YAML explicando por quê:
   e2e-preview:65-69).
8. `pnpm test:e2e` com envs por modo (staging: `secrets.E2E_*`; local:
   envs capturadas).
9. artifacts em falha: `playwright-report/` + `test-results/`.

## Passo 2 — `e2e-preview.yml` (1 linha)

`concurrency.group` → `e2e-staging` (drop do sufixo environment — o
comentário :12-19 explica o porquê de serializar; agora a fila é global por
fixtures). Atualizar o comentário pra mencionar o compartilhamento com
e2e-app. Manter `cancel-in-progress: false`.

## Passo 3 — branch protection (manual, do Thiago)

Settings → Branches → `main` → **Add required check: `e2e-app / e2e`**.
Screenshot/passos no PR. Sem esse passo o check roda mas não bloqueia merge.

## Passo 4 — docs

- `AGENTS.md` §CI: `e2e-app` deixa de ser "manual"; descrever gatilhos,
  alvo staging, fila global `e2e-staging`, e que preview permanece.
- `CLAUDE.md`/`docs/` equivalentes se mencionarem "manual" — grep `e2e-app`
  no repo e atualizar menções.

## Passo 5 — validação antes do merge

- Testar numa branch de feature: push → run executa (staging), verde;
  conferir na aba Actions que um push enquanto um preview rodava ficou
  **pending** (fila global).
- Forçar o guard: dispatch `backend=staging` sem secrets num fork/cópia?
  Difícil de simular — revisar por leitura; o guard é 6 linhas.
- Confirmar nightly dispara na janela seguinte (ou dispatch manual pra
  provar o path).

## Rollback

Reverter o workflow pra `workflow_dispatch` (o required check sai junto —
remover do branch protection primeiro pra não travar merges).

## Questões em aberto

- Rodar também em `push` a `main` (pós-merge)? Recomendado não — merge só
  vem de PR verde; se quiser, trocar `branches-ignore` por `branches:[**]`.
- Fixtures: se staging ficar sem seed (recriação), o primeiro spec falha —
  runbook = `pnpm seed:e2e` com `.env.staging`. Já documentado no AGENTS.
