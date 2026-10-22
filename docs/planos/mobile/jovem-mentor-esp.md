# Mobile audit — jovem + mentor + especialista + supervisor

## Cobertura
`src/app/(jovem)/**` inteiro — /jovem (jornada/home) · /jovem/agenda
(+EncontroLinha, jovem-agendar-dialog, jovem-encontro-acoes,
editar-link-dialog, avaliacao-jovem-acoes) · /jovem/especialistas
(+catalogo-jovem, jovem-especialista-card, pedir-especialista-dialog,
jovem-trilha-card, jovem-sugestao-card) · /jovem/pessoas +
/pessoas/[id] · /jovem/materiais · /jovem/pdm (+pdm-arvore, pdm-dupla) ·
/jovem/perfil (+perfil-form, campos-pessoais, privacidade-card,
jovem-chamados, chamados-app, novo-chamado-dialog, rever-resposta-dialog) ·
onboarding-jovem · loading/error/EstadoCard · jovem-shell.
Mentor — mentor-home, agenda-minha, agenda-por-mentorado,
agenda-calendario, agenda-grade-semanal, agenda-grade-edicao,
agenda-disponibilidade, duplas-lista (LinhaDupla/VisaoMentor/LinhaMini),
lembrete-button/lembrete-disponibilidade, notificacoes, app-shell.
Especialista — demandas-especialista, agenda-especialista,
solicitacao-negociacao, trilha-jornada, VisaoEspecialista (duplas-lista).
Supervisão — agenda-auxiliar (VisaoSupervisor/LinhaConsolidada),
supervisao-dialog, supervisoes-section, supervisao-delete-button.
Casca compartilhada — ui/{button,input,textarea,select,switch,dialog},
globals.css, app/layout.tsx (MotionConfig).

Notas de escopo:
- **Em edição paralela (não auditado)**: Roda da Vida
  (`src/components/instrumentos/roda-vida.tsx`, `roda-svg.tsx`).
- `/duplas/[id]` (ficha da dupla) segue em onda de edição paralela —
  fora do grupo; os cards que levam a ela foram auditados.
- Forms por token público (`/f/[token]`, `/avaliar/[token]`) cobertos
  em `docs/planos/mobile/publicas-auth.md`.
- Auditoria estática (read-only em src, sem emulador). Referência de
  alvo do brief: 44px; o piso interno do app é `h-11`/`min-h-11`/`size-11`.

## Sumário
- Bloqueante: 0
- Importante: 3
- Polish: 6

---

## Achados

### JOVEM — disponibilidade (perfil + onboarding)
- **Importante** — grade de disponibilidade com células de 36px no
  mobile. `src/components/campos-pessoais.tsx:421` usa
  `"grid h-9 w-full ... sm:h-10"` — a grade 7×3 rende células ~31–40px
  × 36px a 360px, abaixo dos 44px que todo o resto do app honra. É o
  input central que o jovem preenche no onboarding passo 2
  (`onboarding-jovem.tsx`) e no dialog de edição do perfil — público
  mobile-majoritário, gesto repetido ~21×. Mitigações já existentes
  (drag-paint com `touch-none`/`onPointerEnter`, toggles de linha e
  coluna, `role="grid"` + roving tabindex + setas) reduzem o custo,
  mas não o alvo. Os toggles de cabeçalho também são `py-1 text-[11px]`
  (`:383`) e `h-full` dentro de linha h-9 (`:397`). Fix: `h-11 sm:h-10`
  nas células (3 linhas × 44px = 132px, cabe) e `min-h-11` nos botões
  de cabeçalho/linha.
- OK: `aria-pressed` + `aria-label` por célula (`:413-414`), roving
  tabindex (`:412`), liberação de pointer capture, legenda `sr-only`
  (`:368`), hint `text-xs` abaixo da grade.

