# Recon — Instrumentos/PDM/avaliação

**Head:** worktree `recon/instrumentos` sobre `integration/plano2` @ `aecb135e` · **Fonte:** 5 sintomas reportados pelo Thiago com prints (materiais, PDM desktop, avaliação, aba Instrumentos, modal Nova meta) · **Status:** recon concluído; nada implementado.

> Diagnóstico — não implementa. Cada afirmação cita `arquivo:linha`. Comportamento descrito em 1440px e 390px; sem screenshots novos (recon por código — a mecânica de cada defeito é verificável no DOM/CSS descrito). "Correção técnica" e "decisão de produto" ficam separadas em cada ponto.

## 1. Resumo executivo

- **S1 · Card de instrumento com realce cortado** — o anel de hover/foco é `ring-inset` no shell (`materiais/page.tsx:895`), mas box-shadow inset pinta **abaixo** dos filhos opacos: a capa `bg-[var(--ict)]` cobre o anel na borda superior e nos cantos (desktop) e a lombada cobre a borda esquerda inteira (mobile). O contorno visível abraça a área interna — literalmente "a borda de uma div interna". A tira "Ler o guia" (`:904`) repete o mesmo padrão e ainda tem o anel de foco cortado pelos cantos arredondados do `overflow-hidden`. Correção técnica: `outline` com offset negativo ou overlay absoluto que pinta por cima dos filhos.
- **S2 · Hierarquia da avaliação** — `/avaliar/[token]` não tem h1 de página: só logo + "Programa de Mentoria Social" (`page.tsx:80-85`). O contexto "Encontro N com Fulano · terça-feira, 24/11 às 19:00" sai em `text-xs` centralizado acima do card (`avaliar-token-flow.tsx:74-78`) e o h1 mora dentro do card do form (`avaliacao-encontro-form.tsx:162-166`). A informação mais importante (qual encontro, quando) é o menor texto da tela. Correção técnica: bloco de cabeçalho real antes do form; o texto exato é decisão de produto.
- **S3 · PDM desktop estreito** — o instrumento PDM em `/f/<token>` herda `max-w-xl` (576px) da página (`src/app/f/[token]/page.tsx:71`); dentro, `instrumentos/pdm.tsx:97` liga `grid-cols-[180px_1fr]` a `@[34rem]` → nav sticky de ~5 itens (180px, altura pequena) + coluna de ~376px; a ficha de meta ainda subdivide em `@[30rem]:grid-cols-[1fr_180px]` (`:484`) medindo o container de 576px → campos de meta espremidos em ~176px ("cropado"). Em 390px a query não dispara — coluna única ok. Correção técnica: alargar o container pra instrumentos; "workspace" de verdade é decisão de produto.
- **S4 · Aba "Instrumentos da jornada"** — o painel empilha 4 superfícies numa coluna só (`duplas/[id]/page.tsx:1532-1602`): a lista dos 5 instrumentos (cada linha carrega título + até 3 badges + resumo + 2 links secundários + data + fileira de até 4 ações, `instrumentos-dupla.tsx:297-504`), o PDM inteiro, terceiros e voz do jovem — lista operacional e documentos vivos sem hierarquia entre si. É remake: decisão de produto + design.
- **S5 · Modal "Nova meta"** — `ItemDialog` usa `DialogContent` default `md` = 448px (`pdm-dupla.tsx:541`, `ui/dialog.tsx:72-87`); o Select "Área da vida" (16 itens, `lib/pdm.ts:60-77`) abre com `alignItemWithTrigger` (`ui/select.tsx:67`): o popup em portal z-50 alinha o item marcado sobre o trigger e cobre o modal inteiro, rolando por cima. Correção técnica: `alignItemWithTrigger={false}` + `size="lg"`; repensar o fluxo SMART é decisão de produto.

## 2. Inventário de superfícies

