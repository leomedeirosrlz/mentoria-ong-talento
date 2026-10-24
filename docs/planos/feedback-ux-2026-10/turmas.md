# Feedback — /turmas (lista + nomeação transversal)

Tela: `src/app/(app)/turmas/page.tsx` + `rotuloCronograma` em
`src/lib/ciclo.ts` + todos os lugares que mostram nome de turma
(painel jornada, agenda, duplas, materiais…).

## Itens do feedback

1. **Ocupar melhor o espaço de forma visual** — os cards de turma são
   texto puro. Pedido: símbolo de turma no card com número grande pra
   identificação rápida — "card visual criativo que nem o banner de
   perfil" — cards bonitos, não texto puro.
2. **Padronizar nomeação** — hoje `rotuloCronograma` produz coisas como
   "2026/2027" (a turma vira só o ano). Pedido: `T1`/`T2` na frente —
   "T1 · 2026/2027" — ou só "Turma 1"/"Turma 2". Como o ano é igual entre
   elas, pode sair do título na maior parte das telas e ficar pequeno na
   descrição do card.
   (Esse é também o motivo da confusão no painel de materiais — "é a
   turma 2?" — a label "2026/2027" não diz qual turma é.)

**Spec travada**: ✅ variante escolhida = **v1a "banner de perfil"**
(`docs/mockups/turmas/v1a.html` — banner ink com sigla fantasma T1/T2,
emblema-dial, linha de dados mono, stats em faixa). v1b (credencial)
descartada, fica como referência de elementos resgatáveis.

## Direção

- **`rotuloCronograma` / helpers de turma**: centralizar. Gerar label curto
  (`Turma 1`, `Turma 2`, ou `T1`/`T2`) derivado de `turma`/`nome` do
  cronograma + label longo (`Turma 1 · 2026/2027`) onde couber. Mapear
  todos os consumers: painel jornada (section headers), agenda-coordenacao
  (`PillTurma`), duplas-lista, materiais-hub, formularios, relatorios —
  sweep pra trocar "2026/2027" solto por "Turma N".
- **Cards de turma**: redesign visual — identidade por turma (cor/sigla
  grande, ex.: "T1" em display ou marca visual), período pequeno na
  descrição, stats como chips (N encontros · N duplas). Referência: banner
  de perfil (o que já tem no app). Status badge continua. Grid atual
  `sm:grid-cols-2 xl:grid-cols-3` pode ficar.
- Onde ainda fizer sentido o ano (relatório público, export), o label
  longo continua — a omissão é só nas telas internas.

## Critérios de aceite

- [ ] Nenhuma tela interna mostra "2026/2027" como título/identificador
      principal de turma — sempre "Turma N" (ou "T1"/"T2"); ano só em
      descrição/contexto pequeno.
- [ ] Cards de `/turmas` têm identidade visual distinta por turma (sigla
      grande/marca + cor), não só texto; mobile 390px bonito, sem
      overflow.
- [ ] A mudança de label não quebra RLS/lógica — é camada de apresentação
      (verificar se `turma` textual "2026/2027" é usada como chave em
      algum filtro; se for, manter o valor e só mudar a exibição).
- [ ] Specs que buscam turma por nome antigo atualizados; e2e
      `turmas`/`agenda`/`materiais` verdes.

## Mapa de regressões e gaps (review out/2026)

### Estado atual mapeado

- **Guarda**: `src/app/(app)/turmas/page.tsx:27` e
  `src/app/(app)/turmas/[id]/page.tsx:33` — só `coordenacao`; demo abre
  read-only (`demoAtivo`, page.tsx:33). Card atual (page.tsx:92-160) =
  `Link` com `rotuloCronograma(c)` (:113) + `StatusBadge` (:115) +
  datas `inicio_em`/`fim_em` + contagens (encontros/eventos/duplas via
  `getVinculosCronogramas`, :32). O detalhe repete o mesmo rótulo no h1
  ([id]/page.tsx:57-59) e no metadata (:23). `/turmas/novo` é o builder
  de cronograma — `turma` é **input texto livre** com placeholder
  "T3 · 2026/2027" (cronograma-builder.tsx:412): nada garante o padrão
  `T<N>` na origem.
- **`rotuloCronograma`** (ciclo.ts:943-945): `` `${c.turma} · ${c.nome}`
  `` — hoje produz **"T1 · 2026/2027 · Calendário oficial"** (a turma já
  carrega o prefixo T nos dados novos — 0111 semeia "T2 · 2026/2027",
  demo `cronogramaDe` idem). O texto do plano ("produz coisas como
  2026/2027") está desatualizado: o problema real é o rótulo longo
  duplicado, não o ano solto. E ainda existe legado sem prefixo:
  `supabase/seed.sql` semeia `turma='2026/2027'` puro (stack e2e local)
  e o demo arquiva "2025/2026".
- **`partesTurma` JÁ EXISTE** (ciclo.ts:1884-1890, REALIZA-151):
  "T1 · 2026/2027" → `{nome:"Turma 1", ano:"2026/2027"}`; valor sem o
  padrão `T\d+` → `{nome: valor inteiro, ano: null}` — o fallback já é
  o comportamento certo pra "E2E Turma de teste" e afins.
- **`PillTurma`** (`src/components/agenda-partes.tsx:55+`) já renderiza
  `partesTurma` (nome forte + ano pequeno); consumidores atuais:
  `agenda-auxiliar.tsx:199,372`, `fila-acompanhar.tsx:198`.
- **`turmaCurta` duplicada e privada**: `src/lib/agenda-auxiliar.ts:70`
  e `src/lib/agenda-coordenacao.ts:70` — mesmo corpo ("T1 · 2026/2027"
  → "T1"); `agenda-auxiliar.ts:205` ainda faz `.replace(/^t/i,"")` pra
  chip "1". Helper central já é dívida de hoje — o sweep deve
  consolidar, não criar um terceiro.
- **Consumidores do valor cru** (string inteira como label):
  `duplas-lista.tsx:296` (texto de relato), `:438` (mini-badge),
  `:877` (chips montados do distinct da lista), `:911` (filtro por
  igualdade exata), `:1125` (contagem por chip), `:1326-1391`
  (chave+cabeçalho de grupo), `:1562-1564`, `:1783`;
  `agenda-por-mentorado.tsx:363` (Badge), `:397`;
  `agenda-minha.tsx:442` (**visão do mentor**);
  `agenda-auxiliar.tsx:110,127,166-169`;
  `agenda-calendario.tsx:651-656` (dedup `turmasRepetidas`) e
  `:2002-2023` (select + chip, com `c.nome` quando a turma repete
  entre cronogramas); `painel-jornada.tsx:327` (group key), `:489`
  (linha), `:518` (h3 por turma); `trilhas-coord-panel.tsx:126`;
  `jovem/materiais/page.tsx:338` (**visão do jovem**);
  `novo-link-dialog.tsx:158` (título sugerido do link), `:337`
  (SelectItem), `:427-438` (`${c.nome} · ${c.turma}` no select de
  cronograma); `relatorio.ts` `resumoRecorteLink` (chips do link
  público); `relatorio-builder.tsx:76,93,121-123,255-259` (chip);
  `api/export/route.ts:155,188,501` (filtro `?turma=` + coluna CSV);
  `promover-mentor-dialog.tsx:83,95` (options de `escopo_turma`);
  `solicitacoes-coord-card.tsx:62`; `dashboard-coordenacao.tsx` (texto
  do resumo semanal via `rotuloCronograma`).
- **`turma` é CHAVE, não só label** — snapshot textual:
  `duplas.turma` sai do cronograma no pareamento (`actions.ts:759,769`)
  e no remanejo (`:1643,1659`); `cronograma-editor.tsx:317-322`
  documenta que renomear o cronograma **não** reescreve as duplas.
  Também é chave em `turma_inscricoes.turma` (0111),
  `relatorio_links.turma` + `config->>turma` (0110 —
  `criar_relatorio_link` grava `nullif(p_config->>'turma','')`),
  `profile_papeis.escopo_turma` (0085), `solicitacoes_especialista.turma`,
  `?turma=` do export e o `d.turma = v_turma` dentro do RPC
  `abrir_relatorio` — tudo igualdade textual exata.
- **e2e**: `operacional.spec.ts:275-303` cria cronograma com turma
  "E2E Turma de teste" (**sem padrão T**) e aterra em `/turmas/[id]`;
  `resumo.spec.ts` usa "Turma E2E Resumo" (chips por nome exato);
  `solicitacao-esp.spec.ts:706` seta `duplas.turma="T1 · 2026/2027"`;
  specs demo de agenda renderizam pills.

### Riscos de regressão por item

1. **Label novo ≠ valor novo**: tudo que filtra/agrupa/compara por
   igualdade textual continua no valor cru — a UI mostra
   `partesTurma(t).nome`/sigla, a chave permanece "T1 · 2026/2027".
   Renomear o TEXTO em qualquer coluna (`duplas.turma`,
   `relatorio_links.turma`, `turma_inscricoes.turma`, `escopo_turma`,
   `config.turma`) é migração de dados à parte — fora deste plano.
2. **O critério "nenhuma tela mostra 2026/2027 como título" está mal
   calibrado**: hoje nenhuma tela mostra "2026/2027" sozinho — mostram
   a string crua inteira ("T1 · 2026/2027") ou "E2E Turma de teste".
   Reescrever como "mostrar nome/sigla derivados (`partesTurma`), ano
   só secundário" — e o fallback (valor inteiro vira nome) já cobre
   fixtures sem padrão.
3. **`rotuloCronograma`** tem superfícies além de /turmas: metadata e
   h1 do detalhe, `nova-dupla-dialog`, `editar-dupla-dialog`, select de
   origem do `cronograma-builder` e o texto do `CopiarResumoButton`
   (vai pra WhatsApp externo — o longo pode ser o certo lá; revisar
   caso a caso, não trocar às cegas).
4. **Cards v1a vão além de "card + chips"**: banner ink, sigla
   fantasma, emblema-dial, faixa de stats, bloco funcional "semana do
   encontro N" e seção de cronograma com cells. `eventoDaSemana`
   (ciclo.ts:1018) + `eventosDoCronograma` + `totalDaTrilha` (:860)
   dão o bloco funcional; o plano não decide quanto do v1a entra
   (emblema? cells? dia da semana? — ver decisões em aberto do mock).
5. **Dedup `turmasRepetidas`** (agenda-calendario.tsx:651-656): dois
   cronogramas com a mesma `turma` já desambiguam com `c.nome` — o
   sweep tem que preservar isso (sigla sozinha ambiguaria).
6. **`duplas.turma` pode divergir de `cronogramas.turma`** (snapshot):
   a label nova não pode assumir join por texto — exibição vem do
   valor da própria linha.
7. **Specs/fixtures**: chips achados por texto exato ("Turma E2E
   Resumo") seguem OK via fallback; qualquer spec que ache
   "T1 · 2026/2027" renderizado precisa atualizar — e o e2e local roda
   com `seed.sql` (`turma='2026/2027'` puro → `partesTurma` devolve o
   valor inteiro como nome; "Turma N" não aparece nesse dado).

### Gaps do plano

- Não cita que `partesTurma`/`PillTurma`/`turmaCurta` **já existem** —
  o trabalho é sweep de adoção + consolidação, não criação.
- Formatos pedidos são dois ("Turma 1" e "T1"), mas `partesTurma`
  devolve `nome` e `turmaCurta` devolve sigla — centralizar um
  `rotuloTurma(t) → {sigla, nome, ano, curto, longo}` em ciclo.ts ao
  lado de `partesTurma` evita o terceiro clone.
- Não cobre `/turmas/[id]` (h1 + metadata) nem `/turmas/novo` (input
  livre — se o padrão importar pro banner/sigla, o form precisa
  sugerir/validar formato).
- "Telas internas" não foi delimitado: visão do JOVEM
  (`jovem/materiais/page.tsx:338`) e do MENTOR (`agenda-minha.tsx:442`)
  também mostram `d.turma` cru — entram no sweep ou ficam com o longo?
- Decisões em aberto do mock v1a não transcritas: `dia_semana` vira
  campo ou deriva do evento? tinta por turma escala além de T2? a cor
  sangra pros pills das outras telas? "N de M com encontro agendado"
  justifica query extra por card?
- `turma_inscricoes` (fila 0111, exibida em /relatorios e filtrada por
  `i.turma === turma`, relatorio-builder.tsx:123) também tem label —
  conferir no sweep.

### Opções de melhoria não cobertas

- `rotuloTurma()` único retornando `{sigla:"T1", nome:"Turma 1",
  ano:"2026/2027", curto:"T1", longo:"Turma 1 · 2026/2027"}` — absorve
  `partesTurma`, as duas `turmaCurta` e o `replace(/^t/i)` num ponto só.
- Chip/pill com `title={longo}` — ano acessível sem poluir.
- Cor por turma além de T2: derivar por hash do nome em vez de mapa
  fixo — evita "sem cor" numa "E2E Turma de teste".

### Must-read antes de implementar

- `src/lib/ciclo.ts:943-945` (`rotuloCronograma`), `:1884-1890`
  (`partesTurma`), `:948` (`encontroEsperado`), `:1018`
  (`eventoDaSemana`), `:860` (`totalDaTrilha`).
- `src/components/agenda-partes.tsx:54-70` — `PillTurma`, padrão já
  aprovado de nome+ano; `src/lib/agenda-auxiliar.ts:70` +
  `src/lib/agenda-coordenacao.ts:70` — `turmaCurta` a consolidar.
- `src/components/cronograma-editor.tsx:317-322` — snapshot
  `duplas.turma` ≠ `cronogramas.turma`.
- `docs/mockups/turmas/v1a.html` — incl. decisões em aberto no fim.
- `supabase/migrations/0061_cronogramas.sql`,
  `0111_turmas_inscricoes.sql` (seeds "T2 · 2026/2027" + turma livre),
  `supabase/seed.sql` (`'2026/2027'` legado).
- `src/lib/actions.ts:754-770,1643-1659` — onde `duplas.turma` é
  escrita; `0110` — `relatorio_links.turma`/`config->>turma`.
- `tests/e2e/app/operacional.spec.ts:275-303` + `resumo.spec.ts` —
  fixtures sem padrão T a respeitar.
