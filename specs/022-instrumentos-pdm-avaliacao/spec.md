# Spec — Instrumentos, PDM e avaliação: polimento das superfícies

**Feature:** `specs/022-instrumentos-pdm-avaliacao` · **Status:** Clarified
**Fila:** rodada UI/UX 24/nov/2026 · **Dono:** Thiago · **Data:** 24/11/2026

> O QUÊ e o POR QUÊ. Cinco sintomas reportados com prints; o recon
> `docs/planos/issues/_recon/instrumentos-2026-11-24.md` traz `arquivo:linha`
> de cada defeito, a mecânica CSS por trás e as opções. Quatro correções de
> defeito (S1, S2, S3, S5) e um remake de hierarquia (S4). Sem DDL, sem
> contrato novo: é uma rodada de superfície (CSS/DOM/copy/a11y) sobre código
> existente — nenhuma RPC, action, policy ou schema muda.

## Problema e resultado

- **Dor hoje:** (a) o realce de hover/foco do card de instrumento do jovem é `ring-inset` no shell — sombra inset pinta **abaixo** dos filhos opacos, então a capa `bg-[var(--ict)]` cobre o anel no topo e nos cantos (desktop) e a lombada cobre a borda esquerda inteira (mobile); o contorno visível abraça uma div interna, e a tira "Ler o guia" perde os cantos do anel de foco no `overflow-hidden` (`src/app/(jovem)/jovem/materiais/page.tsx:891-909`). (b) `/avaliar/[token]` não tem h1 de página: a informação mais importante — qual encontro, quando — sai em `text-xs` cinza solto acima do card (`src/components/avaliar-token-flow.tsx:74-78`) e o h1 mora dentro do card do form (`src/components/avaliacao-encontro-form.tsx:162-166`). (c) o PDM público em `/f/<token>` herda `max-w-xl` (576px) da página (`src/app/f/[token]/page.tsx:71`): a nav lateral de 180px dispara `@[34rem]` e a coluna do documento sobra com ~376px, esmagando os campos de meta/prazo em ~176px — conteúdo "cropado" em 1440px (`src/components/instrumentos/pdm.tsx:96-103,484`). (d) a aba "Instrumentos da jornada" empilha 4 superfícies numa coluna só — a lista operacional de 5 instrumentos (até 3-4 badges + resumo + 2 links + data + 4 ações por linha, `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx:297-504`), o PDM inteiro, terceiros e voz do jovem (`src/app/(app)/duplas/[id]/page.tsx:1532-1602`) — sem hierarquia entre leitura e operação. (e) "Nova meta" abre num dialog de 448px (`DialogContent` sem `size` → `md`, `src/components/pdm-dupla.tsx:541`) e o select das 16 áreas da vida abre com `alignItemWithTrigger` cobrindo o modal inteiro em portal `z-50` (`src/components/ui/select.tsx:60-97`).
- **Resultado observável:** o contorno envolve o card inteiro, por cima de todos os filhos; a avaliação abre com título, data + dia da semana e descrição na ordem de leitura certa antes do form; o PDM usa a largura do desktop como documento sem coluna estrangulada; a aba separa operação (links/ações) de documentos vivos com uma ação primária por estado; criar meta SMART acontece numa superfície com respiro onde o select nunca vaza.
- **Como saberemos que funcionou:** prints 1440×900 e 390×844 sem borda comida pela capa, com o h1 da avaliação visível antes do form, com a coluna do documento PDM ≥ ~560px (ou coluna única — nunca ~376px); Tab alcança cada gesto com anel completo; o select "Área da vida" abre sem cobrir título, campos ou rodapé; um item de instrumento carrega no máximo 1 badge de estado + 1 ação primária + menu.

## Fora de escopo

- Qualquer mudança de contrato: RPCs (`instrumentos_da_dupla`, `emitir_link_instrumento`, `pdm_*`, `avaliacao_*`), server actions, policies, schema, tokens, mint de links, ordem e conteúdo dos campos dos instrumentos.
- **Workspace de documento pro PDM** (nav real de capítulos, layout próprio sem card-shell de form — opção C do S3 no recon): decisão de design registrada como direção futura; esta spec entrega o mínimo técnico (largura por sistema).
- Wizard passo a passo de meta SMART e edição inline completa na árvore (opção C do S5) — a renomeação inline por título já existe (`pdm-arvore.tsx`); o fluxo desta spec é superfície única (decisão em Premissas).
- `TerceirosDupla`, `VozDoJovemCard`/`VozDoJovemEspecialista` por dentro — só o encaixe deles na hierarquia da aba. Os demais forms do `/f/` (genérico, intakes, avaliações) **não mudam**.
- Aba nova na ficha (`ficha-abas-tabs.tsx` não ganha item): a separação operação × documentos acontece dentro da aba atual.
- Varredura global de `ring-inset` sob filhos opacos fora dos cards de `/jovem/materiais` — o defeito latente em outros cards fica como follow-up documentado.
- Reescrita do ItemDialog como página de rota própria.