| Arquivo | Sintoma | Causa raiz |
|---|---|---|
| `src/app/(jovem)/jovem/materiais/page.tsx:891-896` | realce do card "pega borda interna", some em canto/borda | `hover:ring-inset` / `has-[:focus-visible]:ring-inset` no shell: inset shadow pinta sob filhos opacos (capa `bg-[var(--ict)]` `:834`, lombada mobile) |
| `src/app/(jovem)/jovem/materiais/page.tsx:900-909` | anel de foco da tira "Ler o guia" cortado nos cantos | `focus-visible:ring-inset` numa tira retangular cujo rodapé é clipado pelo `rounded-xl overflow-hidden` do shell (`:892`) |
| `src/app/avaliar/[token]/page.tsx:79-85` | página sem h1/hierarquia | header é só logo + tagline; contexto vai como `contexto` prop (`:152-163`) |
| `src/components/avaliar-token-flow.tsx:74-78` | data+contexto ilegível | `<p class="text-center text-xs text-muted-foreground">` — menor texto da tela carrega a info principal |
| `src/components/avaliacao-encontro-form.tsx:153-175` | h1 escondido dentro do card | h1 + meta + privacidade dentro do card lime; sem subtítulo com data |
| `src/app/f/[token]/page.tsx:71` | coluna de 576px em 1440px | `m-auto w-full max-w-xl @container` uniforme pra todos os forms/instrumentos |
| `src/components/instrumentos/pdm.tsx:96-103` | split 180px+376px apertado | `@container` + `@[34rem]:grid-cols-[180px_1fr]` dispara em 576px; nav sticky `self-start` é a "div de altura pequena" |
| `src/components/instrumentos/pdm.tsx:484` | campos de meta espremidos | `@[30rem]:grid-cols-[1fr_180px]` mede o container de 576px, não a coluna de ~376px do grid |
| `src/app/(app)/duplas/[id]/page.tsx:1532-1602` | aba densa, hierarquia bagunçada | `painelInstrumentos` empilha InstrumentosDupla + PdmDupla + TerceirosDupla + VozDoJovem numa coluna única |
| `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx:297-504` | status/ações competindo | `LinhaInstrumento`: até 3-4 badges + resumo + "Como conduzir" + "Ler o guia" + data + fileira com até 4 controles |
| `src/components/pdm-dupla.tsx:541` | modal pequeno | `DialogContent` sem `size` → `md` = `sm:max-w-md` (448px) |
| `src/components/pdm-dupla.tsx:597-612` + `src/lib/pdm.ts:60-77` | select vaza por cima do modal | 16 itens em `SelectContent` com `alignItemWithTrigger` default (`ui/select.tsx:67,87`) — popup portal alinha item sobre o trigger e cobre o dialog |

## 3. Achados por ponto

### P1 — Cards de instrumento (`/jovem/materiais`): realce cortado

**Estrutura** (`src/app/(jovem)/jovem/materiais/page.tsx:820-984`):

- `shell` (`:891-896`): `relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]` + `transition-shadow hover:ring-2 hover:ring-inset hover:ring-[var(--ic)]/50 has-[.gesto:focus-visible]:ring-2 has-[.gesto:focus-visible]:ring-inset has-[.gesto:focus-visible]:ring-ring`. Vars `--ic/--ict` vêm de `instrumentoVars(est.chave)` (`src/components/instrumento-icone.tsx:92-95`).
- `gesto` (`:897-899`): `gesto group/gesto flex min-w-0 outline-none sm:flex-col` — `Link` (`:914-920`), `<article>` trigger do `ReverRespostaDialog` (`:941-948`) ou `<article>` estático (`:980`).
- `capa` (`:831-861`): filho opaco `bg-[var(--ict)]` — `w-14` lombada no mobile; `sm:h-24` capa com glifo sangrando `-right-4 -top-4` no desktop.
- `guia` (`:900-909`): `Link` "Ler o guia", `border-t` + `focus-visible:ring-2 focus-visible:ring-inset`.

**Causa raiz (verificada em tailwind 4.3.3):** `ring-2` emite `--tw-ring-shadow: var(--tw-ring-inset,) 0 0 0 2px …` e `ring-inset` liga `--tw-ring-inset: inset` → sombra interna de 2px pintada pelo shell. Na ordem de pintura CSS, a sombra do elemento (inset) sai **antes** dos backgrounds dos filhos em fluxo: a capa/lombada opaca — encostada nas bordas do shell — repinta por cima do anel onde se sobrepõe.

