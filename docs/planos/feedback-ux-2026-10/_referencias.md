# Referências de design — rodada feedback-ux-2026-10

Padrões verificados (design systems públicos, docs de produto, artigos de pesquisa) que os agents de implementação consultam ao executar os planos desta pasta. Toda URL foi verificada na escrita deste doc.

Convenções da casa que vencem qualquer conflito com as fontes: tokens `--brand-lime`/`--brand-ink`/`--ok`/`--warn`, radius `.75rem`, Inter, primitivos Base UI em `src/components/ui`, filtros animam ≤300ms com `prefers-reduced-motion`, número sem proporção não entra, mobile 390px valida.

## 1. Dashboards densos sem intimidar — "número sempre com escala"

- **Preattentive primeiro** — NN/g, *Dashboards: Making Charts and Graphs Easier to Understand* (nngroup.com/articles/dashboards-preattentive): comprimento e posição 2D são processados antes da atenção; dashboard responde num relance ("tá indo bem?"), não é superfície de exploração.
  **Aplicar em**: `/registros` e faixa resumo de `/materiais` — barras/dots/linha; nunca gauge com número no meio.
- **Número exige contexto (os 3 Cs)** — NN/g, *Choosing Chart Types: Consider Context* (nngroup.com/articles/choosing-chart-types): "24% não significa nada sem o 17% do ano passado" — comparar contra total, meta ou período; context / clutter-free / contrast.
  **Aplicar em**: KPIs de `/materiais` — cada número sai com fração, barra ou delta; card quadrado com número solto está proibido.
- **Contexto inadequado é o erro clássico** — Stephen Few, *Information Dashboard Design*, cap. "Supplying inadequate context" (flylib.com/books/en/2.412.1/supplying_inadequate_context_for_the_data.html): medida sem escala comparável só ocupa espaço; "compared to what?" é a pergunta que toda métrica responde visualmente.
  **Aplicar em**: todo componente do mini-kit `src/components/viz/` — denominador/meta declarado no próprio traço.
- **Sparkline = gráfico tamanho-palavra** — Edward Tufte, *Sparkline theory and practice* (edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte): "dataword" embutido na linha de texto, data-ink ~1, sem eixos — a escala vem do número adjacente.
  **Aplicar em**: card de dupla em `/duplas` ("4/16 encontros" + sparkbar) e `TrajetoriaAvaliacoes` agregada em `/registros`.
- **O escopo é uma linha própria** — Linear, *Cycle graph* / *Project graph* (linear.app/docs/cycle-graph, linear.app/docs/project-graph): linha cinza = escopo total, azul = concluído, amarelo empilhado = iniciado; o denominador é desenhado e scope creep fica visível.
  **Aplicar em**: cobertura por encontro na agenda coord — o "total" aparece no trilho, não só no "N/M".
- **Burn-up do mesmo dataset filtrável** — GitHub Projects, *Insights* (docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects): "burn up" default mostra concluído vs. restante ao longo do tempo, gerado dos mesmos itens (filtráveis) da view — viz e lista nunca divergem.
  **Aplicar em**: `/registros` — a faixa de viz lê o mesmo recorte filtrado do list abaixo (aceite do plano).

## 2. Barras de progresso segmentadas honestas

- **ProgressBar segmentada com texto** — Primer/GitHub (primer.style/product/components/progress-bar/ e /accessibility/): segmentos = partes de um todo; parear sempre com texto explícito ("8 of 10"), legenda por segmento, 3:1 entre adjacentes, descrição pra screen reader.
  **Aplicar em**: `BarraEstacao` (painel jornada) e barras de cobertura da agenda — legenda embutida, não tooltip.
- **Um denominador só, buraco visível** — regra derivada do bug da rodada: "4/10" com barra ~90% cheia mente. Barra e número usam o MESMO total; item sem dado vira segmento neutro/vazio com legenda ("3 sem data"), nunca some do trilho.
  **Aplicar em**: `ResumoEncontrosDupla` na visão Lista de `/agenda` — corrigir o denominador divergente (`agenda-coord.md`).
