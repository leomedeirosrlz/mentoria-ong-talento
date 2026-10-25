# Feedback — /materiais (visão coord/supervisor)

Tela: `src/app/(app)/materiais/page.tsx` + `src/components/painel-jornada.tsx`
+ `src/components/materiais-biblioteca.tsx` + `src/components/materiais-hub.tsx`
+ `src/components/material-preview-pdf.tsx` + jovem:
`src/app/(jovem)/jovem/materiais/page.tsx` (`MaterialCard`).

## Itens do feedback

1. **"Pra que serve o progresso da jornada em coord>materiais?"** — o painel
   não justifica a existência na cabeça da coord. Se os materiais ficam
   disponíveis pros jovens automaticamente, pra que serve "lembrar em lote"?
2. **"A lista ainda tá muito grande, pouco visual"** — a lista por turma com
   as células de estação ocupa a tela inteira antes da biblioteca.
3. **"4 cards quadrados com números simples, em vez de visualização rica"** —
   os KPIs (`N duplas · N estações respondidas · N pendências · N fora da
   janela`) são quadrados de texto. Quer virar visualização.
4. **Copy implícita confusa** — "0 estações respondidas": o que é uma
   "estação"? É material? Instrumento? "pendências" e "fora da janela" idem —
   termos internos vazaram pra copy.
5. **"Ou ela sai, ou precisa ser muito compactada"** — a seção inteira
   disputa com "acompanhar pelas fichas das duplas". Ficar = só a camada
   superficial visual, com dropdown pra não perder função.
6. **Confusão de badges** — "por que os cards não têm badges e de repente
   têm? é a turma 2?" — duas leituras possíveis, revisar as duas:
   (a) o agrupamento por turma não fica óbvio — a label "2026/2027" lê
   como período, não como turma (ver `turmas.md` — "Turma 1 / Turma 2"
   resolve aqui também); (b) o bloco "fora da janela" mostra rows sem
   células de estação e a seção por turma mostra com — a diferença de
   anatomia entre as duas listas não é sinalizada.
7. **Preview de PDF errado — e é global** — renderiza a página toda do PDF,
   scrollável dentro do card (só no PC — `pdfViewerEnabled`). Queria
   **thumbnail curta** — o topo da 1ª página, título legível, sem scroll
   interno. ✅ decidido: vale pra TODAS as superfícies (jovem acervo,
   mentor, ficha da dupla, coord) — a única coisa coord-only do plano é o
   painel de jornada compacto (auxiliar vê versão reduzida das 6 duplas
   dele, se fizer sentido).
8. **Espaço vazio embaixo do card** — onde ficavam os botões. "30% de altura
   desnecessária em cada card × 20 é muito scroll à toa."
9. **Filtros de pílula ocupam 2 linhas no mobile** — podem ter scroll
   lateral em vez de quebrar.
10. **Instrumentos nativos como seção própria em /materiais** — ✅ decidido
    (amarra com `formularios.md`): os instrumentos oficiais do programa
    (`sistema=true`: Roda da Vida, Visão, Metas, PDM, avaliações) saem de
    /formularios e ganham **uma seção única, separada dos materiais
    ordinários** (guias, PDFs ficam como estão). Tratamento de destaque:
    cards mais visuais, símbolo SVG próprio por instrumento, cor própria,
    mais acessíveis na hierarquia visual. E estado de liberação pelo
    cronograma: instrumento ainda fora da janela aparece **desabilitado
    com texto** ("libera no encontro 9" / "a partir da semana de revisão")
    — em vez de sumir ou aparecer clicável. As ações do card (emitir link,
    ver respostas, preencher junto) seguem o instrumento.
11. **Dropdowns por encontro ganham "como conduzir / do que trata"** —
    ✅ decidido (amarra com `como-conduzir.md`): dentro de cada grupo/
    dropdown de encontro na biblioteca, uma entrada mostra o que o
    encontro trata e como conduzi-lo, baseado nos docs oficiais do
    programa, com **copy adaptada por papel** (mentor lê "como conduzir";
    coord lê "o que o encontro cobre"). Mesma fonte única; também fica
    acessível na agenda.

