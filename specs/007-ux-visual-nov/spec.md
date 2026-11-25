# Spec — UX, visual e copy, rodada nov/2026

**Feature:** `specs/007-ux-visual-nov` · **Status:** Draft
**Origem:** brief ws10 (`.devin-ctx/brief.md`) · **Data:** 19/nov/2026

> Guarda-chuva de 14 achados de UX/visual/copy, cada um auditado contra o
> código com evidência `arquivo:linha` (bloco "Estado atual" de cada US;
> o mapa completo está no `plan.md`). US1–US10 são superfície pura:
> nenhuma migration, nenhuma policy nova. US11–US14 tocam schema/RLS e
> carregam decisão registrada no `plan.md` — são spec-only até aprovação,
> seguindo o precedente da US2 da spec 005.

## Problema e resultado

- **Dor hoje:** quatro dores concretas. (a) O "Ler tudo" do encontro da
  semana não trunca em telas largas — a prévia já mostra o texto inteiro
  e o clique só desloca o bloco. (b) A área de instrumentos do mentor é
  texto-densa: 8 cards idênticos, resposta atrás de um `<details>` de
  label fixo, nome do mentorado como link miúdo. (c) Números sem rótulo
  legível: dots de avaliação vermelho/laranja/lima sem legenda, barra da
  semana sem chave, olho da Liza encolhendo em viewport larga. (d)
  Operação com atrito: fila de pareamento enterrada num card fechado,
  registrar mais de um encontro exige voltar à ficha, feedback de
  terceiros só entra por link de WhatsApp, digest fixo no código.
- **Resultado observável:** leitura e instrumentos respondem ao tamanho
  real da tela e ao estado (lido/expandido) de forma explícita; toda cor
  de dado tem legenda; a operação ganha atalho de registro em sequência e
  lançamento manual de resposta de terceiros com proveniência.
- **Como saberemos que funcionou:** num desktop largo o "Ler tudo"
  realmente trunca; o mentor seleciona a dupla por botão com nome e vê a
  resposta expandir animada; toda escala cor→significado tem legenda
  visível; registrar dois encontros seguidos não exige sair do fluxo.

## Fora de escopo

- Redesenho da identidade visual, novas fontes ou tokens novos — tudo usa
  a escala e os tokens vigentes (`--ok-text`, `--destaque`, `--chart-*`).
- Edição de resposta submetida de formulário (o snapshot é evidência —
  decisão REALIZA-435); a edição do mentor fica no documento vivo do PDM
  (US13), nunca na `formulario_respostas`.
- Coordenacao agendar/registrar encontro em nome da dupla — contrato de
  domínio vigente ("quem agenda/registra é a dupla"); US11 muda UX, não
  a regra.
- Envio de digest por WhatsApp, preferências por usuário final, e
  qualquer rota pública nova.
- Redesign da ficha da dupla ou da home — os itens tocam pontos
  localizados, não a arquitetura das páginas.

## Histórias de usuário

### US1 — "Ler tudo" do encontro da semana expande de verdade (P1)

**Estado atual:** `src/components/materiais-mentor-biblioteca.tsx:159,205-248`.
O gate para mostrar o toggle é `conduzir.length > 240` (caracteres), mas o
que trunca é `line-clamp-3` (linhas renderizadas). Em container largo
(~140-175 chars/linha) 3 linhas cabem ~420-520 chars — os textos reais de
`src/lib/como-conduzir.ts:136-228` medem 290-585, ou seja, a maioria passa
do gate mas cabe inteira na prévia: fechado já mostra tudo, e abrir troca
o `<span>` truncado por um `<p>` idêntico abaixo do botão — lê como
"só desloca o texto". A ordem visual do aberto também inverte (controle
no topo, texto embaixo).

- **Por que P1:** bug visível na superfície que o mentor abre toda semana;
  a causa é medida errada (caracteres × linhas), não desenho novo.
- **Teste independente:** em tela larga, encontro com `conduzir` longo —
  fechado trunca em 3 linhas; abrir mostra o restante no mesmo lugar.

Cenários:

1. **Dado** um `conduzir` que passa de 3 linhas na largura renderizada
   **quando** o card abre **então** a prévia trunca em 3 linhas e "Ler
   tudo" aparece.
2. **Dado** o toggle aberto **quando** o usuário lê **então** o texto
   completo cresce no mesmo lugar (as linhas extras aparecem; o controle
   fica no fim do bloco, não no topo).
3. **Dado** o texto aberto **quando** clica "Mostrar menos" **então**
   volta para a prévia de 3 linhas.
4. **Dado** um `conduzir` que cabe em 3 linhas na largura atual **quando**
   o card abre **então** nenhum toggle aparece — nada de controle que
   abre para o mesmo trecho.
5. **Dado** o mesmo card em mobile estreito e em desktop largo **quando**
   comparado **então** o comportamento é consistente (trunca quando não
   cabe, some quando cabe) — o gate é por linhas renderizadas ou
   garantido por construção, nunca por contagem de caracteres.