## O que não muda

- Os dois alvos distintos por card na estante — gesto principal e tira "Ler o guia" (nunca botão dentro de link) — e as 3 variantes de gesto (`Link` `/f/<token>` ou `/jovem/pdm`, `<article>` trigger do `ReverRespostaDialog`, `<article>` estático).
- A cor do anel por instrumento (`--ic`/`--ict` de `instrumentoVars`, `src/components/instrumento-icone.tsx:92-95`) e o card trancado sem anel nenhum.
- O `/jovem/pdm` e a aba da ficha não têm o split estrangulado do `/f/` — a deformação do S3 é do form público; em **390px** todos os layouts seguem como hoje.
- Os estados de entrega do instrumento (`pendenteVisivel`/`refazerVivo`/`pendenteJovem`), os pares antes × depois (`parRoda`/`parChecklist`), a ordem `INSTRUMENTOS_DUPLA_SISTEMA` (`src/lib/forms/schema.ts:128-134`) e os dialogs existentes ("Ver resposta" `xl`, "Pedir pra refazer" `sm`, "Ver avaliação" `xl`).
- O `embutido` do `AvaliacaoEncontroForm` (dialog logado `AvaliarPendenteButton` segue suprimindo o cabeçalho interno), o `EstadoCard` dos estados terminais e o `useFecharNoVoltar` de Dialog/Sheet.
- O default `alignItemWithTrigger = true` do `SelectContent` do kit — a correção é override no call site, nunca global.
- A gramática visual: `rounded-xl bg-card shadow-[var(--shadow-border)]`, faixa lime de card-título, escala de texto de `conventions-ui.md`.

## Histórias de usuário

### US1 — Realce que abraça o card inteiro (P1)

- **Por que P1:** a estante de materiais é a superfície que o jovem mais vê; o anel cortado faz o card ler como seleção parcial e o foco de teclado some nos cantos.
- **Teste independente:** passar o mouse e dar Tab pelos cards e pela tira "Ler o guia" em `/jovem/materiais`, em 1440px e 390px.
- **Cenários:**
  1. **Dado** um card de instrumento com gesto (`linkavel`, `reveravel` ou `pdmSolto`) **quando** o ponteiro entra em qualquer parte do card **então** um contorno de ~2px envolve o card **inteiro** — 4 bordas e os cantos arredondados, pintado por cima de todos os filhos, inclusive da capa `bg-[var(--ict)]` (desktop) e da lombada `w-14` (mobile).
  2. **Dado** o mesmo card **quando** o gesto recebe foco por teclado (`:focus-visible` propagado ao shell via `has-[.gesto:focus-visible]`) **então** o mesmo contorno completo aparece, com contraste ≥3:1 tanto contra `bg-card` quanto contra a capa na cor do instrumento.
  3. **Dado** a tira "Ler o guia" **quando** recebe foco **então** o contorno envolve a tira inteira sem perder os cantos inferiores para o `rounded-xl overflow-hidden` do shell.
  4. **Dado** um card trancado **quando** em hover ou foco **então** nenhum anel promete uma ação que não existe — a borda tracejada segue como está.
  5. **Dado** o `MaterialCard` do acervo (mesma anatomia capa opaca + conteúdo dentro de um `<a>` com `ring-inset`) **quando** em hover/focus-visible **então** o contorno também envolve o card inteiro — a correção vira a convenção local dos cards-estante.
  6. **Dado** `prefers-reduced-motion` **quando** o contorno troca de estado **então** nenhuma animação nova entra — a troca instantânea é aceitável (o `transition-shadow` atual pode morrer junto com a sombra).
- **Nota de mecanismo (do recon, não é stack nova):** o defeito é de ordem de pintura — sombra `inset` sai abaixo dos backgrounds dos filhos. A correção passa por contorno que pinta **acima** deles (`outline` com offset negativo, que segue `border-radius`, ou overlay `pointer-events-none` como último filho). `ring` externo simples fica como fallback rejeitado: engrossa o card pra fora e altera o ritmo da grade.

### US2 — Cabeçalho da avaliação com hierarquia de leitura (P1)