- **1440px (`sm:`):** a capa `h-24` de largura plena encobre o anel na borda superior e nos dois cantos de cima, e nas laterais até y=96px → o realce visível vira um "⊔" abraçando [conteúdo + guia] — o contorno de uma div interna, não do card. O glifo sangrado já depende do `overflow-hidden`.
- **390px:** a lombada `w-14` encobre a borda esquerda do anel na altura toda → anel aparece só em cima/direita/embaixo. Em toque, `:focus-visible` nem sempre dispara (iOS não foca em tap), então o defeito é majoritariamente desktop hover/teclado.
- **Foco da tira "Ler o guia"** (as duas larguras): `ring-inset` desenha um retângulo no perímetro interno da tira; os cantos inferiores da tira são cortados pelo `rounded-xl` do shell via `overflow-hidden` → o anel perde os dois cantos de baixo ("some no canto/embaixo, parece clipping").

Obs.: recon anterior (`_recon/rodada-2026-11-23.md`, item 4) já apontou "hover não envolve o card" quando o anel morava no `Link` interno; a correção subiu o anel pro shell via `has-[:focus-visible]` — mas manteve `ring-inset`, que herda esta oclusão.

### P2 — Formulário de avaliação (`/avaliar/[token]`): hierarquia pobre

**Estrutura atual:**

- `src/app/avaliar/[token]/page.tsx:74-85` — coluna `m-auto w-full max-w-xl`; `<header class="mb-6">` = `<Logo size="lg"/>` + `text-xs` "Programa de Mentoria Social". **Nenhum h1 de página.**
- `:152-163` — monta `contexto` = "Encontro N com Fulano · terça-feira, 24/11 às 19:00" (via `formatDiaSemanaHora`, `src/lib/ciclo.ts:2644-2647`; variações: sessão de especialista, sessão combinada 018).
- `src/components/avaliar-token-flow.tsx:74-78` — `contexto` renderizado como `<p class="mb-4 text-center text-xs text-muted-foreground">` — linha miúda acima do card.
- `src/components/avaliacao-encontro-form.tsx:153-175` — card lime-strip: "Olá, {nome}!" + `<h1 class="text-xl">` "Como foi o encontro?" (`:162-166`) + "1 minuto · só a nota é obrigatória" + privacidade. `embutido` (`:52-54`) suprime esse card nos dialogs.
- `:180-299+` — fieldsets numerados 1–5 cada um num `rounded-xl bg-card shadow-[var(--shadow-border)]`.

**Comportamento:** idêntico em 1440px e 390px (a coluna `max-w-xl` domina nas duas) — Logo > linha miúda cinza (a única coisa que diz QUAL encontro) > card com saudação + h1 genérico. O usuário pede: h1 (título) → subtítulo com **data + dia da semana** → h3 (descrição) → form.

**Precedente interno útil:** o dialog logado `AvaliarPendenteButton` (`src/components/jovem-avaliacoes.tsx:97-99`) já põe data+dia no título: `{formatDiaSemanaHora(...)} · {rótulo}: como foi?` — a página pública ficou pra trás.

**Decisão de produto × técnica:** a estrutura (h1 → subtítulo data → descrição → form) é correção técnica e simples; o texto exato (h1 = "Como foi o encontro?" vs "Avaliação do Nº encontro"; onde fica a linha de privacidade) é decisão de produto/copy.

### P3 — PDM no desktop (`/f/<token>`, instrumento `pdm`): coluna estreita

**Estrutura:**

