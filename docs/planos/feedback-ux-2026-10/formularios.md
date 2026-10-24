# Feedback — /formularios (lista, builder, engine)

Telas: `src/app/(app)/formularios/page.tsx` + `formularios-lista.tsx` +
`formulario-builder.tsx` + `formulario-links.tsx` + engine pública
`/f/[token]`.

## Itens do feedback

1. **Separar os "materiais nativos" dos forms** — ✅ decidido: os
   instrumentos do sistema (`sistema=true`) **movem pra /materiais**, numa
   seção única e destacada (cards visuais, símbolo SVG próprio, cor
   própria, estado de liberação pelo cronograma — detalhado em
   `materiais-coord.md` itens 10–11). Materiais ordinários (guias, PDFs)
   ficam como estão. /formularios passa a listar só forms custom da
   coordenação. As ações do instrumento (emitir link, ver respostas)
   migram junto — nada de órfão.
2. **Ícone SVG custom por instrumento** — cada instrumento oficial ganha
   um SVG próprio pra identificação rápida (a roda pra Roda da Vida, alvo
   pra Metas, doc pra PDM, visão/óculos pra Declaração de Visão, etc.) —
   em vez de ícone genérico de form.
3. **Drag and drop na engine/builder** — reordenar campos do form por
   arrastar (o PDM já tem alça de arraste ou botões subir/descer — ver o
   padrão `pdm-arvore.tsx`; se a casa já tem dnd acessível, reusar).
4. **Numeração automática dinâmica** — as perguntas do builder se numeram
   sozinhas (1, 2, 3…) e a numeração reflete a ordem em tempo real quando
   arrasta/remove (hoje provavelmente estática no label).

## Direção

- **Separação**: os instrumentos oficiais saem da listagem de
  /formularios e viram a seção "Instrumentos do programa" em /materiais
  (decisão do Thiago — era "mover OU separar visualmente", ele escolheu
  mover + destacar). O card no destino carrega as mesmas ações que tem
  hoje (emitir link, ver respostas) + estado de liberação pelo
  cronograma. /formularios fica só com forms custom.
- **Ícones**: `src/components/icons/` ou `public/` — um SVG por sistema
  (`roda_vida`, `visao`, `metas`, `pdm`, `avaliacao_*`, `360`), tokens de
  cor da casa, usado onde o instrumento aparece (materiais, ficha da
  dupla, painel jornada, /formularios).
- **DnD builder**: verificar se a casa já importa `@dnd-kit` ou similar —
  se não, implementar arraste com pointer events + alça (o padrão do PDM)
  mantendo teclado (subir/descer já deve existir — a11y obrigatória).
- **Numeração**: número renderizado derivado da posição (índice do array),
  não de campo salvo — automático por construção; exibir `1.` etc. nos
  headers dos campos e nas seções.

## Critérios de aceite

- [ ] `/formularios` lista separa visualmente instrumentos oficiais de
      forms custom — ou eles saem da lista e aparecem em /materiais com
      as mesmas ações (emitir link / ver respostas). Não pode haver
      instrumento "órfão" sem ponto de ação.
- [ ] Cada instrumento oficial tem ícone SVG próprio usado em pelo menos:
      lista/materiais + ficha da dupla (`LinhaInstrumento`).
- [ ] Builder: reordenar campo por drag funciona com mouse e toque;
      alternativa por teclado (botões/mover) preservada; ordem persiste
      no save.
- [ ] Numeração visível das perguntas no builder e no preview `/f/[token]`
      reflete a ordem atual após drag/remove/insert sem reload.
- [ ] tsc/eslint limpos; specs de formulários verdes (ajustar asserts de
      lista se a separação mover cards).

## Mapa de regressões e gaps (review out/2026)

Leitura do código em out/2026 — o que já existe, o que cada item pode
quebrar e o que falta especificar. O detalhamento da seção de destino
está em `materiais-coord.md` (mesmo review).