### JOVEM — links secundários sub-44 (navegação diária)
- **Importante** — links de ~20–36px nas superfícies do jovem:
  - `src/app/(jovem)/jovem/pessoas/[id]/page.tsx:81-87` — "← Pessoas"
    `inline-flex ... text-sm` sem min-h → ~22px; é a única saída da
    ficha da pessoa.
  - `src/app/(jovem)/jovem/page.tsx:470-480` — "Ver agenda" `text-xs`
    → ~20px, header da seção Encontros.
  - `src/components/jovem-especialista-card.tsx:137` — `<summary>`
    "Experiência e formação" `min-h-9` → 36px.
  O próprio app já tem o padrão correto: "Ver ficha ›" de LinhaDupla
  usa `min-h-11 ... sm:min-h-8` (`duplas-lista.tsx:401`) e os links de
  voltar do PDM usam `min-h-11`. Fix: replicar `min-h-11 sm:min-h-8`
  (ou `py-2.5 sm:py-1`) nesses links/summaries — ~1 linha por arquivo.

### JOVEM — agenda
- **Polish** — cluster de ações do EncontroLinha denso e sem hierarquia
  na hora da chamada. `src/app/(jovem)/jovem/agenda/page.tsx:528-601`:
  `ms-auto flex flex-wrap justify-end gap-2` chega a 5–6 controles —
  "Entrar" (`variant="outline"`, `:530-539`), lápis EditarLink,
  "Remarcar" outline, "Desmarcar"/"Não aconteceu" ghost, "Avaliar",
  badge. Todos h-11 (alvos OK), mas a 360px quebram em 2 linhas
  alinhadas à direita e "Entrar" — a ação que importa no horário —
  tem o mesmo peso visual de "Remarcar"/"Desmarcar". Fix: "Entrar"
  com `variant="default"` (ou cor de papel) quando `futuro &&
  linkSeguro`; opcional: mover "Desmarcar"/"Não aconteceu" para um
  overflow-menu (padrão já usado em `pdm-arvore.tsx:139`).
- OK: todos os tamanhos h-11 via `size="sm"`; ações destrutivas atrás
  de Dialog com copy honesta (jovem-encontro-acoes.tsx:21-61,75-115);
  `sr-only " na chamada (abre em nova aba)"` (:538); EditarLink some
  na trilha especialista porque a RPC é DPP-only (:544); "Remarcar"
  cobre agendado vencido (limbo) (:567-581).

### JOVEM — materiais
- **Polish** — `<summary>` das estações/materiais trancados concatena
  todos os títulos. `src/app/(jovem)/jovem/materiais/page.tsx:869-871`
  (`itens.map(...).join(" · ")`) e `:1170-1174` — um grupo com 5 itens
  vira 3+ linhas enroladas a 360px antes do texto de ajuda. Fix:
  truncar nos 2 primeiros + `"+N"`, ou mostrar só contagem + faixa de
  encontros (`quandoAbre` do 1º ao último).
- OK: `<details>` com `<h3>` no summary (:1162-1169), linhas
  expandidas com LockSimple + explicação (:895-898), `min-h-11` nos
  botões de download/preview, PDF preview `pointer-events-none`
  decorativo.

### JOVEM — especialistas & trilha
- **Polish** — stepper da trilha em `text-[10px]`.
  `src/components/jovem-trilha-card.tsx:218-275`: 5 passos em ~64px
  cada (dots `size-7` :243, labels `text-[10px] max-w-24` :259, datas
  `text-[10px]` :268). `sr-only` com nome+estado por passo (:253-255)
  e `title` no dot (:241) mitigam. Fix opcional: `text-[11px]`, título
  reduzido a 1 palavra já é feito via `split(",")[0]` (:265) — esticar
  `max-w-24`→`max-w-none` em `sm`, data para `title`.
- **Polish** — scroll aninhado no dialog de pedido.
  `src/components/pedir-especialista-dialog.tsx:293`: lista
  `max-h-52 overflow-y-auto` dentro do `DialogContent` que já rola
  (ui/dialog.tsx). 208px escondem metade da lista de especialistas no
  modo dirigido. Fix: `max-h-[40dvh]` ou remover o cap interno.
- OK: slots de horário `min-h-11` com wrap (:492-527, só 10 primeiros +
  title descritivo), rows de especialista `w-full` (:298-308),
  `aria-pressed` na seleção; `catalogo-jovem.tsx:129-141` CTA de ajuda
  h-11 (Button sm) com copy honesta ("abre um chamado"); grid do
  catálogo `sm:grid-cols-2`; `jovem-sugestao-card` ações h-11 + Dialog
  de confirmação; `trilha-jornada` rails `overflow-x-auto` + `size-11`.

