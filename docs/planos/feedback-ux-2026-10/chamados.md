# Feedback — /chamados (fila + detalhe + composer)

Tela: `src/components/chamados-app.tsx` + `src/components/chamado-anexos.tsx`.
Muita densidade de itens — todos na mesma tela.

## Itens do feedback

1. **`@` não faz nada** — o placeholder promete "Use @ pra marcar alguém da
   equipe", mas digitar `@` não abre nada. Deveria abrir um dropdown de
   autocomplete com as pessoas marcáveis (a `equipe` já chega por prop).
2. **Caixinhas de seleção com todas as pessoas = poluição** — o fieldset
   "Marcar alguém da equipe" renderiza um checkbox-pill por pessoa,
   permanentemente visível. Deveria ser um dropdown/combobox que só aparece
   quando o usuário precisa (e as pessoas marcadas aparecem como chips).
3. **Upload de arquivo gera scroll lateral** — quebra o design. Reproduzir
   com nome de arquivo longo / viewport 390px: provável candidato é a row
   de anexo na timeline ou a barra do composer vazando. Encontrar a causa
   real e eliminar o overflow horizontal.
4. **Enviar não tem feedback** — o botão só fica disabled + spinner
   (`busy`). Pedido: uma **animação satisfatória** no sucesso (ex.: o texto
   enviado "entra" na timeline com transição, ou o botão morfa pra check
   antes de limpar). Toast sozinho não é suficiente.
5. **Preview dos anexos** — anexo hoje é `Paperclip + nome` na timeline.
   Imagens devem ter thumbnail (a rota `/api/chamado-anexo/[id]` já serve
   o binário); PDF pode ter a capa ou ícone de tipo mais rico — mesma
   régua visual dos materiais. E no composer, o arquivo recém-anexado
   devia aparecer como chip/thumbnail de confirmação (hoje o upload é
   direto e a evidência só chega depois do refresh).
6. **Cor por status** — "não respondido: vermelho. resolvido: verde. etc."
   Hoje `STATUS_TOM`: aberto=warn(âmbar), em_atendimento=lime,
   resolvido=cinza. Pedido: semântica de cor legível — aberto/sem dono =
   vermelho (pede ação), em atendimento = âmbar/azul, resolvido = verde.
   Revisar `STATUS_TOM` e o stepper do detalhe pra mesma escala.

**Spec travada**: ✅ mock `v5` aprovado (`docs/mockups/chamados/v5.html`)
com diretriz de acabamento: **mais minimalista e intuitivo** — tirar as
bordas/fundos coloridos redundantes (badge de status JÁ carrega a cor;
não faz sentido badge + borda lateral + fundo tintado dizendo a mesma
coisa). Superfícies unificadas, cor vive nos badges/indicadores.

**Decisões travadas**: **mentor NÃO menciona** — o `@`/autocomplete +
chips de marcados ficam só pra coord/supervisor (a RPC
`comentar_chamado` já trava isso no banco — sem mudança de RPC).
Mentor/especialista seguem com textarea simples nos comentários que já
podem fazer. Copy do mock "app + e-mail" vira "notificação no app"
(e-mail de menção não existe).

## Direção

- **Menções**: composer interno ganha autocomplete `@` — detecta `@` +
  prefixo, abre popover filtrável da equipe (Base UI tem primitivos;
  verificar `Combobox`/`Popover` em `src/components/ui`), insere menção
  como chip no texto ou numa zona de marcados. O fieldset de checkboxes
  sai; quem já está marcado aparece como chip removível perto do botão
  enviar. A11y: popover com `role="listbox"`, setas navegam, Esc fecha,
  foco volta pro textarea.
- **Overflow do upload**: reproduzir primeiro (nome longo, 390px) — não
  chutar fix. Provável: `<li>` de anexo ou o nome não truncado em algum
  breakpoint. `min-w-0` + `truncate` onde couber; se for o chip de nome na
  timeline, quebrar em `break-all`/`line-clamp`.
- **Feedback de envio**: animação de entrada do item na timeline
  (stagger/`animate-enter` já existe na casa) + estado transitório do
  botão (check antes de liberar) — respeitar `prefers-reduced-motion`.
- **Status colorido**: nova escala `STATUS_TOM` — `aberto` →
  `border-destructive/40 bg-destructive/10 text-destructive`;
  `em_atendimento` → âmbar ou info; `resolvido` → `var(--ok)`. Aplicar na
  fila, no detalhe (header + stepper) e no "Meus chamados" do autor —
  mesma cor nos 3 lugares.

## Critérios de aceite