- `src/app/f/[token]/page.tsx:71` — `m-auto w-full max-w-xl @container` (576px) envolve logo, header e o `FormularioPublico`/`InstrumentoFlow` (`flow.tsx:95-271`, sem padding lateral).
- `src/components/instrumentos/pdm.tsx:96-97` — `@container` próprio + `@[34rem]:grid @[34rem]:grid-cols-[180px_1fr] @[34rem]:items-start @[34rem]:gap-5`.
- `:101-103` — `<nav>` "Seu PDM" `sticky top-16 hidden self-start space-y-1 @[34rem]:block` — ~5 links de capítulo, ~200px de altura: a "div de altura pequena" que divide o espaço horizontal.
- `:484` — dentro da coluna: `grid gap-3 @[30rem]:grid-cols-[1fr_180px]` (linha meta+prazo da ficha).

**Comportamento:**

- **1440px:** container da página = 576px ≥ 544px (34rem) → split 180px nav + ~376px doc (gap-5). E pior: `@[30rem]`/`@[34rem]` medem o **container** (576px), não a coluna do grid — a ficha ainda tenta `1fr_180px` dentro de ~376px → campos "Meta"/"Prazo" com ~176px. Conteúdo "cropado", nav rasa ocupando 1/3 da largura já estreita.
- **390px:** container ~358px < 544px → coluna única, nav escondida — ok.
- Mesma deformação na **prévia** `FormularioPreview` (`src/app/(app)/formularios/formulario-preview.tsx:55,101`): dialog `size="2xl"` (672px) → `@[34rem]` também dispara dentro do popup.
- Não afeta `/jovem/pdm` (o doc vivo `PdmDupla` dentro de `JovemShell` `max-w-3xl → xl:max-w-5xl → 2xl:max-w-6xl`, `jovem-shell.tsx:240`) nem a aba da ficha — essas superfícies são coluna única sem sidebar. Se o print 2 for `/jovem/pdm` e não `/f/`, o defeito muda (fica o doc dentro de card, sem coluna lateral) — marcado como hipótese secundária.

**Decisão de produto × técnica:** "usar a largura disponível" é correção técnica (o `@container` da página já existe — basta uma largura condicional por `sistema` ou um `max-w` maior). "Navegação/workspace coerentes" (nav real de capítulos, layout de documento) é decisão de produto sobre o que o PDM é: formulário linear × workspace de documento.

### P4 — Aba "Instrumentos da jornada" (`/duplas/[id]`): hierarquia bagunçada

**Estrutura:**

- `src/app/(app)/duplas/[id]/page.tsx:1532-1602` — `painelInstrumentos` empilha: `InstrumentosDupla` (`:1535`), `PdmDupla` inteiro (`:1551`), `TerceirosDupla` (`:1562`), `VozDoJovemCard`/`VozDoJovemEspecialista` (`:1575-1595`).
- `ficha-abas-tabs.tsx:78-85` — tabpanel `animate-enter mt-4 space-y-4`, remonta por aba (links `?aba=`); o contêiner vem do `AppShell` (`max-w-5xl xl:max-w-6xl 2xl:max-w-7xl`, `app-shell.tsx:316`).
- `instrumentos-dupla.tsx:544-577` — `<section>` `h2` + `ul divide-y` de 5 linhas (`INSTRUMENTOS_DUPLA_SISTEMA`, `src/lib/forms/schema.ts:128-134`).
- `LinhaInstrumento` (`:297-504`): `li` `flex flex-col gap-2 py-3` — linha 1: emblema 36px (`InstrumentoEmblema`) + título + chip `GUIA_ENCONTRO` + badges `respondido`/`link enviado`/`link expirado` (`:314-334`) + resumo (`:336-339`) + `<details>` "Como conduzir" + link "Ler o guia" (`:340-361`) + "Respondido em" (`:362-366`); linha 2: fileira de ações — "Ver resposta" (dialog `xl`), "Pedir pra refazer" (dialog `sm`), `CopiarLink` + `NudgeButton` WhatsApp, "Gerar link" (`:370-502`).

**Comportamento:**

- **1440px:** ~1152px de coluna: cada linha pode carregar até 4 badges, 1 parágrafo de resumo, 2 links terciários, 1 data e 4 botões no mesmo peso visual; abaixo, o PDM inteiro + terceiros + voz — três "documentos" e uma lista operacional na mesma régua de `h2`/card.
- **390px:** a linha vira coluna e os botões quebram — denso mas legível; o problema é o mesmo empilhamento.