### US2 — Indicador de leitura explícito na biblioteca (P1)

**Estado atual:** `src/components/biblioteca-lista.tsx:125-130` mostra
"lido" como `Badge outline` na linha de meta, disputando espaço com
"instrumento oficial" e "desta semana"; no card da semana do mentor
(`materiais-mentor-biblioteca.tsx:134-139`) é só um check sem rótulo
visível. Título e linha não mudam. `material_leituras` já registra por
`(profile_id, ref)` e a lista já recebe `lidos` — infra pronta.

- **Por que P1:** pedido explícito e barato — o dado já chega na
  superfície; só falta a marca ser legível no próprio item.
- **Teste independente:** marcar um material como lido e reabrir
  `/materiais` — o item se distingue sem hover nem busca pelo selo.

Cenários:

1. **Dado** um material lido **quando** a linha renderiza **então** o
   item inteiro se distingue dos não lidos (opacidade reduzida no conteúdo
   ou título sublinhado/pesado) — não só um selo na meta.
2. **Dado** o indicador novo **quando** comparado com "instrumento
   oficial"/"desta semana" **então** não se confunde — "lido" continua
   com rótulo textual ou estado de item, nunca só ícone nem só cor.
3. **Dado** o nome acessível do item **quando** lido **então** segue
   contendo "lido" (contrato do e2e `material-leitura`).
4. **Dado** material sem destino ("em breve") já lido por outro caminho
   **quando** exibido **então** aplica-se o mesmo estado — a marca é do
   item, não do link.

### US3 — Instrumentos do mentor: seletor por nome e abas na ordem certa (P1)

**Estado atual:** a "seleção" de mentorado são links `text-xs underline`
no rodapé dos cards (`src/app/(app)/materiais/instrumentos-programa.tsx:503-525`)
ou linhas de lista na página do instrumento (`[chave]/page.tsx:155-187`);
não existe seletor. Capacidade típica é 1-2 mentorados
(`mentor_profiles.capacidade default 1`, `0001_init.sql:27`). As abas de
`/materiais` renderizam **Instrumentos primeiro** (`page.tsx:246-256`) —
o mentor já cai em Biblioteca como default, mas a ordem visual inverte a
prioridade dele. Telas são texto-densas: 8 cards idênticos com descrições
e resposta atrás de `<details>` fixo.

- **Por que P1:** é o fluxo semanal do mentor; a correção das abas é de
  uma linha e o seletor já tem padrão pronto (pills de instrumento).
- **Teste independente:** mentor com 2+ duplas abre
  `/materiais?aba=instrumentos` — Biblioteca é a primeira aba, e cada
  mentorado aparece como botão nomeado que filtra a visão.

Cenários:

1. **Dado** qualquer papel com a aba Instrumentos **quando** a barra de
   abas renderiza **então** Biblioteca vem primeiro; o default por papel
   se mantém (mentor→Biblioteca; staff com painel→Instrumentos).
2. **Dado** um mentor com 1 a 3 mentorados **quando** a área de
   instrumentos abre **então** os nomes aparecem como botões selecionáveis
   (padrão pill, estado ativo óbvio), não como links de rodapé.
3. **Dado** um mentor com mais de 3 mentorados **quando** a lista excede
   o limiar **então** a seleção vira dropdown/Select nomeado — botões só
   até o limiar definido (sugestão: 3).
4. **Dado** um mentorado selecionado **quando** a visão filtra **então**
   a escolha persiste por query param (`?dupla=` ou equivalente) —
   deep-linkável como `?aba=`.
5. **Dado** a lista de duplas na página de um instrumento **quando**
   respondida **então** cada card mostra um resumo visual do resultado
   (ex.: mini-roda ou síntese), não só badge + details fechado.

### US4 — "Ver resposta" destacado, com estado e animação (P2)

**Estado atual:** na página do instrumento o gatilho é `<summary>`
`text-xs text-muted-foreground` sem ícone e **label fixo** — nunca vira
"Fechar" (`[chave]/page.tsx:633-648`); o staff já tem botão que alterna
("Esconder respostas", `detalhe-instrumento-lazy.tsx:50-64`) sem
animação; a ficha abre Dialog xl (`instrumentos-dupla.tsx:371-400`). O
app já tem vocabulário de expansão animada (`src/components/motion.tsx`,
`grid-rows-[0fr→1fr]` de `corpus-documento.tsx`).

- **Por que P2:** a resposta é o conteúdo que o mentor mais quer ver —
  hoje é o elemento mais fraco da linha. Alinha as três superfícies.
- **Teste independente:** abrir resposta de uma dupla na página do
  instrumento — gatilho com peso de ação, vira "Fechar resposta" e o
  conteúdo expande animado.

Cenários:

1. **Dado** uma dupla com resposta **quando** a linha renderiza **então**
   o gatilho "Ver resposta" tem peso de ação (botão com ícone, não texto
   miúdo) — padrão `Button` do kit.
