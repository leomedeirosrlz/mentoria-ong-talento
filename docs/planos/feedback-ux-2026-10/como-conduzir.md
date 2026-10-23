# Feedback — "Como conduzir" fora da ficha da dupla

Fonte hoje: `GUIA_ENCENTRO[sistema].conduzir` em
`src/app/(app)/duplas/[id]/instrumentos-dupla.tsx` (~:51-75) — texto de
condução por instrumento (visao/metas/pdm/roda_vida) atrás de um
`<details>` na ficha da dupla.

## Item do feedback

"Seria interessante colocar o 'Como conduzir' da ficha da dupla em outros
lugares também — tipo na agenda do mentor ou na descrição do encontro em
outro lugar." O texto só existe na ficha; o mentor, que é quem conduz,
provavelmente nunca abre a ficha da própria dupla pra ler isso — ele vive
na agenda dele.

**Ampliação (decisão do Thiago)**: também nos **grupos/dropdowns por
encontro da biblioteca de /materiais** — cada encontro mostra "o que
trata / como conduzir" com **copy adaptada por papel** (mentor lê como
conduzir; coord lê o que o encontro cobre). E "pode ficar na agenda
também em fácil acesso" — cobre a card da semana do programa
(`agenda-coord.md`). Conteúdo baseado nos **docs oficiais do programa**,
não texto inventado.

## Direção

- **Extrair `GUIA_ENCONTRO` pra um lugar compartilhável** (`src/lib/` ou
  `src/components/como-conduzir.tsx`) — hoje é const local da ficha.
  Completar o conteúdo por encontro a partir dos docs oficiais do
  programa (os guias PDF já existem no acervo — a copy vem deles), com
  **duas redações por encontro**: "como conduzir" (mentor) e "o que o
  encontro cobre" (coord/auxiliar).
- **Agenda do mentor** (`agenda-minha.tsx` / detalhe do dia): o encontro
  oficial da semana mostra o chip do instrumento vigente + o "Como
  conduzir" (details ou tooltip com o texto do instrumento daquela
  janela do guia — mapear nº do encontro → instrumento da janela, mesma
  tabela `ESTACOES`/`encIni` de `src/lib/jornada.ts`).
- **Descrição do encontro**: onde o encontro oficial já mostra
  instrumento/material (detalhe do dia no calendário,
  `encontro-detalhe-dialog`), pendurar o mesmo "Como conduzir" —
  UMA fonte, vários lugares.
- **Biblioteca /materiais**: dentro de cada grupo de encontro, a mesma
  entrada (ver `materiais-coord.md` item 11).
- **Card da semana do programa** na agenda coord: o encontro da semana
  pode carregar a versão "o que cobre" (ver `agenda-coord.md`).
- Manter o `<details>` pattern — copy longa, disponível sem poluir.
  No mobile o summary é alvo min-h-11.

## Critérios de aceite

- [ ] O texto de condução mora em um único módulo compartilhado
      (sem cópia em instrumentos-dupla + agenda + materiais) e tem
      redação por papel (mentor × coord) onde o uso difere.
- [ ] Na agenda do mentor, o encontro oficial oferece "Como conduzir" do
      instrumento da janela vigente; encontro sem instrumento na janela
      não mostra nada (não inventar).
- [ ] No detalhe do encontro (dialog/painel do dia), a mesma entrada
      aparece quando o encontro mapeia pra instrumento.
- [ ] O grupo de encontro em /materiais mostra "o que trata / como
      conduzir" do mesmo módulo.
- [ ] Conteúdo conferido contra os guias oficiais — sem condução
      inventada.
- [ ] Ficha da dupla continua igual (mesmo texto, mesma fonte).
- [ ] Specs: se existir assert do "Como conduzir" na ficha, segue verde;
      novo assert na agenda cobre a nova superfície.

## Mapa de regressões e gaps (review out/2026)

Leitura do código em out/2026 — onde a copy vive hoje, quais superfícies
já carregam dados de guia e o que o plano ainda não decide.

### Estado atual mapeado

**Fonte única atual** — `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx`:
`GUIA_ENCONTRO` `:51-75` — `Record<InstrumentoSistema, {chip, conduzir}>`
com apenas as 4 chaves de jornada (`visao`, `metas`, `pdm`, `roda_vida`).
`chip` renderiza como `Badge` na linha do instrumento (`:161-164`);
`conduzir` dentro de `<details>` "Como conduzir" (`:185-194`). O texto
cobre O INSTRUMENTO (ex.: "revisão enc. 9"), não o encontro 1–16 — a
expansão pra "por encontro" é conteúdo novo, não só mover a const.
`INSTRUMENTO_INFO[sistema].resumo` (`schema.ts:122-143`) já é a
descrição curta na mesma linha (`:180-184`) — cuidado pra não duplicar
resumo/condução no mesmo bloco.

