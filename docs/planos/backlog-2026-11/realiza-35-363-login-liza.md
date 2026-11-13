# REALIZA-35 + REALIZA-363 — Primeiro acesso honesto + Liza dormindo

Issue: `bug`,`auth`,`ux` (35 — High, migrada do Linear), `ia`,`ux` (363). Fonte: 35 de `docs/analise-transcricao-mentor.md` + issues/REALIZA-35; batch `login-liza` do `_contexto.md`. Implementação em voo: branch `thiago/login-liza-polish` (worktree `login-liza`) — diff em working tree, não commitado. Status: em implementação.

## O que exige vs. o que existe

**REALIZA-35** — primeiro acesso entrava sem a pessoa saber "como quem" (o `/auth/confirm` não pode mostrar identidade antes do `verifyOtp`) e e-mail fora da allowlist terminava num erro seco sem saída. Hotmail/Outlook filtram agressivo (caso real: doc do Léo caiu em arquivo morto). Estado no branch:

- **Identidade no e-mail de convite** — `emailConviteAcesso` (`email-templates.ts` ~479-510) ganhou `nome` + `papel`: novo parágrafo "O link abaixo é só seu: ele abre a conta de **\<nome\>**, \<papel\>, no e-mail \<email\>." O e-mail é a superfície honesta — a página de confirmação não pode afirmar identidade antes de verificar o token. `alvoConvite` (`actions-convite.ts` ~87-122) resolve `nome = (nome_social || nome).trim()` e o papel sai por `papelLabel` ("Mentor DPP", "Mentorado", …).
- **Caminho "Pedir acesso"** — `pedirAcessoHref(email?)` (`login-erros.ts` ~14-21): `mailto:mentoria@realiza.vc`, subject "Pedido de acesso à Mentoria Social", corpo já com o e-mail digitado (sem e-mail → corpo com campo em branco pra pessoa preencher). Renderizado ao lado do erro `NAO_CADASTRADO` nos dois lugares do `login-form.tsx` (form principal :731-742 e erro do reenvio :580-587), e nas telas de casca: `(app)/layout.tsx` ("Peça acesso por e-mail" na conta não vinculada) e `(jovem)/jovem/layout.tsx` idem — mais "Fale com a coordenação" (`mailto` direto) nas telas de papel-pendente dos dois layouts.
- **Copy de deliverability** — "confira o spam" → "confira a pasta de spam ou lixo eletrônico" no card de link enviado e na copy do reset de senha; toasts de convite (`mentorado-actions.tsx`, `pessoa-actions.tsx`) ganham "Se não chegar, peça pra conferir o spam."

**REALIZA-363** — quando o provider de IA falhava (rate limit/cota, 5xx, timeout), a bolha mostrava erro genérico e o mascote fazia cara de erro — feio e mentiroso pro caso "ela só está cansada". Estado no branch:

- **`dormindo` flag end-to-end** — `chamarModelo`/`chamarModeloStream` (`ia/provider.ts`) devolvem `dormindo?: boolean`: presente quando a causa é do provider — status que avança a cadeia (`avancaCadeia`: retentáveis, 404 de slug, 400 com corpo `unavailable|model|quota|limit`), exceção transitória (`erroTransitorio`: TypeError de rede, TimeoutError/AbortError), timeout do signal da rota, resposta sem mensagem utilizável, cadeia esgotada. **Ausente** em falha nossa (400 genérico de payload, exceção não-transitória) — erro real não se veste de cochilo.
- **Rota** — `api/ia/chat/route.ts`: `sendErro(e, dormindo)` emite `{type:"error", e, dormindo:true}` no SSE; `dormindoUltimo` decide a cara do erro de orçamento esgotado no fim do loop (provider lento/atolado dorme, ferramenta nossa lenta não).
- **Componente** — `src/components/liza/liza-dormindo.tsx` (novo, server-safe: sem `"use client"`, Phosphor `dist/ssr`): card `--pausa` (dormir é pausa, não `--warn`/erro), `LizaBlob estado="sonolento"` + badge `Moon`, título "A Liza está dormindo", copy "Ajudou tanta gente por aqui que acabou ficando exausta. Volte mais tarde que ela já deve estar de pé.", `compacto` pras bolhas/cards, `titulo`/`detalhe` pras variantes, slot `children` pra CTA.
- **Superfícies** — bolha de conversa (`assistente-conversa.tsx`): `Msg.dormindo`, `EstadoConversa` ganha `"sonolento"` (o rosto do mascote cochila junto via `onEstado`), bolha de erro dormindo renderiza o conteúdo parcial real + `<LizaDormindo compacto/>` **sem** prosa de erro e sem a linha-meta; live-region anuncia "A Liza está dormindo e volta mais tarde."; composer desligado (`!providerConfigurado()`) troca o `Card` de indisponível pelo mesmo card compacto; 503 pré-stream mapeia `dormindo`. `/ia` (painel coord): banner `<LizaDormindo>` quando o provider está desligado em config + card por modelo mostra "Este modelo dormiu / Parou de responder até a janela liberar." quando `janela5h`/`semana` usado≥limite ou `ciclo.usado≥teto`.
- **Travessão** — `msgAmigavel` e `IA_MSG_INDISPONIVEL`/`MSG_FALHA` perdem o travessão (regra de copy), viram duas frases com ponto.

A mesma `AssistenteConversa` serve a bolha do staff (`(app)/layout`) e a do jovem (`(jovem)/layout`) — todas as superfícies cobertas por um único ponto de render.

## Decisões

