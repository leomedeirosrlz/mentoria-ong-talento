# Feedback — /registros + identidade visual de dashboard (coord)

Telas: `src/app/(app)/registros/page.tsx` + `src/components/registro-card.tsx`
+ `registros-filtros.tsx` — e transversal: as telas de coord ganharem
"cara de dashboard".

## Itens do feedback

1. **"A parte de registros…"** (frase cortada) + **"no geral, nas telas,
   pode ter mais cara de dashboard pra coord acompanhar melhor — gráficos
   de barra, circulares, linhas, etc. Um design mais criativo."**
   A leitura atual é lista+filtro. A coord quer: panorama visual do ciclo
   — avaliações por semana (linha), volume de registros por turma (barra),
   distribuição de dificuldade/sinais (donut), etc.

**Spec travada**: ✅ `docs/mockups/registros/v2.html` aprovado ("muito
melhor") — com acréscimos do Thiago pra **implementação** (limitação do
mock estático): gráficos ganham **parametrização** (escolher o que a
barra/linha mostram — ex.: avaliação média × individual, métrica por
gráfico) e **mais interatividade** — "pode encher de animações quando
for implementar". Transições animadas ao trocar métrica/recorte;
valores interpolam (não repaint seco).

(v1 rejeitado — "ficou feio": número em cada trilho e cada barra,
cores alternadas T1/T2 por coluna, labels em todos os pontos.)

## Direção

- **`/registros` coord**: faixa "Panorama do ciclo" no topo (spec = mock
  v2 quando aprovado) — gráficos honestos com os dados que já existem:
  - barras: registros entregues vs. esperados por encontro (trilho =
    duplas ativas do cronograma — o buraco é a falta, honesto);
  - linha: **avaliação média ★ do jovem (1–5)** por encontro;
  - donut: semáforo das duplas do recorte.
  Sem biblioteca nova se der pra fazer em SVG/DIV (a casa já desenha a
  roda da vida em SVG — seguir esse padrão, sem recharts pesado).
- **Transversal**: essa é a mesma demanda dos KPIs de materiais
  (`materiais-coord.md`) — números soltos viram visualização com
  proporção. Vale um mini-kit compartilhado (`src/components/viz/` ou
  similar): BarraSegmentada, Sparkline, Donut — usado pelos dois planos.
- Animação de entrada nas barras (grow from 0) respeitando
  `prefers-reduced-motion` — mesma regra da filtragem
  (`visao-geral-duplas.md` item 3).

## Critérios de aceite

- [ ] `/registros` (coord) abre com pelo menos uma visualização agregada
      real (barra por encontro ou linha de avaliação média) com dados do
      recorte filtrado — não decorativa.
- [ ] Filtros da página mudam os gráficos (o viz lê o mesmo dataset do
      list abaixo).
- [ ] Sem lib de chart pesada adicionada sem justificar; SVG/divs com
      tokens da casa (`--ok`, `--warn`, `--brand-lime`, `--chart-*` se
      existirem).
- [ ] Mobile 390px: gráficos legíveis (rótulos truncam com title/tooltip,
      barras empilham verticais se necessário); sem overflow-x.
- [ ] `prefers-reduced-motion`: entrada instantânea.
- [ ] tsc/eslint limpos; specs de registros verdes.

## Mapa de regressões e gaps (review out/2026)

### Estado atual mapeado

- **Guarda de rota**: `src/app/(app)/registros/page.tsx:99` — só
  `coordenacao` e `supervisor` entram (`mentor_dpp`,
  `mentor_especialista`, `mentorado` → `redirect("/")`); `souCoord`
  (:100) destrava ações coord-only no card. A faixa de panorama herda
  o papel do guard — pro supervisor a RLS já recorta a visão dele (só
  duplas supervisionadas; é o "mesmo painel recortado" do feedback, de
  graça — desde que os dados venham pelos mesmos canais RLS).