**Janela encontro→instrumento** — `src/lib/jornada.ts`: `ESTACOES`
`:179-251` tem `encIni`/`encFim` por `EstacaoChave` (não por sistema;
`SISTEMA_DA_ESTACAO` em `painel-jornada.tsx:61` faz a ponte
estacao→sistema parcial: avaliacao_encontro/roda_formal/avaliacao_360
não são `InstrumentoSistema`). Mapa inverso "encontro N → instrumentos
na janela" não existe pronto — derive (para cada chave,
`encIni <= n <= encFim`), lembrando que `avaliacao_encontro` é recorrente
1–16 e roda formal/360º não são `INSTRUMENTO_INFO`. `EstacaoEstado` do
jovem (`feito|a_fazer|trancada`, `:37`) e do painel staff
(`respondido|pendente|expirado|nao_enviado|trancada`,
`estacoesPainelDupla` `:849+`) são vocabulários DIFERENTES — a copy de
condução não pode vazar estados.

**Outra fonte já em dados** — `ciclo_eventos.instrumentos: string[]`
(nomes por encontro oficial) + `PassoGuia.instrumentos`
(`src/lib/ciclo.ts:47-60`, `passosDaTrilha` `:65-95`) — já alimenta a
"Sugestão do guia" do `EncontroDetalheDialog` (`encontro-detalhe-dialog.tsx:168-187`,
só staff — monta só quando `!ehMentor`, `agenda-calendario.tsx:3552-3562`)
e a linha "Instrumentos:" do **detalhe do dia** no calendário
(`agenda-calendario.tsx:1751-1758`), que TAMBÉM já lista "Materiais do
encontro" por `encontro_num` (`:1760-1773`). Ou seja: existem DUAS
fontes de "o que entra no encontro" — a coluna `instrumentos` (lista
curada no calendário oficial) e as janelas `ESTACOES` (regra de jornada).
O módulo compartilhado precisa decidir o contrato entre elas (sugestão:
`instrumentos` do evento diz o alvo editorial do encontro; `ESTACOES`
diz a janela de estado — o texto de condução pendura no instrumento
do evento e a checagem "tem instrumento na janela" pode usar os dois).

**Agenda do mentor** — `src/components/agenda-minha.tsx` +
`src/lib/agenda-minha.ts`: `AgendaItem` (`:61-100`, `encontro: Encontro |
null` `:85`, tipos `encontro`/`a_agendar`/`sessao_esp`/`supervisao`),
seções derivadas por `deriveAgendaMinha` (`:884+`, recebe `duplas`,
`trilhas`, `eventos`, `cronogramas`, `supervisoes`, `meuId`, `hoje`,
`agora` — `agenda-minha.tsx:492-515`). O encontro oficial da semana hoje
aparece como contagem "N eventos do programa" (`agenda-minha.tsx:395-401`)
e como `AgendaItem` nas seções — não há card "semana do guia" por
instrumento. Onde pendurar o "Como conduzir": no `AgendaItem` tipo
`encontro` (o `encontro.numero` já está lá — mapeia por `ESTACOES` ou
pelo `ciclo_eventos` do cronograma da dupla; `previstos` por numero já
existe em `agenda-minha.ts:493-501`).

**Card da semana coord** — `src/components/agenda-coordenacao.tsx`:
"Semana do encontro, por cronograma" → `LinhaResumo` `:290-340` (pill
turma, "Encontro N · dd/mm" link pra `/agenda?aba=calendario&dia=`,
contagem "N duplas ativas", barra X/Y). "O que cobre" entra aqui — a
linha já sabe `eventoNumero`/`eventoData` por cronograma.

**Biblioteca /materiais** — `EncontroDetails`
(`src/components/materiais-hub.tsx:197-318`): `titulo` do encontro já
chega por `titulosPorNumero`; adicionar a entrada "o que trata / como
conduzir" é uma linha nova dentro do `enc-body` — o prop `ehCoord`
(booleano) não separa mentor de supervisor/auxiliar nem de especialista
— a "copy por papel" precisa de prop mais granular que `ehCoord`, ou de
render só pra papéis com condução (mentor) vs cobertura (coord/sup).