É remake (pedido explícito "com UI/UX"), não correção pontual — decisão de produto o que entra/sai da aba.

### P5 — Modal "Nova meta" do PDM + select "Área da vida"

**Estrutura:**

- `src/components/pdm-dupla.tsx:510-649` — `ItemDialog` (modos nova-meta / nova-submeta / editar) com `DialogContent` **sem `size`** (`:541`) → `md` = `sm:max-w-md` (448px, `ui/dialog.tsx:72-87,95`). Campos: Meta (Input) · Porquê (Textarea, só meta) · Indicador · grid `sm:grid-cols-2` [Área da vida | Prazo] (`:594-624`).
- `:597-612` — `Select` com as 16 `PDM_AREAS_VIDA` (`src/lib/pdm.ts:60-77`).
- `src/components/ui/select.tsx:60-97` — `SelectContent` = Portal + Positioner com `alignItemWithTrigger = true` (default `:67`) → o popup alinha o item selecionado **por cima do trigger** e rola dentro de `max-h-(--available-height)` (`:87`), em portal `z-50` — ou seja, cobre o dialog. `DialogContent` é `grid overflow-y-auto max-h-[calc(100dvh-2rem)]` (`ui/dialog.tsx:108`).

**Comportamento:**

- **1440px:** dialog 448px × ~500px; ao abrir o select, o popup de 16 itens (≈520px → clampado à altura disponível) se posiciona sobre o trigger cobrindo título, campos e footer — "vaza/rola por cima do modal".
- **390px:** dialog ~358px de largura, campos em coluna única; mesmo popup por cima — no mobile chega a cobrir quase toda a tela útil.

**Decisão de produto × técnica:** parar o vazamento é técnico (abaixo). "Repensar o fluxo de adicionar meta SMART" — wizard passo a passo (título → porquê → indicador/prazo → área), edição inline na árvore, ou Sheet maior — é decisão de produto.

### Mapa de modais de instrumentos/PDM (pedido explícito)

`DialogContent` sizes (`ui/dialog.tsx:72-87`): `sm` 384px · `md` 448px (default) · `lg` 512px · `xl` 576px · `2xl` 672px · `3xl` 768px · `full`. Todos `grid gap-4 p-4 overflow-y-auto max-h-[calc(100dvh-2rem)]`; o scroll é do popup.

| Onde | Modal | Size | Observação de overflow |
|---|---|---|---|
| `jornada-rever.tsx:103` | Rever resposta (estante do jovem) | `xl` estruturado / `2xl` genérico | scroll interno ok |
| `instrumentos-dupla.tsx:383` | Ver resposta (ficha) | `xl` | ok |
| `instrumentos-dupla.tsx:425` | Pedir pra refazer (confirmação) | `sm` | ok |
| `jovem-avaliacoes.tsx:93` | Avaliar encontro (form embutido) | `xl` | ok — já põe data no título (precedente do S2) |
| `jovem-avaliacoes.tsx:169` | Ver avaliação enviada | `xl` | ok |
| `jovem-avaliacoes-historico.tsx:48` | Histórico de avaliações | `xl` | reabre dialog de detalhe por cima (empilhamento z-50 aceitável mas denso) |
| `pdm-dupla.tsx:467` | Declaração de Visão | `md` | textarea rows=4 — justo |
| `pdm-dupla.tsx:541` | ItemDialog (nova meta/submeta/editar) | `md` | **o pequeno do S5** — select cobre o dialog |
| `pdm-dupla.tsx:665` | Excluir item | `md` | 3 botões no footer — ok |
| `terceiros-dupla.tsx:477,601,772` | contato/consolidação | `md` | fora do escopo direto |
| `formulario-preview.tsx:55` | Pré-visualização do form | `2xl` | carrega o PDM com o mesmo split do S3 |
| `combinar-plano.tsx:1195` | Sheet lateral | — | único Sheet de conteúdo denso; padrão existente pra forms grandes |
| `jovem-shell.tsx:315` | Sheet menu mobile | — | nav, não conteúdo |