### Estado atual mapeado

**Lista** — `src/app/(app)/formularios/page.tsx` (`:13-57`): rota
coord-only (`redirect` fora isso). `formularios-lista.tsx`: filtros
`Filtro` = todos/ativos/encerrados/pendentes `:21-30` (pendente = link
vivo esperando resposta), ordenação `Ordem` = recentes/titulo/pendencias
`:32-60`, chips com contagem facetada `:72-93`, card-link →
`/formularios/[id]` `:143-227` com badge `oficial · {SISTEMA_LABEL[f.sistema]}`
`:155-160` e meta "N perguntas · N links · N pendentes · N respostas ·
última resposta" `:181-225` (perguntas via `camposPerguntas` — exclui
`secao`).

**Detalhe** — `src/app/(app)/formularios/[id]/page.tsx`: badge oficial
`:128-133`, `ehIntake` (`intake_mentor|intake_mentorado`) muda seções
`:66`, prévia `FormularioPreview` (que monta `FormularioPublico` com
`preview`, envio desligado) `:158-162` + `formulario-preview.tsx:18-57`,
seção "Perguntas" com `numeroPorId` = índice em `camposPerguntas`
(excluindo `secao`) `:255-303`, nota "oficial é catálogo imutável"
`:246-254`, `FormularioBuilder` só pra `!f.sistema` atrás de
`<details>` "edição por intenção" `:305-325`, `FormularioLinks`
`:347-351` (prop `formularioSistema` — pra `ehInstrumento` a emissão
genérica nem renderiza, ver abaixo), `RespostasSection` com `sistema`
`:370-377` (→ `InstrumentoResultado` pros 4), exclusão só `!f.sistema`
`:381-388`. `formulario-acoes.tsx:59+` — `FormularioExcluir` não
renderiza pra oficial (trigger do banco também bloqueia, 0042).

**Builder** — `src/app/(app)/formularios/formulario-builder.tsx`:
`TIPOS_SO_OFICIAL` = `arquivo` + `grid_disponibilidade` fora do picker
`:103-107` (o Select filtra em `:592-598`); duplicar insere clone após
`i` `:279`; cards `motion.li layout` (reordenação já anima) `:547-555`;
numeração visível/aria hoje = `i + 1` CRU — conta `secao` junto
(`aria-label` "Texto da pergunta N"/"Título da seção N" `:561-564`,
"Tipo da pergunta N" `:587`, "Ações da pergunta N" `:707`,
`OpcoesEditor n={i+1}` `:620`); reordenação acessível existe e mora no
menu ⋯ do card — "Mover pra cima/baixo" com `disabled` nas bordas
`:719-754` (padrão REALIZA-186, mesmo do `pdm-arvore.tsx:285-292`,
`onMover(no, ±1, irmaos)`). Prévia viva do próprio builder =
`FormularioPublico preview` `:433-452`. Barra fixa "N perguntas · ~M
min" `:807+`.