- [ ] Digitar `@` no comentário interno abre lista filtrável da equipe;
      Enter/click marca; a pessoa marcada vira chip; o comentário sai com
      `mencionados` preenchido (mesmo payload de hoje).
- [ ] Nenhum checkbox-pill da equipe renderiza permanentemente — só o
      dropdown sob demanda. Mobile 390px: o composer não estoura.
- [ ] Upload de `nome-de-arquivo-bem-longo-com-muitos-caracteres.pdf` em
      390px não gera scroll horizontal (medir `scrollWidth ≤ clientWidth`
      na página do chamado depois de anexar).
- [ ] Ao enviar resposta/comentário há animação visível de confirmação
      (além do toast) e o item entra na timeline com transição — sem
      respeitar reduced-motion = sem animação.
- [ ] Anexo de imagem mostra thumbnail clicável na timeline; PDF mostra
      capa/ícone rico; link permanece `/api/chamado-anexo/[id]`.
- [ ] Escala de cores aplicada consistentemente: fila, header do detalhe,
      stepper e visão do autor. AA nos textos coloridos (usar tokens
      `--ok-text`/`--warn-text`/destructive — não inventar tom fora da
      escala).
- [ ] tsc/eslint limpos; `chamados*.spec.ts` verde.

## Mapa de regressões e gaps (review out/2026)

### Estado atual — onde cada coisa mora

- **Entrada e papéis** — `src/app/(app)/chamados/page.tsx`: `staff =
  me.role === "coordenacao" || "supervisor"`; mentorado é redirecionado
  pra `/jovem/perfil`. `ChamadosApp` (`src/components/chamados-app.tsx:105-123`)
  recebe `papel, meuId, meuNome, itens: ChamadoFilaItem[],
  selecionadoInicial, detalheInicial { chamado, timeline, equipe }` —
  `equipe` só é carregada para staff e já vem filtrada (ativos, roles
  `coordenacao`/`supervisor`) por `getChamadoDetalhe`
  (`src/lib/queries-chamados.ts`, ~311-385, que também monta a timeline
  intercalada em ordem cronológica).
- **Fila** — view `chamados_fila`
  (`supabase/migrations/0084_chamados.sql:184-228`): supervisor recebe
  chamados de `plataforma` mascarados (`restrito`, sem assunto/autor). A
  linha da fila renderiza "Chamado restrito à coordenação" /
  "Assunto e autor visíveis só pra coordenação."
  (`chamados-app.tsx:348-370`) e o detalhe mostra o painel com `Lock`
  (:617-622). RLS/helpers: `eh_equipe()`, `chamado_visivel_equipe()`
  (0084:123-182).
- **Cores de status** — `STATUS_TOM` (:70-75): `aberto` = warn/âmbar,
  `em_atendimento` = brand-lime, `resolvido` = muted neutro. `CAT_TOM`
  (:77-83): só `urgencia` é destructive. Usado na fila (:332-346) e no
  header do detalhe (:491-496). **`meus-chamados-card.tsx:82-87` e
  `jovem-chamados.tsx:85` usam `Badge outline` sem tom** — mudar
  `STATUS_TOM` não os alcança; a regra "mesma cor nos 3 lugares" precisa
  editá-los à mão. Stepper do autor (:524-554) pinta feito/atual com
  `border-[var(--brand-lime)]` genérico — a spec pede cor semântica por
  etapa, não por marca.
- **Ações staff** (:557-615): gates `souDono` /
  `papel === "coordenacao"`; RPCs via `rpcSimples` em
  `src/lib/actions-chamados.ts` — `assumir_chamado`, `atribuir_chamado`,
  `devolver_chamado_fila`, `resolver_chamado` (dialog :682-717),
  `reabrir_chamado`. Autor: `acrescentar_info_chamado` e
  `pedir_reabertura_chamado` (`AutorComposer` :975-1024 + painel
  resolvido :658-674).
- **Composer da equipe** (`ChamadoComposer` :850-972): toggle
  `modo: "interno" | "publico"` (:895-915) — interno chama
  `comentarChamado(id, texto, mencionados)` (:873-874), público chama
  `publicarAtualizacaoChamado` que **dispara e-mail ao autor**
  (`actions-chamados.ts:200-219` + `registrar_email_chamado`). O fieldset
  de checkbox-pills `outrasPessoas` (:934-962) é a única "menção" que
  existe; o placeholder "Use @ pra marcar" (:930) promete algo que o
  código não faz. Botão `ChamadoAnexos` (:964) + Enviar (:965-968).
