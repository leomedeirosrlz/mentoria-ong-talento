# RECON — Agenda, CTAs mobile e registro retroativo (feedback 25/11)

- Head: `10ebd056` — branch `recon/agenda-1125` (base `integration/plano2`)
- Fonte: `docs/planos/feedback-thiago-2026-11-25.md` §3 (9 itens), §7 (transversais)
  e §8.3/§8.7 (decisões de produto pendentes)
- Status: **diagnóstico** — nada implementado neste worktree
- Formato/padrão: `_recon/pessoas-especialistas-2026-11-24.md`

## 1. Resumo executivo

Os 9 itens da §3 se agrupam em 4 frentes que compartilham causa raiz:

1. **Picker**: o `SeletorDiaHora` (chips custom, Sheet mobile / Dialog desktop)
  só cobre o caminho feliz — o cartão "Próximo passo" com motor de sugestões
  (481) e as linhas do combinado (482). Todos os outros pontos de agendar/
  remarcar/registrar continuam em `type="datetime-local"` nativo, e os escapes
  "Outro dia"/"Outro horário" do próprio seletor revelam um `type="date"`/
  `type="time"` que pede um 2º toque pra abrir o calendário do SO.
2. **Registro retroativo**: a copy não foi removida — a porta de entrada é que
  é condicional (`numerosRetro.length > 0`), então some quando não há passo
  elegível e o empty-state já escrito dentro do dialog nunca é alcançado. O
  pedido "botão perto de Agendar" é resolvido expondo o `JovemRetroativoDialog`
  que já existe (e que já faz "escolher encontro + data").
3. **CTAs de card**: a linha de encontro do jovem chega a 4 controles + badge
  sem hierarquia, e a agenda do mentor repete a grade `w-18`+ações `w-full
  justify-end` que produz o "espaço inútil assimétrico". O padrão que o
  feedback pede (1 primário + ⋯) **já existe e é canônico**: `DuplaLinha` +
  `DuplaLinhaMenu` (DropdownMenu Base UI, dialogs controlados fora do popup).
  É portar, não inventar.
4. **Liza**: a REALIZA-505 moveu o FAB pra dentro da bottom-nav (faixa
  reservada) pra resolver interseção com CTAs — o feedback considera a troca
  pior que o problema (labels a `text-[10px]`, nav assimétrica). É invariante
  do regression-map com spec e2e própria; reverter exige atualizar os dois.

§8.3 ("Registrar encontro" separado vs no menu) e §8.7 (⋯ em todos os cards vs
só 2+ ações) ficam mapeadas com recomendação, mas são decisão de produto.

## 2. Mapa de superfícies

