# Mobile audit — coord/staff core

## Cobertura: /duplas (lista, todas as visões), /pessoas (listas + fila + matching board), /registros, /relatorios (builder + canvas), /materiais (hub novo + painel jornada), /formularios (lista, ficha, builder, links, respostas), /turmas (lista, ficha, builder novo), /chamados (fila + detalhe + composer), fila de acompanhamento (agenda-coordenacao), shell mobile (app-shell)

> `src/app/(app)/duplas/[id]/**` — **em edição** paralela, não auditado.

**Bloqueantes: nenhum.** O codebase já é mobile-first (primitivos `h-11`/`text-base`, `filterChipCls` `min-h-11`, dialogs `max-h-[calc(100dvh-2rem)] overflow-y-auto`, bottom-nav com `env(safe-area-inset-*)`).

### /duplas — `src/app/(app)/duplas/page.tsx` + `src/components/duplas-lista.tsx`
- **Polish**: "sinais" da `LinhaDupla` trunca em 1 linha com texto integral só em `title=` (`duplas-lista.tsx:354-355`) — inalcançável por toque. Fix: `<span className="sr-only">` com `tituloSinais` dentro da `<p>` ou `<details>` inline.
- **Polish**: link "Ver ficha ›" da `LinhaMini` tem `px-1.5 py-2` (~32px) (`duplas-lista.tsx:443-448`). Fix: `inline-flex min-h-11 items-center` (reduzir em `md:`/`lg:`).
- **OK**: linha densa vira card empilhado abaixo de lg (`duplas-lista.tsx:251-252`), "Ver ficha" mobile `min-h-11` no topo (`:272-279`), chips de categoria `min-h-11` em grid 2-col (`:1030-1085`), busca `type="search"` + `aria-label` (`:1006-1013`), busca/filtros/ações em `flex-wrap` (`:993-1025`), `+ mentor` fallback `min-h-11` (`:1163`), views supervisor/mentor/especialista/híbrido adaptadas (`:1280-1889`).

### /pessoas — `src/app/(app)/pessoas/page.tsx` + `src/components/pessoas-listas.tsx` + `fila-espera.tsx` + `matching-panel.tsx` + `matching-afinidade.tsx`
- **Polish**: `Collapsible.Trigger` de "Fora do programa" e "Inativos" sem `min-h` (~28px de alvo) (`pessoas-listas.tsx:633`, `:676`). Fix: `min-h-11 items-center` (ou `md:min-h-0`).
- **OK**: Link grande por linha (avatar+nome, `basis-48`, `py-1.5`) (`:903`, `:1180`), cluster coord cai pra linha cheia <sm com `RoleSelect h-11` + ⋯ `size-11` (`:986-995`), `DetalhesTrigger min-h-11 md:min-h-8` (`:730`), FilaEspera `sm:grid-cols-2` com `WhatsAppRapido size-11` (`fila-espera.tsx:87`, `whatsapp-rapido.tsx:80-90`), MatchingPanel empilha selects `w-full` (`matching-panel.tsx:94`), AfinidadePar 100% textual/wrap com alertas legíveis (`matching-afinidade.tsx:155-329`).

### /registros — `src/app/(app)/registros/page.tsx` + `registro-card.tsx` + `registros-filtros.tsx`
- **Polish**: `DialogFooter` (Limpar/Aplicar) dentro da área rolante do dialog de filtros (`registros-filtros.tsx:667-691`) — em aparelho baixo, "Aplicar" fica abaixo da dobra após a lista `max-h-52`. Fix: `sticky bottom-0 bg-popover` no footer.
- **OK**: timeline com rail `w-10` + nó de status (`registros/page.tsx:250-275`), `RegistroCard` trigger full-width `min-h-11` e link expandido `min-h-11` (`registro-card.tsx:65`,`:177-184`), pills/checks `min-h-11` (`registros-filtros.tsx:79-85`,`:111-117`), agrupamento `xl:grid-cols-2` não força colunas no mobile (`:302-303`), "Mostrar mais" Link h-11 (`:491-499`).