**Spec travada**: ✅ **v5a "faixa resumo"** (`docs/mockups/materiais/v5a.html`)
com correções do Thiago (revisão v5c em produção):

- **Card de instrumento do mentorado vira "card de produto"**: sai o
  campo "você marcou/escreveu" (snippet da resposta real — não precisa
  expor resposta), fica só descrição básica do material; sai o botão
  "continuar/ver" — **o card inteiro é o botão**; o ícone/símbolo ocupa
  o espaço liberado (maior, como thumb de produto de ecommerce).
- **Separação de turmas em TODAS as telas** (convenção transversal):
  coord precisa ver como cada turma anda independente — T1/T2 sempre
  quebrado em barras/contagens, nunca só agregado global.
- **Lista "fora da janela" com teto**: se forem 20 duplas não pode
  lotar a tela — mostrar as N primeiras por criticidade + "ver todas"
  (ou agregado colapsável). A seção serve ação, não relatório completo.
- Na implementação: pesquisar referências antes de codar
  (`_referencias.md` + padrões de card de produto).
- **Fora de escopo (decisão Thiago)**: "Preencher junto" (mentor
  respondendo instrumento junto com o jovem) **não entra** — a
  superfície fica emitir-link/ver-resposta; cards de instrumento do
  jovem seguem o fluxo atual.

## Direção

- **Painel Jornada**: compactar pra uma faixa resumo — barra segmentada por
  instrumento (a `BarraEstacao` já é a visualização certa) + a lista "fora
  da janela" (a única parte acionável, com Lembrar) — e mover a matriz
  completa por dupla pra dentro de um `<details>`/aba colapsada. A copy
  "Você vê / Você não vê" sai ou vira tooltip — a seção precisa se explicar
  pelo visual, não por parágrafo.
- **Renomear copy**: "estações" → "instrumentos" (o vocabulário do guia);
  "pendências na janela" → texto falado ("links esperando resposta" etc.).
- **KPIs → visualização**: os 4 quadrados viram a leitura agregada (ex.:
  barras empilhadas por instrumento com % respondido, ou sparkbar de
  cobertura). Número sozinho sem proporção é o que o Thiago chamou de
  "pouco visual".
- **Thumbnail de PDF — global**: `PreviewPdf` deve recortar o topo da
  página (crop via iframe com `view=Fit` + altura fixa menor e
  `overflow:hidden`, ou imagem gerada — manter a decisão de implementação
  com o subagent, mas o resultado é uma **capa estática curta**, nunca
  scrollável). Hoje o iframe com `#view=FitH` embute a página INTEIRA —
  o bug "scrollável" vem daí. Vale em toda superfície que mostra material:
  acervo do jovem, mentor, ficha da dupla, biblioteca coord.
- **Cards do acervo (jovem + coord)**: remover a banda vazia — o espaço
  onde ficavam os botões. O card é capa + linha de título; `flex-1` no
  corpo não pode esticar área vazia. Altura alvo: capa curta (~2/3 da
  atual) + 1–2 linhas de título.
- **Seção "Instrumentos do programa"**: acima/antes da biblioteca
  ordinária, grid de cards próprios — símbolo SVG + cor por instrumento,
  estado (disponível agora / libera no encontro N / concluído), ação por
  card. Desabilitado mostra o motivo da trava, nunca card mudo. Materiais
  ordinários (guia, template, conteudo, link) ficam na listagem atual.
- **Condução nos grupos de encontro**: cada `<details>` de encontro
  mostra 1–2 linhas "o que este encontro trata" + "como conduzir"
  (detalhe expansível), copy por papel, fonte única com a agenda.
- **Pills de filtro mobile**: `flex-nowrap overflow-x-auto` com snap ou
  fade de borda — nunca 2 linhas de chips.

## Critérios de aceite (julgáveis)