2. **Dado** a resposta aberta **quando** o usuário olha o gatilho
   **então** ele diz "Fechar resposta" com `aria-expanded=true`.
3. **Dado** o toggle **quando** acionado **então** a expansão/contração
   anima (altura + fade, ≤300ms) e `prefers-reduced-motion` entrega a
   troca seca pelo guard global — nenhum media query local.
4. **Dado** o estado de carregamento lazy **quando** a resposta ainda
   baixa **então** o gatilho mostra progresso (spinner) sem trocar de
   lugar.
5. **Dado** a ficha da dupla **quando** o resultado abre **então** o
   rótulo e a afordância são os mesmos da página do instrumento (Dialog
   segue válido como destino — decisão no plan).

### US5 — Hierarquia na leitura "Construindo sua visão" (P2)

**Estado atual:** `resposta-lista.tsx:196-206` renderiza pergunta e
resposta ambas em `text-sm`, separadas só por `font-medium`; o número é
`text-muted-foreground` inline. O lado de preenchimento (`instrumentos/visao.tsx:116-141`)
já tem a hierarquia pedida: número em disco lime e pergunta `text-lg
font-semibold`. Convenção de cor: amarelo (`--destaque`) é marcador,
nunca cor de texto (`globals.css:135-137`).

- **Por que P2:** a leitura da Visão é cerimonial (é o artefato que o
  jovem constrói) e hoje lê como lista genérica; a solução espelha um
  padrão que o próprio app já validou.
- **Teste independente:** abrir uma Visão respondida — número, pergunta e
  resposta distinguem-se à primeira vista sem ler o conteúdo.

Cenários:

1. **Dado** a lista pergunta→resposta da Visão **quando** renderiza
   **então** o número é marcador amarelo (disco/chip `--destaque` com
   texto `--destaque-foreground`), a pergunta é texto verde
   (`--ok-text`, peso semibold) e a resposta é corpo em `text-foreground`
   com tamanho/entrelinha de leitura.
2. **Dado** o bloco da Declaração **quando** exibido **então** segue
   hero (blockquote atual), sem perder o novo sistema de hierarquia na
   narrativa.
3. **Dado** a mesma `RespostaLista` usada por 360º e forms genéricos
   **quando** a hierarquia muda **então** a decisão é consciente: escopo
   só na Visão ou padrão global — registrado no plan.