- **Por que P1:** `/avaliar/[token]` é a porta sem login — a pessoa precisa saber **qual encontro** está avaliando antes de responder; hoje isso é o menor texto da tela e a página não tem h1 fora do card.
- **Teste independente:** abrir `/avaliar/<token válido>` em 1440px e 390px e ler a ordem dos headings; checar os estados terminais.
- **Cenários:**
  1. **Dado** um link válido pendente **quando** a página renderiza **então** a ordem visual é: chrome da marca (Logo + "Programa de Mentoria Social") → bloco de cabeçalho do gesto → form. O bloco carrega, nesta ordem: saudação (`Olá, {primeiroNome}!`, quando há nome) → **h1** título → **subtítulo** com a linha de contexto montada no servidor ("Encontro 3 com Fulano · terça-feira, 24/11 às 19:00" — data + dia da semana + hora via `formatDiaSemanaHora`, `src/lib/ciclo.ts:2644-2647`) → **h3** descrição ("1 minuto · só a nota é obrigatória" + a linha de privacidade). O `<p class="text-xs">` solto do `contexto` some — a informação sobe pro subtítulo.
  2. **Dado** qualquer estado da página (form, já registrada, expirado, outra pessoa, erro de rede, link inexistente) **quando** renderizado **então** existe **exatamente um h1** — o do header no estado de form; o `titulo` do `EstadoCard` (que já renderiza `<h1>`, `src/components/estado-card.tsx:36`) nos terminais. Nunca h1 duplicado página+card nem página sem h1.
  3. **Dado** a sessão combinada (018) ou a trilha de especialista **quando** o subtítulo monta **então** ele carrega a variação certa já produzida pelo servidor ("Sessão combinada dos encontros N e M · …", "Sessão com Fulano · …") — sem perder dia da semana; sem data legível cai em "data a confirmar", nunca inventa.
  4. **Dado** o form embutido no dialog logado (`embutido`, `src/components/avaliacao-encontro-form.tsx:52-54,153`) **quando** renderizado **então** o cabeçalho interno segue suprimido — zero regressão no `AvaliarPendenteButton`, cujo `DialogTitle` já traz data+dia (`src/components/jovem-avaliacoes.tsx:97-99`).
  5. **Dado** a hierarquia tipográfica **quando** medida **então** o h1 usa a escala de título de página da casa (`text-2xl font-semibold tracking-tight` — mesma do cartão de título do `/f/`, `src/components/instrumentos/flow.tsx:153`), o subtítulo sai de `text-xs` para no mínimo `text-sm` e a descrição é `text-sm` legível — a informação principal nunca mais fica em 12px cinza.
  6. **Dado** 390px **quando** o subtítulo quebra **então** ele pode ocupar 2 linhas sem truncar a data — nada de `whitespace-nowrap` na linha de contexto.
- **Estrutura pedida:** `h1` título → `p` subtítulo → `h3` descrição, antes do form — pedido explícito; o nível `h3` sob `h1` direto é aceito consciente (Premissas).

### US3 — PDM com largura de documento no desktop (P1)

- **Por que P1:** o PDM é o documento vivo da jornada; 376px de coluna com campos de ~176px tornam a ficha de meta ilegível e o "documento" lê como formulário estrangulado.
- **Teste independente:** abrir um link `/f/<token>` de `sistema=pdm` em 1440px e medir a coluna do documento e os campos; repetir em 390px e na prévia.
- **Cenários:**
  1. **Dado** um instrumento sob medida (o gate `ehInstrumento`: `visao`, `metas`, `pdm`, `roda_vida`) **quando** aberto em viewport desktop **então** o container usa largura de documento (≥ ~768px úteis — `max-w-3xl`/`max-w-4xl` ou dedicada) em vez dos 576px de form linear. O split `nav 180px + doc` do `pdm.tsx:97` só existe quando sobra coluna real: doc ≥ ~560px.
  2. **Dado** a ficha de meta do PDM **quando** o grid `1fr_180px` dispara **então** os campos "Meta"/"Indicador"/"Prazo" ficam com ≥ ~200px cada — nunca ~176px espremidos.
  3. **Dado** um form **fora** do gate (genérico da coordenação, `intake_mentor`/`intake_mentorado`, avaliações 360) **quando** aberto no mesmo desktop **então** ele segue em `max-w-xl` — a largura é por `sistema`, nunca global.
  4. **Dado** 390px **quando** qualquer instrumento abre **então** o layout é idêntico ao de hoje: coluna única, nav escondida, zero overflow-x — o mobile não se move.
  5. **Dado** as âncoras `#pdm-cap-N` do sumário lateral **quando** clicadas **então** rolam pro capítulo certo com `scroll-mt` sob a pill sticky de progresso, em todas as larguras em que a nav existe.
  6. **Dado** a prévia `FormularioPreview` (`src/app/(app)/formularios/formulario-preview.tsx:55,101`) **quando** aberta no modo "Computador" **então** o PDM mostra o mesmo layout válido do `/f/` (nunca o split apertado); no modo "Celular" a coluna única permanece.
  7. **Dado** `loading.tsx` do `/f/` **quando** o suspense pinta **então** o skeleton acompanha a mesma regra de largura (ou fica neutro) — nunca uma quebra de container que estremeça a transição.
  8. **Dado** qualquer campo/grid do instrumento **quando** medido de 320px a 1440px **então** não há overflow-x; `prefers-reduced-motion` segue coberto pelo guard global (sem media query nova por componente).