## 4. Opções + recomendação

### S1 — realce do card

- **A · `outline` com offset negativo (recomendada).** Trocar `ring-inset` por `outline-2 outline-[var(--ic)]/50 -outline-offset-2` no hover e `outline-ring` no `has-[:focus-visible]`: `outline` pinta **por cima** de todos os filhos e segue o `border-radius` nos browsers atuais → contorno completo do card com 2px, sem overlay extra. Na tira do guia, idem (`-outline-offset-2` mantém dentro). Trade-off: `outline` não é animável — o `transition-shadow` atual vira no-op visual (troca instantânea; aceitável pra foco/hover) — e offsets negativos exigem testar Safari <16.4? Não: seguem o radius desde ~2022. Custo: 2 linhas de classe.
- **B · overlay absoluto.** `after:`/span `pointer-events-none absolute inset-0 rounded-[inherit]` carregando o `ring-inset` como último filho pintado — mantém sombra (animável) e cobre os filhos. Custo: um elemento a mais por card + pseudo nas 3 variantes de gesto.
- **C · `ring` externo (sem `inset`).** Mais simples ainda; mas engrossa o card pra fora (2px nos gaps de 8-12px cabe, porém muda o ritmo da estante e pode encostar visualmente no vizinho).
- Recomendo **A**: corrige oclusão e o clipping da tira no mesmo gesto, sem estrutura nova.

### S2 — header da avaliação

- **A · bloco de header na página (recomendada).** Em `avaliar/[token]/page.tsx`: manter o chrome (logo + programa) e inserir antes do card — `<h1>` (título do gesto), `<p>` subtítulo com `formatDiaSemanaHora(quando)` + nome do mentor/encontro, `<h3>`/`p` descrição curta — e remover a linha `contexto` do flow (`:74-78`); o card do form perde o h1 duplicado ou vira h2. Espelha a ordem já usada no dialog logado (`jovem-avaliacoes.tsx:97-99`). Copy exata = decisão de produto.
- **B · promover o contexto dentro do card.** Reordenar `avaliacao-encontro-form.tsx`: h1 > subtítulo data > h3 descrição > fieldsets, tudo no card lime-strip. Menos arquivos, mas a página segue sem h1 fora do card e o formato pedido ("depois do header") fica mais fiel em A.
- **C · replicar a gramática do `/f/<token>`.** Card de título com faixa lime + h1 `text-2xl` + meta (`flow.tsx:136-192`/`formulario-publico.tsx:634-680`) — padroniza avaliação com os instrumentos; mais retrabalho, mesma família da A.
- Recomendo **A** com a gramática do `/f/` pra hierarquia (h1 `text-2xl tracking-tight`, subtítulo `text-sm`, descrição `text-sm muted`).

### S3 — PDM desktop

- **A · largura condicional por instrumento (recomendada).** Em `f/[token]/page.tsx:71` o wrapper ganha largura maior quando `sistema` é instrumento de documento (pdm/metas/roda): `max-w-xl` → `sm:max-w-2xl`/`3xl` (672/768px) ou dedicado (~ `max-w-4xl`). O `@container` já existe — `@[34rem]` do `pdm.tsx` passa a disparar com folga real (768-180-20 = ~568px de doc), e o `@[30rem]` interno volta a fazer sentido. Trade-off: `loading.tsx:17` e a largura percebida de consistência entre forms.
- **B · matar o split dentro do `max-w-xl`.** Subir o threshold do `@[34rem]` pra `@[44rem]`+ ou remover o grid — nav some no fluxo real, split só existe na prévia larga. Simples mas joga fora a intenção do sumário.
- **C · workspace próprio pro PDM.** Layout de documento (nav de capítulos real, sem card-shell de form) — o que o usuário descreve como ideal; escopo de produto/design, não só de layout.
- Recomendo **A** agora (fix técnico, uma linha de classe + flag por `sistema`) e registrar **C** como decisão de produto.

### S4 — aba "Instrumentos da jornada"

