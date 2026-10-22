# REALIZA-35 — acceptance.md

## Identidade

1. **GIVEN** magic link clicado na aba do e-mail **WHEN** handoff ok
   **THEN** `/auth/confirmado` mostra "Tudo certo, {nome}! Você entrou
   como {papel}." (dados vieram do RPC, não da URL — `location.search`
   sem `nome`).
2. **GIVEN** RPC antiga (sem retorno) **THEN** confirmado cai no texto
   genérico — sem quebra.
3. **GIVEN** 1º acesso **WHEN** `/auth/definir-senha` abre **THEN**
   "Você está entrando como {nome} — {papel}."; em modo recovery, linha
   omitida ou "Redefina…" — nunca mistura.

## Não-cadastrado

4. **GIVEN** e-mail fora da allowlist **WHEN** pedir link **THEN** card
   "E-mail não cadastrado" + "Pedir acesso" + mailto.
5. **GIVEN** "Pedir acesso" clicado **WHEN** RPC ok **THEN** "Pedido
   enviado…" e **notificação** `pedido_acesso` existe pra toda
   coordenação (verificado no banco do staging).
6. **GIVEN** segundo clique <24h **THEN** `{ok}` sem notificação
   duplicada (dedup provado via count).
7. **GIVEN** e-mail **já** cadastrado passando por `solicitar_acesso`
   **THEN** resposta `{ok}` — enumeração não confirmada pro chamador.

## Copy/deliverability

8. **GIVEN** link enviado **THEN** painel menciona "lixo
   eletrônico/spam — Outlook e Hotmail…" (assert textual no e2e).
9. **GIVEN** template re-renderizado **THEN** e-mail contém "entra como
   {{ .Email }}" (aplicado no dashboard — verificação manual com Thiago
   registrada no PR).
10. **BLOCKER ops**: SPF/DKIM/DMARC + From-name "Realiza.vc" — checklist
    executada com Thiago; marcado no `_done-E.md` como pendência fora do
    repo até confirmação.

## Regressão do fluxo

11. Poll/handoff/anti-fixação: specs existentes de login seguem verdes —
    `setSession` com e-mail divergente ainda derruba a sessão.
12. Link queimado → `falhar_login_handoff` → aba que pediu cai no card
    de link inválido (inalterado).

## Gates

`tsc` ✅ `eslint` ✅ `pnpm test` ✅ e2e app (novos: identidade,
pedir-acesso, copy) ✅ e2e-preview ✅ migration em staging antes do
push / prod antes do merge ✅ review ≥2 ✅