- **Falha no topo, agrupado por estado** — merge box do PR no GitHub (github.blog/changelog/2024-12-03-improved-pull-request-merge-experience-now-in-public-preview/): checks agrupados por status, falhas primeiro — "o que pede ação" antes da cronologia.
  **Aplicar em**: filas de cobertura/agenda — ordenar pelo que exige ação, não pela data.
- **Fração com critério nomeado** — Khan Academy, unit missions (support.khanacademy.org/hc/en-us/articles/47216131257997): "0 of 4 skills to Proficient" — a fração diz *de quê* e *até onde*.
  **Aplicar em**: encontros/instrumentos — "3 de 5 respondidos", "4 de 16 encontros"; nunca "%" sozinho.

## 3. Filas tipo inbox/tickets — status semântico e ação por linha

- **Inbox com ações por item** — Linear, *Inbox* (linear.app/docs/inbox): lista navegável por teclado (J/K), ações inline (marcar lida, snooze), abrir o item em vista focada sem perder a fila.
  **Aplicar em**: `/chamados` — selecionar na fila abre detalhe sem sair do contexto; ação mora na linha.
- **Triage separa o não-decidido** — Linear, *Triage* (linear.app/docs/triage): entrada nova vai pra caixa própria com ações rápidas (aceitar, recusar, pedir info), não se mistura à fila ativa.
  **Aplicar em**: `/chamados` — "aberto sem dono" é a lane que pede ação; ordenar por mais antigo sem resposta.
- **Cor por estado, aprendível** — GitHub, *issue status icons and colors* (github.blog/changelog/2021-10-26-updates-to-our-issue-status-icons-and-colors/ + /2021-06-08-new-issue-and-pull-request-state-icons/): "closed" saiu de vermelho pra roxo — vermelho em massa lê como erro, não como "feito"; ícone+cor por estado pra escanear.
  **Aplicar em**: `STATUS_TOM` — aberto/sem dono = vermelho (pede ação), em atendimento = âmbar/info, resolvido = verde.
- **Lozenge semântica** — Atlassian Design, *Lozenge* (atlassian.design/components/lozenge/usage + /examples): success = concluído, warning = atenção, danger = bloqueado/falha, information = em andamento; lozenge é pra estado que muda ação, tag é metadado.
  **Aplicar em**: escala de cor única em fila, header do detalhe, stepper e "Meus chamados".
- **Campos da conversa** — Help Scout, modelo de shared inbox (developer.helpscout.com/mailbox-api/endpoints/conversations/list/): cada conversa carrega status, dono, tags, mailbox — a linha da fila mostra os mesmos.
  **Aplicar em**: linha de `/chamados` = status pill + dono + prévia + idade ("há 3 dias").

## 4. Combobox / @mention no composer

- **Padrão ARIA combobox** — W3C WAI-ARIA APG (w3.org/WAI/ARIA/apg/patterns/combobox/): input com `aria-expanded`, popup `listbox`, foco fica no input e `aria-activedescendant` marca a opção ativa; setas navegam, Enter confirma, Esc fecha e devolve foco.
  **Aplicar em**: autocomplete `@` do composer de `/chamados` — copiar o padrão, não improvisar roles.
- **Autocomplete ≠ Combobox** — Base UI, nossa stack (base-ui.com/react/components/combobox e /autocomplete): Combobox = valor restrito à lista; Autocomplete = texto livre com sugestões — é o caso da menção no textarea.
  **Aplicar em**: `chamados-app.tsx` — `Autocomplete`/`Popover` do Base UI no caret; marcado vira chip removível; fieldset de checkboxes sai.
- **Lista restrita e instantânea** — GitHub, *@mention autocompletion* (github.blog/news-insights/mention-autocompletion/): `@` abre só colaboradores do repo + participantes da thread (não busca global), filtra ao digitar, setas+Enter/Tab.
  **Aplicar em**: menções limitadas à prop `equipe` — dataset pequeno, zero fetch.
- **Trigger char + inserção inline** — GitHub Docs, *Basic writing and formatting syntax* (docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax): digitar `@` abre a lista na posição do texto.
  **Aplicar em**: detectar `@`+prefixo no textarea, popover no caret, inserir `@nome` e gravar `mencionados` (payload do action já existe).