- **Menções hoje** — `type Equipe = Pick<Profile, "id" | "nome" |
  "nome_social" | "role">[]` (:68); `mencionados` é `string[]` de ids
  separados do texto. O action só filtra por `UUID_RE`
  (`actions-chamados.ts:232`), mas **a RPC revalida no banco**:
  `comentar_chamado` (0084:777-806) só notifica `p.ativo and p.role in
  ('coordenacao','supervisor')` e insere `notificacoes` tipo
  `chamado_mencao` com href `/chamados?c=<id>` — **in-app apenas, sem
  e-mail**. O texto não é parseado: "@Fulano" digitado é literal e não
  gera notificação; a marcação é só o array.
- **Timeline** — `ChamadoTimelineItem` union (`src/lib/types.ts:701-717`):
  `sistema` | `atualizacao` pública | `comentario` interno | `anexo`.
  Comentários internos só entram no select quando staff; anexo interno
  idem (`interno` na row). Render: item interno com
  `bg-[var(--warn)]/8` + badge `Lock · interno` (:818-839); anexo é
  `Paperclip` + nome com `truncate` + sufixo "· interno" (:795-817).
- **Pipeline de anexo** — `src/components/chamado-anexos.tsx`: bucket
  privado `chamado-anexos`, allowlist `pdf/png/jpeg/webp`, 10 MB (:9-12);
  fluxo (:49-67): **insert da metadata em `chamado_anexos` → upload do
  binário → toast → `router.refresh()`**. Falha no storage deixa row
  órfã (link `/api` devolve erro — signed URL de path inexistente).
  `/api/chamado-anexo/[id]/route.ts` (:28-52): valida UUID, `getClaims`,
  lê a row **via RLS** (autor nem lê metadata de anexo interno), gera
  signed URL de 300 s e redireciona. `NovoChamadoDialog` **não** tem
  upload de anexo (grep vazio) — anexar só existe dentro do chamado.
- **Realtime/notificações** — nenhuma subscription; atualização é
  `router.refresh()` pós-action + poll do sino a cada 60 s
  (`notificacoes.tsx`, `POLL_MS = 60_000`).
- **E2E** — `tests/e2e/demo/chamados.spec.ts`: mascaramento plataforma
  (:54-89) e timeline pública do mentor (:91-117). No modo demo
  `equipe: []` (`queries-chamados.ts` ~260) — autocomplete fica vazio no
  demo.

### Riscos de regressão por item do plano

1. **`@` autocomplete / "+ pessoas"**
   - **Colisão com texto comum**: `@` em início de frase, e-mail ou handle
     não pode abrir popover — exigir contexto (início do campo ou após
     espaço + ≥1 char de prefixo) e Esc/blur fechando sem marcar. O mock
     **mantém `@Nome` como texto literal** dentro do textarea (ghost
     overlay `.ta-ghost`/`.at` em `v5.html:634,823`) com a pessoa em chip
     na zona `.mchips` (:633) — ou seja, o token no texto e o chip são
     duas representações da mesma marcação; remover o chip deve decidir o
     que acontece com o `@Nome` no texto (o plano não resolve).
   - **Escopo**: o mock lista o **autor do chamado** como option
     ("André Lima · Mentor DPP · autor do chamado", v5:635) — mas a RPC
     só notifica `coordenacao`/`supervisor` (0084:797-799): mencionar o
     autor vira **no-op silencioso**. Ou o autor sai do listbox, ou a RPC
     é estendida (decisão de produto pendente — v5:1019 também pergunta
     se marcação fora da equipe faz sentido).
   - **E-mail de menção**: o mock anuncia "notificada no app + e-mail"
     (v5:633); hoje só existe o sino (60 s de poll). E-mail de
     `chamado_mencao` é superfície nova (`enviarEmailsLote` +
     `registrar_email_chamado`) — não sai de graça.
   - **Demo/e2e**: `demoChamadoDetalhe` devolve `equipe: []` — sem
     enriquecer o dataset demo, o popover não é testável no e2e demo.
   - **A11y**: `role="listbox"` sobre textarea exige
     `aria-activedescendant`/keydown manual (↑↓ Enter Esc) — manter o
     `<Textarea>` real (o highlight do mock é overlay, não
     contenteditable). `outrasPessoas` já exclui `meuId` — o mock mostra
     o próprio usuário como `aria-disabled` "você".
   - O payload `mencionados` (array de ids) já é o contrato com a RPC —
     preservá-lo satisfaz "mesmo payload de hoje"; o que muda é só a UI
     de seleção.