| Superfície | Arquivo | Hoje |
|---|---|---|
| Picker custom | `src/components/seletor-dia-hora.tsx` | Chips dia/hora + `type="date"` (:335) e `type="time"` (:413) como saída rara; Sheet bottom <768px, Dialog lg ≥768px (:505-538) |
| Agendar do jovem | `src/components/jovem-agendar-dialog.tsx:224-235` | `datetime-local` + motivo de remarcação (:256-287) |
| Retroativo do jovem | `src/components/jovem-retroativo-dialog.tsx:169-177` | `datetime-local`; copy :109-113; empty-state :115-136 (inalcançável) |
| Agendar/remarcar do mentor | `src/components/agendar-encontro-dialog.tsx:367-382` | `datetime-local` + motivo obrigatório se data muda (:435-463) |
| Retroativo do mentor | `src/components/registrar-retroativo-dialog.tsx:213-221` | `datetime-local` |
| Card "Próximo passo" | `src/components/jovem-agendar-sugestao.tsx:196-236` | Primário "Marcar para…" + ghost "Escolher outro dia" → `SeletorDiaHora` |
| Agenda do jovem | `src/app/(jovem)/jovem/agenda/page.tsx:573-594, 927-944` | Header: `JovemAgendarDialog` só se **sem** sugestão + `JovemRetroativoDialog` só se `numerosRetro>0`; rodapé do histórico idem |
| Linha "Próximos" do jovem | `src/components/jovem-encontro-linha.tsx:163-277` | Até 4 controles + badge por estado (o "7º encontro" do feedback) |
| Pendências do jovem | `src/components/jovem-para-fazer.tsx:219-262` | Até 3 ações/linha (Aconteceu + Remarcar + Não aconteceu; retro via dialog) |
| Minha agenda (mentor) | `src/components/agenda-minha.tsx:98-249` | Grade `w-18` + `AcoesItem` com até 4 botões (`w-full justify-end` no mobile) |
| Por mentorado (mentor) | `src/components/agenda-por-mentorado.tsx:359, 519-534, 596-631, 809, 1270` | Card `p-5 gap-4`, caixas aninhadas com padding próprio, pendências com 2 links, footer com 2 CTAs |
| Agenda especialista | `src/components/agenda-especialista.tsx:327-362, 398-462` | Mesma grade `w-18`, ação única (já limpa) |
| Tag de escopo | `src/lib/agenda-minha.ts:702, 940` | `notaConvidado: "agenda de X: você não participa"` |
| Padrão ⋯ canônico | `src/components/dupla-linha.tsx:272-296` + `dupla-linha-menu.tsx` | "UMA ação contextual + ⋯ + Ver ficha decorativo"; kit `ui/dropdown-menu.tsx` (Base UI Menu) |
| Liza | `src/components/assistente-bolha.tsx`, `jovem-shell.tsx`, `app-shell.tsx:329-337` | FAB dockado na faixa reservada da bottom-nav (REALIZA-505) |

## 3. Achados por ponto

### Ponto 1 — "Agendar encontro no mobile ainda abre picker nativo"

**Achado:** o `datetime-local` nativo continua em 4 dialogs (`jovem-agendar-
dialog.tsx:227`, `jovem-retroativo-dialog.tsx:172`, `agendar-encontro-
dialog.tsx:367-382`, `registrar-retroativo-dialog.tsx:213-221`). O picker
custom (`SeletorDiaHora`) só é alcançado quando o motor de sugestões entrega
`SugestoesEncontro` — cartão "Próximo passo" (`jovem-agendar-sugestao.tsx:223-
236`) e combinado. Remarcar (`EncontroLinha`, `jovem-para-fazer.tsx`, agenda do
mentor), o fallback sem sugestão e os dois retroativos caem nos dialogs
antigos. A causa raiz é que `SeletorDiaHora` **exige** o pacote
`SeletorSugestoes` (`seletor-dia-hora.tsx:69-79`: datas+perfil+disponibilidade+
ocupados+duração+janela) e não tem "modo manual". Complicador de domínio:
remarcar cobra `motivo` quando a data muda (preset Select + texto livre —
`agendar-encontro-dialog.tsx:435-463`, `jovem-agendar-dialog.tsx:256-287`) e o
seletor não coleta motivo; o retroativo é `date` puro com teto hoje, não
datetime futuro.

**Opções:**

- **A. `SeletorDiaHora` ganha "modo manual"** — `sugestoes` opcional: sem
  datas sugeridas, a seção "Dia" mostra direto o `type="date"` (único campo
  nativo honesto) + chips de hora derivados do perfil/janela quando houver,
  ou `type="time"` quando não. Props novas: `atual`/`piso`/`max`, `pedeMotivo`
  (revela o mesmo Select de motivo), `rotuloConfirmar`/`titulo` já existem.
  Os 4 dialogs viram wrappers finos (FormSurface + estado + RPC) sobre ele.
  Prós: uma anatomia só, um a11y só, o "Nada de picker nativo no mobile onde
  o fluxo tem picker custom" (§7) fica verdadeiro. Contras: maior refatoração;
  o modo retroativo precisa de "chips de encontro" (já tem `numeros`/`Outro
  encontro` :433-464) + `max=hoje` no date.
- **B. `DiaHoraField` dumb novo** — componente de campo (chips de hora +
  `type="date"` separado) usado pelos 4 dialogs sem tocar no motor. Prós:
  desacoplado, migração fileira a fileira. Contras: dois seletores na casa,
  anatomia tende a divergir.
