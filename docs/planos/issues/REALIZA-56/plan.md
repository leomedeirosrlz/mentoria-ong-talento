# REALIZA-56 — plano de implementação

Descrição essencial: `/relatorios` (hoje só a grade `RelatorioBuilder`) ganha
uma camada de dashboards operacionais — cards de métricas com listas de
atenção filtráveis — acima do builder inalterado. Compute puro novo em
`src/lib/relatorios-dash.ts`, queries em `queries.ts`, sem view
materializada. Depende de 182 só pro bloco de tendência (degrada gracioso).

## Passo 0 — referências

- `src/app/(app)/relatorios/page.tsx` + `relatorio-builder.tsx` — superfície
  atual (coord-only, demo-parity, grade).
- `src/lib/ciclo.ts`: `saudadeDaDupla` (:1245), `encontroEsperado` (:948),
  `diasAtrasoRegistro` (:2005), `resumoSemana` (:1108), `textoResumoSemana`
  (:1227).
- `src/lib/encerramento.ts:54` — `PESO_AVALIACAO`.
- `src/lib/agenda-coordenacao.ts` — padrão de fetch-em-lote + compute do
  semáforo por dupla (:399) — o dataset do dash segue esse molde.
- `queries.ts:347` — `DUPLA_SELECT`.
- `presencas` (0040), `assinaturas`+`documento_templates` (0033+),
  `formulario_links` (0036+), `interacoes`, `mentor_profiles.formacao_ok`.
- `docs/planos/relatorios-inteligencia.md:32` — lacuna de remarcações.
- `docs/planos/issues/REALIZA-182/` — snapshots (tendência).

## Passo 1 — compute puro `src/lib/relatorios-dash.ts` [NOVO]

Funções tipadas, input = dataset carregado, output = shape de cada card:

```ts
export type DashFiltros = { turma?; cronogramaId?; duplaId?; status?: DuplaStatus[] };
export function semaforoDash(duplas, eventos, hoje): {ok,atencao,risco, porDupla:[{id,nomes,tom,motivo}]}
export function aderenciaDash(duplas, eventos, hoje): {pct, atrasoMedioRegistro, abaixo:[...]}
export function apoioDash(duplas, interacoes, hoje): {abertos, maisAntigo, lista:[...]}
export function remarcacoesDash(encontros): {count, motivosTop:[{motivo,n}]}
export function engajamentoDash(duplas, registros, hoje): {naSemana, semRecente:[...]}
export function presencasDash(eventos, presencas, mentorProfiles): {...}
export function instrumentosDash(formularioLinks): {porForm:{enviados,respondidos}, expirados:[...]}
export function documentosDash(assinaturas, templates, hoje): {porStatus, vencendo:[...]}
```

Testes Vitest `tests/relatorios-dash.test.ts` [NOVO] — cada função com
dataset sintético (molde dos testes de ciclo).

## Passo 2 — query agregada `getRelatoriosDataset` em `queries.ts`

`React.cache`, retorna `{duplas, eventos, presencas, assinaturas,
formularioLinks, interacoesRecentes, registrosRecentes, mentorProfiles,
snapshots?}` com `Promise.all` — consumida pelo dash **e** pelo builder
(que passa a receber fatias por prop em vez de refazer selects — ou mantém
os dele; decidir no PR: deduplicar fetch é o ideal, não obrigatório v1).

Snapshots: `select * from dupla_saude_snapshots` quando a tabela existir —
se a 182 não mergeou, envolver em try/`` ou feature-detect? **Decisão:** o
dash só consulta snapshots **depois** que a 182 mergear — v1 do dash lança
sem tendência; quando 182 existir, a query adiciona o select e o card
mostra. Não referenciar tabela inexistente (schema-contract quebraria).

## Passo 3 — UI

- `DashFiltros`, `DashCard`, `SparkSemaforo`, `DigestCard`, `ItensAtencao`
  [NOVO, `src/app/(app)/relatorios/`] — composição dos ui/ existentes
  (design.md).
- `page.tsx`: ler `searchParams` → `DashFiltros` → fetch dataset → render
  blocos → `RelatorioBuilder` embaixo com `turma` inicial do filtro
  (prop já existente? Se não, adicionar `initialTurma` — mudança pequena).
- `loading.tsx` com skeletons (se a rota não tiver).
- Demo: dataset demo em `src/lib/demo/data.ts`/`queries.ts` — mesmos
  números shape-compatíveis (o dashboard em demo mostra dados canned —
  manter paridade do papel coord).

## Passo 4 — testes e gates

- Vitest cobrindo cada `*Dash` + casos de borda (recorte vazio, dupla sem
  cronograma, sem eventos formação, snapshots vazios).
- `tsc`/`eslint` verdes; nenhuma migration → sem validador REST novo.
- E2E `tests/e2e/app/relatorios-dash.spec.ts` [NOVO]: coord abre, vê cards
  com números, filtra por turma (URL muda), item de atenção navega pra
  ficha; demo spec `demo/relatorios.spec.ts` se o demo mostrar o dash.

## Passo 5 — rollout

Sem migration → merge normal. Verificar em prod com 1 login coord:
cards renderizam, filtro turma funciona, digest copia.

## Rollback

Revert de código puro — sem dados novos, sem schema. O builder isolado
permanece.

## Questões em aberto

- Chart lib pro sparkline? Recomendado SVG inline (sem dep nova) — decisão
  final no PR.
- "Ver todas" da lista de atenção leva ao builder ou a `/duplas` filtrada?
  Proposta: `/duplas` (a lista de duplas já tem filtros naturais) —
  confirmar no PR.
- Dedup do fetch com o builder (getRelatoriosDataset) — recomendado mas
  opcional v1.