- [ ] `/materiais` coord: a primeira dobra mobile (390px) mostra a
      biblioteca ou o mapa de cobertura — o painel de jornada não pode
      empurrar a biblioteca pra fora da 2ª dobra.
- [ ] A palavra "estação" não aparece em copy visível ao usuário
      (grep: `estação|estacoes|estações` em `painel-jornada.tsx` e
      `page.tsx` = zero em strings de UI).
- [ ] Nenhum número aparece sem proporção/contexto visual (barra, sparkline
      ou fração rotulada "x de y").
- [ ] A matriz completa de estações por dupla só aparece atrás de um gesto
      (details/menu/aba) — default colapsado.
- [ ] `PreviewPdf` renderiza só o topo da 1ª página: sem scroll interno do
      iframe, altura do thumb ≤ ~96px, título do PDF discernível no card —
      **em toda superfície** (jovem, mentor, ficha, coord).
      Android/iOS (sem `pdfViewerEnabled`) caem no ícone — sem regressão.
- [ ] Cards do acervo: altura total do card = capa + conteúdo, sem bloco
      vazio embaixo; 20 cards em sequência não geram scroll "morto".
- [ ] Existe UMA seção "Instrumentos do programa" separada da biblioteca
      ordinária, com card visual por instrumento (símbolo + cor próprios).
      Instrumento fora da janela renderiza desabilitado com texto
      ("libera no encontro N"); dentro da janela, ações vivas (emitir
      link / ver respostas / preencher junto, conforme o papel).
- [ ] Ao menos um grupo de encontro da biblioteca mostra a condução/
      "o que trata" — e a fonte é o mesmo módulo compartilhado da agenda.
- [ ] Pills de audiência/tipo em 390px ocupam 1 linha com scroll lateral;
      desktop segue wrap.
- [ ] `npx tsc --noEmit` e `npx eslint src/` limpos; specs
      `materiais*.spec.ts` e `jovem-jornada.spec.ts` verdes (atualizar
      asserts se labels mudarem).

## Mapa de regressões e gaps (review out/2026)

Leitura do código em out/2026 — onde cada coisa mora hoje, o que cada item
pode quebrar e o que o plano ainda não especifica. Referência visual
aprovada: `docs/mockups/materiais/v5c.html`.

### Estado atual mapeado

**Página staff** — `src/app/(app)/materiais/page.tsx`:

- Filtro de audiência por papel `:39-46` (`audiencia` =
  todos/dpp/especialista/coordenacao, `temPapel`), `ehCoord` `:48`.
- `particionarMateriais(visiveis, maxEncontro)` `:52-55` +
  `titulosPorNumero(eventos)` `:56`; stats da biblioteca `:77-91`;
  UA-sniff `mobile` `:95-96`; encontro vigente por cronograma
  (`eventoDaSemana`, fica o MENOR nº com turmas defasadas) `:62-69`.
- `vePainel` = coordenação | supervisor `:106-110` — dispara
  `getPainelInstrumentosJornada()` (RPC `painel_instrumentos_jornada`,
  definer coord/sup), `getDuplas()` e `getUltimasInteracoes(...,"nudge")`
  `:111-116`; `duplasInfo` leva só flags (`status`, `mentorWhatsapp`,
  `jovemTemEmail`, `mentorTemEmail` — endereço de e-mail nunca desce pro
  client) `:117-127`.
- `<PainelJornada linhas eventos nudges duplasInfo meuNome ehSupervisor
  podeLote envioLiberado>` `:147-157` — `podeLote` só coord (`:155`),
  `envioLiberado = EMAIL_ENVIO_LIBERADO` (`:156`).
- `<MateriaisBiblioteca stats encontros transversais ehCoord maxEncontro
  encontroAtual mobile>` `:192-204` — a página JÁ tem `eventos` completo;
  `encontros` carrega título do calendário por número.