## 5. Cards de identidade/entidade — emblema grande

- **Precedente interno: `pessoa-banner.tsx`** — faixa `--brand-ink` + marca-emblema por papel (traço fino + ponto, "selo estável por grupo") + relevo seedado + nome fantasma. É a referência citada no feedback ("card tipo o banner de perfil").
  **Aplicar em**: `/turmas` — mesma gramática: emblema "T1"/"T2" em display + cor própria + stats em chips + período pequeno.
- **Badge legível em qualquer escala** — Credly, *Badge visuals best practices* (credlyissuer.zendesk.com/hc/en-us/articles/360027660152-Badge-visuals-and-graphics-best-practices-and-technical-requirements): forma ousada que preenche o quadrado, reconhecível em tamanho pequeno, cor distingue programa, texto mínimo (detalhe no metadata).
  **Aplicar em**: símbolos de turma e de instrumento — funcionam em 40px e em 200px.
- **Card = capa + página** — Notion, *Gallery view* (notion.com/help/galleries): card com preview de capa (fit × crop), tamanho configurável, abre a entidade.
  **Aplicar em**: grid de `/turmas` e seção "Instrumentos do programa" — emblema como capa, 1–2 linhas de conteúdo, sem faixa vazia.
- **Galeria de entidades com identidade** — notion.vip, *Compare database formats* (notion.vip/insights/compare-and-configure-notion-s-database-formats-tables-lists-galleries-boards-and-timelines): gallery serve pra entidades "pessoais" (diretório de pessoas usa foto como preview, agrupa por propriedade) — títulos curtos, card vira porta da ficha.
  **Aplicar em**: `/turmas` como diretório visual de entidades — agrupar/ordenar por status, card abre a turma.

## 6. Micro-interações de confirmação

- **Duração/easing tabelados** — Material M3, *Easing and duration* (m3.material.io/styles/motion/easing-and-duration): entra ~250–400ms decelerate, sai ~200ms accelerate, transição utilitária ~300ms Standard; teto da casa = 300ms.
  **Aplicar em**: item entrando na timeline de `/chamados`, animação de filtro em `/duplas`, grow das barras do kit `viz/`.
- **Feedback abaixo de 400ms** — Laws of UX, *Doherty Threshold* (lawsofux.com/doherty-threshold) + NN/g, *Response-Time Limits* (nngroup.com/articles/response-times-3-important-limits): <0,1s lê como manipulação direta; press state sai na hora, confirmação anima depois do ACK — clique nunca fica mudo.
  **Aplicar em**: botão Enviar do composer.
- **Botão que vira check** — vawe.dev, *success check* (vawe.dev/moves/success-check): press → morph pra círculo → check desenhado (`stroke-dashoffset`, ~360ms) → land com pop; cada fase começa antes da anterior acabar.
  **Aplicar em**: envio de resposta em `/chamados` — botão resolve em check enquanto a mensagem entra na timeline com slide+fade.
- **Animação com propósito e fallback** — The UX Shop, *Micro-interactions* (theuxshop.com/patterns/micro-interactions-feedback-language): 100–300ms, escala proporcional à ação, "que pergunta esta animação responde?"; a interação se entende com todas as transições removidas.
  **Aplicar em**: transversal — `prefers-reduced-motion` desliga, estado final idêntico.

## 7. Accordion / details — progressive disclosure em lista densa

- **Progressive disclosure** — NN/g (nngroup.com/articles/progressive-disclosure): default mostra só o essencial, secundário sob demanda; o que está visível sinaliza o que importa.
  **Aplicar em**: matriz dupla×instrumento de `/materiais` atrás de um gesto, colapsada por padrão.
- **Quando NÃO usar accordion** — NN/g, *Accordions Are Not Always the Answer* (nngroup.com/articles/accordions-complex-content): se o usuário lê a maior parte, o accordion só cobra clique; serve quando cada visita abre poucos tópicos.
  **Aplicar em**: grupos de encontro em `/materiais` — "o que trata / como conduzir" fica no header do grupo, não escondido dentro.