### US4 — Aba "Instrumentos da jornada" com hierarquia (P1)

- **Por que P1:** é onde mentor e coordenação operam os links e leem os documentos; a linha de 4 badges + 4 ações no mesmo peso e o empilhamento lista→PDM→terceiros→voz sem separação fazem a aba ler como ruido.
- **Teste independente:** abrir a ficha de uma dupla com os 5 estados de instrumento (respondido, link enviado, pedido pelo jovem, expirado, não enviado) em 1440px e 390px.
- **Cenários:**
  1. **Dado** uma linha de instrumento **quando** renderizada **então** ela carrega: emblema + título + **no máximo 1 badge de estado dominante** (precedência: `respondido` > `pedido pelo jovem`/`link enviado` > `link expirado` > `não enviado`) + **1 ação primária contextual** + um menu `⋯` com as secundárias. Nunca mais 3-4 badges nem 4 botões no mesmo peso.
  2. **Dado** o estado do item **quando** a primária é escolhida **então** ela é o próximo passo daquele estado: `respondido` → "Ver resposta" (dialog `xl` inalterado); pendente com link vivo → "Copiar link" (o WhatsApp vai pro menu); `nao_enviado`/`expirado` → "Gerar link"/"Gerar novo link". O "Pedir pra refazer", "Enviar no WhatsApp", "Como conduzir" e "Ler o guia" vivem no menu — a linha para de carregar prosa e gesto secundário.
  3. **Dado** o menu `⋯` **quando** acionado por teclado **então** abre com `aria-label` nomeando o instrumento ("Ações de {título}"), navega por setas, fecha em Esc e devolve o foco ao `⋯` — padrão do `DropdownMenu` do kit (já usado em `pdm-arvore.tsx`).
  4. **Dado** a aba inteira **quando** lida de cima a baixo **então** a **operação** (a lista de instrumentos, links e gestos) e os **documentos vivos** (PDM, terceiros, voz do jovem) leem como grupos distintos — separação visual explícita (rótulo de grupo/subseção) e hierarquia de `h2` consistente, não 4 superfícies disputando a mesma régua.
  5. **Dado** quem olha sem permissão de gesto (coord vs mentor, `podeEnviar`, `jornadaViva`) **quando** a linha renderiza **então** as mesmas ações de hoje aparecem ou somem pelos mesmos gates — o remake não abre nem fecha gesto.
  6. **Dado** 390px **quando** a linha vira coluna **então** título e ações seguem alcançáveis, alvos de toque ≥44px (`min-h-11`), zero overflow-x.
  7. **Dado** os dados de hoje **quando** a linha remonta **então** nenhum estado some: `pendenteVisivel`, `refazerVivo`, `pendenteJovem`, data "Respondido em", resumo do instrumento e os pares roda/checklist (`respostasAnterior`) continuam dirigindo badge e menu.
  8. **Dado** o deep link `?aba=instrumentos` e as âncoras `#instrumentos`/`#pdm` **quando** acessados **então** chegam ao mesmo lugar — tablist e âncoras intactas (sem aba nova — decisão em Premissas).

### US5 — "Nova meta" SMART numa superfície com respiro (P1)