**Painel** — `src/components/painel-jornada.tsx`: mapa
`SISTEMA_DA_ESTACAO` `:61`, `CelulaEstacao` `:88-140` (atributo `title` =
"<rótulo> · <detalhe>" — contrato dos specs), `BarraEstacao` `:146-250`
com slot `acao` que recebe `<EnviarInstrumentoLote>` quando
`podeLote && elegiveis.length > 0` `:389-416`; KPIs `:363-370` (o único
"estações respondidas" visível ao usuário é `:367`); lista "Fora da
janela do guia" `:426-515` (Lembrar = `NudgeButton` + `casoMentor`
`:470`, "Ver ficha" → `/duplas/<id>` `:506`); matriz por turma
`:517-561` + legenda `:586-590`. O estado por célula vem de
`estacoesPainelDupla`/`atrasadasPainel` (`src/lib/jornada.ts:849-915`) —
inclui a regra de re-emissão `:879-885` (link reemitido após a janela
continua "pendente", não vira "expirado"/"fora").

**Biblioteca** — `src/components/materiais-hub.tsx`: `temConteudo`
`:60-63` (`path` ou `url` http(s); ausência = "em breve", estado
legítimo), `particionarMateriais` `:67-92` (`encontro_num` → grupos;
`null` → transversais por tipo), `CoberturaTrilha` `:114-195` (âncora
`#mat-encontro-N`), `EncontroDetails` `:197-318` (`open` SSR `:217`,
badge "semana atual" `:249-256`, `NovoMaterialDialog` interno coord
`:283-289`/`:304-312`), `MaterialRow` `:370-478` (thumb `PreviewMaterial`
`h-20 w-14` `:407-414`, badge de audiência, `MaterialActions` coord /
`MaterialMenu` demais `:461-469`), `TransversaisMateriais` `:345-350`
(heading "Transversais" assertado em spec), "sem conteúdo" (coord) ×
"em breve" (demais) `:464`. `src/components/materiais-biblioteca.tsx`:
props `:121-142`; filtros client `aud`/`tipoF` com contagens facetadas
`:144-178`; chips `:215-310`; grupo "Por encontro" nasce fechado no
mobile `:139-141`.

**Preview de PDF** — `src/components/material-preview-pdf.tsx`:
`PreviewPdf` `:57-94` — `navigator.pdfViewerEnabled` via
`useSyncExternalStore` `:67-71` (Android/iOS caem no ícone, sem mismatch
de SSR), iframe `src#page=1&toolbar=0&navpanes=0&view=FitH` `:84-90`,
container `h-36 overflow-hidden` `:78`, IntersectionObserver 600px
`:24-47`, decorativo (`aria-hidden` + `pointer-events-none` +
`tabIndex=-1`). `PreviewMaterial` `:100-134` (imagem → `<img>`
`object-top`), `PreviewLink` `:140-170`. Consumidores de thumb hoje:
`MaterialRow` (hub `:407`) e `MaterialCard` do jovem
(`src/app/(jovem)/jovem/materiais/page.tsx:964-1014`). A ficha da dupla
NÃO tem thumb — o material vira chip de texto em `EncontroRow`
(`src/app/(app)/duplas/[id]/page.tsx:1402-1406`).

**Jovem** — `src/app/(jovem)/jovem/materiais/page.tsx`: payload = RPC
`jovem_jornada` (0096) → `estacoesJornada()` `:197-214`; estações são
`<article>`, trancadas ficam num `<details>` (`:425`, `:474-475`);
`EstacaoAction` `:622-699` — "Continuar" → `/f/<token>` `:681-699`,
`ReverRespostaDialog` no feito/a_fazer com respostas `:667-695`,
avaliação de encontro pendente `:649-665`; o acervo filtra por
`materialLiberadoParaJovem(m, encCorrente)` `:1055-1072` — material com
`encontro_num = null` é SEMPRE liberado pro jovem.