- **`<details>` nativo pra 1 seção** — GOV.UK, *Details* (design-system.service.gov.uk/components/details/): uma única seção auxiliar → `details`, não accordion nem tabs; menos proeminente (bom pra conteúdo secundário); texto do link curto.
  **Aplicar em**: "como conduzir" dentro do grupo de encontro — `<details>` puro, zero JS.
- **Critérios Carbon** — Carbon, *Accordion usage* (carbondesignsystem.com/components/accordion/usage/): usar pra encurtar página com conteúdo relacionado; não usar se o usuário lê tudo; nunca aninhar; flush em side panels.
  **Aplicar em**: checklist antes de qualquer accordion novo na rodada.
- **Escolha do container** — primitivos da casa (Base UI, `src/components/ui`): `details`/Collapsible = conteúdo no fluxo; `Popover` = contexto transitório ancorado; `DropdownMenu` = ações; `Dialog` = decisão que bloqueia.
  **Aplicar em**: painel jornada compacto (details), "Compartilhar" de `/relatorios` (DropdownMenu), preview de anexo (Dialog).

## 8. Grid de instrumentos com estado locked — "libera no encontro N"

- **Path linear com nós de estado** — Duolingo, *learning path* (blog.duolingo.com/new-duolingo-home-screen-design/): trilha ordenada em unidades; a posição mostra "onde estou" e os próximos nós ficam visíveis mas travados — o futuro é prévia, não segredo.
  **Aplicar em**: seção Instrumentos do programa em `/materiais` — ordem do cronograma sempre visível, locked ocupa posição no grid.
- **Estado declarado por fração** — Khan Academy, *Course and Unit Mastery* (support.khanacademy.org/hc/en-us/articles/115002552631): níveis por habilidade (Not started → Mastered), missão "0 of 4 skills to Proficient" — progresso diz o critério.
  **Aplicar em**: card de instrumento mostra "N de M respondidos" + gatilho de liberação ("encontro 9").
- **Desabilitado explica o porquê** — NN/g, *Inactive GUI Controls* (jakobnielsenphd.substack.com/p/inactive-buttons) + USWDS, *Disabled States Research* (github.com/uswds/uswds/wiki/Disabled-States-Research-Findings-2023): melhor prática = muted COM explicação do motivo e de quando libera; disabled mudo frustra e falha contraste — preferir `aria-disabled` + texto.
  **Aplicar em**: instrumento fora da janela renderiza emblema + cor dessaturada + "libera no encontro N"; ações não somem — viram o motivo.
- **"Gray out" visível, identidade preservada** — Jenifer Tidwell, *Disabled Irrelevant Things* (mit.edu/~jtidwell/language/disabled_irrelevant_things.html): o item irrelevante-agora fica acinzentado "com os traços principais ainda visíveis" — o usuário sabe que existe, mas não pode usar agora; remover também a affordance visual (cursor, hover), não só a cor.
  **Aplicar em**: card locked de instrumento — dessatura, mantém forma reconhecível, zera hover/cursor de ação.

## Antipadrões a evitar

1. Número solto sem denominador, meta ou delta ("compared to what?").
2. Barra visualmente cheia quando a fração não está — o bug "4/10 ≈ 90%" da rodada.
3. Omitir do trilho quem não tem dado — buraco invisível vira mentira; segmento neutro + legenda.
4. Gauge/velocímetro decorativo que gasta área sem escala rotulada.
5. KPI em card quadrado com número gigante e nada mais.
6. Vermelho pra estado final/neutro (lê como erro — GitHub reverteu "closed" pra roxo).
7. Checkbox-pill permanente pra escolha sob demanda — usar combobox.
8. Accordion em conteúdo que o usuário lê inteiro; accordion aninhado.
9. Controle desabilitado mudo (sem motivo) ou item que some ao travar.
10. Animação >300ms em feedback pequeno, ou que ignora `prefers-reduced-motion`; toast como única confirmação.
11. Pills de filtro quebrando em 2 linhas no mobile — scroll lateral com snap/fade.
12. Card com banda/footer vazio herdado de botão removido — altura = conteúdo real.

> Uso: este doc é repertório, não spec — quando um padrão conflitar com o plano da tela (`<tela>.md` nesta pasta), o plano manda.
