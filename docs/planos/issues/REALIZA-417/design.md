# REALIZA-417 — design.md (apresentação dos dados de adoção)

Plano da **camada de apresentação** da rodada de analytics. Fase 1 já está
no ar (`5ed55a37`): `produto_eventos` + beacon client + RPC whitelist
(8 ações). Este doc decide como a aba **Adoção** apresenta esses dados —
o mais bonito possível dentro da gramática da casa.

## Recon — o que já existe

- **Dados**: `produto_eventos(profile_id, papel, superficie, acao, meta, created_at)`
  (0197). ~17 superfícies (`superficieDoPath`), ações: `pageview`, `busca`,
  `sort`, `dialog`, `nudge`, `form_emitido`, `material_aberto`,
  `lembrete_whatsapp`. RLS: cada um lê os seus; coordenação lê tudo.
- **Destino**: aba nova em `/relatorios/operacionais` — o "workbench de
  relatórios" do ticket. Hoje 7 abas por URL (`?aba=`); Adoção é a 8ª.
  A régua dela é própria (janela + papel), não a de turma — evento não
  tem turma.
- **Kit viz da casa** (`src/components/viz/`): `GraficoTempo` (linha/barras,
  média, pico, leitura por teclado+ponteiro, tabela fallback),
  `Sparkline` (multi-série, pontos de atenção), `BarraSegmentada`
  (denominador honesto, legenda nomeada, hatch "sem dado"). Gramática
  Tufte/Few embutida: denominador sempre, buraco visível, status nunca
  só por cor, `tabular-nums`, `--chart-1..5`, animação só transform/opacity.
- **Matéria-prima do funil**: `avaliacao_links` (status/respondido_em/
  expira_em) + `formulario_links` × `formulario_respostas` — **emitido →
  respondido** em 2 etapas honestas. "Aberto" não existe: `resumo_acessos`
  loga acesso ao `/resumo` público (não abertura de formulário) e links
  anônimos não gravam abertura — a etapa caiu no recon da auditoria.
- **Padrões de tela**: cards `rounded-xl bg-card shadow-[var(--shadow-border)]`,
  seção `text-base font-semibold`, meta `text-sm text-muted-foreground`,
  kicker `text-[11px] uppercase tracking-[0.08em]`; páginas longas = abas
  por URL; entrada `.animate-enter` + `--i`; filtro novo re-key anima.

## Pesquisa — o que os dashboards bem resolvidos fazem

Fontes: Linear/Vercel/Stripe/Plausible/PostHog (referências de 2025-26) +
literatura (Few/Tufte, que o kit já cita).

1. **Três camadas, não uma grade de widgets iguais**: KPIs (≤5, um
   dominante) → tendências/recortes → tabelas de drill-down. Grid de
   cards iguais diz "tudo importa igual" — nunca é verdade.
2. **Tabelas voltaram ao trono**: a era do painel-só-de-gráfico acabou;
   a tabela estruturada é o instrumento de trabalho (Stripe). Gráfico só
   onde a *forma* responde melhor que o número.
3. **Cor é significado, não decoração**: paleta contida; cor saturada
   reservada a status/ação (Vercel: monocromático + estado).
4. **Denominador exposto** (PostHog funnel): cada taxa diz "de quem" —
   conversão por etapa e janela declaradas, nunca um % solto.
5. **Progressive disclosure**: visão escaneável em <30s; densidade fica
   um clique abaixo (detalhe sob demanda, não escondido).
6. **Scan F-pattern**: o dado-âncora no topo-esquerda.

## Decisão central — híbrido: kit viz dentro, ECharts só se sankey real

**Decidido (jan/2026)**: viz da casa pra tudo nesta rodada; ECharts fica
como escape hatch lazy **só** se um sankey real fizer falta depois do
heatmap. Trade-offs na mesa:



O ticket diz "viz rica com ECharts". Reavaliado com a régua "mais bonita
possível":

| Critério | Kit da casa (estender) | ECharts |
|---|---|---|
| Linguagem visual | **é** a gramática aprovada (denominadores, buracos, legendas nomeadas) | defaults estranhos (tooltip box, gradientes, legend-dot) — precisaria de tema custom pesado pra não destoar |
| A11y | role=img + leitura + tabela em `<details>` por construção | canvas; modo aria/decal existe mas é inferior ao DOM semântico |
| Bundle | zero-dep (hoje nenhuma lib de chart) | ~200KB+ gz mesmo tree-shaken (`echarts/core`+`use`), lazy na aba |
| SSR/RSC | props prontas do servidor | client-only obrigatório |
| Custo de manter | componentes novos seguem o padrão viz/ | segunda gramática de viz no produto |