- **C. Migrar só o jovem primeiro** (`JovemAgendarDialog` +
  `JovemRetroativoDialog`), mentor na frente seguinte. Reduz risco da fatia,
  mas deixa o mentor — superfície mais usada — no picker nativo por um ciclo.

**Recomendação:** A, fatiada como C por papel (jovem → mentor), não por
componente: o `SeletorDiaHora` cresce modo manual + slot de motivo, e cada
dialog vira casca fina. O comentário do próprio seletor já marca a intenção
("chips… nunca datetime-local" :37-41) — o modo manual a estende com honestidade:
`type="date"` isolado onde chip não tem o que mostrar.

### Ponto 2 — "Outro dia" deve abrir o picker sem clique extra

**Achado:** em `seletor-dia-hora.tsx`, tocar no chip "Outro dia" roda
`escolherOutroDia` (:265-272): marca `selDia="outro"`, pré-preenche `outroDia`
com amanhã e **monta** o `Input type="date"` no render seguinte (:333-352).
O calendário nativo só abre no 2º toque, no input revelado — exatamente o
"clique extra" do feedback. `HTMLElement.showPicker()` existe em Chrome/Edge/
Safari 16+ e roda dentro de transient activation — a janela do clique no chip
vale, desde que o input já esteja montado (elemento `hidden`/`display:none`
recusa; `sr-only`/clip aceita). Mesmo caso no "Outro horário" (:400-430).

**Opções:**

- **A. Input sempre montado + `showPicker()` no handler** — o `type="date"`
  nasce invisível (`sr-only` ou tamanho 0 quando `selDia!=="outro"`), e
  `escolherOutroDia` chama `ref.current?.showPicker()` ainda dentro do clique.
  `try/catch` + `focus()` como fallback (browsers sem a API caem no
  comportamento atual). Idem no "Outro horário".
- **B. `useEffect`/`requestAnimationFrame` no mount condicional** — funciona,
  mas a transient activation pode expirar entre a fase de commit e o rAF;
  mais frágil que A.
- **C. Mini-calendário custom próprio** — escopo de design novo; resolve o
  nativo de vez mas é desproporcional pro tamanho do problema.

**Recomendação:** A — duas linhas por campo + fallback gracioso. O efeito
colateral é positivo: com o input sempre montado dá pra focar/ler o valor
mesmo antes do toque (SR anuncia "Outro dia, campo de data").

### Ponto 3 — Posição da Liza ("sair do nav")

**Achado:** a REALIZA-505 dockou o FAB na bottom-nav: `jovem-shell.tsx` reserva
`pr-[max(4.25rem,calc(env(safe-area-inset-right)+3.25rem))]` na barra e
comprime os labels pra `text-[10px]`; `assistente-bolha.tsx` posiciona o FAB a
`bottom: 0.375rem` dentro da faixa; `app-shell.tsx:329-337` repete a reserva
no shell staff. O motivo era real — o FAB flutuante interceptava toques em
CTAs/links na base (o invariante "nunca intersecta alvo interativo a 390px"
está em `docs/regression-map.md:54`, protegido por `tests/e2e/demo/liza-posicao.spec.ts`).
O feedback julga a troca pior que o problema: label miúdo + nav assimétrica +
a Liza "virou chrome" em vez de assistente.

**Opções:**

- **A. Desdocar: FAB flutuante acima da nav** — volta ao pré-505 com o offset
  vertical correto (`bottom: calc(altura da nav + margin + safe-area)`),
  labels voltam a `text-[11px]`, remove a reserva `pr-*` dos dois shells. A
  regra da 505 migra de "não intersecta a nav" pra "não cobre a barra nem
  alvos sticky" — o FAB pode cobrir conteúdo scrollável (overlay comum), e se
  a interseção voltar a incomodar, mitigar com recolhimento ao rolar (hide on
  scroll down, show on up — o motion kit já tem spring pra isso).