2. **Preview de anexo (composer + timeline)**
   - **Privacidade**: `<img src="/api/chamado-anexo/<id>">` funciona (o
     browser segue o 302), mas a signed URL final fica exposta no
     DOM/network — copiá-la compartilha o arquivo por 300 s. É o mesmo
     modelo já aceito em `material-preview-pdf.tsx` (iframe
     `src=/api/material/[id]`); aceitar conscientemente, nunca gerar URL
     assinada fora da rota nem embutir `path` cru.
   - **Imagens de menores**: thumbnail inline na timeline é decisão de
     produto — o mock pede thumb de imagem; considerar se autor também vê
     thumb do próprio anexo público (sim, é o dele) e se staff vê thumb
     de `interno` (sim, mas só staff lê a row). Um click-to-preview lazy
     reduz exposição acidental sem mudar o modelo.
   - **Anexo pendente no composer**: hoje o upload é imediato no clique
     (row + storage + refresh). O mock quer arquivo **pendente antes do
     envio** com botão remover — isso reabre o pipeline: (a) upload
     imediato + delete da row/objeto no "remover"/unmount (órfão
     possível), ou (b) upload diferido no submit segurando `File[]` em
     state (precisa bloquear Enviar durante upload e tratar falha
     parcial). O `interno` é gravado na row no momento do upload — com
     upload diferido a flag passa a depender do `modo` no momento do
     envio; trocar interno↔público com arquivo pendente precisa de regra.
   - **Ordem metadata→storage**: falha no upload hoje deixa row órfã
     apontando pra path que não existe. Inverter (storage → row) deixa
     objeto órfão no bucket — menos visível que row quebrada na timeline;
     ideal é server action única que limpa o objeto se o insert falhar.
   - **MIME/preview**: thumbs só para `image/*`; PDF vira capa estilizada
     (ícone + nome), não iframe — PDF de usuário renderizado embutido é
     superfície de risco que o PreviewPdf de materiais já contorna com
     `pdfViewerEnabled` + CSP `frame-src` cobrindo o hop do 302.
   - **E2E**: o spec do mentor (:91-117) garante timeline pública sem
     interno — thumbnail/markup novo não pode vazar `title`/`alt` de anexo
     interno (a row nem chega via RLS, mas o teste deve cobrir o seletor
     novo).
3. **Overflow a 390px** — reproduzir antes. Suspeitos concretos:
   `.mchips`/`.m-pop` novos (popover pode estourar a largura do composer),
   thumbnail com tamanho fixo, pills com nome longo sem truncate no
   fieldset atual (:939-960). O `<li>` de anexo já tem `min-w-0 flex-1
   truncate` (:798-813) — se o bug é nele, a causa é outra (ex.: `quando`
   shrink-0 + conteúdo); medir `scrollWidth` como diz o plano.
4. **Feedback de envio** — `animate-enter`, `confirm-pop`,
   `confirm-draw`, `flash-ok` e `enter-x` já existem em
   `src/app/globals.css` (:149-310) com guard global de
   `prefers-reduced-motion` (:300); `motion/react` está instalado e o
   `MotionConfig reducedMotion="user"` é global
   (`src/app/layout.tsx:67`). O item novo só existe após
   `router.refresh()` — a animação de entrada exige ou inserção otimista
   local ou marcar o item recém-criado (data-attr/key) no primeiro render
   pós-refresh; cuidado pra não animar toda a timeline. O ✓ transitório
   segue o padrão de `copiar-chamada.tsx` (:34-47, timer 1,6 s).
5. **Status semântico** — trocar `STATUS_TOM` para
   aberto=destructive/atendimento=warn/resolvido=ok toca: fila (:343),
   header (:494), stepper (:531-535), `meus-chamados-card.tsx:82-87`,
   `jovem-chamados.tsx:85`. Pontos de atrito:
   - `urgencia` já usa destructive via `CAT_TOM` — `aberto` destructive
     apaga a diferença visual entre "status urgente do pipeline" e
     "categoria urgência"; no mock a urgência fica no ícone, não na cor.
   - O texto "sem dono" hoje é sufixo da linha (:364-365); o pill novo
     "Aberto · sem dono" (v5:1002) pode duplicar informação com
     `atribuido_nome`/origem na mesma linha — ajustar a fórmula do
     sufixo.
   - E2E demo asserta texto visível ("Chamado restrito…", itens de fila);
     labels novos como "Aberto · sem dono" podem colidir com
     `getByText(/Aberto/)` genéricos — conferir seletores ao mudar label.
   - Cores novas devem usar tokens existentes
     (`--destructive`/`--warn`/`--ok` + `-text`) — contraste AA vem de
     graça; não introduzir hex novo.