- **Por que P1:** o dialog de 448px aperta 5 campos e o select de 16 áreas abre por cima do modal inteiro — o fluxo central de construir o plano não pode falhar no primeiro clique.
- **Teste independente:** abrir "Nova meta" na ficha e em `/jovem/pdm`, abrir o select "Área da vida" e navegar só por teclado, em 1440px e 390px.
- **Cenários:**
  1. **Dado** o gesto "Nova meta"/"Nova submeta"/"Editar" **quando** a superfície abre **então** ela é **superfície única por viewport**: `Dialog` de tamanho `lg`+ no desktop e `Sheet` de rodapé no mobile — o mesmo padrão de conteúdo denso da casa (`SheetContent side="bottom"` em `combinar-plano.tsx:1195-1196`). Nunca o `md` (448px) pra form com select de 16 itens.
  2. **Dado** o campo "Área da vida" **quando** o select abre **então** o popup ancora junto ao trigger (`alignItemWithTrigger={false}` no call site) e **nunca cobre** título, outros campos ou o rodapé da superfície — altura limitada, scroll interno com as setas do kit visíveis.
  3. **Dado** o select aberto dentro da superfície **quando** Esc é pressionado **então** fecha o select primeiro e a superfície depois, nessa ordem; escolhida a área, o foco volta ao trigger; fechada a superfície, o foco volta ao botão que a abriu.
  4. **Dado** o form submetido com o título vazio **quando** a validação roda **então** o campo marca `aria-invalid`, mostra a mensagem inline e o foco vai pro campo — o botão "Adicionar"/"Salvar" não fica apenas `disabled` sem explicação.
  5. **Dado** o form SMART **quando** lido **então** os campos cobrem o acrônimo em linguagem da dupla: Meta (específica) · Porquê · Indicador de sucesso (mensurável) · Área da vida (relevante) · Prazo-alvo (temporal) — labels e ordem já existentes, só reapresentados com espaço.
  6. **Dado** o mesmo componente nos dois hosts (`PdmDupla` na ficha e em `/jovem/pdm`) **quando** usado **então** comportamento e superfície são idênticos — uma implementação só (`ItemDialog` de `src/components/pdm-dupla.tsx:510-649`).
  7. **Dado** a superfície aberta **quando** auditada **então** tem `DialogTitle`/`SheetTitle`, foco inicial no primeiro campo (o `autoFocus` atual se mantém ou migra pro equivalente), `useFecharNoVoltar` preservado (Dialog e Sheet já o trazem) e form inteiro navegável por teclado.
  8. **Dado** 390px com teclado virtual **quando** o campo de data/título foca **então** o campo ativo não fica escondido sob a borda do Sheet — a área rolante acompanha o foco.

### US6 — Auditoria dos outros modais densos (P1/P2)

**Por que:** o problema do "Nova meta" (form denso em `md` de 448px) não é exclusivo do PDM. A revisão encontrou outros modais pequenos com 3+ campos ou select longo; a correção vira convenção, não caso isolado.

**Teste independente:** abrir cada superfície em 1440px e 390px, com teclado e select aberto, e medir se o form respira.

| Superfície | Arquivo | Conteúdo | Hoje | Decisão |
|---|---|---|---|---|
| Dados do cronograma | `src/components/cronograma-editor.tsx:244` | nome, turma, status | `md` | **P1** — `lg`+ no desktop / Sheet no mobile |
| Editar contato de terceiro | `src/app/(app)/duplas/[id]/terceiros-dupla.tsx:477` | nome, vínculo, WhatsApp | `md` | **P1** — `lg`+ |
| Indicar pessoa | `src/app/(app)/duplas/[id]/terceiros-dupla.tsx:772` | nome, vínculo, WhatsApp | `md` | **P1** — `lg`+ |
| Registrar resposta de terceiro | `src/app/(app)/duplas/[id]/terceiros-dupla.tsx:601` | nome/vínculo + resposta transcrita | `md` | **P1** — `lg`+ / Sheet |
| Filtros de registros | `src/components/registros-filtros.tsx:347` | vários selects + campos de data | `md` | **P2** — filtro denso; Sheet se passar de 1 rolagem |
| Filtros de duplas | `src/components/duplas-lista.tsx:1493` | supervisão + mentor | `md` | **P2** — `lg` ou Sheet |
| Retroativo do jovem | `src/components/jovem-retroativo-dialog.tsx:102` | encontro + datetime | `md` | **P3** — 2 campos cabem; Sheet mobile é desejável |
| Retroativo do mentor | `src/components/registrar-retroativo-dialog.tsx:171` | passo + datetime | `md` | **P3** — idem |
| Declaração de Visão | `src/components/pdm-dupla.tsx:467` | textarea única | default | **sem mudança** — campo único |
| Excluir meta | `src/components/pdm-dupla.tsx:665` | confirmação | default | **sem mudança** |
| Vincular resposta | `src/app/(app)/formularios/vincular-resposta.tsx:88` | select de jovem | `md` | **sem mudança** — campo único |

**Regra:** form com **3+ campos** ou select com **8+ itens** não usa o default/`md`; vai para `lg`+ no desktop e Sheet no mobile. `md`/`sm` ficam para confirmação, um campo ou escolha curta. A auditoria é viva: qualquer modal novo que fure a regra deve ser pego no review ou no teste de convenção.

## Casos de borda