**Links** — `src/app/(app)/formularios/formulario-links.tsx`: props
`:318-330` (`formularioSistema` marca instrumento); "os 4 instrumentos
de jornada só emitem pela ficha da dupla — `emitir_link_instrumento`
carrega `dupla_id` + momento" `:343-346`, `instrumento =
ehInstrumento(formularioSistema)` `:346`; `ReemitirLinkButton` (só
expirado) `:170-207`, `CopiarLink` no link vivo `:903-907`, WhatsApp via
`waLink`/`msgLinkWhatsApp` `:242-244`+`:479`.

**Público** — `src/app/f/[token]/page.tsx`: estados
pendente/respondido/expirado/inativo/`outra_pessoa` (sessão autenticada
que não é a destinatária — `:143+`), faixa "Modo demonstração" e
`FormularioPublico` no fim. `formulario-publico.tsx`: dispatch
`ehInstrumento(sistema)` → `InstrumentoFlow` (renderers sob medida em
`src/components/instrumentos/{flow,roda-vida,roda-svg,visao,metas,pdm,
campos,submetas-editor,use-resposta}.tsx`) `:80-89`; genérico numera
`camposPerguntas(campos).filter(visivel)` — condicional fora da condição
nem conta `:124-126`, `numeroPorId` `:483-497`; rascunho por token em
localStorage `:128-131`; envio `preview` desligado.

**Schema/ações/RPCs** — `src/lib/forms/schema.ts`: `FormularioSistema`
`:83-94` (10 sistemas), `INSTRUMENTOS_SISTEMA` `:111-118` (só
visao/metas/pdm/roda_vida), `INSTRUMENTO_INFO` `:122-143`,
`camposPerguntas` `:256-261`, `TIPOS_SEM_RESPOSTA` `:252`,
`validaCampos` `:312`, `visivel` `:449`, `extraiRodaDaVida` `:659`,
`extraiMetas` `:716`. Convenções estruturais dos oficiais em
`src/lib/forms/instrumentos.ts` (secao+escala=quadrante; grupos
meta_N/is_N/prazo_N/porque_N/submetas_N — `:5-7`, `:77-99`,
`:226-251`). Ações: `salvarFormulario`/`gerarLinksFormulario` (instrumento
rejeitado — via própria, `actions.ts:259`)/`reemitirLinkFormulario` (só
expirado `:362-399`)/`excluirLinkFormulario`/`vincularRespostaOrfa`/
`submeterRespostaFormulario` (RPC `submeter_resposta_formulario` `:533+`)
em `src/lib/forms/actions.ts`; `enviarInstrumentoMentorado` → RPC
`emitir_link_instrumento` `actions-formularios.ts:261-285`;
`enviarInstrumentoLote` → RPC `emitir_instrumento_lote`
`actions-email.ts:389+`; `formulario_por_token`
`src/lib/forms/queries.ts:421-439`; `getInstrumentosDaDupla` → RPC
`instrumentos_da_dupla` `:391-411`; `getAnamneseMentorado` (`sistema =
'anamnese'` hardcoded) `:300-312`. Demo: `src/lib/demo/forms-data.ts`
(forms oficiais completos + `demoInstrumentosDaDupla` `:1412` +
`demoPainelInstrumentosJornada` `:1327` + `demoJovemJornada` `:1247`).

**Guarda e2e** — `tests/e2e/app/formularios.spec.ts:28-87`: o select do
"Enviar formulário" (na ficha, `enviar-formulario-dialog.tsx:102` filtra
`ehInstrumento` + `avaliacao_especialista`) NÃO pode oferecer
Visão/Metas/PDM/Roda e DEVE manter 360º/Anamnese emissíveis. Esse
contrato não muda com a mudança de listagem — é sobre o dialog da ficha.

### Riscos de regressão por item do plano

- **Item 1 — instrumentos saem de /formularios**: a remoção é de
  LISTAGEM, não de rota. `/formularios/[id]` continua sendo a casa de
  respostas agregadas + links legados + prévia de cada sistema —
  qualquer "Ver respostas" no card novo precisa de destino (deep-link
  pra rota existente é o caminho barato). Se a lista filtrar
  `sistema != null`, conferir efeitos colaterais: `getFormularios`
  alimenta também o dialog "Enviar formulário" da ficha
  (`enviar-formulario-dialog.tsx`), `getAnamneseMentorado`,
  `queries-encerramento.ts:91` (checklist 360º), a seção intake e o
  `demoPainelInstrumentosJornada` — NÃO mudar o payload da query pra
  cortar sistemas (quebra tudo isso); o corte é só visual na lista.
  Instrumentos não-jornada que ficam `sistema=true` (anamnese,
  autoavaliacao_mentor, avaliacao_especialista, intake_*) precisam de
  destino explícito: ou entram na seção com rótulo próprio, ou ficam na
  lista — decidir por enum, não por "tudo que tem sistema sai".
- **Item 2 — ícone SVG por instrumento**: hoje não existe mapeamento
  ícone↔sistema; os pontos de uso são `formularios-lista.tsx` (badge),
  `instrumentos-dupla.tsx` (LinhaInstrumento `:160`), `painel-jornada.tsx`
  (`CelulaEstacao` `:88-140` — tem ícone por estado hoje, não por
  instrumento) e o público `/f/[token]` (`InstrumentoFlow`). Ícone por
  sistema deveria morar ao lado de `INSTRUMENTO_INFO`
  (`schema.ts:122-143`) — `avaliacao_360` e os demais não-jornada também
  precisam de símbolo se entrarem na seção (o mapa `InstrumentoSistema`
  só cobre os 4).
- **Item 3 — drag and drop**: a premissa "o PDM já tem alça de arraste"
  está errada — `pdm-arvore.tsx` tem o mesmo menu ⋯ com mover ↑/↓
  (`:268-292`), não há `@dnd-kit` nem outro pacote de dnd no
  `package.json` (ausente — verificado). Drag novo = pointer events do
  zero ou dependência nova; o `motion.li layout` já faz os irmãos
  deslizarem no reorder `:547-555`. Preservar o menu ⋯ (teclado/a11y) —
  o drag é adição, não substituição. Touch em 390px: alvo de alça ≥44px e
  cuidado com o scroll da página dentro do gesto (listas longas,
  `touch-action`). Estado intermediário (dragging) precisa de
  `aria-live`/texto pra leitor de tela.
- **Item 4 — numeração dinâmica**: parcialmente feita e divergente —
  `/f/[token]` e a seção "Perguntas" do detalhe já excluem `secao`
  (`numeroPorId` por `camposPerguntas`, `[id]/page.tsx:258-261`,
  `formulario-publico.tsx:483-497`), mas o builder usa `i + 1` cru
  (seção consome número nos aria-labels). Padronizar o builder pro
  mesmo mapa — e decidir se o chip visível do header do card também vira
  "Pergunta N" (hoje o número não aparece visualmente no card, só nos
  aria-labels). Aviso: `e2e` e leitores de tela podem depender de
  "pergunta N" incluindo seção — mudar o índice muda TODOS os
  aria-labels citados acima.
- **Secao numérica nos forms oficiais**: a numeração dinâmica é do
  builder custom; os oficiais são imutáveis via trigger — o builder nem
  renderiza pra `f.sistema` (`[id]/page.tsx:305`). Nada a fazer neles
  além de não quebrar `extraiEstruturaRoda`/`extraiGruposMeta` ao tocar
  tipos.

### Gaps do plano

- **Destino da ação "emitir link" por card**: em `/formularios` o emitir
  genérico já é escondido pra instrumento (`formulario-links.tsx:343-346`)
  — a emissão por instrumento é por dupla (`emitir_link_instrumento` com
  `dupla_id`+momento) ou em lote (`emitir_instrumento_lote`). O card do
  mockup mostra "Enviar em lote · N" pra coord e nada disso pra
  "emitir link" solto — o item 1 diz "as ações migram junto", mas a ação
  real que existe é lote (coord) e por-dupla (ficha). Especificar.
- **Forms custom criados pela coord com `sistema` nulo** continuam com
  `gerarLinksFormulario` (link genérico por destinatário) — não deixar a
  seção nova herdar esse caminho pros instrumentos.
- **Versionamento/estado `ativo` do oficial**: `formulario.ativo=false`
  desliga o emitir na ficha ("Instrumento encerrado em Formulários",
  `instrumentos-dupla.tsx:264-265`) — card desabilitado por `!ativo` é
  um estado a mais além de "fora da janela" (o mockup não cobre;
  jornada trata via `item.ativo`). Decidir o texto ("encerrado pela
  coordenação" vs "libera no enc. N").
- **`intake_*` e `anamnese`**: não são da jornada DPP — intake é link
  público de inscrição (`IntakeLinkSection`), anamnese emite da ficha.
  Se ficarem na lista, a tag "oficial" segue (ok); se moverem, precisam
  de card próprio fora da régua de janelas.
- **Número de campos `secao` no builder**: a contagem da barra fixa "N
  perguntas" já usa `camposPerguntas`? Conferir `:807+` e alinhar com o
  mapa de numeração novo (consistência builder ↔ detalhe ↔ público).
- **`avaliacao_especialista`** é `sistema` mas é da trilha especialista
  (5 encontros, outro relógio) — não mapear pelas `ESTACOES` de DPP.

### Opções de melhoria (fora do plano)

- O chip "oficial · {label}" pode virar o ícone novo + label — reusa o
  mesmo mapa em lista e ficha.
- `formulario-links.tsx` já distingue link de instrumento; o card pode
  mostrar "links vivos N" reaproveitando `linksTotal/pendentes` do
  `FormularioListaItem`.
- Deep-link `/formularios/<id>` nos cards preserva TODA a superfície de
  respostas sem rebuild — opção mais barata pro item 1.

### Must-read pro implementer

- `src/app/(app)/formularios/page.tsx:13-57` (gate coord),
  `formularios-lista.tsx:21-60` (filtros/ordem), `:136-227` (card).
- `src/app/(app)/formularios/[id]/page.tsx:60-80` (`ehIntake`),
  `:128-170` (badge + preview), `:240-303` (numeração de leitura que
  exclui secao), `:305-388` (builder/links/respostas/excluir por
  `sistema`).
- `src/app/(app)/formularios/formulario-builder.tsx:85-107`
  (`TIPOS_SO_OFICIAL`), `:433-452` (preview), `:531-555` (item motion),
  `:561-620` (labels com `i+1`), `:700-795` (menu ⋯ mover + barra).
- `src/app/(app)/formularios/formulario-links.tsx:170-207` (reemitir),
  `:318-360` (props + guarda instrumento), `:903-915` (Copiar/Reemitir).
- `src/lib/forms/schema.ts:83-143` (enums/info), `:244-312`
  (tipos/perguntas/validação), `:449-510` (visivel/formatada),
  `:628-752` (extratores roda/metas).
- `src/lib/forms/instrumentos.ts:16-99` (`ehInstrumento`,
  `agrupaEmSecoes`, `extraiEstruturaRoda`), `:220-252`
  (`extraiGruposMeta`).
- `src/lib/forms/queries.ts:84-160` (FormularioPublico/getFormularios),
  `:291-312` (anamnese), `:358-439` (`InstrumentoDupla` + RPCs
  `instrumentos_da_dupla`/`formulario_por_token`).
- `src/lib/forms/actions.ts:65-142` (salvar/ativar/excluir),
  `:203-280` (links genéricos + guarda instrumento), `:362-430`
  (reemitir/excluir/vincular), `:533-640` (submit + anexo);
  `src/lib/actions-formularios.ts:184-285` (anamnese +
  `emitir_link_instrumento`); `src/lib/actions-email.ts:389-460`
  (`emitir_instrumento_lote`).
- `src/components/enviar-formulario-dialog.tsx:95-120` (a guarda
  `ehInstrumento` + `avaliacao_especialista`).
- `src/app/f/[token]/page.tsx:95-210` (estados públicos),
  `formulario-publico.tsx:80-139` (dispatch + numeração),
  `:360-500` (progresso/`numeroPorId`).
- `src/lib/demo/forms-data.ts:110-150` (dataset oficial),
  `:1207-1470` (`ORDEM_JORNADA`, `demoJovemJornada`,
  `demoPainelInstrumentosJornada`, `demoInstrumentosDaDupla`).
- Specs: `tests/e2e/app/formularios.spec.ts` inteiro (guarda),
  `tests/e2e/demo/instrumentos.spec.ts:16-140` (ficha + `/f/<token>`).