- **B. Liza no header superior** — slot ao lado do `NotificacoesBell`; sai da
  zona de polegar de vez, mas compete com sino/perfil e enterra o assistente
  (a proposta da Liza é ser presente).
- **C. Manter a doca e polir** — label `text-[11px]` mesmo apertado, FAB
  menor, balão mais contido. Não atende o "sair do nav" do feedback.

**Recomendação:** A — é o que o feedback pede e devolve a nav simétrica. O
preço é reescrever a invariante: `liza-posicao.spec.ts` passa a medir
interseção contra a **barra** e contra alvos **sticky** (o caso que motivou a
505), aceitando cobertura de conteúdo scrollável; `regression-map.md:54` é
corrigido na mesma PR (regra do AGENTS.md). Decisão de produto: confirmar que
"fora do nav" = flutuante (A) e não header (B).

### Pontos 4+5 — Retroativo: a copy existe; falta a porta

**Achado:** nada foi removido — a copy "Se vocês se encontraram sem agendar
por aqui…" está em `jovem-retroativo-dialog.tsx:109-113` e o gatilho "Encontro
que não aparece aqui?" no rodapé do histórico (`agenda/page.tsx:927-944`). O
problema é que **todos os pontos de entrada são condicionais a
`numerosRetro.length > 0`**: botão do header (`:583-594`), rodapé do
histórico e a pendência "O Nº encontro era na semana de dd/mm e não está na
agenda. Vocês se encontraram?" (`pendencias-jovem.ts:317-330`, prioridade 90,
via `JovemParaFazer:249-262`). Sem passo oficial vencido elegível, a função
some da tela — parece removida. E o empty-state já escrito dentro do dialog
(`:115-136`: "a agenda oficial passa pela equipe…") é **código morto** hoje,
porque todo caller filtra antes. O pedido §3 — botão "Registrar encontro"
perto de "Agendar" com escolha de data e encontro — é literalmente o que o
`JovemRetroativoDialog` já faz ("Qual encontro foi" por chips + "Quando foi").

**Opções:**

- **A. Botão separado sempre visível** — "Registrar encontro" (outline) ao
  lado do CTA de agendar: no `JovemAgendarSugestao`, no `Casca` de fallback e
  no header. Sem passo elegível, o dialog abre no empty-state que já existe.
  Prós: atende a letra do feedback ("perto de Agendar", "facilitar");
  ressuscita o empty-state sem custo. Contras: um segundo botão permanente —
  mitigado pela variante menos proeminente.
- **B. Item no menu ⋯ do card** — nasce junto do Ponto 6; esconde a função que
  o feedback quer mais visível. Só combina se o ⋯ já estiver lá por outras
  ações.
- **C. Toggle "já aconteceu" dentro do `SeletorDiaHora`** — mistura dois
  domínios (agendar = RPC de agenda futura; retroativo = `jovem_registrar_
  retroativo`, realizado no passado); confunde o resumo e a confirmação.

**Recomendação:** A — botão separado (recomendação pra §8.3). Bônus: a mesma
mudança fecha o Ponto 1 no retroativo quando o dialog virar casca do
`SeletorDiaHora` em modo manual/retroativo (`max` = hoje, chips de encontro).

### Pontos 6+7 — CTAs "jogados" e o padrão 1 principal + ⋯

**Achado:** `jovem-encontro-linha.tsx:163-277` renderiza por estado, tudo em
`flex flex-wrap gap-x-2 gap-y-1.5` sem hierarquia:

- `agendadoFuturo`: [Entrar | "Link da chamada"] + lápis `EditarLinkDialog`
  (icon-sm) + `Remarcar` (outline sm) + `Desmarcar` (ghost sm) + badge = **4
  controles + 1 badge** — o exemplo do "7º encontro".
- `passadoSemDesfecho` (limbo): `Aconteceu` + `Remarcar` + `NaoAconteceu`
  (ghost) + badge "Aconteceu?".
- `retroDele`: `Corrigir` + `Desfazer` (ghost).