- **Filtros atuais** (`parseFiltros`, page.tsx:52-92): `encontro` (nº),
  `avaliacao` (enum **qualitativo do mentor**:
  `excelente|boa|regular|baixa`), `apoio`, `dificuldade` (`com` ou
  valor do enum), `dupla`, `q`, `tardio`, `pagina` — mais `ordem`
  (`recentes|prioridade|antigas`) e `grupo` (`dupla|semana|avaliacao`)
  na URL. `FiltrosRegistro` vive em `src/lib/queries.ts:850-864`.
  **Não existe filtro de turma nem de período** — as pills de turma e
  o seletor de período do mock v2 são dimensões novas (o próprio mock
  lista como decisão em aberto: "pill de turma filtra só o painel ou
  a página inteira?").
- **Payload da lista**: `RegistroResumo` (queries.ts:830-848) +
  `REGISTRO_RESUMO_SELECT` (:868-882) — campos do registro +
  `encontro!inner` (id, numero, data_hora, realizado_em, status, dupla
  {id,status,trilha,cronograma_id,mentor,mentorado}) +
  `encaminhamentos(id)` + `anexos(id)` + `autor(nome)`.
  **`avaliacoes_encontro` não vem** — a linha ★ 1–5 do mock não tem
  fonte nesse select.
- **Server × client**: ordenação e `range` são server-side
  (`REGISTROS_PAGINA = 100`, paginação cumulativa — `pagina` é
  "mostrar mais"); `tardio` é filtro JS pós-query (PostgREST não
  compara duas colunas — por isso o `tardio` desativa o `range` e
  devolve o conjunto inteiro filtrado, queries.ts:884-942);
  `prioridade`/`antigas` ordenam a fatia em JS; agrupar
  (dupla/semana/avaliação) é `src/lib/registros.ts`. **Não existe
  nenhuma agregação de gráfico** — o panorama inteiro é código novo.
  `getAlertasRegistros` (queries.ts:945-985) já retorna
  `{apoio, baixa, comDificuldade, tardios}` globais ao papel — a
  página só renderiza `apoio` e `tardios` (page.tsx:369-396); `baixa`
  e `comDificuldade` são buscados e descartados.
- **★ do jovem**: tabela `avaliacoes_encontro` (migration 0071) —
  `estrelas` smallint 1–5, `encontro_id` unique → embed to-one
  `avaliacao_jovem:avaliacoes_encontro(*)`, já usado no `DUPLA_SELECT`
  (queries.ts:349-357). RLS: coord tudo; supervisor só supervisionadas;
  `mentor_dpp` só quando `avaliacao_visivel_mentor`; especialista não
  lê a tabela (a view `especialista_avaliacoes` expõe só estrelas das
  próprias sessões). Não confundir com `registros.avaliacao`
  (qualitativa do mentor) — alimentar a linha com ela troca a métrica.
- **Donut (semáforo)**: `saudadeDaDupla(dupla, eventos)`
  (ciclo.ts:1245-1340) precisa da `Dupla` completa — `getDuplas`
  (queries.ts:379) é o select mais pesado da casa. Alternativa na
  base: `dupla_saude_snapshots` (0107) guarda sinais derivados, mas é
  escrita por cron (`/api/jobs/tick`) — sem cobertura garantida em
  demo/staging; se o donut for de `DuplaSaude`, a fonte é decisão a
  tomar (e snapshot pode estar atrasado/ausente).
- **Denominador "esperados" das barras**: duplas ativas que deviam ter
  feito o encontro N na data do `ciclo_eventos` — precisa de
  `duplas.status`, `iniciada_em`, `cronograma_id`. `getDuplasOpcoes`
  **não** tem `status`/`iniciada_em` (só id, cronograma_id, nomes —
  usada hoje só pra popular o select do filtro). `encontroEsperado`
  (ciclo.ts:948) e `eventoDaSemana` (:1018) já calculam o "devia ter
  acontecido" por cronograma.
- **Tokens/motion**: `globals.css` tem `--ok/--warn/--danger/
  --info(+bg)/--brand-lime/--role-*` — **não existe `--pausa` nem
  `--chart-*`**: o mock usa `var(--pausa)` na fatia "Pausada" do donut;
  mapear pra token real (o `Seg` do dashboard usa
  `bg-muted-foreground/40` pra "sem encontro",
  dashboard-coordenacao.tsx:662 — barra segmentada privada, candidata
  natural à `BarraSegmentada` do mini-kit `viz/`). `motion` v13 já é
  dependência (`src/components/motion.tsx`: `T`, `EASE`, `fade`,
  `ExitList`); `prefers-reduced-motion` já tem guard global.
- **Demo**: `demoRegistros` (demo/queries.ts:1001) replica os filtros;
  `demoAlertasRegistros` (:1097), `demoDuplasOpcoes` (:1122); o dataset
  tem avaliações com `estrelas` (demo/data.ts:3613+, ids 44xx) — o
  panorama precisa de ramo demo próprio.
- **e2e**: `tests/e2e/demo/registros.spec.ts` cobre
  grupo/busca/chips/dialog/largura/mobile da lista; a banda nova entra
  com `aria-label` própria (o spec usa h1 "Registros" exact — sem
  colisão).

### Riscos de regressão por item

1. **Barra "entregues vs esperados"**: "entregue" = existe `registro`
   pro encontro da dupla (o buraco é a falta — honesto, como o plano
   diz); conferir se o mock conta `encontro.status='realizado'` sem
   registro como buraco também. "Esperado" precisa de dados que hoje
   não chegam (ver denominador acima) — esticar `getDuplasOpcoes` muda
   contrato usado pelo filtro; preferir query agregada dedicada.
2. **Linha ★ 1–5**: não derivar de `itens` — a avaliação mora no
   encontro e existe **mesmo sem registro** (link mintado pelo trigger
   0071), e `itens` é a fatia paginada: "Mostrar mais" mudaria o
   gráfico ("o viz lê o mesmo dataset do list" = dataset filtrado
   completo, não a janela carregada). Pior: filtro `encontro=N`
   esvaziaria a série temporal.
3. **Donut**: grão diferente — lista é de registros, semáforo é de
   duplas. Definir "duplas do recorte" (ativas do ciclo? as que
   aparecem na lista? a turma da pill?). Com `dupla=X` ou
   `encontro=N` o donut vira um ponto — comportamento a decidir.
4. **Paginação**: nunca agregar a fatia (`range` corta em 100;
   `pagina` acumula). Com `tardio` o conjunto inteiro já vem — os dois
   caminhos têm que dar o mesmo número ou o gráfico muda com o filtro.
5. **Quais filtros valem pra qual gráfico**: `q`/`avaliacao`/`apoio`/
   `dificuldade` filtram registros — fazem sentido no numerador, não
   no denominador "esperadas" (que não depende de texto buscado).
   Fixar por gráfico quais dimensões do `FiltrosRegistro` se aplicam,
   senão "filtros mudam os gráficos" fica ambíguo.
6. **Trilha especialista**: encontros esp não estão em `ciclo_eventos`
   — barras "por encontro N" são DPP-only; `passoEsp`
   (page.tsx:136 + `getEncontrosPorDuplas`, queries.ts:523) resolve o
   card, mas o panorama precisa de política explícita (ignorar esp ou
   eixo separado por passo).
7. **`var(--pausa)` e lib de chart**: mapear cores do mock pra tokens
   reais antes de codar; `recharts`/lib nova só com justificativa
   (critério já cobre — `Seg` + SVG da roda da vida são precedente da
   casa).
8. **`loading.tsx` de /registros** espelha a lista — a banda pede
   skeleton próprio pra não dar flash de layout; e a tela é a 1ª
   página de coord/supervisor: custo de render entra no caminho
   crítico da home deles.

### Gaps do plano

- Não escolhe a fonte da linha ★ (embed to-one dentro do `encontro`
  do `REGISTRO_RESUMO_SELECT` vs. query agregada própria vs. RPC de
  série) — a decisão muda custo e desenho, e o select atual não a
  carrega.
- Decisões em aberto do mock v2 (notas no fim do HTML) não foram
  transcritas: pill de turma filtra página ou painel? período corta
  qual data (`realizado_em`/`data_hora`/`created_at`)? filtros finos
  alimentam o viz?
- `?turma=`/`?periodo=` não existem em `FiltrosRegistro` — turma é por
  `encontro.dupla.cronograma_id` (a string `turma` da dupla é snapshot,
  ver plano turmas), período corta data do encontro — contrato novo.
- Custo do semáforo (`getDuplas` pesado vs. snapshot 0107 vs. select
  magro) não foi decidido.
- Parametrização/interatividade extra (métrica por gráfico, transições
  animadas) não tem desenho de estado: vive na URL como os filtros ou
  é estado local do painel?
- Critério demo: o dataset tem avaliações, mas a agregação demo
  precisa existir pra spec/demo seguirem verdes.

### Opções de melhoria não cobertas

- Reusar `alertas.baixa`/`alertas.comDificuldade` (buscados e
  descartados hoje) como KPI chips do painel — custo zero.
- Barras/pontos do gráfico linkarem pra `?encontro=N` — fecha o loop
  viz → evidência sem navegação nova.
- `dupla_saude_snapshots` já guarda histórico — se um dia o donut
  quiser tendência, a tabela existe (fora de escopo).
- Extrair `Seg` (dashboard-coordenacao.tsx:662) como `BarraSegmentada`
  do `viz/` — menos código novo, idioma já usado na home.

### Must-read antes de implementar

- `docs/mockups/registros/v2.html` — incl. notas e decisões em aberto
  no fim do arquivo (pill turma, período, densidade).
- `src/lib/queries.ts:830-985` — `RegistroResumo`,
  `REGISTRO_RESUMO_SELECT`, `getRegistros`, `getAlertasRegistros`;
  `:349-357` o embed `avaliacao_jovem` + RLS (0071). ★ é do jovem;
  `registros.avaliacao` é outra métrica.
- `src/lib/registros.ts` — `agruparRegistros`/`registroTardio` (a mesma
  regra do filtro tardio).
- `src/lib/ciclo.ts:948` (`encontroEsperado`), `:1018`
  (`eventoDaSemana`), `:1245+` (`saudadeDaDupla`) — domínio do
  esperado/semáforo.
- `src/components/registro-card.tsx` + `registros-filtros.tsx` — o que
  já existe (badges, expand inline, resolver apoio coord-only,
  `draftDe` pra re-seed de draft).
- `src/components/motion.tsx` + `globals.css` — `EASE`/guard de
  reduced motion prontos; `dashboard-coordenacao.tsx:662` (`Seg`).
- `src/lib/demo/queries.ts:1001-1130` + `demo/data.ts:3613+` — ramo
  demo; `tests/e2e/demo/registros.spec.ts` — superfície a preservar.