- Card **trancado** (estado `trancada`) e card **sem guia** (`guiaHref` null): sem anel, sem tira — a anatomia varia e o contorno acompanha só o que existe. Card "em breve" do acervo não é clicável e não promete ação.
- Instrumento em estado intermediário (`a_fazer` com resposta anterior — re-emissão): o gesto e o anel valem como no `reveravel`.
- Avaliação: `contexto` null (link sem encontro resolvido) — o subtítulo não renderiza linha vazia; `primeiroNome` null — saudação some sem quebrar o bloco. Sessão de especialista e sessão combinada mantêm a variação de texto do servidor.
- PDM `/f/`: form **editado pela coordenação** com campos fora da convenção (grupo `meta_N` incompleto) — o documento degrada pro fallback de hoje sem layout quebrado. `roda_vida` também usa container queries (`roda-vida.tsx:204-212`) e **ganha** com o container maior — não quebra.
- Ficha: dupla **encerrada** (`jornadaViva` falso → sem CTAs de emissão/refazer, leitura preservada), trilha **especialista** (sem instrumentos DPP — a mensagem existente "Esta trilha não tem instrumentos da jornada DPP." permanece), item **sem `sistema`** (fallback `ListChecks` neutro).
- Nova meta: tetos `PDM_MAX_METAS`/`PDM_MAX_SUBITENS` (o CTA some no limite — o e2e de cap já existe); `podeEditar` falso nunca abre a superfície; prazo com `type="date"` inválido depende da validação nativa; select sem escolha segue no placeholder "Escolher…".
- Escolha de superfície vs. gesto do teclado virtual: `type="date"` nativo no Sheet mobile não pode prender o foco fora da área visível.

## Requisitos funcionais

- **FR-001:** o realce de hover e de `:focus-visible` do card de instrumento DEVE contornar o **card inteiro** — desenhado por cima de todos os filhos (contorno com offset na superfície ou overlay `pointer-events-none`), nunca sombra `inset` que a capa/lombada repintam. Aplica às 3 variantes de gesto, à tira "Ler o guia" e ao `MaterialCard` do acervo; o card trancado não ganha anel.
- **FR-002:** os alvos de toque não podem mudar — gesto principal e "Ler o guia" seguem targets separados, sem botão dentro de link e sem sobreposição de hit areas.
- **FR-003:** `/avaliar/[token]` DEVE renderizar o bloco de cabeçalho antes do form — saudação (quando há `primeiroNome`) → `h1` → subtítulo com a linha `contexto` do servidor (data + dia da semana + hora) → `h3` descrição — e remover a linha `text-xs` solta do `AvaliarTokenFlow`. Cada estado da página tem exatamente um `h1`.
- **FR-004:** `embutido` DEVE seguir suprimindo o cabeçalho interno do form — o dialog logado não ganha h1 duplicado nem perde o título com data.
- **FR-005:** o container de `/f/[token]` DEVE alargar **por sistema**: instrumentos sob medida (`ehInstrumento`) recebem largura de documento (≥ ~768px úteis); todo o resto permanece `max-w-xl`. A regra vale igualmente para o conteúdo da `FormularioPreview` nos dois modos.
- **FR-006:** nenhuma container query do PDM pode disparar o split quando a coluna real do documento não comporta: com nav 180px + gap, a coluna do doc só existe com ≥ ~560px; os campos meta/indicador/prazo nunca ficam abaixo de ~200px; abaixo disso, coluna única.
- **FR-007:** a linha do `LinhaInstrumento` DEVE exibir no máximo 1 badge de estado (precedência da US4) + 1 ação primária contextual + menu `⋯` (DropdownMenu, `aria-label` com o título, teclado completo, foco restaurado); "Como conduzir" e "Ler o guia" saem da linha.
- **FR-008:** a aba DEVE separar visualmente a operação (lista/ações) dos documentos vivos (PDM, terceiros, voz) com hierarquia de `h2` consistente; estados, gates de papel, ordem dos instrumentos, `?aba=` e âncoras preservados.
- **FR-009:** o `ItemDialog` DEVE virar superfície única por viewport (Dialog `lg`+ desktop / Sheet mobile) compartilhada pela ficha e por `/jovem/pdm`; o Select "Área da vida" usa `alignItemWithTrigger={false}` no call site e nunca cobre a superfície; validação com `aria-invalid` + mensagem + foco.
- **FR-010:** nenhum arquivo de contrato é tocado — RPCs, actions, `src/lib/forms/schema.ts`, `database.types.ts`, ordem dos campos e payloads seguem iguais.
- **FR-011:** os modais densos da tabela US6 DEVEM seguir a mesma convenção do "Nova meta": `lg`+ no desktop e Sheet no mobile quando houver 3+ campos ou select de 8+ itens; `md`/`sm` ficam reservados a confirmação/um campo. A tabela é o inventário mínimo da rodada; P2/P3 podem ser cortados se a onda esticar, mas o P1 não.

## Requisitos não funcionais