**Os glifos pedidos são DOM-simples**: heatmap = grid CSS + escala de
intensidade; funil = barras + ribbons de etapa; cohort = grade triangular
(variante do heatmap). O único realmente difícil é o **sankey** — e para
~17 superfícies × ~5 papéis, o sankey de jornada é ornamentado demais:
a pergunta real ("quais telas cada papel usa") é respondida pelo heatmap;
a jornada entra melhor como **top-caminhos** (ver CaminhosFluxo abaixo) —
mais legível que nós e arestas com 17 nós.

**Sankey fica de fora desta rodada.** Se depois do heatmap ainda fizer
falta, reabre-se: `echarts/core` tree-shaken + lazy só na aba, ou
`FluxoSankey` próprio (~2-3 colunas, layout fixo) — reversível.

## A página — anatomia

`/relatorios/operacionais?aba=adocao&janela=30` — três camadas:

```
┌ Adoção ──────────────────────────────────────────────────────────┐
│ [7d] [30d] [90d]   papel: [Todos] [Coord] [Mentor] [Mentorado]…    │ régua própria
│                                                                    │
│ ┌ Pessoas ativas ┐ ┌ Gestos/dia ┐ ┌ Superfícies vivas ┐ ┌ Resposta ┐│ L1 — KPIs
│ │  148  ↑12%     │ │  3,4 mil   │ │   14 de 17        │ │  68%     ││ (hero = ativas)
│ │  vs 30d ant. ▁▃▅ │ │  por dia   │ │  3 paradas >14d   │ │ em ≤14d  ││
│ └────────────────┘ └────────────┘ └───────────────────┘ └──────────┘│
│                                                                    │
│ ┌ Quem usa o quê — pessoas únicas por superfície × papel ─────────┐│ L2 — o herói
│ │                 coord  mentor  ment.do  superv  espec  │ total   ││ MapaCalor
│ │  ficha_dupla     ▓▓▓     ▓▓▓▓    ▓▓      ▓       ·       │  142    ││
│ │  agenda          ▓▓      ▓▓▓     ▓       ▓       ·       │  118    ││
│ │  materiais       ▓       ▓▓      ▓▓▓     ·       ▓       │   97    ││
│ │  …                                                         │       ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                    │
│ ┌ Eventos por dia (empilhado por papel) ┐ ┌ Funil de instrumentos ┐│ L2 — formas
│ │  GraficoTempo barras                  │ │ emitido→respondido    ││
│ └───────────────────────────────────────┘ └───────────────────────┘│
│                                                                    │
│ ┌ Coorte de retorno ┐  ┌ Caminhos — sequências mais percorridas ──┐││ L2 — retenção/jornada
│ │ sem 0  sem 1  +2   │  │ home → agenda → ficha_dupla   41 pessoas ││
│ │ S/nov   82%  64%   │  │ home → duplas → ficha_dupla   38 pessoas ││
│ └────────────────────┘  └─────────────────────────────────────────┘│
│                                                                    │
│ ┌ Superfícies — a lista de trabalho ──────────────────────────────┐│ L3 — tabela
│ │ superfície   gestos  pessoas  papéis        último   tendência   ││ (kill/melhorar/
│ │ chamados       812     34     coord         hoje     ▂▅▃  (spark)││  ensinar)
│ └─────────────────────────────────────────────────────────────────┘│
│ ┌ Gestos recentes ─ (Realtime, feed vivo) ────────────────────────┐│ L3 — confiança
│ └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### L1 — KPIs (4, um dominante)

Tile quiet-chrome: número grande `tabular-nums`, rótulo kicker, delta
**com palavras** ("↑ 12% vs. os 30 dias anteriores" — nunca só seta/cor)
+ sparkline muda do período. Hero = **Pessoas ativas** (topo-esquerda,
F-pattern) porque é a pergunta-mãe da adoção.

| Tile | Medida | Denominador/contexto |
|---|---|---|
| Pessoas ativas | `count(distinct profile_id)` na janela | vs. janela anterior equivalente |
| Gestos por dia | eventos/dia (média) | total da janela ao lado |
| Superfícies vivas | superfícies com ≥1 gesto | "14 de 17" + as paradas nomeadas |
| Taxa de resposta | respondido/emitido (instrumentos) | "em até 14 dias" — janela declarada |

### L2 — MapaCalor (a peça central)

`MapaCalor` (`viz/mapa-calor.tsx` `[NOVO]`): linhas = superfícies
ordenadas por uso; colunas = papéis (`coordenacao`, `mentor`, `mentorado`,
`supervisor`, `especialista` — as que aparecerem). Célula = número
impresso dentro + intensidade = escala seqüencial de **uma** família de
matiz (proposta: `--brand-lime`/`ink` de 0→saturado — nunca arco-íris;
a pesquisa e o kit concordam). Coluna "total" à direita; linha "total"
embaixo. Célula 0 = vazio de trilho (o buraco honesto — **é** o dado:
superfície morta ou papel errado). Clique na célula → drill: pessoas
daquele papel naquela superfície. `role="grid"`/`table` — heatmap **é**
uma tabela: leitura de célula grátis, sem hack de canvas.

**Toggle pessoas/gestos (decidido)**: a régua do mapa tem um chip
pessoas únicas × gestos — `count(distinct profile_id)` × `count(*)`.
Pessoas responde "adoção"; gestos mostra intensidade (e infla com power
users — vale ver os dois).

Respostas que ele entrega de relance: feature morta (linha zerada),
feature de público errado (mentorado em superfície de staff), adoção de
papel inteiro fraca (coluna fraca = onboarding daquele papel falha).

### L2 — Eventos por dia

`GraficoTempo` existente, `tipo="barras"` — um slot por dia. Recorte por
papel vem da régua (re-fetch), não de empilhamento de cores — menos
tinta, mesma resposta. Se a curiosidade "por papel simultâneo" for
frequente, v2 com barras empilhadas `--chart-N`.

### L2 — Funil de instrumentos

`FunilEtapas` (`viz/funil-etapas.tsx` `[NOVO]`): uma linha por
instrumento — **emitido → respondido** ("aberto" não existe nos dados;
a etapa foi cortada pela auditoria). A largura da barra compara o volume
entre instrumentos; os segmentos dentro carregam o destino literal do
denominador (`BarraSegmentada`): **responderam** (ok cheio),
**responderam após o prazo** (ok/50 — meia vitória, não pendente),
**expiraram sem responder** (muted), **aguardando** (hatch neutro).
Conversão sempre com janela declarada ("em até 14 dias"). Links
`multi_uso` (campanha intake) viram linha rotulada "campanha aberta" —
sem denominador observável, a % deles não informa nada. Dados:
`avaliacao_links` + `formulario_links` × `formulario_respostas`.

### L2 — Coorte de retorno

`CoorteGrade` (variante do `MapaCalor`, `viz/coorte-grade.tsx` `[NOVO]`):
linhas = semana do primeiro evento da pessoa; colunas = semanas
seguintes (0…N); célula = **% de pessoas da coorte ativas** naquela
semana, escala compartilhada, número dentro. Responde "o uso fica ou é
one-off?" — a métrica que separa adoção de curiosidade. Triângulo
honesto: coortes novas têm menos colunas (sem zero inventado).

### L2 — Caminhos (em vez do sankey)

`CaminhosFluxo`: as 6-8 sequências superfície→superfície mais
percorridas na janela, como cadeia de chips com `→` e o nº de pessoas —
sessionização simples (sequência de pageviews por profile/dia). Muito
mais legível que sankey nesta escala e cobre 90% da pergunta "como as
pessoas navegam". Se `meta.sessao`/path completo pesar, v1 = pares de
transição mais frequentes.

### L3 — Tabela de superfícies (a lista de trabalho)

Stripe-style: uma linha por superfície — gestos, **pessoas únicas**,
papéis que usam (pills mini), último uso, spark de tendência. Ordenável;
clique → superfície em detalhe (drill por query param). É a lista
operacional "melhorar / matar / ensinar" — a decisão que a aba existe
pra alimentar.

### L3 — Gestos recentes (Realtime)

Feed append-only: `superfície · ação · papel · há Xmin` — o canal
Supabase Realtime em `produto_eventos` (ticket pede; é barato e dá
confiança no dataset — você vê o dado nascer). Cap de ~30 linhas,
`aria-live="off"` (não é alerta).

## Estados, a11y, movimento

- **Acumulando** (<7d de eventos ou janela vazia): estado estilo aba
  Saúde — "Coletando desde {data}; volte em alguns dias", nunca gráfico
  vazio fingindo dado.
- **Loading**: `loading.tsx` da rota + skeletons com o mesmo layout dos
  cards (altura real do heatmap, não spinner).
- **Erro parcial**: cada bloco busca o seu; falha num dado vira card
  com mensagem + retry, não página quebrada.
- **a11y**: todo viz tem `role="img"`+leitura ou é `table` de verdade;
  `MapaCalor`/`CoorteGrade` navegáveis por setas; valores sempre em
  texto (intensidade é reforço, nunca o único canal — mesma regra do
  semáforo).
- **Movimento**: `.animate-enter` stagger nos cards; `fill-grow` nas
  barras do funil; transições de width/height nas trocas de janela;
  guard global de reduced-motion cobre tudo.
- **Demo**: `demoAdocao*` — gerador sintético determinístico (demo não
  coleta eventos reais; sem ele a aba fica cega na demo/review). Mesmo
  padrão de `demoTendenciaSaude`.

## Camada de dados

Agregação **server-side** (RSC → props tipadas). Para dashboards fixos
isso é mais simples e testável que DuckDB-WASM no browser — e mantém o
SSR/demoparity de graça. O ticket reserva o DuckDB-WASM pro explorador
ad-hoc (fase B); para a aba fixa, SQL resolve folgado em ~100k eventos/janela:

- `rpc adocao_resumo(p_desde)` → KPIs (ativas, gestos/dia, sups vivas, resposta)
- `rpc adocao_matriz(p_desde)` → superfície × papel de pessoas únicas
- `rpc adocao_serie_dia(p_desde)` → eventos/dia (×papel se recortado)
- `rpc adocao_coorte()` → grade semanal
- `rpc adocao_caminhos(p_desde)` → top sequências/pares
- funil: deriva de `avaliacao_links` + `formulario_links`/
  `formulario_respostas` (query composta, não evento)
- `lib/adocao.ts` `[NOVO]` — tipos + derivações puras (ordenação do
  heatmap, totais, deltas) testáveis com Vitest
- **Tool da Liza**: `adocao_por_superficie` lê as mesmas RPCs — fonte única

DuckDB-WASM + export parquet ficam para a fase B (explorador ad-hoc) —
o custo (worker, ~7MB wasm, COOP/COEP do bundle eh) não se paga em
painel fixo; onde ele brilha é fatiar por qualquer dimensão sem query
nova. Recomendação: manter no ticket como destino, não como fundação.

## Ordens de entrega (PRs)

1. **Dados**: RPCs de agregação + `lib/adocao.ts` + testes + gerador demo.
2. **Viz**: `MetricTile`(KPI), `MapaCalor`, `FunilEtapas`, `CoorteGrade`,
   `CaminhosFluxo` — componentes puros com stories internos/specs.
3. **Aba**: `aba=adocao` no workbench — régua janela/papel, L1→L3,
   estados, Realtime no feed.
4. **Fechamento**: tool `adocao_por_superficie` da Liza + track points
   server-side pendentes (nudge, form_emitido já na whitelist).
5. **Fase B (ticket, fora desta rodada)**: export parquet +
   DuckDB-WASM explorer + retenção 90d/rollups.

## Decisões tomadas (jan/2026)

1. **Viz híbrida** — kit da casa pra todos os painéis desta rodada;
   ECharts vira escape hatch lazy só se um sankey real fizer falta.
   `CaminhosFluxo` cobre a pergunta de jornada.
2. **Dados: SQL server-side** — RPCs de agregação → props RSC.
   DuckDB-WASM + parquet ficam pra fase B (explorer ad-hoc, onde ele
   se paga).
3. **Célula do heatmap = toggle** — pessoas únicas × gestos na régua
   do mapa; as duas perguntas respondidas, default pessoas.

## Revisões da auditoria pós-spec (jan/2026)

Correções que a auditoria obrigatória trouxe antes da aba subir:

- **Beacon carimba `meta.ts`** (epoch ms do client): o lote grava num
  statement só e `transaction_timestamp()` empataria os 20 eventos — a
  sessionização dos caminhos depende da ordem real. `created_at` usa o
  ts quando plausível (±1h/5min), senão `now()`.
- **Sessionização = profile×dia** (a sessão não cruza meia-noite) e
  `p_papel` chega a resumo/caminhos (o recorte da régua vale pra aba
  inteira; **coorte fica fora** — retenção é dimensão-pessoa, o papel
  gravado é por-evento, e a UI declara isso no card).
- **`SUPERFICIES` reconciliado com os emissores reais** (17 rotas sob os
  layouts com beacon): entram turmas/ajuda/assinar/assistente, saem
  comunicados/onboarding (nunca existiram como rota).
- **Coorte com zeros reais**: `generate_series` por coorte até a semana
  corrente — "0% real" agora é célula, não célula ausente (ausente =
  futuro). Cap de 12 coortes.
- **`tardios` no funil** + linha de **campanha** rotulada (multi_uso).
- **Migration endurecida**: revoke public/anon, publication idempotente,
  `coletando_desde` no resumo, `tendencia` por superfície (spark da L3).
