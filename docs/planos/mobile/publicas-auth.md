# Mobile audit — públicas + auth

## Cobertura
/login (+LoginForm) · /auth/link · /auth/confirm · /auth/confirmado ·
/auth/definir-senha · /demo · /f/[token] (form genérico + InstrumentoFlow:
campos/visao/metas/pdm) · /t/[token] · /avaliar/[token]
(+AvaliacaoEncontroForm) · /assinar/[token] + /assinar logado
(+AssinaturaForm + TermoVoluntarioDoc) · /resumo/[slug]
(+ResumoSenhaForm + RelatorioCanvas) · /privacidade · not-found ·
error/global-error · SiteFooter · EstadoCard · /api/* (superfícies
visíveis: download/PDF inline).

Notas de escopo:
- `src/app/page.tsx` **não existe** — a "landing" pública é `/login` +
  `/demo`; `/` resolve em `(app)/(home)/page.tsx` (home staff, fora do
  grupo; deslogado o proxy manda pra `/login` — `src/lib/supabase/middleware.ts:82-89`).
- `src/components/forms/publico*` **não existe** — os forms públicos
  moram em `src/app/f/[token]/formulario-publico.tsx`,
  `src/app/t/[token]/terceiro-publico.tsx`,
  `src/components/avaliacao-encontro-form.tsx`,
  `src/components/assinatura-form.tsx`,
  `src/components/resumo-senha-form.tsx` e `src/components/instrumentos/*`.
- **Em edição paralela (não auditado)**: `instrumentos/roda-vida.tsx`,
  `instrumentos/roda-svg.tsx` (roda da vida — onda 4), forms de intake,
  `privacidade-card` do /jovem (LGPD docs). A casca compartilhada
  (`instrumentos/flow.tsx`, `campos.tsx`) foi auditada.

---

### /login
- **Importante** — `<Suspense>` sem fallback: `useSearchParams` no
  LoginForm faz bail-out do prerender e o HTML estático sai só com o
  link fixo — primeiro paint é página em branco até hidratar.
  `src/app/login/page.tsx:17-19`. Fix: `fallback` com skeleton
  espelhando o card (logo h-8 + título + card p-6 com input h-11 +
  botão), ~30 linhas.
- **Polish** — "Ver a demonstração" é `fixed right-4 bottom-…`
  (`login/page.tsx:22-27`): em viewport muito baixo (teclado aberto,
  zoom) o scroll ao fim coloca a última linha do SiteFooter sob o link
  (link transparente, sem bg). Fix: `pb` reservada no fluxo
  (`pb-16` no container) ou `sm:static`.
- **Polish** — `px-4` sem `env(safe-area-inset-left/right)` lateral
  (`login-form.tsx:351`): em landscape com notch o card toca a área
  insegura — as páginas por token já usam `pl/pr-[max(1rem,env(…))]`
  (ex.: `f/[token]/page.tsx:69`). Mesma inconsistência em
  `demo/page.tsx:69`, `auth/*`, `assinar/[token]/page.tsx:99` e
  `privacidade/page.tsx:170`.
- OK: radios do seletor `h-11` (`login-form.tsx:471`), input
  `type=email` + `autoComplete=email` + `autoCapitalize=none`
  (`:513-524`), CTAs `w-full` h-11, text-buttons `min-h-11` (`:443,571`),
  flex+m-auto comentado pro teclado (`:347-351`), cooldown/estados
  completos (enviado/erro-link/429).

### /auth/*
- **Importante** — `<Suspense>` sem fallback também em
  `auth/link/page.tsx:11` e `auth/definir-senha/page.tsx:11` — blank até
  hidratar (definir-senha faz parte do primeiro acesso). Mesmo fix.
- OK: cards `max-w-xs` centrados, `min-h-11` nos links de saída
  (`confirmar.tsx:122`, `confirmado.tsx:57`), spinner `role=status`,
  foco programático no status (`confirmado.tsx:18-19`),
  PasswordInput `w-11` full-height (`ui/password-input.tsx:27`),
  `autoComplete="new-password"` (`definir-senha-form.tsx:188,203`),
  animação confirm-* coberta pelo guard global (`globals.css:246-266`).

### /demo (landing)
- **Importante** — link "Entrar com magic link" `text-xs underline`
  ~16px (`demo/page.tsx:107-112`) — mesma classe de alvo pequeno do
  SiteFooter (ver componentes). Fix: `inline-flex min-h-9 items-center`
  (ideal `min-h-11`).
- OK: cards-papel full-button (`demo-enter-button.tsx:24-48`),
  `min-[360px]:grid-cols-2` pensado pro fold (`demo/page.tsx:88-90`),
  `animate-rise` sob o guard (`:70-72`), copy honesta (sem login, nada
  gravado).

### /f/[token] — form genérico + instrumentos
- **Polish** — `enterKeyHint="send"` pode cair num `texto_longo`:
  `TIPOS_COM_ENTER` inclui `texto_longo` (`formulario-publico.tsx:34-38`)
  e `ultimoComEnter` pega o último deles (`:344-346`) — na textarea a
  tecla "send" insere `\n`, não envia. Fix: tirar `texto_longo` de
  TIPOS_COM_ENTER ou usar hint `"enter"` nesse tipo.
- **Polish** — sem `loading.tsx`: navegação fria via WhatsApp + RPC
  mostra só o spinner do browser; `/assinar` e `/resumo` já têm skeleton
  espelhado. Fix: `loading.tsx` com logo + pill de progresso + 2 cards.
  Idem `/t` e `/avaliar`.
- OK: sticky progress pill com `env(safe-area-inset-top)` (`:378`),
  rascunho localStorage (`:98-101,206-251`), validação por campo +
  scroll/focus no primeiro erro (`:288-299`), alvos h-11/min-h-11 em
  todos os tipos (`:746,773,805,841,864`), select nativo `text-base`
  (`:709`), honeypot (`:475-488`), inputMode/autoComplete por formato
  (`:622-643`), submit `h-11 w-full` (`:507`), foco migrando pro painel
  de sucesso (`:105-109`), InstrumentoFlow repete o chrome
  (`instrumentos/flow.tsx:109-129`), Segmentos h-11
  (`instrumentos/campos.tsx:212`), PDM empilha no mobile com sumário só
  `lg:` (`instrumentos/pdm.tsx:55-59`), Metas X `size-11`
  (`instrumentos/metas.tsx:347`).

### /t/[token]
- OK: mesma anatomia do /f — `pl/pr-[max(1rem,env(safe-area-inset-*))]`
  (`page.tsx:49`), rascunho (`terceiro-publico.tsx:48`), honeypot
  (`:207-215`), submit `h-11 w-full` (`:227`), safe-area lateral,
  textareas `text-base` (sem zoom iOS). Nada a corrigir além do
  loading.tsx (ver /f).

### /avaliar/[token]
- **Importante** — chips `h-10` (40px < 44px) nas perguntas 2 e 4 —
  `avaliacao-encontro-form.tsx:253` (sentimento) e `:313` (temas):
  `flex h-10 … rounded-full px-3.5`. É o controle de seleção principal
  do form mais mobile do app (jovem via WhatsApp); os radios do mesmo
  form já são `size-11`/`h-11` (`:196,283`). Fix: `h-11` nos dois chips.
- OK: estrelas `size-11` (`:196`), toggle/pedido-ajuda como cards-label
  grandes (`:355,374`), copy de privacidade por trilha, focus sucesso,
  safe-area lateral (`page.tsx:74`), honeypot.

### /assinar/[token] + /assinar logado (+AssinaturaForm/TermoVoluntarioDoc)
- **Importante** — índice de etapas com alvo ~20px: `<a>` `text-sm` sem
  min-h em `assinar/[token]/page.tsx:303-327` e `(app)/assinar/page.tsx:87-111`.
  O próprio link "Continuar" irmão usa `min-h-11`
  (`assinar/[token]/page.tsx:378`, `termo-doc.tsx:89`) — inconsistência
  interna da mesma página. Fix: `inline-flex min-h-11 items-center` nos
  3 links (ou pills `bg-muted rounded-full px-3.5 h-10`).
- **Importante** — `grid-cols-[1fr_100px]` em toda largura
  (`assinatura-form.tsx:111`): a 320px o input Logradouro fica ~124px
  (px-4 + p-6 + gap). Fix: `grid-cols-1 sm:grid-cols-[1fr_100px]` (ou
  `min-[420px]:`) — número vira linha própria no mobile.
- **Polish** — submit "Assinar eletronicamente" sem `w-full`
  (`assinatura-form.tsx:307` `justify-center`): único CTA público que
  não é `h-11 w-full`. Fix: `w-full` (ou `w-full sm:w-auto sm:px-8`).
- **Polish** — `text-justify` sem `hyphens-auto` no doc serifado
  (`termo-doc.tsx:41,46,54`): a ~46ch mobile gera rios de espaço em
  justificado pt-BR. Fix: `text-justify hyphens-auto` ou
  `text-left sm:text-justify`. (O doc inline do token,
  `assinar/[token]/page.tsx:353`, já usa text-sm normal — ok.)
- OK: `inputMode="numeric"` CPF/CEP (`:77,103`), `type="date"` +
  `autoComplete="bday"` (`:91-92`), street-address/postal-code
  (`:104,119`), aceite = label-card grande (`:274-286`), índice com
  `scroll-mt-4` nos destinos, grid civis `sm:grid-cols-2` (`:46`),
  loading.tsx espelha anatomia (`app/assinar/loading.tsx`).

### /resumo/[slug] + RelatorioCanvas
- **Polish** — hint desktop em público mobile: "Arraste a borda…
  Shift+clique… Ctrl+C" (`relatorio-canvas.tsx:592-596`) — instruções
  mortas no toque (sem Shift/Ctrl). Fix: `hidden sm:block` + linha
  mobile "deslize pra ver mais colunas". Relacionado: alça de resize
  `w-3` (`:410`) difícil de pegar no dedo e linhas ~29px
  (`:459 py-1.5`, `text-[13px] :372`) — aceitável pra grade, mas a alça
  poderia ser `w-4`/`w-5` em pointer coarse.
- **Polish** — card `Indisponivel` sem saída (`resumo/[slug]/page.tsx:57-72`):
  revogado/expirado não tem `mailto:` nem retry — as irmãs (/f, /t,
  /avaliar, /assinar) sempre oferecem `acao`. Fix: mailto
  `mentoria@realiza.vc` "Falar com a coordenação" (não vaza oráculo).
- OK: grade em `overflow-auto max-h-[70dvh]` + gutter/header sticky
  (`:286-289,379,389`) — padrão correto de tabela no mobile; skeleton
  com `overflow-hidden` (`resumo/[slug]/loading.tsx:37`); senha form
  com PasswordInput (`resumo-senha-form.tsx:50-58`), rate-limit/estados
  completos (senha/limite/revogado/404).

### /privacidade
- OK: header links `min-h-11` (`page.tsx:172,179`), corpo `text-base
  leading-relaxed max-w-prose`, listas `pl-5`. (Marcado LGPD docs como
  edição paralela — só conferida a moldura, sem achados.)

### not-found / error / global-error
- **Polish** — "Voltar para o início" `inline-block text-sm` ~20px
  (`not-found.tsx:18-23`) — mesmo fix `inline-flex min-h-11 items-center`.
- OK: `error.tsx` usa Button h-11 (`:27`); `global-error.tsx` usa
  NextError (viewport meta própria).

### Componentes compartilhados
- **Importante** — SiteFooter: links `text-xs` (~16-18px) sem min-h e
  `gap-y-1` ao quebrar linha — `site-footer.tsx:63-72` (light, em TODAS
  as páginas públicas) e `:40-54` (ink, no app shell). Abaixo até do
  mínimo AA WCAG 2.5.8 (24px). Fix: `inline-flex min-h-9 items-center`
  (ideal `min-h-11`) nos links + `gap-y-2`; a variante ink já tem
  focus-visible, a light não tem anel de foco explícito.
- OK — EstadoCard: ação `buttonVariants size:"sm"` = `h-11` no mobile
  (`estado-card.tsx:44` + `ui/button.tsx:32`), `max-w-sm text-sm`,
  ícone 12 — padrão dos estados terminais.

### /api/* (superfícies visíveis)
- **Polish** — erros como `new NextResponse("…")` viram texto cru
  top-left no mobile (`api/material/[id]/route.ts:44-46,55`,
  `api/assinar-token/[token]/route.ts:34,41,62`). Raro, mas visível.
  Fix: página de erro compartilhada ou `Content-Type: text/html` com
  EstadoCard.
- OK: PDF `inline` abre no viewer nativo do celular
  (`api/assinar-token:17-26`); demais rotas são redirect/download —
  sem UI.

### Transversal
- OK: guard global `prefers-reduced-motion` (`globals.css:300-319`,
  com exceção do spinner) + `MotionConfig reducedMotion="user"`
  (`layout.tsx:67`) + `viewportFit:"cover"` e
  `interactiveWidget:"resizes-content"` (`layout.tsx:48-55`);
  inputs `h-11 + text-base` (16px → sem auto-zoom iOS) no
  `ui/input.tsx:12` e `ui/textarea.tsx:10`; botões todos `h-11` mobile
  (`ui/button.tsx:29-39`); honeypot nos 4 forms públicos; rascunho
  localStorage em /f, /t e instrumentos.
