# REALIZA-166 — critérios de aceite

## Gatilhos

1. Push em branch de feature (não-`main`) → run `e2e-app` executa contra
   staging, verde com código sadio.
2. PR → `main`: o check `e2e-app / e2e` aparece no contexto do PR e (após o
   passo manual) bloqueia merge quando vermelho.
3. `schedule` (10:00 BRT) → run diário mesmo sem push; visível na aba
   Actions com `event: schedule`.
4. `workflow_dispatch` default → modo staging; `backend=local` → sobe
   `supabase start` e roda a suíte no stack local (modo preservado).

## Gate real

5. Código quebrando spec app (ex.: assert forçado numa branch de teste) →
   check vermelho → merge bloqueado; artifact `playwright-report` +
   `test-results` (traces) disponíveis.
6. Vercel Ignored Build Step cancelando o preview **não** deixa o push sem
   e2e — o e2e-app executa de qualquer forma (esse era o buraco original).
7. Push com secrets `E2E_*` removidos/renomeados (testar numa branch de
   prova ou por leitura) → job **falha** com `::error::` — nunca skip verde.

## Serialização / fixtures

8. Push-run disparado enquanto um e2e-preview está rodando → fica **pending**
   até o preview terminar (grupo `e2e-staging` compartilhado). E vice-versa.
9. Push novo durante um run → **não cancela** o run em curso
   (`cancel-in-progress:false`); o novo espera na fila.
10. Nenhuma spec app escreve em prod: `E2E_SUPABASE_URL` com ref de prod →
    hard-stop (helpers) + guard CI — duas camadas, testar pelo menos uma por
    dry-run com URL forjada.

## Flaky / artifacts

11. Falha em spec → retry automático 1× (`retries:1` CI) e, persistindo,
    artifacts com trace visualizável em `trace.playwright.dev`.
12. Runtime típico ≤ 25min (timeout) — regressão de duração visível no
    histórico do Actions.

## Docs / regressão

13. `AGENTS.md` §CI não diz mais "e2e-app é manual"; menções grepadas
    atualizadas.
14. `e2e-nightly.yml` inalterado — demo-smoke em prod continua só demo.
15. `e2e-preview.yml` segue funcional com o grupo renomeado (run posterior
    confirma pending/compartilhamento).