### /relatorios — `src/app/(app)/relatorios/page.tsx` + `relatorio-builder.tsx` + `src/components/relatorio-canvas.tsx` + `novo-link-dialog.tsx`
- **Importante**: inputs de edição inline herdam `text-[13px]` da `<table>` (`relatorio-canvas.tsx:372`) e têm `py-0.5` (`:565-569`) → iOS auto-zoom ao focar + campo ~26px. Fix: `text-base md:text-[13px] min-h-11 md:min-h-0` na className do input.
- **Importante**: dica de uso permanente é só-desktop — "Arraste a borda…", "Shift+clique…", "Ctrl+C copia pra planilha" (`relatorio-canvas.tsx:592-596`); no toque, seleção por intervalo é impossível e não há alternativa de cópia (o "Baixar CSV" do builder cobre export geral, `relatorio-builder.tsx:308-320`). Fix: `max-sm:hidden` na dica + variante mobile ("deslize pra ver mais · toque no título pra ordenar"); alternativa de seleção/cópia por toque = **a verificar**.
- **Polish**: alça de resize `w-3` (12px) com `touch-none` (`relatorio-canvas.tsx:406-413`) — difícil de pegar no dedo. Fix: `w-5`/`w-6` ou hit-area invisível (`-m-2 p-2`).
- **OK**: chips `filterChipCls` `min-h-11` em `flex-wrap` (`relatorio-builder.tsx:255-305`), canvas com scroll interno `overflow-auto overscroll-auto` que devolve gesto à página (`relatorio-canvas.tsx:360-370`), header+gutter sticky, área full-bleed `-mx-4` amplia viewport útil (`relatorio-builder.tsx:361`), dialog "Publicar" `sm:max-w-lg` com selects h-11 (`novo-link-dialog.tsx:244`).

### /materiais — `src/app/(app)/materiais/page.tsx` + `materiais-hub.tsx` + `painel-jornada.tsx` + `material-actions.tsx` + `novo-material-dialog.tsx`
- **Polish**: células do mapa de cobertura `size-7` (28px) — jump-links `title`+`aria-label` mas alvo pequeno (`materiais-hub.tsx:165-182`). Fix: `size-9`.
- **Polish**: `CelulaEstacao` carrega estado/`atrasada` só no `title=` do `<span>` (`painel-jornada.tsx:108-139`) — no toque, atraso vira só anel+ícone sem o motivo (a linha da turma não repete o texto do "falta"). Fix: `sr-only` com o `titulo` dentro da célula.
- **Polish**: campo "Encontro (nº)" do dialog de edição é `type="number"` sem `inputMode` (`material-actions.tsx:298-302`) — o diálogo de criação já tem `inputMode="numeric"` (`novo-material-dialog.tsx:273`). Fix: paridade.
- **OK**: `MaterialRow` head-link `basis-full px-5 py-3.5` = linha inteira clicável, trailing wrap pra linha 2 <lg (`materiais-hub.tsx:384-423`), "sem conteúdo/em breve" por papel (`:417-420`), radio-pills `min-h-11` (`novo-material-dialog.tsx:43`), PainelJornada rows `flex-wrap` + "Ver ficha" button sm h-11 (`painel-jornada.tsx:479-511`,`526-558`).

### /formularios — `src/app/(app)/formularios/**`
- **Importante**: busca de links `className="h-8 pl-8 text-xs"` (`formulario-links.tsx:727-734`) → 32px de alvo **e** fonte 12px → iOS auto-zoom no foco. Fix: `h-11 pl-8 text-base md:h-8 md:text-xs`.
- **OK**: lista em cards-Link (`formularios-lista.tsx:143-150`), chips `filterChipCls` + Select `size="sm"` h-11 mobile (`:76-117`), builder com barra sticky `bottom-[calc(4rem+env(safe-area-inset-bottom))]` que respeita bottom-nav + notch (`formulario-builder.tsx:771`), icon-buttons com `aria-label` em todos os controles de campo (`:510-520`,`674-714`,`857-866`), `<details>` "Editar formulário" com `summary min-h-11` (`[id]/page.tsx:275-283`), âncoras de seção, dialogs `sm:max-w-md`, lista de destinatários rolável `max-h-64` (`formulario-links.tsx:547`), rows de link com wrap deliberado `basis-full` (`:789-790`), preview dedicado (`[id]/page.tsx:139-144`), respostas em cards com `summary min-h-11` (`respostas-section.tsx:274`).