- **O e-mail carrega a identidade porque o `/auth/confirm` não pode.** Antes do `verifyOtp` a página não sabe de quem é a conta — afirmar depois seria tarde (a pessoa já clicou). Nome social vence o civil (mesma régua do resto da app).
- **`mailto:` é o canal real de hoje.** "Pedir acesso" não abre form nem ticket — manda pra caixa da coordenação com o e-mail digitado no corpo. Form de solicitação ficaria bonito e órfão (ninguém monitoraria uma fila nova).
- **`dormindo` é flag do provider, não heurística de UI.** O componente não adivinha — a classificação acontece uma vez, em `provider.ts`, onde vive a tabela de retentáveis. 400 genérico continua erro: mascote dormindo em cima de bug nosso esconderia regressão.
- **`--pausa`, não `--warn`.** Dormir é o estado "pausada" do semáforo de status — não é atenção nem falha; o card nunca usa cor de erro.
- **Erro dormindo não mostra linha-meta nem prosa de erro.** O card já carrega a saída ("volte mais tarde"); texto parcial real que chegou antes da queda segue legível acima do card.

## Schema

Nenhuma.

## Domínio (src/lib/)

- `login-erros.ts` — `+ pedirAcessoHref(email?)`.
- `actions-convite.ts` — `alvoConvite` resolve `nome` completo; `convidarAcesso` passa `nome`/`papel` ao template.
- `email-templates.ts` — `emailConviteAcesso` com parágrafo de identidade.
- `ia/provider.ts` — `dormindo` nos dois contratos de falha; classificação via `avancaCadeia`/`erroTransitorio`/`signal.aborted`/cadeia esgotada.
- `ia/mensagens.ts` — `msgAmigavel` sem travessão.
- `api/ia/chat/route.ts` — evento `error` carrega `dormindo`; `dormindoUltimo` no erro de orçamento.

## UI

- `login-form.tsx` — "Pedir acesso" ao lado de `NAO_CADASTRADO` (×2), copy de spam endurecida (×2).
- `(app)/layout.tsx`, `(jovem)/jovem/layout.tsx` — "Peça acesso por e-mail" na conta não vinculada; "Fale com a coordenação" na tela de papel pendente.
- `assistente-conversa.tsx` — bolha/estado/live-region/meta/composer tratando `dormindo`.
- `ia/page.tsx` — banner provider-desligado + `LizaDormindo` compacto nos cards de modelo estourados.
- `mentorado-actions.tsx`, `pessoa-actions.tsx` — toast de convite com instrução de spam.
- `components/liza/liza-dormindo.tsx` — novo.

## Seed + demo

Inalterado. A demo não exercita `dormindo` (provider falso não falha por cota) — o estado é coberto por vitest de render + os testes de provider/rota.

## Testes

- `tests/liza-dormindo.test.ts` — novo: render do mascote svg + lua, copy sem travessão, `compacto` no piso de 12px, `titulo`/`detalhe` das variantes, slot `children`.
- `tests/ia-provider.test.ts` / `ia-provider-stream.test.ts` — `dormindo` true em 429/502/TimeoutError/rede e false em 400 genérico e exceção não-transitória.
- `tests/ia-route.test.ts` — evento SSE `error` carrega `dormindo`; orçamento esgotado herda a cara do último provider.
- `tests/login-erros.test.ts` — `pedirAcessoHref`: mailto+subject, e-mail digitado no corpo, vazio cai no corpo com campo em branco.
- `tests/email-templates.render.test.ts` / `tests/convite-acesso.test.ts` — identidade (nome+papel+e-mail) no HTML do convite, trilha staff e jovem; sem travessão.
- `tests/e2e/app/assistente.spec.ts` — ambiente sem `IA_API_*` apresenta "Liza está dormindo" no painel + composer escondido (o rollback honesto).

## Critérios de aceite

- [x] E-mail de convite afirma a conta que o link abre: nome de exibição (social primeiro) + papel + e-mail de destino — verificado em render-test nas duas trilhas.
- [x] Erro `NAO_CADASTRADO` no login oferece "Pedir acesso" → `mailto:mentoria@realiza.vc` com o e-mail digitado no corpo (e versão sem e-mail pra telas de casca).
- [x] Telas de conta-não-vinculada e papel-pendente (staff e jovem) oferecem o canal da coordenação.
- [x] Copy de entrega menciona pasta de spam/lixo eletrônico no card de envio, no reset e nos toasts de convite.
- [x] Falha do provider (429/cota/5xx/timeout/rede/cadeia esgotada) renderiza `LizaDormindo` — bolha (staff+jovem), composer desligado, `/ia` banner e card por modelo — nunca erro genérico nem cor de alerta.
- [x] Falha nossa (400 genérico, exceção não-transitória) continua erro genérico — `dormindo` ausente.
- [x] Texto parcial emitido antes da queda segue visível acima do card; live-region anuncia o sono.
- [ ] ⚠ gap (35): remetente/deliverability de infra (SPF/DKIM/remetente dedicado pro Hotmail) **não** foi tratado — o branch cobriu só o lado copy; a parte "Hotmail arquiva" segue dependendo de config do domínio fora do repo. Decidir: follow-up de infra ou fecha parcial.
- [ ] ⚠ gap (35): a identidade foi afirmada no **convite** (`emailConviteAcesso`); o magic link de retorno (template do Supabase Auth, fora do repo) não ganhou identidade — limitação de plataforma, verificar se o template do dashboard precisa de ajuste manual.

## Fora de escopo

- Form de "pedir acesso" com fila/ticket (o `mailto` é o desenho).
- Retry automático da Liza quando acorda (o usuário reaperta enviar — o card não agenda retentativa).
- Telemetria nova de taxa de `dormindo` (os eventos `error` já gravam `ia_eventos` — a flag viaja no payload existente).
- Identidade no template de magic link do Supabase Dashboard (config, não código).