4. **Dado** o resultado aberto pela ficha ou pelo jovem ("Rever
   resposta") **quando** renderizado **então** a mesma hierarquia vale —
   uma linguagem de leitura por instrumento.

### US6 — ViaCEP: sem texto fixo e cobrindo todo CEP (P2)

**Estado atual:** cobertura já é total por construção — o único input de
CEP do app é `DadosCivisFields` (`assinatura-form.tsx:181-195`), usado
por assinatura, onboarding staff e jovem, cadastro e edição de pessoa e
mentorado (lista completa no plan). O texto explicativo é o estado idle
`"CEP completo consulta o ViaCEP e preenche o endereço."`
(`assinatura-form.tsx:30,204-210`) — existe como transparência LGPD
in-situ pedida pela spec 005. Gap real restante: no modo `compacto` o
autofill não alimenta os campos simples cidade/UF que vivem fora do bloco
(`assinatura-form.tsx:96-98`).

- **Por que P2:** o pedido parte de premissa vencida ("hoje só
  assinatura/dialogs") — o trabalho real é remover o hint fixo sem
  perder a transparência e fechar o gap do modo compacto.
- **Teste independente:** abrir o passo do termo no onboarding — nenhum
  texto fixo sob o CEP em repouso; ao digitar, os estados de busca
  aparecem normalmente.

Cenários:

1. **Dado** o campo CEP em repouso **quando** o form abre **então**
   nenhum texto explicativo fixo aparece — estados `buscando`,
   `encontrado`, `não encontrado` e `falha` seguem anunciados.
2. **Dado** a transparência sobre o ViaCEP **quando** o texto sai
   **então** ela segue coberta por `docs/lgpd/base-legal.md` (operador
   listado) — o hint não era a única divulgação.
3. **Dado** um form em modo `compacto` (cadastro/edição) **quando** o
   CEP autocompleta **então** os campos simples cidade/UF do formulário
   também preenchem — nada de metade do endereço manual.
4. **Dado** campo cidade/UF preenchido pelo autofill **quando** o usuário
   edita **então** o valor editado prevalece no submit.
5. **Dado** os formulários de perfil próprio (staff/jovem) **quando**
   auditados **então** fica registrado que não coletam CEP hoje —
   fora desta rodada (fora de escopo declarado).

### US7 — Toda escala de cor de gráfico com legenda (P2)

**Estado atual:** o kit `src/components/viz` já exige legenda nomeada,
mas nem toda superfície a usa: `TrajetoriaAvaliacoes`
(`trajetoria-avaliacoes.tsx:6-71`) desenha dots verde/lima/laranja/
vermelho só com `title` por ponto — "o que é vermelho/laranja" não está
na tela; `ContextoAvaliacaoCard` repete o padrão; a barra "Esta semana"
(`dashboard-coordenacao.tsx:399-410`) e as `BarraSegmentada` dos cards da
Liza (`assistente-cards.tsx:421-432,1443-1451`) não passam a prop
`legenda` que o componente já aceita (`barra-segmentada.tsx:46`).

- **Por que P2:** semântica de status carregada só na cor fere a regra
  da casa ("status nunca só cor"); a correção é majoritariamente ligar
  o que já existe.
- **Teste independente:** abrir ficha da dupla e home da coordenação —
  toda escala colorida tem chave legível ao lado.

Cenários:

1. **Dado** a trajetória de avaliações **quando** exibida **então** uma
   legenda curta mapeia cor→faixa (ex.: verde excelente · lima boa ·
   laranja regular · vermelho baixa), com rótulo textual e não só cor.
2. **Dado** qualquer `BarraSegmentada` multi-categoria **quando**
   renderizada **então** recebe `legenda` ou chave equivalente visível —
   barras de uma categoria só seguem dispensadas.
3. **Dado** a tira de encontros da retrospectiva **quando** lida
   **então** o mapa cor→avaliação está explícito, não só a nota
   "a cor é a avaliação do mentor".
4. **Dado** leitor de tela **quando** percorre o gráfico **então** ouve
   os mesmos rótulos da legenda — paridade com `aria-label` existente.
5. **Dado** micro-labels de eixo a 10-11px **quando** a rodada passa
   **então** ficam como estão — a convenção já os permite em gráfico;
   o pedido de legibilidade se resolve em legenda, não em fonte.

### US8 — /duplas: "por situação" como ordem escolhível (P2)

**Estado atual:** a ordenação default já é o radar por situação
(apoio→risco→atenção→em dia→fora da régua, `duplas-lista.tsx:1223-1232`
+ `ORDEM_SEMAFORO` `ciclo.ts:2360`), mas o controle `?ordem=` só oferece
nome/encontros/nota — o cabeçalho "Situação" é `<span>` fixo não
ordenável (`duplas-lista.tsx:579`). Ordenar explicitamente desliga o
colapso da "massa saudável" (`:1291-1294`) — comportamento pronto para
herdar.

- **Por que P2:** a base canônica existe e é consistente com agenda e
  dashboard; o trabalho é expô-la como opção, barato e sem domínio novo.
- **Teste independente:** clicar no cabeçalho Situação em /duplas — a
  lista reordena por semáforo, a URL reflete `?ordem=` e o terceiro
  clique volta ao radar.

Cenários:

1. **Dado** a visão coordenação/supervisor **quando** a coluna Situação é
   clicada **então** ordena por severidade (apoio/risco primeiro),
   segundo clique inverte e terceiro volta ao default.
2. **Dado** a ordenação por situação **quando** ativa **então** a URL
   carrega `?ordem=situacao` (ou equivalente serializado) — recarregar e
   compartilhar preservam.
3. **Dado** ordenação explícita ativa **quando** a lista renderiza
   **então** o colapso da massa saudável se desliga — regra já vigente
   para as demais ordens.
4. **Dado** a visão do mentor **quando** avaliada **então** fica como
   está — já ordenada por situação por construção; o controle é staff.

### US9 — Fila de pareamento descobrível e acionável (P2)

**Estado atual:** a única superfície de pareamento é um card **fechado
por padrão** dentro de /pessoas (`fila-espera.tsx:106-108`, montado em
`pessoas-listas.tsx:1196-1210`) — nenhum caminho a partir de /duplas; o
contador mistura mentorados + mentores (`:103,318-319`). Sem busca nem
filtro de turma; no modo Parear o "há N dias" some (`:259-262`); "parear"
é botão-ícone ghost (`:769-779`) e "Formar dupla" só habilita no fim de
3 gestos. Dores completas mapeadas no plan.

- **Por que P2:** pareamento é o ato central da coordenação e hoje está
  atrás de um card fechado; é reforma de superfície, sem mexer em
  matching/RLS.
- **Teste independente:** coord com fila não vazia abre /pessoas — vê
  quantos esperam sem expandir nada e chega em "Formar dupla" com a
  espera visível na decisão.

Cenários:

1. **Dado** fila não vazia **quando** /pessoas abre **então** a
   contagem distingue os dois lados ("3 mentorados · 2 mentores com
   vaga") e há chamada de entrada — card aberto por padrão quando há
   espera, ou link/badge a partir de /duplas.
2. **Dado** o modo Parear **quando** o coord escolhe um lado **então**
   a espera ("há N dias") segue visível no candidato e a lista ordena
   por espera antes do alfabético.
3. **Dado** fila longa ou várias turmas **quando** o coord filtra
   **então** há busca por nome e recorte por turma dentro do card.
4. **Dado** um par completo selecionado **quando** a revisão mostra
   **então** "Formar dupla" é a ação primária sempre visível (label,
   não ícone), com afinidade do par junto.
5. **Dado** colunas em mobile **quando** a tela estreita **então**
   mentorados e mentores empilham com ordem clara e a seleção persiste.
6. **Dado** seleção no modo Parear **quando** os efeitos rodam **então**
   o carregamento cobre a decisão toda (sugestões + afinidade), não só
   um bloco.

### US10 — Olho da Liza responsivo por container (P2)

**Estado atual:** `LizaBlob` recebe `tamanho` em px literal por call site
(`liza-blob.tsx:424`, `tipos.ts:19`); a única decisão responsiva é
`matchMedia("(min-width: 768px)")` de viewport no FAB
(`assistente-bolha.tsx:483-487,1040-1044` — 44px no desktop, 48 no
mobile). Os internos do desenho (`detalhe`, `kOlho`, `ciliosMini`,
`px2u`) consomem o número — escala CSS pura quebraria as proporções. O
painel é redimensionável (352-960px) e o mascote não acompanha.

- **Por que P2:** o rosto é a interface emocional do app; o fix correto é
  estrutural (medir o slot, não a viewport) e a convenção da casa já manda
  responder a container, não a tela.
- **Teste independente:** redimensionar o painel do assistente no desktop
  — a mascote do empty state escala com o painel; o FAB não depende de
  media query.

Cenários:

1. **Dado** o FAB do assistente **quando** renderiza **então** o tamanho
   do blob deriva do tamanho real do botão — `matchMedia` de viewport
   removido dessa decisão.
2. **Dado** o empty state do painel **quando** o usuário redimensiona o
   painel **então** a mascote acompanha a largura disponível dentro de
   limites sãos (mín/máx definidos).
3. **Dado** qualquer tamanho medido **quando** o blob desenha **então**
   as proporções internas (olho, cílios, detalhe) seguem corretas — a
   medida alimenta `tamanho`, não transforma o SVG.
4. **Dado** SSR/primeiro frame **quando** a medida ainda não existe
   **então** um fallback sensato renderiza sem flash de tamanho errado.

### US11 — Registrar mais de um encontro sem fricção (P2, spec-only)

**Estado atual:** `encontros` é uma linha por passo do guia
(`unique(dupla_id, numero)`, `0001_init.sql:67-79`) e `registros` é 1:1
(`encontro_id unique`, `:82-93`); avaliação do jovem idem (`0071`).
"Duas sessões na mesma semana" já funciona porque o unique é por nº, não
por data; pós-save já existe o encadeado "Registrar o Nº também"
(`registro-form.tsx:1334-1348`). Não existe: registro em lote, um registro
cobrindo vários nºs, ou encontro fora da régua do guia — `numero` ancora
materiais, notas, intenções e combinados.

- **Por que P2:** dor real de operação (dupla que se encontrou mais de
  uma vez, ou cobriu dois passos numa sessão) com caminho já ensaiado
  pelo encadeado; a parte de modelo (encontro avulso) fica spec-only até
  decisão — ver plan.
- **Teste independente:** dupla com 2+ encontros pendentes de registro —
  o mentor registra todos num fluxo só, sem voltar à ficha entre eles.

Cenários:

1. **Dado** 2+ encontros realizados sem registro **quando** o mentor
   termina um registro **então** o fluxo oferece o próximo pendente já
   em sequência (generaliza o "Registrar o Nº também" existente), até
   zerar a fila.
2. **Dado** uma sessão que cobriu dois passos do guia **quando** o mentor
   marca "cobriu mais de um encontro" **então** ele escolhe os nºs
   cobertos e o servidor grava um encontro+registro por nº — nunca um
   registro único reescrito para dois nºs.
3. **Dado** um encontro fora da régua (sessão avulsa, sem nº do guia)
   **quando** o produto decidir pela modelagem do plan **então** o
   registro avulso existe sem colidir com `numero` nem com materiais —
   spec-only, decisão registrada.
4. **Dado** retroativo em lote **quando** validado **então** as mesmas
   réguas vigentes valem (nº do guia da dupla, data passada, realizado
   é fato terminal) — a flexibilidade não afrouxa o domínio.
5. **Dado** a avaliação do jovem **quando** um encontro extra é criado
   pelo fluxo **então** o link de avaliação nasce como hoje (trigger do
   realizado) — nada de avaliação órfã.

### US12 — Feedback de terceiros com lançamento manual do mentor (P2, spec-only)

**Estado atual:** o domínio existe completo (`0103`): mentor cadastra o
contato, o terceiro responde por link público `/t/[token]`, a resposta
(`terceiros_respostas`) é imutável e só entra pela RPC pública; o mentor
lê identificado e publica síntese anônima. Não há canal para o mentor
lançar uma resposta recebida por fora (telefone, papel) — nem policy de
INSERT nem coluna de proveniência. O painel vive na aba Instrumentos da
ficha (`terceiros-dupla.tsx`, montado em `page.tsx:1407-1419`).

- **Por que P2:** o pedido ("opção manual pelo mentor") reusa um fluxo
  fechado e bem resolvido — precisa de um write-path novo com
  proveniência, não de domínio novo.
- **Teste independente:** mentor lança feedback ditado por telefone —
  aparece identificado na ficha com marca de origem e entra na
  consolidação normalmente.

Cenários:

1. **Dado** um contato pendente ou um nome novo **quando** o mentor
   escolhe "Registrar resposta" **então** ele digita pontos fortes e a
   melhorar e a resposta grava com proveniência ("registrado por
   {mentor}"), distinguível das recebidas por link.
2. **Dado** uma resposta lançada manualmente **quando** exibida **então**
   indica origem na leitura identificada — a consolidação do mentor não
   a trata como se o terceiro tivesse escrito.
3. **Dado** o lançamento manual **quando** avaliado contra o link
   **então** o convite do contato não é consumido (se houver) — os dois
   caminhos convivem sem que um apague o outro; regra de um-por-contato
   explícita no plan.
4. **Dado** resposta manual lançada **quando** a consolidação publica
   **então** o jovem segue lendo só a síntese — a linha de privacidade
   da 0103 é preservada.
5. **Dado** o card nos instrumentos do mentor **quando** há respostas de
   terceiros **então** o contador/estado aparece também na área de
   instrumentos do mentor, não só na ficha (decisão de superfície no
   plan).
6. **Dado** papel não autorizado (jovem, especialista, mentor de outra
   dupla) **quando** tenta lançar **então** é negado no banco — RPC
   `security definer` com gate, nunca só na tela.

### US13 — Mentor edita o PDM do jovem com autoria registrada (P2, spec-only)

**Estado atual:** respostas de formulário são evidência imutável
(REALIZA-435 — correção é reemitir, `formulario_respostas` sem caminho de
update). Exceção já viva: o **PDM nativo** (`0109`) é documento
co-editável — `pdm_pode_editar` inclui o mentor e as RPCs `pdm_salvar_*`
gravam via definer; a projeção das respostas visao/metas alimenta o doc
sem sobrescrever itens manuais (`origem='manual'`). Não existe coluna de
"editado por/atualizado por" — `created_by` só carimba a criação.

- **Por que P2:** a decisão do brief ("só o que faz sentido — PDM e
  correlatos") já tem a base certa: o documento vivo co-editável existe;
  falta autoria e transparência. Não abre edição de resposta — muda só o
  PDM.
- **Teste independente:** mentor ajusta uma meta do PDM — a ficha mostra
  quem editou por último e a resposta original do instrumento permanece
  intacta.

Cenários:

1. **Dado** o PDM de uma dupla viva **quando** o mentor edita visão ou
   item **então** grava `atualizado_por`/`atualizado_em` (ou equivalente)
   — a autoria da última escrita é consultável.
2. **Dado** um item editado pelo mentor **quando** o jovem ou a ficha lê
   **então** a marca de autoria aparece de forma honesta (ex.: "editado
   pelo mentor") — decisão de visibilidade por superfície no plan.
3. **Dado** a resposta original do instrumento que projetou o item
   **quando** o item é editado **então** o snapshot permanece — a
   projeção nunca reescreve edição manual e a edição nunca altera a
   resposta.
4. **Dado** dupla encerrada ou mentor de outra dupla **quando** tenta
   escrever **então** `pdm_pode_editar` nega no banco — a RPC segue a
   única porta de escrita.
5. **Dado** "correlatos" ao PDM **quando** o escopo é listado **então**
   ficam dentro dos artefatos vivos (pdm, pdm_itens e o que o plan
   nomear) — `formulario_respostas` segue intocável.

### US14 — Digest semanal configurável (P3, spec-only)

**Estado atual:** tudo fixo no código — frequência `SEGUNDA` hardcoded
(`jobs-digest.ts:16,31`), destinatários = `profile_papeis
'coordenacao'` (`digest.ts:155-159`), conteúdo = 3 seções fixas
(`digest.ts:68-126`). Sem tabela de config, opt-out ou env dedicada. O
job já roda no tick diário com dedup por semana (`jobs-digest.ts:38-48`)
e existe disparo manual coord-only (`actions-email.ts:899-933`).

- **Por que P3:** melhoria operacional real mas não urgente; exige schema
  novo — boa candidata a spec-only até a janela de migration.
- **Teste independente:** mudar a config no staging — o próximo job
  respeita dia, destinatários e seções configuradas.

Cenários:

1. **Dado** a config padrão (sem row ou defaults) **quando** o job roda
   **então** comportamento idêntico ao atual — configuração é opt-in.
2. **Dado** frequência configurada (dia da semana/cadência) **quando**
   o tick roda **então** o guard do job honra a config, não a constante.
3. **Dado** destinatários configurados (pessoas, papéis ou e-mails
   explícitos) **quando** o digest monta **então** o envelope sai para a
   lista configurada — coord segue recebendo por padrão.
4. **Dado** seções ligadas/desligadas na config **quando** o corpo monta
   **então** só as seções ativas aparecem.
5. **Dado** a UI de configuração **quando** avaliada **então** mora junto
   do disparo manual em relatórios operacionais, coord-only — mesma
   fronteira de papel do botão existente.
6. **Dado** dedup e ledger **quando** o job dispara **então** seguem
   gravando `emails_enviados` — configuração nunca envia duas vezes na
   mesma semana.

## Casos de borda

- **Ler tudo:** texto na fronteira exata das 3 linhas; `conduzir` com
  quebras de linha explícitas; card muito estreito (mobile pequeno) onde
  até textos curtos passam de 3 linhas — a regra é "trunca quando não
  cabe", não "existe toggle acima de N chars".
- **Indicador lido:** demo (cookie + baseline), item "em breve" sem link,
  material refeito com mesmo `ref`.
- **Seletor de mentorado:** mentor com 1 dupla (seletor vira redundância
  honesta ou auto-seleciona — definir); dupla pausada segue listada com
  estado; especialista nunca vê a aba.
- **Ver resposta:** resposta ausente, dupla sem entrega emitida, lazy
  falhando (estado de erro do gatilho).
- **ViaCEP:** CEP de cidade única (sem logradouro/bairro), resposta
  tardia após editar o CEP, serviço fora — cenários da spec 005 seguem
  valendo e não regridem.
- **/duplas:** `?ordem=` legado ("az"/"za") continua parseando; chips de
  situação + ordenação por situação juntos (filtro dentro da ordem).
- **Fila:** zero candidatos de um lado; mentor cheio selecionado (aviso +
  dialog de capacidade seguem); dupla criada por outro caminho enquanto a
  tela está aberta.
- **Registros:** dois passos cobertos numa sessão com um deles já
  registrado (nunca duplica); `realizado` terminal — lote não edita
  encontro selado; trilha especialista (`numero` = tentativa) fica fora
  do fluxo de "cobriu mais de um passo".
- **Terceiros manual:** contato respondido por link E lançado depois
  (regra explícita); resposta manual depois da consolidação publicada
  (entra na próxima curadoria ou exige despublicar — decidir); cap de 9
  contatos vale para lançamentos manuais com contato novo.
- **PDM:** item oriundo de instrumento editado pelo mentor perde ou mantém
  `origem_campo` (decidir); visão projetada de resposta antiga × edição
  manual nova (ordem de escrita vence).
- **Digest:** config inválida (dia fora de faixa, e-mail malformado) —
  job cai no default, nunca envia errado; staging recebe só com
  `EMAIL_ENVIO_LIBERADO` consciente.

## Requisitos funcionais

- **FR-001 (US1):** o truncamento do "Como conduzir" é decidido por
  linhas renderizadas (ou garantido estruturalmente), nunca por contagem
  de caracteres; fechado mostra prévia real, aberto cresce in-place com o
  controle ao fim.
- **FR-002 (US2):** material lido se distingue no item inteiro
  (opacidade da linha/título ou sublinhado), mantendo nome acessível com
  "lido" e rótulo textual ou estado — nunca só ícone, só cor ou só selo
  de meta.
- **FR-003 (US3):** as abas de /materiais renderizam Biblioteca primeiro
  para todos os papéis; o default por papel se mantém (mentor→Biblioteca,
  staff com painel→Instrumentos).
- **FR-004 (US3):** a área de instrumentos do mentor ganha seletor de
  mentorado: botões nomeados até o limiar definido (sugestão 3) e
  dropdown acima; seleção persistida na URL.
- **FR-005 (US4):** o gatilho de resposta vira ação de peso (Button do
  kit + ícone), alterna "Ver resposta"↔"Fechar resposta" com
  `aria-expanded` correto, e a expansão anima dentro do guard global de
  movimento.
- **FR-006 (US5):** a leitura da Visão distingue número (marcador
  amarelo), pergunta (verde, semibold) e resposta (corpo foreground),
  seguindo a convenção "amarelo é marcador, nunca cor de texto".
- **FR-007 (US6):** nenhum texto fixo em repouso sob o campo CEP; estados
  de busca seguem anunciados por `aria-live`.
- **FR-008 (US6):** em modo `compacto`, o autofill alimenta também os
  campos simples cidade/UF do formulário hospedeiro, que seguem
  editáveis.
- **FR-009 (US7):** todo gráfico com escala cor→significado exibe
  legenda textual visível próxima; `BarraSegmentada` multi-categoria
  sempre com `legenda` ou equivalente.
- **FR-010 (US8):** a coluna Situação de /duplas é ordenável no padrão
  das demais (ciclo asc→desc→default, estado em `?ordem=`), nas visões
  coordenação e supervisor.
- **FR-011 (US9):** a fila de pareamento mostra contagem separada dos
  dois lados sem expandir, espera visível no modo Parear, busca e recorte
  por turma, e "Formar dupla" como ação primária rotulada.
- **FR-012 (US10):** o tamanho da Liza deriva do container renderizado
  (medida real do slot alimentando `tamanho`), sem `matchMedia` de
  viewport e com fallback de primeiro frame.
- **FR-013 (US11):** o mentor registra encontros pendentes em sequência
  contínua; a opção "cobriu mais de um encontro" grava um par
  encontro+registro por nº escolhido — sempre dentro das réguas vigentes.
- **FR-014 (US12):** o mentor lança resposta de terceiros por write-path
  com proveniência (`registrado_por`), aparecendo identificado com marca
  de origem na ficha e contabilizando na área de instrumentos; o jovem
  segue lendo só a síntese.
- **FR-015 (US13):** escrita do mentor no PDM registra autor da última
  edição, visível na leitura; respostas de instrumento permanecem
  imutáveis.
- **FR-016 (US14):** frequência, destinatários e seções do digest semanal
  são configuráveis; ausência de config preserva o comportamento atual;
  dedup e ledger inalterados.

## Requisitos não funcionais

- **RLS:** US12 exige RPC `security definer` nova (mentor da própria
  dupla DPP); US13 reusa `pdm_pode_editar` + colunas de auditoria
  (migration); US14 exige tabela de config com policy coord-only.
  US1–US10: nenhuma policy nova. Caso e2e do papel negado para cada
  write-path novo (A2).
- **Auth:** nenhuma rota pública nova; `/t/*` e `/f/*` intocados.
- **LGPD:** resposta manual de terceiros é dado pessoal de terceiro —
  conferir/atualizar `docs/lgpd/inventario-dados.md`; remoção do hint do
  CEP não retira ViaCEP da lista de operadores (`base-legal.md`).
- **Demo:** indicador de leitura, seletor de mentorado, "Ver resposta"
  animado e ordenação por situação precisam de paridade em `/demo`
  (dataset `demo` + bloqueio de mutação); o lançamento manual e a edição
  do PDM mostram-se como `DEMO_MSG`.
- **A11y/movimento:** expansões animadas respeitam o guard global de
  `prefers-reduced-motion` (sem media query local); `aria-expanded` nos
  toggles; legenda de gráfico paritária com `aria-label`; piso de 12px
  de texto informativo no mobile (micro-label de gráfico segue a exceção
  nomeada).
- **Copy:** pt-BR sem travessão em texto exibido, sem jargão interno;
  "editado pelo mentor"/"registrado por" como microcopy consistente.

## Entidades e dados

- **US11:** possível `encontros` avulso — alternativas e impacto no
  plan; `unique(dupla_id,numero)` e âncora dos satélites são o limite.
- **US12:** `terceiros_respostas` + proveniência (coluna ou tabela-irmã);
  `terceiros_contatos` pode nascer implícito pelo lançamento; imutável
  como as demais.
- **US13:** `pdm`/`pdm_itens` + colunas de auditoria de edição;
  `origem`/`origem_campo` coexistem com autoria.
- **US14:** config do digest (entidade única ou por escopo) — dia,
  cadência, destinatários, seções; fora do escopo de profiles.

## Critérios de sucesso

- **SC-001:** em desktop largo, "Ler tudo" trunca de verdade e expande
  in-place — medido em encontro com `conduzir` entre 290 e 585 chars.
- **SC-002:** o mentor chega à resposta de uma dupla em ≤2 cliques a
  partir da aba Instrumentos, com gatilho rotulado e estado óbvio.
- **SC-003:** nenhuma escala de cor de avaliação/status aparece sem
  legenda na ficha da dupla nem na home de coordenação.
- **SC-004:** registrar dois encontros pendentes não exige voltar à
  ficha entre um e outro.
- **SC-005:** feedback recebido por fora entra na ficha com origem
  marcada e aparece na área de instrumentos do mentor.
- **SC-006:** a config do digest muda o próximo envio sem deploy.

## Premissas

- "Muitos mentorados" é >2-3 na prática (capacidade default 1) — limiar
  do dropdown resolvido em 3, revisável com dado real de capacidade.
- O pedido ViaCEP partiu de visão anterior ("hoje só
  assinatura/dialogs"); a auditoria mostra cobertura total — a spec trata
  o gap real (texto idle + compacto→cidade/UF) e registra o achado.
- "Resposta" do US4 é a do instrumento na página `[chave]` e na ficha;
  a "Ver resposta" de avaliação de encontro (`jovem-avaliacoes`) segue o
  mesmo padrão se a unificação for aprovada.
- Encontro avulso (US11, cenário 3) é decisão de produto aberta — a spec
  propõe o desenho no plan e o item pode entregar só a fatia de lote sem
  ele.
