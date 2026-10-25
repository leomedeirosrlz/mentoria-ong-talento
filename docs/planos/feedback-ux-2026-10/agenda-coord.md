# Feedback — /agenda (visão coord, abas Monitoramento e Calendário)

Telas: `src/components/agenda-coordenacao.tsx` (aba Monitoramento) +
`src/components/agenda-calendario.tsx` (aba Calendário, visão "Lista" —
screenshot da cobertura do ciclo).

## Itens do feedback

1. **Barra de cobertura mentirosa** — "mostra 4/10 e o gráfico com linha
   completa". Na visão Lista, `ResumoEncontrosDupla` desenha os segmentos
   como fração de `itens.length` (só duplas que TÊM row de encontro), mas o
   número ao lado é `realizaram/total` de TODAS as duplas ativas —
   denominadores diferentes. A barra de 4/10 enche ~90% e lê como "quase
   tudo feito".
2. **"Semana do programa" deveria ficar acima, servindo de guia, como cards
   bonitos e visuais — nas DUAS abas** — ✅ decidido: tanto na aba
   Monitoramento (hoje é a 3ª seção, depois da síntese e de "Para
   acompanhar") quanto na aba Calendário/Lista (o screenshot era dela).
   Em ambas, cards visuais no topo, orientando a leitura da tela — o que
   o calendário oficial pede essa semana antes do detalhe operacional.

   **Ampliação (revisão do v7)**: o Thiago elevou o patamar — a aba
   **Monitoramento deve ser uma dashboard visual, interativa,
   profissional e clara** (não só seções de lista); a aba **Agenda/
   Calendário consolida as mesmas informações por janela temporal**
   (semanal, mensal, ciclo). Spec = `docs/mockups/agenda/v8.html`
   (v7 aprovado parcialmente: cards da semana + barra honesta ficam;
   o que muda é o patamar de dashboard da Monitoramento e a consolidação
   por janela na Lista).

   **Correções do v8 (revisão v8b)**:
   - Cards "Semana do programa" **ficaram feios** — problemas concretos
     do screenshot: ~60% de espaço morto embaixo, faixa lateral de data
     larga e vazia, texto "O que o encontro cobre · como conduzir"
     **duplicado** (heading repetido), blocos de prosa longos inline.
     Redesenhar: badge de data compacto, "o que cobre/como conduzir"
     atrás de `<details>`/teaser curto (não prosa inline), alturas
     consistentes, sem fundo morto.
   - **Gráficos acima do painel da semana**: a linha de viz (cobertura +
     semáforo + pulso) sobe ANTES da seção "Painel da semana"/"Para
     acompanhar" — dashboard lê os números primeiro, ação depois.

   **Decisões finais da faixa "Semana do programa"**:
   - **Escala: scroll lateral sempre** — mesma regra do mobile no
     desktop (~4-5 cards visíveis + fade na borda + scroll-snap),
     nunca espremer tudo numa linha só.
   - **Componente compartilhado entre personas** — a faixa vira
     "próximas programações" por papel: coord/aux = semana operacional
     do programa (como no mock); **mentor** = mesma faixa na agenda
     dele, filtrada pros encontros das duplas dele + formações/roda
     que ele participa — "o que vem pra você essa semana". Jovem não
     recebe (a jornada já cobre próximo encontro + materiais).
     Um componente, conteúdo adaptado por papel.

   **Correção decisiva (review do v8b)**: a janela **"Mês" da aba
   Agenda NÃO é a lista agregada do mock** — é a **grade de calendário
   mensal já implementada** (`agenda-calendario.tsx`, 4.8k linhas),
   preservada. Usuário clica no dia → detalhe lateral (já é coluna
   sticky ≥lg) com os eventos/ações daquele dia (marcar/remarcar
   encontro, registrar retroativo, chamada, materiais). Semana e
   Ciclo (consolidações novas do v8b) ficam em volta — Mês = calendário
   real.

   **Regressões a mapear e preservar** (`agenda-calendario.tsx`):
   grade mensal com eventos oficiais + encontros das duplas por dia;
   split de disponibilidade mentor×mentorado na célula; seleção de dia
   por clique/teclado + detalhe lateral sticky (desktop) / abaixo da
   dobra (mobile); dialogs AgendarEncontro/EditarLink/
   RegistrarRetroativo/EncontroDetalhe; "Materiais do encontro" por
   `encontro_num`; chamada de formação no dia; seletor de cronograma
   (T1/T2); legenda de buckets (realizado/registro pendente/agendado/
   não aconteceu/sem data); `chamadaHoje`. Tudo isso continua
   funcionando depois do redesign — specs cobrem.

## Direção

### Cobertura do ciclo (visão Lista)

- **Um denominador só**: a barra e o número usam o mesmo total (duplas
  ativas do cronograma do evento). Segmentos possíveis: realizou (ok) /
  registro pendente (warn) / agendado (neutro-anel) / não aconteceu /
  **sem data** (vazio de fundo — hoje invisível porque não tem row).
- Ou, alternativa mínima: barra = só "realizaram/total" (a fração do
  número) com o detalhe segmentado indo pro detalhe do dia (que já existe
  na visão Semana).
- A linha "N/M" fica ao lado da barra — o olho tem que ler a mesma
  proporção nos dois.

### Semana do programa no topo (Monitoramento + Lista)

- Reordenar as seções da aba Monitoramento: **Semana no programa**
  primeiro (é o contexto — "o que o calendário pede essa semana"), depois
  "Para acompanhar" (a fila de ação), depois "Semana do encontro por
  cronograma".
- Na aba Calendário→Lista: a mesma faixa de cards da semana aparece
  acima da lista de cobertura — um componente só, duas montagens.
- As linhas `LinhaPrograma` viram cards visuais: data em destaque (bloco
  dia+mês), título do evento, tipo como pill colorido (encontro/formação/
  roda de conversa/etapa), etiqueta "hoje"/"semana" — mais card de agenda
  do que linha de tabela. Referência visual: cards de turma (`turmas.md`)
  e o banner do perfil — mesma linguagem.
- Bônus amarrado (`como-conduzir.md`): o card do encontro da semana pode
  carregar a entrada "o que trata / como conduzir" — fácil acesso pedido.

## Critérios de aceite

- [ ] Visão Lista da agenda coord: para cada encontro, a proporção visual
      da barra corresponde ao número "N/M" ao lado (ex.: 4/10 = ~40%
      preenchido, não ~90%). Verificar com seed real (staging): barra de
      encontro passado 4/10 lê <50%.
- [ ] Duplas sem encontro agendado aparecem na barra como segmento vazio/
      neutro OU a legenda deixa o furo explícito ("3 sem data").
- [ ] "Semana no programa" é a 1ª seção de conteúdo da aba Monitoramento
      (ordem no DOM antes de "Para acompanhar") E aparece acima da lista
      na aba Calendário→Lista — mesmo componente, duas montagens.
- [ ] Os itens da semana renderizam como cards (não rows divididas):
      grid/carrossel com bloco de data em destaque; mobile 390px sem
      overflow horizontal; pill de tipo com cor por tipo de evento.
- [ ] Chamada da formação continua aparecendo só no dia certo
      (`chamadaHoje` preservado).
- [ ] tsc/eslint limpos; `agenda-coordenacao.spec.ts` e specs de lista da
      agenda verdes (atualizar asserts de estrutura/ordem).

## Mapa de regressões e gaps (review out/2026)

Review do plano contra o código atual — o que existe, o que o redesign
pode quebrar e o que ainda não está decidido. Nada aqui substitui as
decisões acima; é o mapa de preservação.

### Estado atual mapeado

**Roteamento** — `src/app/(app)/agenda/page.tsx` (590 linhas) decide tudo
server-side:

- Params: `?dia=` (validado `^\d{4}-\d{2}-\d{2}$`, linha 58), `?visao=`
  (só `dpp`/`especialista`, híbridos), `?aba=` (modos internos).
- Queries sempre executadas: `getCicloEventos`/`getMe`/`getDuplas`/
  `getCronogramas` (68–71); `cronogramaVigente` (79) e
  `eventoDaSemana(eventosVigente)` (83) viram a prop `semanaId`.
- `?dia=` sem `?aba=` força `aba="calendario"` (203–206) — é o deep-link
  usado por LinhaResumo, "Abrir chamada", strip do mentor e links da
  ficha/home.
- Ramos por papel: mentor DPP (`souMentor && aba!=="calendario"`, 217)
  busca `getSupervisoesDaPessoa` + extras por aba e renderiza
  `AbasAgendaMentor` (Minha agenda | Por mentorado | Calendário) +
  `AgendaMinha`/`AgendaPorMentorado`; supervisor → `AgendaAuxiliar` (329)
  com só as supervisionadas (`d.supervisor?.id === me.id`), com guard
  que preserva `?aba=calendario`/`?dia=` pro híbrido supervisor+mentor
  (312–318); coordenação → `AgendaCoordenacao` quando `diaInicial==null`
  (350–380).
- Ramo calendário (382+): `getMateriais` (386) e `getEspecialistaEventos`
  (388) são tardios; `getMentoresChamada`+`getPresencas` só rodam pra
  coordenação (407). `AgendaCalendario` recebe `eventos`, `cronogramas`,
  `espEventos`, `materiaisVisiveis`, `hoje`, `semanaId`, `diaInicial`,
  `duplas`, `role`, `papeis`, `mentores`, `presencas`,
  `mentorDisponibilidade` (426+).

**`AgendaCalendario`** (`src/components/agenda-calendario.tsx`, 4788
linhas, `"use client"`):

- **Janela de dados**: derivada dos eventos datados do cronograma
  selecionado — `minMes`/`maxMes`/`minDia`/`maxDia` (827–835). Evento sem
  `data` não abre mês/semana; etapa de preparação concluída sem data vive
  só no painel "Etapas de preparação" (1399–1411, render 1850–1861).
- **Cronograma T1/T2**: `cronogramaSel` (657, inicializado por
  `semanaId`), `eventosSel` filtrados (669–672), e ao trocar o select o
  estado mês/semana/dia é **re-clampado** aos bounds do novo cronograma
  via compare na render (`cronAnterior`, 932–958). `itensPorNumero`
  assume cronograma único — o comentário em 1431 registra que a união de
  cronogramas faria números colidirem (enc. 5 da T1 × enc. 5 da T2).
- **Visões**: union `"dia" | "semana" | "mes" | "lista" | "horarios"`
  (867), sanitizada por papel em `visaoEfetiva` (~880–897): coord/sup
  têm dia|semana|mes|lista (default `semana`; `?dia=` → `mes`); mentor
  tem dia|mes|semana|horarios (default `mes`; `lista` sanitiza pra
  `mes`); demais papéis ficam em `mes`.
- **Grade mensal** (visão `mes`): `role="grid"` 7 colunas com
  `aria-labelledby="agenda-mes-rotulo"` (2118, 2270), `role="row"`/
  `gridcell`, botões de dia com `aria-pressed`/`aria-current` e label
  composto (eventos + semana + resumo de duplas + disponibilidade).
  Roving tabindex real: `refsDias` Map (961–967, populado em 2356),
  `focoPendente`, setas ±1/±7 + Home/End.
- **Seleção de dia**: `selecionado` + `direcao`; ponteiro no mobile
  dispara `scrollIntoView` pro painel (981–994, `behavior:
  reduz ? "auto" : "smooth"`); ≥lg não rola porque o detalhe é a coluna
  lateral `lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]
  lg:overflow-y-auto` (2897) dentro de `lg:grid-cols-[minmax(0,1fr)
  _minmax(300px,340px)]` (1845). No mobile o detalhe fica abaixo da
  dobra — comportamento intencional.
- **Overlay de disponibilidade** (só mentor DPP — a prop
  `mentorDisponibilidade` é `undefined` pros demais): tinta mentor
  `bg-[var(--ok)]/8`, mentorado `bg-[var(--role-mentorado)]/16`, ambos =
  gradiente diagonal `color-mix`, por célula do grid e da grade semanal
  do mentor.
- **Buckets/legenda**: `bucketsDoEncontro` + `ResumoEncontrosDupla` (431)
  + `LegendaEncontrosDupla` (458) com ok/warn/agendado/apagado;
  `LegendaAgenda` (3828) cobre encontro/recesso/hoje + chave de dots +
  chave de disponibilidade condicional.
- **Visão `semana` coord/sup**: board do `oficialSemana` do cronograma
  selecionado — `itensBoard` via `itensPorNumero` (1467–1480), resumo
  "X de Y", `BucketsEncontros` (3716) por categoria e "Sem o Nº encontro
  marcado" (`LinhaSemEncontro`, 3783).
- **Visão `lista` coord/sup**: "Cobertura do ciclo" (2752+) — uma linha
  por evento na `ordem` do cronograma, barra + "N/M" (2752–2869). É a
  tela do screenshot do item 1.
- **Visão `dia`**: `corpoDetalheDia` promovido full-width (2584, nota
  2892).
- **Visões do mentor**: `SemanaMentor` (4092, grade seg–dom com blocos +
  tinta, clique seleciona o dia) e `HorariosMentor` (4350, grade horária
  com snap 30min, menu "Agendar/Remarcar com X" alimentando
  `AgendarEncontroDialog` controlado).
- **Detalhe do dia** (`corpoDetalheDia`, 1550+): "Disponível neste dia"
  (mentor), lista/buckets das duplas, `NotaEncontro`, "Sem o Nº
  encontro", eventos do dia com fase/`data_fim`/observação/
  instrumentos, `MaterialDoEncontro` por `encontro_num` (3631),
  `ChamadaFormacao` (só `ehCoord` && tipo `formacao` && evento do dia),
  `CoberturaEncontro`, `AcaoDiaMentor` (3098) por dupla ativa.
- **Dialogs importados** (topo do arquivo): `AgendarEncontroDialog`
  (agendar/remarcar/desmarcar, retroativo quando a data é passada, modo
  controlado pra grade de horários), `EditarLinkDialog`,
  `RegistrarRetroativoDialog`, `EncontroDetalheDialog` (coord/sup,
  read-only com anexos lazy + `ResolverApoioButton`), além do
  `RegistroForm` em dialog inline (`registroAberto`).
- **Rail "Encontros da jornada"** (nav 2163): discos 1..N com cobertura
  falada no aria-label via `resumoSemanaDe` (2181) — já é quase a
  "linha do tempo" do mock.
- **Exclusões intencionais**: trilha especialista fora dos denominadores
  oficiais (`oficiaisPorCron`/`passosDppPorCron` × `passosEspPorNumero`,
  footer "fora do calendário oficial" 2882); "Todos os eventos de {mês}"
  só renderiza pra `!ehCoordSup` na visão `mes` (2945).

**Monitoramento** (`agenda-coordenacao.tsx`, 412 linhas): derivações
66–84 (`resumosPorCronograma`, `paraAcompanhar`, `itensDaSemanaPrograma`,
`sinteseMonitoramento`); ordem real no DOM: síntese `p role="note"
aria-label="Síntese do monitoramento"` (~162, condicional à fila viva)
→ `section[aria-label="Duplas para acompanhar"]` (217) →
`section[aria-label="Semana no programa"]` (240) → `section[aria-label=
"Semana do encontro por cronograma"]` (256). `LinhaPrograma` (376) é
row, não card; `chamadaHoje` = `tipo==="formacao" && diaKey===hoje`
(379) e renderiza **link** "Abrir chamada" pra
`/agenda?aba=calendario&dia=` (398). `LinhaResumo` (302) linka pro dia do
evento vigente e expõe `role="progressbar"` com aria-label "T1: X
realizaram, Y agendadas, Z sem agendamento" (357).

**`lib/agenda-coordenacao.ts`**: `resumosPorCronograma` (160) — um card
por cronograma **ativo**, ativas excluem `trilha==="especialista"`
(173–178), `semAgendamento = ativas - realizaram - agendadas` (203);
`paraAcompanhar` (374) — união `sem_data` (via
`duplasSemEncontroDoNumero(..., incluirNovas)`) + sinais do semáforo +
`encerramento` (459–486), ordena `ORDEM_SEMAFORO`; `dimensoesDoItem`
(514) — danger só na dimensão acompanhamento; `sinteseMonitoramento`
(591) — `semData = Σ semAgendamento` (mesmo denominador das linhas),
`apoioAberto` conta **todas** as duplas vivas (610); `ItemPrograma` +
`itensDaSemanaPrograma` (618–707) — semana seg–dom de `semanaBounds`,
só cronogramas ativos (657), tipos `encontro_oficial|formacao|evento|
supervisao`, supervisões da equipe entram com data na semana. O tipo
**não** carrega turma-pill estruturada, instrumentos, tema do guia ou
"como conduzir".

**Mentor** (`agenda-minha.tsx` + `lib/agenda-minha.ts`): `AgendaMinha`
com chips de escopo ("Tudo"/"Eu", 542–563) e seções `hoje|amanha|
proximos` (`secoesDaAgenda`, lib 733–772) + rail "Esta semana"/"Suas
duplas". **Não existe faixa "Semana do programa"** pra ele hoje — o que
existe é `AgendaSuaSemana` (componente separado, strip de 7 células)
só na aba "Por mentorado", com links `?aba=calendario&dia=` que
preservam `&visao=dpp` quando híbrido.

**Auxiliar** (`agenda-auxiliar.tsx`): escopo = supervisionadas; abas
"Por turma"/"Consolidada" (`?aba=consolidada`); cards com
`LembreteButton` + "Registrar supervisão" + "Ver ficha"; consolidada
mistura encontros de dupla, supervisões próprias, sessões esp ("só
acompanhamento") e oficiais; "Sem encontro agendado (N)" como warnbox.
Denominadores são sempre do recorte supervisionado — não existe
agregado de coorte aqui.

**Contratos de DOM/a11y que os specs prendem** (`tests/e2e/**/agenda*`):
`tablist[aria-label="Modos da agenda"]` com `role="tab"` +
`aria-selected` (a externa do híbrido usa "Visão da agenda"); radios
`name="agenda-visao"` sr-only clicados via label; `section[aria-label]`
dos três blocos do monitoramento, com a **primeira** sendo "Duplas para
acompanhar" (demo `agenda-coordenacao.spec.ts` 84–94, app 127–137);
`p[aria-label="Síntese do monitoramento"]`; `progressbar` aria-label
por turma; `nav` "Encontros da jornada"; `region` "Grade da semana —
role horizontalmente"; botões "Próxima semana"/"Mês anterior"/"Hoje"/
"Agendar encontro na …"; tabs do mentor ("Minha agenda"/"Por
mentorado"/"Calendário", demo `agenda-dpp.spec.ts` 39–48) e do auxiliar
("Por turma"/"Consolidada", demo `agenda-auxiliar.spec.ts` 53–58);
dialogs por heading ("1º encontro", "Detalhes do encontro").

### Riscos de regressão

1. **A janela "Mês" não é a lista do mock** — decisão já tomada acima;
   o risco é implementar `jw-mes` literal e perder `role=grid`, roving
   tabindex (`refsDias`), `aria-pressed`/`aria-current`, dots por dupla
   e overlay de disponibilidade. A grade mensal (2270–2521) e suas
   labels acessíveis são o contrato.
2. **Reordenação do Monitoramento quebra specs**: hoje a 1ª
   `section[aria-label]` é "Duplas para acompanhar" (assert explícito).
   O v8b põe "Semana do programa" e os números antes da fila — os specs
   demo+app precisam ser reescritos junto, e as novas labels acessíveis
   ("Números da semana"? "Painel da semana"?) precisam nascer com
   nome/estrutura pensados pra teste.
3. **Tabs da coord**: `getByRole("tab", { name: "Calendário" })` é
   assert dos specs; `?aba=calendario` é contrato externo (LinhaResumo,
   "Abrir chamada", strip do mentor, home/ficha). Renomear a aba ou
   mudar o param quebra links e specs — o mock chama a aba de "Agenda";
   se adotar o nome novo, atualizar os deep-links junto.
4. **Janela Semana·Mês·Ciclo × estado `visao` interno**: os radios
   `agenda-visao` atuais são dia|semana|mes|lista|horarios com
   sanitização por papel. Adicionar "ciclo"/remover "lista" muda o
   union, a sanitização (mentor não pode herdar "lista" nem "ciclo" se
   ficar coord-only) e os specs que clicam nos labels. **`?visao=` já é
   outra coisa** (dpp|especialista, nível de página) — não sobrecarregar:
   a janela temporal fica em estado do componente ou param novo.
5. **Denominador único**: `ResumoEncontrosDupla` segmenta por
   `itens.length` (só rows) enquanto "N/M" usa `resumoSemanaDe.total`
   (ativas). O fix tem que valer nos três lugares que reusam a função —
   board da semana (2702), lista (2752+) e a linha-resumo do
   monitoramento — e manter o segmento "sem data" visível (trilho
   tracejado do mock) sem esconder a lista nominal de quem falta
   (`LinhaSemEncontro`/"Sem encontro agendado (N)").
6. **"Todas" do mock × `cronogramaSel` único**: o toggle
   Todas/T1/T2 do dashboard não pode ser o mesmo estado do seletor do
   calendário — a união de cronogramas colide números de encontro
   (registrado em 1431). Se "Todas" existir na janela Semana, renderiza
   por cronograma (duas barras/duas seções, padrão `resumosPorCronograma`),
   nunca `itensPorNumero` com union.
7. **`?dia=` deep-link**: hoje força aba calendário + visão `mes` +
   `selecionado`. Se a janela default da aba virar "Semana" consolidada
   (mock abre em `jw-sem`), o mapeamento `diaInicial → mes` precisa
   continuar — senão o dia fica inalcançável (o detalhe só existe nas
   visões mes/dia).
8. **`chamadaHoje`**: a chamada real mora no `ChamadaFormacao` dentro do
   detalhe do dia (`ehCoord` && `formacao`), e as queries de presença só
   rodam pra coordenação (page 407). No card novo da faixa o "Abrir
   chamada" deve continuar sendo link pro dia certo, só no dia, só pra
   coordenação — não virar ação genérica de card.
9. **Materiais por `encontro_num`**: `getMateriais` é fetch tardio do
   ramo calendário (page 386) e `materiaisPorNumero` alimenta o detalhe
   do dia. Se a faixa compartilhada precisar de materiais, a query sobe
   ou o card fica sem — o "como conduzir" do mock pode sair do
   `PassoGuia` (título/instrumentos/foco, já dentro de `eventos`) sem
   query nova.
10. **Overlay de disponibilidade é mentor-only**: a faixa/janelas novas
    de coord não podem depender de `mentorDisponibilidade` (undefined
    fora do mentor), e o redesign do mentor não pode perder a tinta na
    grade `mes`/`semana` dele.
11. **Gates por papel nas ações**: `AcaoDiaMentor` (agendar/remarcar/
    retroativo) só existe pra `mentor_dpp` nas próprias duplas;
    coord/sup só abre `EncontroDetalheDialog` read-only + Lembrete —
    quem agenda é a dupla, e o redesign não pode dar "Agendar" pra
    coordenação. Auxiliar: "Registrar supervisão" sim, agendamento de
    encontro não.
12. **Mobile/sticky**: a faixa entrando acima do card do calendário não
    pode quebrar `refDetalhe`/`rolarDetalhePendente` (scrollIntoView)
    nem remover o `lg:sticky` (2897) — a acessibilidade do detalhe do
    dia depende dos dois.
13. **Mentor não herda nada de coord**: a faixa filtrada vai na "Minha
    agenda" dele (mock), sem síntese/números/fila; os links internos
    dela precisam preservar `&visao=dpp` pra híbridos (mesma regra do
    `AgendaSuaSemana`/`AbasAgendaMentor`).
14. **Denominador do auxiliar**: se o painel novo for reutilizado pra
    supervisor/auxiliar, os agregados têm que rodar sobre o recorte
    supervisionado (o que `paraAcompanhar` já faz pelas `duplas`
    recebidas) — nunca sobre a coorte inteira.
15. **Trilha especialista separada**: sessões esp não entram nos
    denominadores nem colidem com "Encontro N" (exclusões em
    `resumosPorCronograma` 173–178 e `itensPorNumero`/`oficiaisPorCron`);
    qualquer janela/faixa nova mantém a separação.
16. **Bounds do Ciclo**: só eventos datados abrem janela (827–835);
    recesso usa `data_fim`; etapas sem data moram no painel de
    preparação; o "acumulado" do mock soma só encontros cuja data oficial
    já passou — mesma âncora `agora`/`agoraMs` congelada no mount.
17. **Semana com >1 oficial**: `oficialSemana` assume um evento vigente
    por cronograma; `outrosDaSemana` já cobre os demais. A faixa nova
    lista todos — o board da semana pode seguir single-oficial, mas o
    resumo não pode ignorar silenciosamente um segundo oficial.
18. **`agoraMs` congelado no mount**: buckets/limbo/esperados usam
    `Date.now()` capturado uma vez — a janela Ciclo e os KPIs novos
    devem usar a mesma âncora pra não divergir dentro da mesma tela.

### Gaps do plano

- **Fonte de dados por janela** ainda não está fechada: Semana usa
  `itensDaSemanaPrograma` (só cronogramas ativos, seg–dom) ou a união do
  board? Mês = `porDia`/`duplasPorDia` do `cronogramaSel`. Ciclo =
  `resumoSemanaDe` por encontro — do cronograma selecionado só, ou das
  duas turmas (o mock desenha T1 e T2 lado a lado)?
- **Cronograma selecionado compartilhado?** Hoje o Select vive só dentro
  do calendário; o monitoramento deriva todos os cronogramas ativos. Se
  a turma escolhida numa aba deve valer na outra, precisa de param novo
  (`?cron=`) — não existe hoje.
- **"lista" atual × janela "Ciclo"**: o mock recolhe a lista completa em
  `<details>` "Linha a linha do ciclo". Decidir se a visão `lista` vira
  esse conteúdo (mantendo markup/asserts dentro do details) ou morre.
- **"Ciclo" não navega por mês**: o chrome prev/next/Hoje hoje só se
  esconde na `lista` — estender pra `ciclo`; e o rail "Encontros da
  jornada" fica redundante com a timeline nova (decidir se some na
  janela Ciclo).
- **Hierarquia de tabs por papel** — confirmar no plano:
  coord=Monitoramento+Calendário(Agenda), mentor=Minha agenda+Por
  mentorado+Calendário, híbrido=`?visao=` externo + abas internas,
  auxiliar=Por turma+Consolidada. O mock só cobre coord e mentor;
  auxiliar e jovem ficam fora do desenho.
- **Onde monta a faixa compartilhada**: na page (server, itens prontos)
  ou dentro de cada componente? Pro mentor ela vai na aba "Minha
  agenda" — a `getSupervisoesDaPessoa` dele só roda nesse ramo; se a
  faixa também aparecer na aba Calendário dele, a query precisa subir.
- **`ItemPrograma` é pobre pro card do mock**: sem turma estruturada,
  instrumentos, tema do guia, "como conduzir" ou href do dia — estender
  o tipo ou criar derive novo por papel.
- **Pulso**: "avaliação média dos jovens" sai de `avaliacoes_encontro`
  (embed `avaliacao_jovem` já vem nos encontros, `queries.ts` 355) —
  mas janela temporal e fórmula do agregado não estão definidas (semana?
  acumulado do ciclo?).
- **Filtros são client-only**: chips da fila e toggle de turma operam
  sobre dados já carregados — não viram filtro de query server.
- **A11y dos controles novos**: seguir o padrão dos chips de visão
  (radios sr-only + labels dentro de `role="group"` com aria-label) ou
  tabs de verdade — decidir antes de implementar; links com `role="tab"`
  continuam sendo o padrão das abas.
- **Deep-link/navegação**: janela ativa e dia selecionado não vão pra
  URL além de `?dia=`/`?aba=`/`?visao=` — voltar do browser não restaura
  janela. Aceitável ou param novo? Registrar a decisão.
- **Jovem/mentorado e especialista puro**: o redesign não toca (mentorado
  segue `mes` apenas); confirmar que a faixa compartilhada não aparece
  pra eles (mock: jovem não recebe).

### Opções de melhoria (fora do coberto acima)

- Componente único `semana-programa` server-rendered recebendo itens
  já derivados por papel — o único comportamento client é `<details>`
  nativo + scroll-snap CSS.
- Extrair o seletor de janela como chrome separado do estado `visao`
  (evita sobrecarregar o union e `?visao=`).
- Resolver a barra honesta uma vez dentro de `ResumoEncontrosDupla` —
  segmento "sem data" embutido cobre semana, lista e linha-resumo.
- Reusar o rail "Encontros da jornada" como base visual da timeline do
  Ciclo em vez de um segundo componente de régua.
- `?cron=` na URL se a turma selecionada precisar persistir entre abas.
- `data-testid` só onde specs precisarem de seletor estável — o
  contrato atual é todo role/label, manter assim.
- Fixtures de teste novos: dois cronogramas, dupla sem row de encontro,
  evento multi-dia (`data_fim`), usuário híbrido, escopo do auxiliar.

### Must-read pro implementer

- `src/app/(app)/agenda/page.tsx` — params 52–58; queries 67–83; ramos
  mentor 217–305, auxiliar 307–342, monitoramento 344–380, calendário
  382–468; `AbasAgenda*` 472–590.
- `src/components/agenda-calendario.tsx` — props 576–623; cronograma
  657–683; `porDia`/`duplasPorDia` ~687–745; bounds 827–835; estado
  `visao`/`visaoEfetiva` 867–897; `semanaIso`/`minSemana`/`maxSemana`
  899–921; reclamp 932–958; roving tabindex 961–968; scroll do detalhe
  981–994; `itensPorNumero` 1425–1449; `oficialSemana`/`itensBoard`/
  `resumoOficial` 1467–1480; `corpoDetalheDia` 1550+; preparação
  1850–1861; rail 2163–2265; grade `mes` 2270–2521; visões mentor
  2526–2549 (SemanaMentor 4092, HorariosMentor 4350); dia 2555–2586;
  board semana 2589–2749; lista 2752–2869; footer esp 2882; painel
  sticky 2892–2938; "Todos os eventos" 2945–3063; `AcaoDiaMentor` 3098;
  `EncontroDuplaRow` 3308; `MaterialDoEncontro` 3631;
  `BucketsEncontros` 3716; `LinhaSemEncontro` 3783; `LegendaAgenda` 3828.
- `src/components/agenda-coordenacao.tsx` — derivações 66–84; ordem das
  seções ~136–292; `LinhaResumo` 302–372 (progressbar 357);
  `LinhaPrograma` 376–412 (`chamadaHoje` 379).
- `src/lib/agenda-coordenacao.ts` — `resumosPorCronograma` 160–233;
  `paraAcompanhar` 374–492; `dimensoesDoItem` 514–565;
  `sinteseMonitoramento` 591–614; `ItemPrograma`/`itensDaSemanaPrograma`
  618–707.
- `src/components/fila-acompanhar.tsx` — `LinhaFila`, `FILTROS`, grupos
  "Precisam de intervenção"/"Demais duplas", `LinhaAcompanhar`.
- `src/lib/agenda-minha.ts` (`deriveAgendaMinha`, `secoesDaAgenda`
  733–772), `src/lib/agenda-auxiliar.ts`, `src/lib/ciclo.ts`
  (`bucketsDoEncontro`, `resumoSemanaDe`, `coberturaEncontro`,
  `duplasSemEncontroDoNumero`, `eventoDaSemana`, `semanaBounds`,
  `cronogramaVigente`).
- `src/components/agenda-auxiliar.tsx` — abas 263–295, cards por turma
  ~183–224, consolidada ~434–506; `src/components/agenda-sua-semana.tsx`
  — strip do mentor e a regra `&visao=dpp`.
- `docs/mockups/agenda/v8b.html` — faixa compartilhada 382–510 e
  529–569; janelas/seletores 571–584; Semana 580–611; Mês (lista
  agregada — **não** implementar como janela) 614–652; Ciclo 654–767;
  mentor 774–815; notas/decisões abertas 861–907.
- Specs que prendem o DOM: `tests/e2e/demo/agenda-coordenacao.spec.ts`
  (ordem das sections, tabs, progressbar, síntese, fila),
  `tests/e2e/app/agenda-coordenacao.spec.ts`, `tests/e2e/app`+`demo/
  agenda-views.spec.ts` (chips de visão, grades do mentor, "Agendar
  encontro na …"), `demo/agenda-dpp.spec.ts` (tablist do mentor,
  escopo, guest sem link), `demo/agenda-auxiliar.spec.ts`,
  `app`+`demo/agenda-disponibilidade.spec.ts` (tinta do overlay),
  `demo/agenda-dpp-extras.spec.ts`, `demo/agenda-grade-dia.spec.ts`,
  `app`/`demo/agenda-hibrido.spec.ts`.