### /turmas — `src/app/(app)/turmas/**` + `cronograma-editor.tsx` + `cronograma-builder.tsx`
- **Importante**: `const inputSm = "h-9"` (`cronograma-builder.tsx:225`) aplicado a título e data de cada item da prévia (`:269-284`) → campos de 36px na etapa de edição (interação central do passo 2). Fix: `h-11 sm:h-9` ou remover o override (Input base já é `h-11` mobile).
- **OK**: cards de turma são Links `h-full` grandes (`turmas/page.tsx:107-133`), editor de eventos com 4 icon-buttons `size-11` + `aria-label` nomeado por evento (`cronograma-editor.tsx:622-692`), `IconButton` idem no builder (`cronograma-builder.tsx:734-764`), dialogs `sm:max-w-md`, grid de parâmetros `sm:grid-cols-2/3/4` colapsa pra 1 col no mobile (`:389`,`:480`,`:608`), `CronogramaDuplas` rows-link px-4 py-2.5 (`cronograma-editor.tsx:763-779`).

### /chamados — `src/app/(app)/chamados/page.tsx` + `chamados-app.tsx`
- **Importante**: `/chamados` é a única rota staff do grupo `(app)` **sem `loading.tsx`** (confirmado por glob — todas as demais têm). No mobile o toque na nav/"Mais" fica sem feedback enquanto o server busca fila+detalhe. Fix: criar `src/app/(app)/chamados/loading.tsx` com skeleton da lista+detail (padrão das rotas irmãs).
- **Polish**: stepper de status com `flex-1` + `truncate` corta rótulos (~70px/etapa a 360px) (`chamados-app.tsx:525-552`). Fix: `whitespace-normal leading-tight` ou labels curtos em `max-sm:`.
- **OK**: alternância lista↔detalhe mobile via `hidden lg:block` + botão voltar `size-11 lg:hidden` (`chamados-app.tsx:173-184`,`383`,`482`), chips de fila `min-h-11 md:min-h-8` (`:217`), selects `h-11` (`:233`,`:252`), busca `h-11` (`:271`), rows `w-full px-4 py-3.5` (`:323`), composer com pills `min-h-11` e chips de menção `min-h-11` (`:904`,`:941`), dialogs `sm:max-w-md` (`:681`,`:719`).

### Fila de acompanhamento — `src/components/fila-acompanhar.tsx` (em `agenda-coordenacao.tsx`)
- **Importante**: "Ver ficha ›" `min-h-9` (36px) diverge do padrão da casa (`min-h-11` em `duplas-lista.tsx:275`, `:401`) — a fila vive na home que a coord abre todo dia (`fila-acompanhar.tsx:256-261`). Fix: `min-h-11 sm:min-h-8`.
- **OK**: linha envolve `basis-56`, badges com `sr-only` equivalente ao `title` (`:216-229`), `LembreteButton` com estado de bloqueio visível.

### Transversal / shell
- **Polish**: links inline sub-44px espalhados onde o padrão casa seria `min-h-11 sm:min-h-8` — `enviar-termos-dialog.tsx:140` (`min-h-8`), `matching-panel.tsx:171-176` (trigger "aumentar capacidade →" inline, ~24px — aceitável por ser inline em frase, mas registrar), `pessoas-listas.tsx:1024-1031` idem ("ajustar"). Fix incremental: adotar `min-h-11` mobile onde couber.
- **OK**: bottom-nav com `pb-[env(safe-area-inset-bottom)]` + overflow "Mais" (`app-shell.tsx:247-339`), top-bar com safe-area (`:122`), primitivos `h-11`/`text-base`/`size-11` (`button.tsx:28-39`, `input.tsx`, `select.tsx:43`), `filterChipCls` `min-h-11 sm:min-h-8` (`filter-chip.ts:6-12`), dialogs mobile `w-full max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto`, `VoltarLink` `min-h-11` (`voltar-link.tsx:18`), `animate-enter` + reduced-motion global (`globals.css`).