**Jornada (fonte das janelas)** — `src/lib/jornada.ts`: `EstacaoChave`
`:25-32` (7 estações); `ESTACOES` `:179-251` — roda_inicial enc. 1,
visao 1–4, metas 2–3, pdm 1–4, avaliacao_encontro 1–16 (recorrente),
roda_formal 12–14, avaliacao_360 16; `resolveEstacao` `:398-530`
(trancada → `detalhe` "libera no enc. N (data)" `:470-477`);
`encCorrenteDe` `:553-559` (maior `realizado` + 1, teto
`TRILHA_LEN.dpp` = 16); `estacoesPainelDupla` `:849+` (estados staff:
respondido/pendente/expirado/nao_enviado/trancada); `atrasadasPainel`
`:903+` (fora da janela = `regua > encFim` e não respondido).

**Consumidores de `sistema` (forms oficiais)** — enums em
`src/lib/forms/schema.ts:83-143` (`FormularioSistema` `:83-94`,
`SISTEMA_LABEL` `:95-110`, `INSTRUMENTOS_SISTEMA`+`InstrumentoSistema`
`:111-118`, `INSTRUMENTO_INFO` `:122-143`); `ehInstrumento`
`src/lib/forms/instrumentos.ts:19-23`. Quem lê hoje: tag "oficial" em
`/formularios` (`formularios-lista.tsx:155-160`), página de detalhe
(`/formularios/[id]` — badge `:128-133`, nota "imutável" `:246-254`,
`FormularioLinks` com emissão genérica escondida pra instrumento
`formulario-links.tsx:343-351`, `RespostasSection`→`InstrumentoResultado`
`:370-377`), `InstrumentosDupla` na ficha (RPC `instrumentos_da_dupla`
via `getInstrumentosDaDupla` `src/lib/forms/queries.ts:391-411`), envio
por dupla `enviarInstrumentoMentorado` → RPC `emitir_link_instrumento`
(`src/lib/actions-formularios.ts:261-285`), lote `enviarInstrumentoLote`
→ RPC `emitir_instrumento_lote` (`src/lib/actions-email.ts:389+`,
`src/components/enviar-instrumento-lote.tsx:42-105`), exclusão do dialog
"Enviar formulário" (`src/components/enviar-formulario-dialog.tsx:102`),
público `/f/[token]` (RPC `formulario_por_token`
`src/lib/forms/queries.ts:421-439` → `InstrumentoFlow`
`formulario-publico.tsx:85-88` + `src/components/instrumentos/*`),
checklist de encerramento lendo `avaliacao_360`
(`src/lib/queries-encerramento.ts:91`). O modo demo espelha tudo em
`src/lib/demo/forms-data.ts` (`demoInstrumentosDaDupla` `:1412`,
`demoPainelInstrumentosJornada` `:1327`, `demoJovemJornada` `:1247`,
ordem `ORDEM_JORNADA` `:1210`).

### Riscos de regressão por item do plano