`jovem-para-fazer.tsx:219-262` repete o trio do limbo. O padrão pedido **já é
canônico na casa**: `DuplaLinha` ("UMA ação contextual + ⋯ + Ver ficha
decorativo", `dupla-linha.tsx:272-296`) + `DuplaLinhaMenu`
(`dupla-linha-menu.tsx:121-222`) — trigger outline sm "Ações" (md+) / w-11
px-0 (mobile), `DropdownMenu` do kit (Base UI Menu), **dialogs controlados
fora do popup** (fecha o menu, o dialog e o foco sobrevivem — padrão "Mais"
da ficha, REALIZA-157).

**Opções:**

- **A. Extrair `LinhaAcoesMenu` compartilhado + portar `EncontroLinha`** — a
  anatomia vira `[primário contextual] [⋯]` com os dialogs do caller
  controlados fora do popup (a `DuplaLinha` continua sendo a linha canônica;
  o menu em si é o que se generaliza). Primário por estado: `agendadoFuturo`
  → "Entrar" na janela, senão "Remarcar"; `passadoSemDesfecho` → "Aconteceu";
  `retroDele` → "Corrigir". No ⋯: Editar link, Remarcar/Desmarcar, Não
  aconteceu, Desfazer. Badge segue badge (status, não ação).
- **B. Menu genérico novo (FAB/menu próprio por card)** — reinventa o que
  `DuplaLinhaMenu` já provou em a11y e foco.
- **C. Só compactar** (size `xs`, menos variantes) — reduz volume mas não
  resolve hierarquia; o feedback pede anatomia, não tamanho.

**Recomendação:** A. Para §8.7 (⋯ em todos os cards ou só 2+ ações):
**só quando 2+** — com uma ação única o ⋯ é indireção pura e o trigger vazio
parece bug. Aplicar a `EncontroLinha` primeiro, depois varrer as superfícies
do §7 (materiais, pessoas, especialistas, ficha) — `PendenciaItem` e
`AcoesItem` entram na mesma fatia.

### Ponto 8 — Cards da agenda do mentor: padding e espaço assimétrico

**Achado:** duas camadas diferentes com o mesmo sintoma:

- `agenda-minha.tsx` — a grade de toda linha é `[w-18 trilho de hora]
  [conteúdo] [ações]`. No celular (`<sm`) `AcoesItem` vira `w-full
  justify-end` (:110): os botões (até 4 — Entrar, Registrar como foi,
  Remarcar, Agendar) despencam pra uma linha própria **alinhada à direita**,
  deixando o vão à esquerda = o "espaço inútil assimétrico". O trilho `w-18`
  (72px) existe até em item por-dia, onde só carrega um ícone centralizado.
  `LinhaAviso` e a `LinhaSessao`/`LinhaPendencia` de `agenda-especialista.tsx`
  usam a mesma grade — a ação única delas já é limpa, o problema é a coluna de
  ações do mentor.
- `agenda-por-mentorado.tsx` — `CardMentorado` `p-5 gap-4` (:359) com caixas
  aninhadas de padding próprio (próximo encontro `bg-muted/50 px-4 py-3`,
  pendências `px-3 py-2.5` com "Registrar"+"Remarcar" inline :519-534, blocos
  `rounded-xl border px-4 py-3.5`) = padding em cascata ("padding estranho");
  footer `border-t pt-4` com "Abrir ficha da dupla" + `DuplaWaAcao` (:596-631).

**Opções:**

- **A. Mesma anatomia do Ponto 6 + auditoria de padding** — `AcoesItem` vira
  `[primário] [⋯]` (o `primario` flag da página já escolhe o CTA decisivo — é
  só transformar o resto em menu); trilho `w-18` afina pra `w-14` em `<sm`
  quando o item é por-dia; as caixas internas de `agenda-por-mentorado` viram
  seções separadas por `border-t`/`py-3` (uma superfície por card, como o
  `CardTrilha` de `agenda-especialista.tsx:500-566` já demonstra).
- **B. Só paddings** (p-5→p-4, deduplicar bordas) — não resolve os botões.
- **C. Trocar `LinhaItem` por `DuplaLinha`** — a grade dela é pra contexto
  denso de staff (situação+dupla+motivo+progresso+nota); na agenda do mentor
  a coluna é tempo, não cabe.

**Recomendação:** A + B juntos — anatomia nova **e** revisão de superfície;
só um dos dois deixa metade da reclamação de pé.

### Ponto 9 — "Você acompanha, não participa" → "Trilha especialista · Larissa"

**Achado:** a frase é título em 2 lugares de `agenda-por-mentorado.tsx` —
header do `TrilhaBlock` (:809, subtítulo "Trilha com {nomeEsp}") e do
`PedidoEspecialistaBlock` (:1270) — e vive também na tag de escopo
`notaConvidado` de `agenda-minha.ts` (:702, :940: `agenda de {nome}: você não
participa`, Tag info com Eye). O `nomeEsp` já está na mão (:793,
`trilha.especialista_nome ?? "especialista a definir"`) e o aria-label do
bloco já é `Trilha de especialista · ${nomeEsp}` (:797) — a troca deixa o
visível igual ao acessível. A semântica "só leitura" já é carregada por:
borda tracejada + Eye nos itens + detalhes "sem ação sua" (:965, :975).

**Opções:**

- **A. Título vira o objeto** — `Trilha especialista · {nomeEsp}`; pedido:
  `Pedido de especialista · {status curto}` (ex.: "aguardando aceite");
  `notaConvidado` → `agenda de {nome}` (o Eye já diz "só olhar"). Eye fica no
  header como ícone de escopo, não como frase.
- **B. Manter a frase e reordenar** — não atende o feedback.

**Recomendação:** A — varrer a frase nos 3 lugares (grep `"você acompanha"`
/`"não participa"` pega todos); os detalhes informativos "sem ação sua"
permanecem — eles respondem "por que não posso agir", que é a pergunta certa
dentro da linha.

## 4. Critérios de aceite

**Mobile 390px primeiro (§7):**

- Nenhum `datetime-local` nos fluxos de agendar/remarcar/registrar do jovem e
  do mentor — picker custom (chips/`SeletorDiaHora`) ou campo nativo isolado
  (`type="date"`/`type="time"` separados); `rg 'datetime-local'` nos arquivos
  dos 4 dialogs = 0 ocorrências.
- "Outro dia" e "Outro horário" abrem o calendário/relógio do SO em **um
  toque** no Chrome Android (fallback: input focado e visível onde
  `showPicker` não existir).
- `EncontroLinha`, `AcoesItem`, `PendenciaItem`: no máximo 1 CTA visível por
  linha; as demais ações no ⋯ (`w-11`/`min-h-11`, `aria-label` nomeado por
  encontro); badge continua sendo badge. Com ação única, sem ⋯.
- "Registrar encontro" visível junto ao agendar **independente de passo
  elegível**; sem elegível, o dialog abre no empty-state explicando que a
  agenda oficial passa pela equipe.
- Títulos dos blocos de acompanhamento: "Trilha especialista · {nome}" /
  "Pedido de especialista · {status}"; `rg "você acompanha"`/`"não participa"`
  = 0 como título/tag.
- Liza fora da faixa da nav (decisão A ou B); labels da nav a `text-[11px]`;
  FAB/botão nunca cobre a barra nem alvos sticky.
- Alvos ≥ `min-h-11`, focus-visible em todo controle novo, scroll horizontal
  zero; copy pt-BR sem travessão; reduced-motion intacto (menus/dialogs já na
  gramática `animate-enter`/`data-open`).

## 5. Testes que provam o comportamento

**Já existem (a estender/ajustar):**

- `tests/jovem-encontro-linha.test.tsx` — os asserts de ações por estado
  passam a exigir 1 primário + menu com os itens restantes.
- `tests/remarcar-vencido.test.tsx` + `tests/plano-acordos.test.tsx` +
  `tests/solicitacao-negociacao.test.tsx` — invariante "agendado vencido
  mostra o trio real" vira "primário Aconteceu + ⋯ com Remarcar/Não
  aconteceu" (conteúdo igual, anatomia nova).
- `tests/e2e/demo/liza-posicao.spec.ts` — a métrica da invariante muda (nav
  livre; FAB não cobre barra/alvo sticky); `docs/regression-map.md:54` na
  mesma PR.
- `tests/agenda-minha.test.ts` — `notaConvidado` novo rótulo.
- `tests/e2e/app/jovem-agenda.spec.ts` — caso novo: "Registrar encontro"
  presente sem pendência → abre empty-state.

**A criar:**

- Unit `SeletorDiaHora`: modo manual (sem `sugestoes.datas`), `pedeMotivo`
  revela o Select só quando a data muda, `showPicker` chamado no clique do
  chip (spy) com fallback em jsdom.
- e2e mobile 390px: chip "Outro dia" → picker abre sem 2º toque; card de
  encontro → 1 CTA + ⋯; item do menu abre o dialog e o foco volta ao ⋯ ao
  fechar.
- Sweep estático: `datetime-local` fora dos 4 fluxos + `"você acompanha"`/`"não
  participa"` como título — grep guard (padrão dos guards existentes).

## 6. Riscos e decisões de produto

**Decisões pendentes (§8 do feedback — com recomendação):**

1. **§8.3 — "Registrar encontro": separado ou no menu?** Recomendado
   separado (Ponto 4): o feedback pede visibilidade ("perto de Agendar"), e
   um item de menu só existe se o card tiver ⋯ por outras ações.
2. **§8.7 — ⋯ em todos os cards ou só 2+?** Recomendado **só 2+**: com ação
   única o trigger vazio confunde e adiciona um clique.
3. **Liza: flutuante (A) ou header (B)?** Recomendado A; B enterra a
   assistente. Confirmar com o Thiago antes de reverter a 505.

**Riscos técnicos:**

- **Motivo de remarcação**: portar "Remarcar" pro `SeletorDiaHora` exige o
  slot de motivo (Select preset + "outro" → texto) — hoje ele vive nos
  dialogs e é exigido pela RPC quando a data muda. Se a regra for "motivo só
  no mentor", o jovem herda o mesmo slot por consistência.
- **Retroativo ≠ agendar**: `JovemRetroativoDialog` é `date` puro com teto
  hoje e chips de passo elegível; no modo manual do seletor, `max`/`min` e o
  rótulo ("Quando foi" vs "Escolher dia") mudam — mapear como `modo:
  "futuro" | "retroativo"`, não heurística por props.
- **`showPicker` sem transient activation**: browsers antigos rejeitam; o
  fallback (input visível + foco) tem que ser o caminho normal de hoje, não
  um estado quebrado.
- **FAB acima da nav pode voltar a cobrir CTA** — o caso que motivou a 505.
  Mitigação proposta: reservar a área só quando necessário ou recolher o FAB
  ao rolar; a spec e2e nova mede interseção contra alvos sticky.
- **`numerosRetro` vazio com botão sempre visível**: o empty-state do dialog
  precisa explicar o porquê e sair com dignidade — o texto :115-136 já cobre,
  mas a versão "encontro fora da agenda oficial" (número livre) é decisão de
  produto: hoje só passos oficiais vencidos são registráveis pela RPC
  0207/0208; permitir número livre amplia escopo de domínio (não recomendo na
  mesma fatia).
- **Efeito colateral do menu ⋯**: `DuplaLinhaMenu` carrega catálogo sob
  demanda na 1ª abertura — se algum menu de agenda precisar de fetch, copiar
  o padrão (nada de fetch por card na montagem).

---

### Apêndice — skills carregadas neste recon

`ui-ux-pro-max`, `frontend-ui-engineering`, `better-layout`,
`better-accessibility`, `better-interface`, `accessible-animation` — aplicadas
na leitura de anatomia de cards/linhas (hierarquia de ações, padding em
cascata), no padrão ⋯ canônico, nos alvos de toque e nas regras de motion.