### JOVEM — pessoas, perfil, chamados, home, casca
- OK: `pessoas/page.tsx` rows h-11, WhatsApp icon-only com aria-label,
  opt-in de telefone respeitado (sem foto/WhatsApp de colega sem
  consentimento); `jovem-chamados.tsx:77` rows `min-h-11` full-width +
  empty state; `novo-chamado-dialog` opções `min-h-11` (:156);
  `avaliacao-encontro-form` radios `size-11` (:196);
  `privacidade-card` label full-row envolvendo o switch (alvo = linha
  inteira); `perfil-form` reusa `(app)/perfil` — BotaoLapis `size-11`;
  onboarding `100dvh` + header/footer fixos com `env(safe-area-inset-*)`,
  progressbar, foco programático, CTA h-11 full-width
  (`onboarding-jovem.tsx:328-389`); `jovem-shell` safe-area nos dois
  eixos + bottom nav 4 destinos + "Mais" em popover com labels
  acessíveis (:225-306) — Especialistas/Perfil ficam no Mais (ok:
  trilha e perfil aparecem na home); skeletons espelham a anatomia;
  `error.tsx` retry dentro do shell.

### MENTOR — home, agenda, duplas
- **Importante** — pills de aba com `py-1.5` (~33px) na /agenda staff,
  o switch de modo mais usado no dia a dia:
  `src/app/(app)/agenda/page.tsx:492` (AbasAgenda híbrido
  DPP/Especialista), `:531` (AbasAgendaCoord Monitoramento/Calendário),
  `:576` (AbasAgendaMentor Minha/Por mentorado/Calendário) e
  `src/components/agenda-auxiliar.tsx:283` (AbasAuxiliar) — todos
  `rounded-md px-3 py-1.5 text-sm`. Fix: `py-2.5 sm:py-1.5` ou
  `inline-flex min-h-11 sm:min-h-8 items-center`.
- OK: `mentor-home` CTAs `min-h-11` (:370,:519), painel "O que fazer
  agora" claro, trilhas de especialista corretamente sem CTA de
  agendamento DPP; `agenda-minha` coluna única + chips `min-h-11`
  (filter-chip.ts:8); `agenda-por-mentorado` cards com summary
  `min-h-11`, footer `flex flex-wrap gap-2` + Button sm h-11
  (:565-597), "Lembrar" com cap 48h visível e razão no `title`
  (lembrete-button.tsx:55-65); `agenda-grade-semanal` mobile vira
  card-por-dia dedicado (:245-343) — boa transformação;
  `agenda-grade-edicao` `hidden md:block` (edição desktop-only por
  decisão consciente); `agenda-calendario` `overflow-x-auto` +
  `role="region"` + `aria-label` + `min-w-[32rem]` (:4133-4139) —
  scroll horizontal intencional com affordance; `agenda-disponibilidade`
  remover slot `size-11` (:263,:353); `duplas-lista` LinhaDupla
  colapsa em card empilhado abaixo de `lg` (:245-405), "Ver ficha ›"
  `min-h-11 sm:min-h-8` (:401), VisaoMentor em cards mobile com
  ações h-11 (:1457-1695); CabecalhoColunas `hidden lg:grid` (:462).

### MENTOR/SUPERVISOR — alvos secundários sub-44
- **Polish** — "Ver ficha ›" e afins a 32–36px onde o resto do mesmo
  arquivo usa `min-h-11`:
  - `src/components/agenda-auxiliar.tsx:403` e `:601` — `min-h-9`
    (36px) nos dois cards do supervisor (por turma e consolidado) —
    é a ação central por card.
  - `src/components/duplas-lista.tsx:443-448` — LinhaMini `px-1.5
    py-2` (~36px); o `lg:py-1` mostra que o mobile merecia `min-h-11`.
  - `src/components/pdm-dupla.tsx:202` — "Editar" `min-h-8` (32px).
  - `src/components/pdm-arvore.tsx:139,167,256` — chevrons/overflow
    `size-10` (40px).
  Fix: uniformizar `min-h-11 sm:min-h-8`/`size-11 sm:size-8` — mesmo
  padrão de `duplas-lista.tsx:401`.