- **A · linha compacta + menu de ações (recomendada como remédio).** `LinhaInstrumento` vira: emblema + [título · estado chip único] + 1 ação primária contextual + `DropdownMenu` (`src/components/ui/dropdown-menu.tsx` existe) com as secundárias; "Como conduzir"/"Ler o guia" caem pro menu ou popover. Corta a competição badge×botão. Mantém as 4 seções empilhadas.
- **B · cards-estante (espelhar `/jovem/materiais`).** A lista vira grid de cards com capa `--inst-*` + 1 linha de estado + 1 gesto — mesma gramática que o jovem vê (coerência de produto) e ações dentro do destino. Mais retrabalho; resolve a densidade de verdade.
- **C · repartir a aba.** "Instrumentos" fica com a lista; PDM/Terceiros/Voz ganham aba própria ou sub-âncoras com `scroll-mt`. Trade-off: +1 aba na tablist (já rola overflow-x) — decisão de produto sobre taxonomia da ficha.
- Recomendo combinar **A** (linha enxuta) + **C** como decisão (separar "operação de links" de "documentos da dupla"); **B** é o passo de design completo se a estante agradar.

### S5 — modal "Nova meta"

- **A · `alignItemWithTrigger={false}` + `size="lg"` (recomendada imediata).** O popup ancora abaixo do trigger sem cobrir o dialog (`ui/select.tsx` já expõe a prop); `lg` (512px) dá respiro ao grid de 2 colunas. Custo: 2 props. Resolve o "vaza por cima".
- **B · Sheet no mobile + Dialog `lg` no desktop.** `combinar-plano.tsx:1195` já usa `SheetContent` pra conteúdo denso — padrão da casa pra forms maiores no mobile.
- **C · repensar o fluxo SMART (decisão de produto).** Wizard (específica → mensurável → prazo → área) ou criação inline na árvore com expansão — o usuário pediu explicitamente repensar; precisa de design/copy, não só largura.
- Recomendo **A** como correção agora; **C** fica como decisão de produto (junto ao "não gosto de modais pequenos" — talvez default de form passe a `lg`?).

## 5. Critérios de aceite propostos

**S1**
- Hover no card (1440px) desenha contorno completo de 2px nas 4 bordas + 4 cantos arredondados, incluindo sobre a capa; idem `:focus-visible` no gesto e na tira "Ler o guia".
- 390px: foco do gesto/tira também contorna o alvo certo (sem borda faltando na esquerda/cantos).
- Teclado: Tab pelo card e pelo guia produz anel visível com contraste ≥3:1 contra `bg-card` e contra a capa `--ict`.
- `prefers-reduced-motion`: sem animação nova (o `transition-shadow` pode morrer junto com a sombra).

**S2**
- `/avaliar/<token válido>` em 1440px e 390px: h1 visível antes do form, subtítulo com dia da semana + data + hora (`formatDiaSemanaHora`), h3/descrição em seguida; `contexto` não aparece mais como `text-xs` solto.
- Um h1 por estado (form / já registrada / erros) — sem h1 duplicado página+card.
- Landmarks/heading-order ok (h1 → h2/h3 sem pular nível); leitor de tela anuncia "Como foi o encontro, Encontro 3 com Fulano, terça…" na ordem.
- `embutido` (dialog logado) continua escondendo o header interno — sem regressão visual no `AvaliarPendenteButton`.

**S3**
- 1440px: doc do PDM usa ≥ ~560px de coluna útil (split nav+conteúdo faz sentido: nav ~180px, doc ≥ ~560px) ou cai pra coluna única — nunca o meio-termo de ~376px; campos "Meta"/"Prazo" com ≥ ~200px cada.
- 390px: idêntico ao atual (coluna única, nav escondida, zero overflow-x).
- Âncoras `#pdm-cap-N` continuam rolando pro capítulo certo com `scroll-mt` sob a pill sticky; preview `FormularioPreview` mostra o mesmo layout válido nos dois modos.
- Sem overflow-x em nenhum campo/grid em 320-1440px; `prefers-reduced-motion` mantém `transition-[width]` da barra já coberto.