- **A11y:** exatamente um `h1` por estado/rota; ordem de headings sem pular nível salvo o `h3` pedido (Premissas); contorno de foco/hover com contraste ≥3:1 contra cada fundo adjacente (`bg-card` e a capa `--ict`); alvos ≥44px no mobile (`min-h-11`) e ≥24×24px no desktop (WCAG 2.5.8); Esc resolve select → superfície na ordem; menu navegável por setas com `aria-label`; `aria-invalid` + `aria-describedby` na validação; zero conteúdo escondido sem affordance.
- **Motion:** nenhuma animação nova; a troca do contorno pode ser instantânea; o guard global de `prefers-reduced-motion` cobre as transições existentes (`transition-[width]` da barra, `animate-enter` do tabpanel, slides do Sheet/Dialog).
- **Copy:** pt-BR, sem travessão em texto exibido; mensagem de validação curta e honesta ("Dê um nome pra meta." ou equivalente — texto final no plan); nunca "modal", "campo obrigatório" ou jargão interno.
- **LGPD/auth:** nenhum dado novo; `/avaliar/*` e `/f/*` já estão em `isPublic` — nenhuma rota pública nova, nenhum grant novo.
- **Demo:** `/avaliar/<token>?demo` e a ficha demo cobrem os mesmos estados — os prints dos critérios devem ser reproduzíveis em demo sem login.
- **Perf:** zero dependência nova; `outline` não anima (custo zero); container queries medem o container certo (o `@container` do `pdm.tsx` já existe).
- **Convenção:** Tailwind no JSX, kit de `src/components/ui`, Phosphor `dist/ssr` em server component; `ring-inset` sob filhos opacos passa a ser anti-padrão documentado em `docs/convencoes/conventions-ui.md` na mesma PR (escopo local: `/jovem/materiais`).

## Entidades e dados

Nenhuma entidade nova, nenhum campo novo, nenhuma migration. A rodada é inteira de superfície: classes, ordem de DOM, hierarquia de headings e composição de componentes existentes. Os dados que alimentam os estados (`InstrumentoDupla`, `PdmDoc`, `contexto` da avaliação) são os mesmos que já chegam ao client.

## Critérios de sucesso

- **SC-001:** prints 1440×900 e 390×844 da estante: hover e `:focus-visible` desenham o contorno completo de ~2px nas 4 bordas e cantos de cada card com gesto (sem trecho comido pela capa/lombada) e da tira "Ler o guia" (sem cantos perdidos).
- **SC-002:** `/avaliar/<token>` válido: DOM ordena `h1` → subtítulo contendo dia da semana por extenso + `dd/mm às hh:mm` → `h3` → `<form>`; página com 1 `h1` só; cada estado terminal também tem 1 `h1`; o texto `text-xs` solto do `contexto` não existe mais.
- **SC-003:** `/f/<token>` de PDM em 1440px: coluna do documento ≥ ~560px (ou coluna única), campos "Meta"/"Prazo" ≥ ~200px; em 390px layout idêntico ao atual; forms não-instrumento seguem em 576px; prévia celular/desktop íntegra.
- **SC-004:** ficha, aba Instrumentos: cada linha ≤ 1 badge de estado + 1 ação primária + menu `⋯`; todas as ações de hoje alcançáveis pelo menu; separação visual operação × documentos; sem overflow-x em 390px; alvos ≥44px.
- **SC-005:** "Nova meta": select nunca cobre título/campos/rodapé em nenhuma largura; Esc fecha select→superfície na ordem; título vazio gera `aria-invalid` + mensagem + foco; foco retorna ao trigger certo; superfície é Dialog `lg`+ no desktop e Sheet no mobile.
- **SC-006:** Os P1 da US6 (cronograma, editar contato, indicar pessoa, registrar resposta) não usam `md`; 1440px mostra form com respiro e 390px usa Sheet; select longo não cobre título/rodapé.
- **SC-007:** gates verdes (`pnpm exec next typegen && npx tsc --noEmit`, `npx eslint src/`, `pnpm test`, `pnpm guard`) + testes novos/atualizados do plano; prints anexados no PR.

## Plano de testes