- **Polish** — sinais do LinhaDupla em `text-[10.5px]` truncate
  (`duplas-lista.tsx:354-370`). Em card mobile há espaço vertical;
  `title={tituloSinais}` mitiga mas mobile não tem hover. Fix:
  `text-[11px]` + `line-clamp-2` (ou badge count + detalhe na ficha).

### ESPECIALISTA
- OK: `demandas-especialista` chips `min-h-11`, busca/filtros quebram
  em wrap, cards com empty state; `agenda-especialista` CTAs
  `min-h-11` (:282,:291) e ações empilham em wrap (:189-239);
  `solicitacao-negociacao` — todos os botões Button sm/default = h-11
  mobile (aceitar/contrapropor/recusar + chips de slot `min-h-11`,
  Select `size="sm"` h-11); `trilha-jornada` rail `overflow-x-auto` +
  dots `size-11`; VisaoEspecialista (duplas-lista:1702-1889) usa cards
  + stepper de dots (informativo, não interativo — tamanho ok).
- Sem achados de severidade — densidade de labels é a única aresta
  (muitos `text-xs`/`text-[11px]`), coerente com persona secundária.

### SUPERVISÃO
- OK: `supervisao-dialog` selects/Input h-11, date `type="date"`,
  textarea conta 4000, submit full-width h-11; `supervisoes-section`
  cards com data/contexto/atribuição + delete coord-only com
  `aria-label` (supervisao-delete-button.tsx:22); VisaoSupervisor
  trigger `min-h-11` (agenda-auxiliar:~1423); LinhaAuxiliar e
  LinhaConsolidada quebram em cards. Achados do supervisor estão no
  grupo "alvos secundários sub-44" acima (Ver ficha › 36px).

### Casca & primitivas (transversal)
- OK: `ui/button.tsx:29-39` — todo size é h-11/size-11 abaixo de `md`
  (default, sm, icon, icon-sm); `ui/input.tsx:12` h-11 text-base
  mobile → md:h-8; `ui/textarea.tsx`, `ui/select.tsx` h-11;
  `ui/dialog.tsx` `max-w-[calc(100%-2rem)]` +
  `max-h-[calc(100dvh-2rem)]` + `overflow-y-auto` — dialogs sobem o
  scroll para o container, teclado não cobre ação.
- OK: tipos de input/teclado corretos em todo o código auditado —
  `type="tel"`+`inputMode="tel"`+`autoComplete="tel"`, `type="url"`,
  `type="datetime-local"` (jovem-agendar-dialog:217,
  agendar-encontro-dialog:265), `type="date"` (supervisao-dialog:195),
  `enterKeyHint`/`autoComplete` no instrumentos/campos.
- OK: safe-area `env(safe-area-inset-bottom)` no bottom nav dos dois
  shells (jovem-shell, app-shell), header staff com controles
  `size-11`, sino `size-11` (notificacoes:302) + popover
  `max-w-[calc(100vw-2rem)]` + lista `overflow-y-auto`.
- OK: motion — `MotionConfig reducedMotion="user"` (app/layout.tsx:65-67)
  + guard CSS global `@media (prefers-reduced-motion: reduce)`
  (globals.css:300-318) cobrindo animate-enter/-x/rise; spinner
  preservado.
- OK: permissões no UI — ações staff não aparecem pro jovem
  (EditarLink some na trilha especialista, :544); WhatsApp de colega
  só com opt-in; contato direto do especialista só após trilha
  iniciar; delete de supervisão é coord-only; LembreteButton
  desabilitado carrega razão no `title` (lembrete-button.tsx:55-65).

## Limitações
- Auditoria estática — sem viewport real; recomenda-se smoke em
  360×800: grade de disponibilidade no onboarding, EncontroLinha na
  hora da chamada, dialog de supervisão com teclado aberto.
- `/duplas/[id]` e Roda da Vida fora por edição paralela.