6. **Restrições que NÃO podem regredir**
   - `restrito` (plataforma p/ auxiliar): nenhuma timeline, anexo ou
     composer aparece — o painel `Lock` (:617-622) é a única saída; o
     guard `!chamado.restrito` (:558,626) não pode ser relaxado por
     refactor do composer.
   - Autor nunca lê comentário interno nem anexo `interno` (select
     staff-only + RLS) — previews novos têm que respeitar o mesmo corte.
   - Gates de ação: `souDono`/`papel === "coordenacao"`/`podeTratar`
     (:557-615) — plataforma segue coord-only mesmo que a UI mude.
   - `acrescentarInfoChamado` só aceita o autor e barra resolvido
     (0084:817-822) → o "Pedir reabertura" (:658-674) é o caminho do
     resolvido; não confundir com `reabrir_chamado` (staff).
   - E-mail sai **só** na atualização pública; comentário interno e
     menção não podem vazar por e-mail — preservar a fronteira ao mexer
     no fluxo de envio.

### Gaps do plano (o que falta decidir/especificar)

- **Parsing do `@`**: gatilho exato (início/espaço), caracteres válidos
  do prefixo, múltiplas menções, colar texto com `@`, editar/remover o
  token — e a sincronia token↔chip (ver risco 1).
- **Autor no listbox** = no-op server-side hoje; e **e-mail de menção**
  não existe — ambos precisam de decisão de produto (v5:1019,1020
  abertos).
- **Anexo pendente**: lifecycle completo (remover, trocar de modo,
  falha parcial multi-arquivo, retry) e se o `interno` segue o `modo` na
  hora do envio.
- **Preview**: quem vê thumb (autor × staff × interno), lazy/IO,
  lightbox ou link puro; PDF capa estática × viewer embutido.
- **Realtime**: o plano não diz se espera live-update; hoje é
  refresh+poll de 60 s — subscription `postgres_changes` seria escopo
  novo (e a RLS já isola).
- **Demo**: `equipe` vazia no dataset demo impede testar autocomplete
  via e2e demo — enriquecer `demoChamadoDetalhe`/`demoEquipe`.
- **Mentorado como autor**: `acrescentar_info_chamado` aceita
  `autor_mentorado_id` (0084:818) e o `AutorComposer` renderiza pra
  qualquer `!staff` — confirmar se a tela do jovem (`jovem-chamados`)
  deve ganhar anexo/status novos também.

### Melhorias opcionais (não estão no plano)

- Highlight dos tokens `@Nome` via overlay ghost (como o mock) sem
  contenteditable — puramente visual, zero risco de dado.
- Barra de progresso/retry no item de anexo pendente.
- E-mail de menção (quando decidido) reusa `emailChamadoAtualizacao` +
  `registrar_email_chamado`.
- `title`/`aria-label` no thumb do anexo com "arquivo interno" pra staff
  (hoje o sufixo "· interno" já existe no texto).

### Checklist do implementador (must-read)

- `src/components/chamados-app.tsx` — `STATUS_TOM`/`CAT_TOM` (:70-83),
  fila (:320-378), header+stepper (:486-555), ações staff (:557-622),
  timeline (:624-637 + `TimelineItem` :771-848), `ChamadoComposer`
  (:850-972 — pills :934-962, `enviar` :870-886), `AutorComposer`
  (:975-1024).
- `src/components/chamado-anexos.tsx` — allowlist/10 MB (:9-12), upload
  metadata→storage (:49-67).
- `src/app/api/chamado-anexo/[id]/route.ts` — auth+RLS+signed URL (:28-52).
- `src/lib/actions-chamados.ts` — `comentarChamado` (:224-238), e-mail
  público (:200-219).
- `src/lib/queries-chamados.ts` — detalhe/`equipe`/timeline (~311-385);
  demo `equipe: []` (~260).
- `supabase/migrations/0084_chamados.sql` — helpers/RLS (:123-182), view
  mascarada (:184-228), `comentar_chamado` com validação de papel e
  `chamado_mencao` (:776-806).
- `src/lib/ciclo.ts` — labels `CHAMADO_*_LABEL` (:2223-2233).
- `src/components/meus-chamados-card.tsx` (:82-87) e
  `src/components/jovem-chamados.tsx` (:85) — badges de status fora do
  `STATUS_TOM`.
- `tests/e2e/demo/chamados.spec.ts` — mascaramento (:54-89), timeline
  pública do mentor (:91-117).
- `docs/mockups/chamados/v5.html` — ghost overlay/mchips (:633-636),
  matriz papel×vê×pode (:996-999), regras (:1001-1010), decisões abertas
  (:1013-1021).