- **Itens 1/5/10 — painel compacto + seção "Instrumentos do programa"**:
  a RPC `painel_instrumentos_jornada` só serve coord/supervisor — a seção
  de instrumentos do mockup `v5c` existe nas três visões staff **e** na do
  mentor DPP (`v-d`, cards por jovem com "Preencher junto"/"Enviar
  rodada"). Pra mentor, o estado por instrumento hoje só existe via RPC
  `instrumentos_da_dupla` (por dupla — N duplas = N chamadas ou RPC nova);
  o mockup mentor não é só "mover o card" — é uma fonte de dados nova.
  Pra coord, "Enviar em lote · N" do card já existe como
  `EnviarInstrumentoLote` (elegíveis = pendente/expirado/nao_enviado —
  respondido nunca reemite; `envioLiberado` troca "Enviar N e-mails" por
  "Emitir N links"). Reusar `estacoesPainelDupla`/`atrasadasPainel` pra
  "libera no encontro N" do card — NÃO derivar janela de `encontro_num`:
  instrumento oficial não é linha de `materiais` e a régua é por dupla
  (dupla atrasada tem janela aberta além do enc. oficial, ver
  `painel-jornada.tsx:295-303`).
- **Item 4 — copy**: "estações respondidas" (`painel-jornada.tsx:367`) é
  o único "estação" visível; os demais são identificadores de código
  (não entram no grep). O assert existe nos DOIS specs
  (`tests/e2e/app/materiais-painel.spec.ts:61` e
  `tests/e2e/demo/jovem-jornada.spec.ts:348`) — renomear exige atualizar
  ambos. Idem "Você vê:/Você não vê:" (`jovem-jornada.spec.ts:341`,
  `materiais-painel.spec.ts:52`), heading "Fora da janela do guia"
  (`:79`), "Ver ficha" `href=/^\/duplas\//` (`:82-85`), botões
  `Lembrar|Lembrada|dupla pausada` (`:91-95`), `getByTitle(/^Roda
  inicial · …/)` das células (`jovem-jornada.spec.ts:396-410`) — a
  matriz pode colapsar atrás de gesto, mas os seletores/títulos precisam
  sobreviver ou o spec muda junto.
- **Item 7 — thumbnail curta**: `PreviewPdf` já corta com
  `overflow-hidden` (h-36); o "scrollável" reclamado é o scroll interno do
  viewer do Chrome (a caixa não rola — `pointer-events-none` — mas o
  viewer renderiza página inteira + chrome próprio). Opções reais: caixa
  mais baixa (~96–106px, como `.pthumb` do mockup) + `view=Fit`/`FitH` já
  ancorado no topo, ou thumb gerada (custo novo: storage + job). Manter:
  `pdfViewerEnabled` fallback (Android/iOS = ícone, assertado pela
  convenção "sem regressão"), lazy por IntersectionObserver, src
  `/api/material/[id]` (signed URL 300s — não apontar o iframe pro
  storage direto), `frame-src` do CSP. O mockup desenha capa
  estilizada (`.pg1`), não a página real — decisão de "capa real
  cortada × capa sintética" está aberta no plano; validar contra o
  v5c antes de implementar. Superfícies hoje: `MaterialRow` (thumb
  portrait `h-20 w-14` — a régua "≤96px" já está abaixo do alvo, cuidado
  pra não encolher além do legível) e `MaterialCard` do jovem. "Ficha da
  dupla" e "mentor" citados no item NÃO têm thumb hoje — é superfície
  nova, não mudança de uma existente.
- **Item 8 — espaço morto dos cards**: `MaterialRow` usa a trailing zone
  (badge+menu) que cai pra linha 2 abaixo de `lg` (`:446-478`); o card do
  jovem (`MaterialCard` `:964-1014`) tem a banda de ações. Remover a banda
  vazia sem quebrar: a linha-link do `MaterialRow` é o gesto principal — o
  cluster trailing (`MaterialActions`/`MaterialMenu`) não pode sumir pra
  coord nem pros demais papéis (cópia de link mora ali).
- **Item 9 — pills em 1 linha**: os dois grupos de chips
  (`materiais-biblioteca.tsx:280-310`) usam `flex-wrap` + `filterChipCls`;
  `role="group"`/`aria-label` dos grupos ("Filtrar por audiência"/"por
  tipo") são contrato a11y — trocar pra `overflow-x-auto` com
  scroll-snap/fade no mobile mantendo `flex-wrap` no `sm+`. Contagem
  dentro do chip (`{n}`) é feature — manter.
- **Item 10 — a seção**: dados vêm de `formularios` (`sistema IS NOT
  NULL`), não de `materiais`. NÃO modelar como `Material` pseudo-linha:
  `particionarMateriais` jogaria tudo em "Transversais" e
  `materialLiberadoParaJovem(null)` libera instrumento trancado pro jovem
  (roda formal/360º vazariam). O card desabilitado "libera no encontro N"
  é computado por turma/dupla — o texto do mockup já é por turma ("T1 em
  4 nov · T2 em 26 nov"); fonte = `ESTACOES[chave].encIni` +
  `dataPorNumero` do cronograma (mesma matemática de `resolveEstacao`
  `:470-477`), não data fixa. Links/tokens já emitidos seguem vivos —
  nada pode invalidar `/f/<token>` (`formulario_por_token` é
  security-definer e não depende da listagem).
- **Item 11 — "o que trata" nos dropdowns**: `EncontroDetails` recebe hoje
  só `titulo` (`titulosPorNumero`). `ciclo_eventos.instrumentos` já chega
  na página via `getCicloEventos()` (a prop `encontros` pode carregá-lo
  sem query nova). A copy "o que o encontro cobre" é dado novo — ver
  `como-conduzir.md` (módulo único). Cuidado: `EncontroDetails` é
  compartilhado por todos os papéis staff — a versão "como conduzir"
  (voz mentor) vs "o que cobre" (voz coord) exige prop de papel; o
  componente hoje recebe só `ehCoord` (booleano — supervisor/auxiliar
  executivo, DPP e especialista caem no mesmo lado). Especialista não é
  DPP: encontro_num do guia DPP pode não se aplicar à trilha dele —
  conferir se a seção de condução deve aparecer pra ele.
- **Transversal**: "T1/T2 sempre quebrado" nos cards = dados por
  cronograma — a linha `PainelJornadaLinha` já traz `turma` +
  `cronograma_id` (agrupamento em `:324-328`); a faixa resumo nova precisa
  do mesmo recorte (mockup `.tl` T1/T2 por instrumento).

### Gaps do plano

- **Qual conjunto `sistema` vira card?** O mockup mostra 8 cards: os 4 de
  jornada (`visao`, `metas`, `pdm`, `roda_vida` — leitura inicial) +
  avaliação por terceiros + avaliação do encontro + roda formal + 360º.
  Desses, só 4 são `INSTRUMENTOS_SISTEMA`; `avaliacao_encontro` não é
  formulário (é a tabela de avaliações por encontro, link nasce do
  encontro realizado); "avaliação por terceiros" é a feature 0103
  (`TerceirosDupla`); "roda formal" é o mesmo form `roda_vida` em
  segundo momento (a estação `roda_formal` resolve o MESMO sistema — ver
  `resolveEstacao` com `camposDe("roda_vida")` em
  `jornada.ts:675`); `avaliacao_360` é sistema mas fora de
  `INSTRUMENTOS_SISTEMA`. E ainda existem `anamnese`,
  `autoavaliacao_mentor`, `avaliacao_especialista`, `intake_mentor`,
  `intake_mentorado` (`schema.ts:83-94`) — todos `sistema=true`, nenhum no
  mockup. O plano precisa enumerar: o que é card da seção, o que fica em
  `/formularios` (se ficar), e o que não é formulário mas entra como
  card informativo (terceiros, avaliação de encontro).
- **Instrumento transversal**: o plano não define onde fica um
  instrumento sem encontro-alvo (anamnese é pré-jornada; intake é porta
  de entrada). Se entrar na seção, precisa de rótulo próprio ("antes do
  enc. 1" no mockup) — não pode cair na lógica `encontro_num=null` →
  transversal/sempre-liberado dos materiais.
- **Página de detalhe `/formularios/[id]`**: sai da lista ≠ some. O card
  "Ver respostas" precisa de destino — a página hoje é a casa das
  respostas agregadas + links legados + prévia (`[id]/page.tsx:240-389`);
  manter a rota (deep-link) ou recriar a superfície. Links pendentes
  existentes e respostas já recebidas seguem alcançáveis daí.
- **"Preencher junto"** (mockup mentor): não existe hoje — o mentor
  autenticado abrindo o link do jovem cai em `outra_pessoa`
  (`/f/[token]/page.tsx:143+`). É feature nova (modo de preenchimento
  assistido?) e não só mover botão — especificar ou cortar do escopo.
- **Ordem dobrada**: `PageHeader` → `PainelJornada` → biblioteca é a
  ordem atual; o aceite "1ª dobra mobile mostra biblioteca/mapa" exige a
  seção de instrumentos + painel compactos ANTES — definir a ordem final
  (mockup: painel → instrumentos → biblioteca) e lembrar que supervisor
  sem `podeLote` vê o mesmo painel reduzido.
- **Auxiliar executivo** no mockup = papel `supervisor` no código (não
  existe role "auxiliar" — `AppRole` é coordenacao/supervisor/
  mentor_dpp/mentor_especialista/mentorado, `types.ts:1-6`; o nome
  "auxiliar executivo" aparece em comentários de escopo, ex.
  `queries.ts:174`). Não criar papel novo nem gatear por nome.
- **Painel vazio**: `if (!linhas.length) return null` (`:290`) — com a
  seção nova, /materiais nunca fica sem a parte de instrumentos mesmo com
  painel vazio; checar se a seção também deve renderizar quando a RPC
  volta vazia (turma ainda não começou).
- **`InstrumentosDupla` na ficha** continua sendo a casa de ação por
  dupla — a seção nova não substitui (o mockup coord só tem lote + ver
  respostas; o mentor continua emitindo na ficha). Decisão: a seção pode
  deep-link `#instrumentos`/`Ver ficha` em vez de reimplementar ações.

### Opções de melhoria (fora do plano)

- A faixa resumo pode virar `role="img"` com `aria-label` textual como o
  mockup (`:478`) — um padrão já praticado em `BarraEstacao`.
- `EncontroDetails` já tem âncora `#mat-encontro-N` — o mapa de cobertura
  pode ganhar deep-link `/materiais#mat-encontro-9` compartilhável.
- "Lembrado ontem · libera 9/out" (mockup `:542`) = `nudges` (cap 48h) +
  data de liberação — os dois dados já chegam; juntar numa linha só é
  barato e aumenta a honestidade do botão desabilitado.

### Must-read pro implementer

- `src/app/(app)/materiais/page.tsx:32-110` (queries + escopo de papel +
  `vePainel`) e `:147-205` (ordem painel→biblioteca).
- `src/components/painel-jornada.tsx:257-330` (props + resolvidas +
  turmas), `:339-416` (copy por papel, KPIs, barras + slot de lote),
  `:426-592` (lista de ação + matriz por turma + legenda), `:43-140`
  (labels/célula + `SISTEMA_DA_ESTACAO`).
- `src/components/materiais-hub.tsx:56-115` (`temConteudo`,
  `particionarMateriais`, `titulosPorNumero`), `:197-320`
  (`EncontroDetails`), `:345-478` (`TransversaisMateriais` +
  `MaterialRow`).
- `src/components/materiais-biblioteca.tsx:121-178` (props + filtros
  facetados), `:215-330` (chips + grupos).
- `src/components/material-preview-pdf.tsx:24-94` (lazy + `PreviewPdf`),
  `:100-170` (`PreviewMaterial`/`PreviewLink`).
- `src/lib/jornada.ts:179-251` (`ESTACOES`), `:398-530`
  (`resolveEstacao` — a copy "libera no enc. N" já nasce aqui),
  `:553-575` (`encCorrenteDe`/`materialLiberadoParaJovem`), `:843-915`
  (`estacoesPainelDupla`/`atrasadasPainel`).
- `src/app/(jovem)/jovem/materiais/page.tsx:246-310` (listas por
  estado), `:520-700` (célula/pill/`EstacaoAction`), `:852-870`
  (`TrancadasItem`), `:1048-1075` (acervo + liberação).
- `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx:77-153` (estado +
  `enviarInstrumentoMentorado`), `:156-277` (`LinhaInstrumento` completo:
  chip de janela, "Como conduzir", Ver resultado, Copiar/WhatsApp, Gerar
  link), `:280-332` (`InstrumentosDupla` props).
- `src/components/enviar-instrumento-lote.tsx:42-105` + `:375-398`
  (elegíveis, prévia "quem recebe", `envioLiberado`).
- `src/components/materiais-hub.tsx` + mockup `docs/mockups/materiais/
  v5c.html:455-760` (visão coord) e `:922-1095` (visão mentor).
- Specs: `tests/e2e/app/materiais-painel.spec.ts:38-157`,
  `tests/e2e/demo/jovem-jornada.spec.ts:326-405` (painel) — atualizar
  junto quando labels/copy mudarem.