- **Unit (Vitest + jsdom, prioridade — `tests/dom.ts` já dá `montar`/`clicar`/`botao`/`assentar`):** ordem e contagem de headings do bloco de avaliação (1 `h1`, subtítulo com `formatDiaSemanaHora`, `h3` antes do form) e a supressão com `embutido` — mesmo molde de `tests/avaliar-modal-cabecalho.test.tsx`; `LinhaInstrumento` por estado (5 estados → 1 badge dominante, a primária certa por estado, menu lista as secundárias); `ItemDialog`/superfície SMART: `aria-invalid` em título vazio, campos na ordem SMART; guard puro da largura por `sistema` (gate `ehInstrumento` vs demais).
- **E2E app (Playwright, `tests/e2e/app/`):** anel completo do card e da tira guia por teclado e hover + bounding box sem interseção com a capa (estende `materiais-painel.spec.ts` ou spec nova `instrumentos-ui.spec.ts`); `/avaliar/<token>` com h1/subtítulo/h3 na ordem e 1 h1 por estado (estende `avaliacao.spec.ts`, que já cobre link público e `outra_pessoa`); `/f/` PDM com coluna ≥560px em 1440 e coluna única em 390 (estende `formularios.spec.ts`); linha da aba com primária+menu e teclado abrindo/fechando (estende `dupla-menu.spec.ts` ou `materiais-painel.spec.ts`); ItemDialog: select não intersecta DialogTitle/footer, Esc na ordem, Sheet no projeto mobile (estende `pdm.spec.ts`, que já cobre "mentor cria meta completa" e co-edição).
- **E2E demo:** `/avaliar/<token>?demo` renderiza o cabeçalho novo; a ficha demo mostra a linha enxuta; o fixture demo já cobre os 5 estados de instrumento.
- **Regressão a reescrever:** expectativas que citam o `contexto` `text-xs`, o `ring-inset` do card e o `DialogContent` `md` da nova meta; o e2e de cap de metas (`pdm.spec.ts:641`) e o de criação na ficha (`:192`) devem seguir verdes com a superfície nova.
**Convenção US6:** teste de render/`size` para os P1 (cronograma, terceiros) e um teste de regressão que falhe se um form com 3+ campos voltar a usar `md`; screenshots 1440/390 no PR.

## Riscos

- `shell`/`guia` são compartilhadas pelas 3 variantes de card e o `MaterialCard` usa o mesmo vocabulário — a troca do mecanismo de realce deve ser única pra não divergir; outros `ring-inset` sob filhos opacos guardam o mesmo defeito latente (documentado, fora desta PR).
- Alargar `/f/<token>` por engano global mudaria intake e forms da coordenação — o gate por `sistema` é obrigatório e testado; `loading.tsx` acompanha.
- A aba mexe em superfície de coord+mentor com 5 estados de entrega e 2 trilhas — a remontagem não pode perder `pendenteVisivel`/`refazerVivo`/`pendenteJovem` nem os pares roda/checklist; os e2e de instrumento/PDM são a rede.
- `alignItemWithTrigger` é prop local do `SelectContent` — override no call site apenas; mexer no default do kit reescreveria a app inteira.
- Dialogs empilhados (histórico → detalhe) já vivem em `z-50` — qualquer mudança de camada pode reordenar popups.
- `outline` não anima: o `transition-shadow` atual vira no-op visual (aceitável — troca instantânea) e em forced-colors o outline nativo resolve melhor que sombra.
- Sheet no mobile com `type="date"`: o campo ativo não pode ficar sob a borda/teclado — validar no e2e do projeto mobile.

## Premissas

- **Copy da avaliação (decidido):** o h1 segue a voz do gesto — "Como foi o encontro?" / "Como foi a sessão?" — e a linha de privacidade sobe pra descrição (`h3`) do cabeçalho; o texto exato final é do plan/copy, não da spec. O bloco usa a gramática do cartão de título do `/f/` (faixa lime + card) por coerência entre superfícies públicas.
- **`h3` sob `h1` direto (aceito consciente):** a estrutura pedida é `h1` → `p` subtítulo → `h3`; pula `h2` de propósito como decisão do pedido — se a revisão de a11y preferir `h2`, a troca é de um nível só, sem efeito visual.
- **Largura por sistema (decidido):** o gate é `ehInstrumento` (os 4 instrumentos sob medida) — a experiência custom compartilha o `InstrumentoFlow`; forms genéricos/intakes/360 ficam em `max-w-xl`. O "workspace de documento" (nav real, layout próprio) fica registrado como direção futura, fora desta spec.
- **Taxonomia da aba (decidido):** uma aba só — a separação operação × documentos acontece por agrupamento visual dentro dela; nenhuma aba nova entra na tablist. Ação primária por estado: respondido→"Ver resposta"; pendente→"Copiar link"; não enviado/expirado→"Gerar link"; o resto mora no `⋯`.
- **Fluxo SMART (decidido):** superfície única — `Dialog lg`+ no desktop, `Sheet` de rodapé no mobile — não wizard (5 campos não justificam 5 telas) nem edição inline completa (a renomeação inline por título já existe na árvore). "Form nunca em modal pequeno" vira convenção declarada: forms com 3+ campos ou select longo usam `lg`+ — aplicado aqui no call site, sem mudar o default do kit.
- **Convenção do anel (decidido):** o contorno por cima dos filhos (`outline` com offset, ou overlay equivalente) vira o padrão dos cards-estante de `/jovem/materiais`; a anotação entra em `conventions-ui.md` e a varredura global é follow-up.
