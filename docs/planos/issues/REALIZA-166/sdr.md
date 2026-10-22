# REALIZA-166 — security & data review (leve — secrets + prod)

## Superfície

- Workflow CI com secrets `E2E_*` (staging) expostos a `pnpm test:e2e` e ao
  processo do app no runner.
- Writes em staging a cada push/PR/nightly.
- Required check protegendo merge em `main`.

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| `E2E_*` aponta pra **prod** por erro de config | Dupla proteção: hard-stop `PROD_REF` em `tests/e2e/helpers.ts:173` (spec recusa rodar) + guard novo no step de CI (`exit 1` se a URL contém o ref de prod). Defense-in-depth sobre o dado mais sensível: dados reais de menores. |
| Secrets em PR de fork | `pull_request` de fork não recebe secrets → guard falha vermelho explícito (não skip silencioso). Repo é single-dev; se um fork aparecer, maintainer roda manualmente. Documentado no plan. |
| `SERVICE_ROLE_KEY` em log do runner | Secrets são mascarados pelo Actions; steps não fazem `echo` deles (revisar o diff — nenhum `run:` imprime `E2E_*`). O `supabase status -o env` do modo local imprime keys **locais** (efêmeras, sem risco). |
| Run cancelado deixa fixture corrompido | `cancel-in-progress:false` — runs nunca são interrompidos por push novo (fila). Timeout 25min é o teto. |
| Required check teatral | Nenhum path skipa o job em push/PR: secrets ausentes → falha, não skip. Skipped conta como verde no GitHub — por isso o desenho proíbe `if` no job inteiro. |
| Nightly escreve em prod | O job nightly usa os mesmos `secrets.E2E_*` (staging) + o mesmo guard; `e2e-nightly.yml` existente (demo em prod) não muda — specs demo não escrevem. |
| `pull_request` + `push` dispara 2 runs por PR | Possível (push no branch + evento PR) — fila serial absorve; custo é tempo de fila, não correção. Reduzível limitando `push` a branches sem PR aberto — complexidade não compensa. |

## Checklist

- Guard de secrets **falha** (não skip) em push/PR
- Nenhum step imprime secrets; artifacts não contêm `.env` (traces podem
  conter dados de tela de staging — dados sintéticos `e2e00000-*`/`de*`,
  não reais)
- `cancel-in-progress:false` + grupo compartilhado `e2e-staging`
- Hard-stop prod em duas camadas (helpers + CI guard)
- Nenhum `secrets.*` expandido em `run:` além do padrão atual