**Ficha da dupla** — o `<details>` atual mora dentro do `<li>` de cada
instrumento (`instrumentos-dupla.tsx:185-194`). O spec demo usa
`li:has-text("Plano de Desenvolvimento do Mentorado")` pro resultado
estruturado (`tests/e2e/demo/instrumentos.spec.ts:38-49`) — o comentário
diz explicitamente que os textos de "Como conduzir" da Visão/Metas
contêm "PDM" e casariam num `hasText` solto. Mover/duplicar esse texto
pra dentro de outros elementos muda o que seletores `hasText` casam —
manter o texto canônico e revisitar o spec se a anatomia do `<li>`
mudar.

### Riscos de regressão por item do plano

- **Extrair `GUIA_ENCONTRO`**: hoje é `const` local com tipagem
  `Record<InstrumentoSistema, …>` — se virar módulo compartilhado
  (`src/lib/` ou `src/components/como-conduzir.tsx`) e o plano expande
  pra "por encontro", o tipo muda de chave (sistema → número de encontro)
  OU vira dois mapas (instrumento × encontro). A ficha continua lendo
  por sistema — adaptador fino lá (`GUIA_ENCONTRO[sistema]`) pra não
  quebrar `instrumentos-dupla.tsx` nem o spec de ficha. O mockup mostra
  condução POR ENCONTRO na agenda/biblioteca ("revisão do PDM no
  encontro 9" com 4 passos numerados + chips de apoio) e por INSTRUMENTO
  na ficha — são dois níveis; especificar o schema (ex.:
  `ENCONTRO_GUIA[n] = { cobre: string; conduzir: string[]; apoio:
  {label;materialId?}[] }` + manter o mapa por sistema).
- **Agenda do mentor**: `AgendaItem.encontro` é o encontro AGENDADO da
  dupla (com `numero`) — encontro ainda não marcado aparece como item
  `a_agendar` com `encontro: null` e o nº em outro campo (conferir o
  shape em `agenda-minha.ts:392-405`/`:493-535`). O "Como conduzir" do
  vigente precisa ler o nº DO GUIA (o `previstos`/fila por número), não
  só `encontro.numero`. E especialista (`sessao_esp`) não mapeia pra
  `ESTACOES` de DPP — sem condução neles (a régua "encontro sem
  instrumento não mostra nada" já é o aceite).
- **Detalhe do encontro/dia**: o "detalhe do dia" do calendário já é
  compartilhado entre papéis e já mostra `instrumentos` + materiais —
  pendurar a condução ali cobre mentor E coord de uma vez (melhor que o
  `EncontroDetalheDialog`, que é staff-only). Na ficha, `EncontroRow`
  (`page.tsx:1311+`) já tem `materiais` por passo e o `passo.foco` —
  pendurar "como conduzir" no passo também é viável (mesmo módulo).
- **Card da semana coord** (`LinhaResumo`): a linha é por CRONOGRAMA —
  duas turmas no mesmo encontro nº levam a mesma copy; ok. Mas "a
  condução por papel" não deve aparecer pro papel errado: o card é da
  coordenação, usa a redação "o que cobre".
- **Conteúdo**: a ordem dos itens (1..N) no mockup condução-do-enc-9 é
  editorial — `ol`. Os guias PDF do acervo são a fonte (o próprio
  `Material` tipo `guia` por encontro pode linkar junto — o mockup faz
  isso com "Roteiro do encontro N"). Risco real: texto inventado —
  validar contra os guias antes de codar (convenção do AGENTS:
  "fonte da verdade do domínio = guias").
- **Mobile**: `<details>` já é o padrão (`BucketEncontros` do calendário
  `:3730+`, o próprio "Como conduzir" atual); summary min-h-11 em
  `EncontroDetails` já existe (`:234`) — reutilizar as mesmas classes
  `group-open:rotate-*` de caret.

### Gaps do plano

- **Schema do módulo não especificado**: chave por encontro × por
  instrumento × por papel — o plano diz "duas redações" mas não fixa
  forma. Fixar antes de codar (sugestão acima) e escolher onde vive:
  `src/lib/` puro (dados+tipos, sem JSX — segue `jornada.ts`) + componente
  de apresentação separado.
- **Encontros sem instrumento**: a régua "não mostra nada" resolve o
  mentor; mas a redação "o que o encontro cobre" (coord) existe mesmo sem
  instrumento — o módulo precisa de `cobre` pra TODOS os 16 (ou a regra
  de render vira "só quando tem instrumento" por papel — divergente).
- **`observacao`/`foco` já existem no evento** — decidir se a copy nova
  complementa (`observacao` é operacional: reposição/feriado) ou
  substitui; não duplicar conceito na mesma linha (o detalhe do dia já
  empilha fase/observacao/instrumentos/materiais — enxuto).
- **Quem escreve a redação**: "baseado nos docs oficiais" sem indicar
  qual doc por encontro — antes da implementação, colher a lista
  encontro→doc (o `Material` `guia` do encontro pode servir de
  referência cruzada; `titulosPorNumero` já casa título oficial).
- **Jovem**: o plano não pede copy no acervo do jovem — ok, mas note que
  o jovem JÁ vê `descricao` por estação (`Estacao.descricao`
  `jornada.ts:54`, "na voz do guia") — reaproveitar o mesmo vocabulário
  pra não divergir.
- **Trilha especialista**: `passosDaTrilha` devolve passos com `foco`
  mas sem `instrumentos` — o módulo DPP-first deixa especialista fora;
  documentar que é intencional.
- **Testes novos**: o aceite "novo assert na agenda" precisa de spec
  nomeando onde — sugestão: `agenda-auxiliar.spec.ts` (mentor) ou novo
  caso no `agenda-coordenacao.spec.ts` (card semana) + `materiais*`
  (grupo encontro). O assert atual de ficha
  (`instrumentos.spec.ts:38-49`) deve seguir verde — mover o texto pra
  módulo não pode mudar o DOM do `<li>`.

### Opções de melhoria (fora do plano)

- O módulo pode expor `instrumentosDoEncontro(n)` reutilizável — hoje o
  mockup da biblioteca já mostra isso na summary ("o que o encontro
  cobre"); ter o helper puro permite reuso no painel da jornada e na
  futura seção de instrumentos (chip "Enc. N").
- Linkar o "Roteiro do encontro N" (Material `guia` com `encontro_num=n`)
  dentro do bloco de condução — a relação já existe por dados, zero custo
  de conteúdo.

### Must-read pro implementer

- `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx:41-75`
  (`GUIA_ENCONTRO` + INSTRUMENTO_INFO do schema), `:156-194` (chip +
  details), `:280-332` (seção e props).
- `src/lib/jornada.ts:25-73` (tipos), `:179-251` (`ESTACOES` —
  janelas), `:843-915` (`estacoesPainelDupla`/`atrasadasPainel`).
- `src/lib/ciclo.ts:47-95` (`PassoGuia`/`passosDaTrilha` — inclui
  `instrumentos: string[]` e `observacao`), `:1018-1130`
  (`eventoDaSemana`).
- `src/lib/agenda-minha.ts:46-100` (`AgendaItem`/`AgendaItemTipo`),
  `:372-535` (derivação dos itens `encontro`/`a_agendar` + `previstos`),
  `:884+` (`deriveAgendaMinha`); `src/components/agenda-minha.tsx:395-401`
  (contagem de programa), `:492-567` (props + render das seções).
- `src/components/agenda-coordenacao.tsx:240-345` (`LinhaResumo` — o
  card por cronograma).
- `src/components/agenda-calendario.tsx:1730-1800` (detalhe do dia:
  `instrumentos`, `observacao`, "Materiais do encontro",
  `CoberturaEncontro`, `NotaEncontro`), `:3552-3562`
  (`EncontroDetalheDialog` staff-only), `:3694-3760` (padrão de
  `<details>` de buckets).
- `src/components/encontro-detalhe-dialog.tsx:168-200` ("Sugestão do
  guia" + `observacao` — staff).
- `src/components/materiais-hub.tsx:197-320` (`EncontroDetails` — onde a
  entrada nova mora na biblioteca), `src/app/(app)/materiais/page.tsx:52-69`
  (`titulos`/vigente já calculados).
- Specs: `tests/e2e/demo/instrumentos.spec.ts:38-49` (cuidado
  `hasText`/"Como conduzir"), `tests/e2e/demo/smoke.spec.ts:50`
  (semana do encontro do mentor), `tests/e2e/demo/agenda-auxiliar.spec.ts`
  e `tests/e2e/demo/agenda-coordenacao.spec.ts` (superfícies novas de
  assert).
- Mockup: `docs/mockups/materiais/v5c.html:307-314` (CSS `.enc-note` +
  `.ht` details), `:1059-1070` (`enc-note` dentro dos grupos de encontro
  do mentor) e `:983-993`/`:1034-1045` (bloco "Como conduzir · revisão
  do PDM" / "encontro 5 de amanhã" por jovem).