**S4**
- Cada linha de instrumento: título + 1 indicador de estado + 1 ação primária (+1 menu de secundárias); sem mais de 2 elementos "status" visíveis simultâneos.
- Menu/rota secundária acessível por teclado (setas/esc) e `aria-label` com o instrumento.
- A aba separa visualmente "operação" (links/ações) de "documento" (PDM/terceiros/voz) — hierarquia de h2 consistente.
- 390px: ações alcançáveis sem overflow-x; `min-h-11` nos alvos de toque.

**S5**
- Abrir "Área da vida" não cobre título/outros campos/footer do dialog em nenhuma largura; popup limita altura e rola internamente com setas visíveis.
- Esc fecha select→depois dialog (ordem certa); foco volta pro trigger após escolha e pra "Nova meta" após fechar.
- Form completo navegável por teclado; `aria-invalid` no título vazio (hoje só `disabled`).
- Se virar Sheet/wizard: `DialogTitle`/`SheetTitle` presentes, foco inicial no 1º campo, `useFecharNoVoltar` mantido.

## 6. Riscos e fora de escopo

**Riscos**
- S1 toca a classe `shell`/`guia` compartilhada pelas 3 variantes do card (link / trigger-article / estático) e pelo padrão `shadow-[var(--shadow-border)]` — olhar `MaterialCard` (`materiais/page.tsx:995+`) que usa o mesmo vocabulário; uma troca de `ring-inset`→`outline` pode querer virar convenção (outros cards com `ring-inset` em filhos opacos sofrem o mesmo defeito latente).
- S3: alargar `/f/<token>` afeta **todos** os forms públicos (genérico, intake, 360, avaliações por link) — precisa gate por `sistema`, não troca global; `loading.tsx` acompanha.
- S4 mexe em superfície de coord+mentor com 5 estados de entrega e 2 trilhas — a RPC `instrumentos_da_dupla` e os pares roda/checklist (`parRoda`/`parChecklist`) alimentam o merge de estados; a remontagem não pode perder `pendenteVisivel`/`refazerVivo`/`pendenteJovem`.
- S5: `alignItemWithTrigger` é prop do `SelectContent` local (não global) — trocar o default do kit afetaria a app inteira; faça override no call site.
- Dialogs empilhados (histórico → detalhe) já vivem em z-50 igual — qualquer mudança de camada pode reordenar.

**Fora de escopo (não investigado a fundo)**
- `TerceirosDupla`, `VozDoJovemCard`, outros forms do `/f/`; o `Metas`/`Visao`/`RodaVida` só foram checados pra container-queries (só `roda-vida.tsx:204-212` usa, e ganha com container maior — não quebra).
- Migrations/RPCs: nada aqui pede schema — `emitir_link_instrumento`/`pdm_*` intactas.
- E2E: não rodei app/Playwright (recon de código; a repro descrita é suficiente pra spec).

## 7. Perguntas/decisões de produto

1. **S2 — copy do header:** h1 = "Como foi o encontro?" (gesto, igual ao card atual) ou "Avaliação do Nº encontro" (formal)? A descrição (h3) traz a linha de privacidade pra cima ou ela fica no card do form?
2. **S3 — o PDM é formulário ou documento?** "Workspace coerente" (nav real + layout próprio) é fatia de design; o mínimo técnico (alargar container) resolve o aperto mas mantém a metáfora de form. O mesmo vale pro `FormularioPreview`, que herda o container.
3. **S4 — taxonomia da ficha:** a aba junta "operação de links" + PDM + terceiros + voz. Separar em abas/subseções? Quais ações merecem ficar primárias por estado (mentor vs coord veem gestos diferentes)?
4. **S5 — fluxo "Nova meta SMART":** dialog maior resolve o vazamento; mas o pedido é repensar o fluxo — wizard guiado (específica → mensurável → alcançável → relevante → prazo), edição inline na árvore, ou form único maior? E: "modais pequenos" vira regra (default de form passa de `md` pra `lg`)?
5. **S1 — convenção do anel:** se `outline` vencer, vale padronizar como o realce de card da casa (mesmo defeito latente em outros `ring-inset` sob filhos opacos) ou manter local?
