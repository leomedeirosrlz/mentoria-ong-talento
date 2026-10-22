# REALIZA-56 — software design

## 1. Arquitetura — camada acima do builder

`page.tsx` de `/relatorios` vira: **filtros (server, searchParams) → blocos
de dashboard (server components) → RelatorioBuilder** (inalterado, recebe os
mesmos filtros pra pré-selecionar turma). A grade atual continua — o usuário
que hoje usa ela não perde nada; o dashboard é a parte de cima.

Dados: **queries novas em `queries.ts`** (`React.cache`), compute puro em
`src/lib/relatorios-dash.ts` [NOVO] (testável Vitest). Sem view materializada:
~40 duplas + relacionados — agregação em memória sobre 3–4 selects já usados
(`DUPLA_SELECT`, `presencas`, `assinaturas`, `formulario_links` count).

## 2. Blocos — definição de cada métrica

Todos exibem **número + lista do porquê** (padrão semáforo — nunca métrica
opaca). Cada item lista links pra `/duplas/<id>`.

| Bloco | Definição exata |
|---|---|
| **Semáforo** | `saudadeDaDupla(d, evs, hoje)` por dupla filtrada → count por tom + lista `motivos[0]` por dupla em atenção/risco. Tendência: se `dupla_saude_snapshots` (182) tiver dados, sparkline `count(risco)` por semana; senão, oculta a mini-série (não quebra). |
| **Aderência** | por dupla: `encontroEsperado(evs, hoje, desde=iniciada_em)` × `feitos`; agregado = média ponderada (Σfeitos/Σesperado). Lista: duplas abaixo de 80%. |
| **Atraso de registro** | média de `diasAtrasoRegistro(registro, encontro)` das últimas 4 semanas; count de `registro_pendente` atuais (semáforo). |
| **Remarcações** | count de encontros `status='agendado'` com `motivo_reagendamento is not null` + top motivos agregados por texto normalizado. **Limitação explícita no rodapé do card:** "conta encontros remarcados, não o nº de remarcações — histórico por vez é follow-up". |
| **Apoio** | `saude.apoio.aberto` por origem (mentor/jovem/ambos) + idade do pedido (primeira interação `pedido_apoio` sem `apoio_resolvido` posterior — `interacoes`). Lista abertos por dias. |
| **Engajamento** | registros criados na semana corrente × esperado; "dias desde último registro" por dupla (max registros.created_at). Lista: >14d sem registro. |
| **Presenças formação** | `ciclo_eventos.tipo='formacao'` já ocorridos × `presencas` por evento; mentors sem `formacao_ok` listados. |
| **Instrumentos** | `formulario_links` por formulário: enviados × respondidos (`status`/`respondido_em`) — taxa por formulário oficial; links expirados sem resposta listados. |
| **Documentos** | `assinaturas` count por status (pendente/assinado/revogado/expirado) × `documento_templates`; pendentes >14d listados. |
| **Digest** | `textoResumoSemana(resumo)` — card com o texto pronto + botão copiar (já existe 80% — só renderizar). |

## 3. Filtros (searchParams)

`?turma=&cronograma=&dupla=&status=` — todos opcionais; `status` multi
(`?status=ativa,pausada`). `programa` **não existe** (47) — documentado no
card de filtros como "Turma" sendo o topo. URL é a fonte de verdade dos
filtros (link compartilhável de recorte — ex.: "as de risco da T2").

Escopo de cada filtro: `turma` → `duplas.turma`; `cronograma` →
`duplas.cronograma_id` + `ciclo_eventos` do cronograma; `dupla` → restringe
tudo a 1; `status` → `duplas.status in (...)`. Filtros aplicados no TS do
dashboard (não refazer queries por filtro — um fetch + filter em memória,
como agenda-coordenacao faz).

## 4. Componentes

- `DashFiltros` [NOVO] — `Select`s controlados que `router.push` searchParams;
  usa `Select`/`filterChipCls` existentes.
- `DashCard` [NOVO] — `Card` com título, métrica principal (nº grande),
  sub-lista `ItensAtenção` (nome+detalhe+link, max ~6 + "ver todas" que leva
  ao builder filtrado ou `/duplas`).
- `SparkSemaforo` [NOVO] — mini-série SVG inline (~40 linhas) dos snapshots;
  sem lib nova (o projeto não tem chart lib — desenho manual basta pra
  barras/pontos). Se optar por lib, **decisão de PR** — registrar custo.
- `DigestCard` [NOVO] — texto + botão copiar (`navigator.clipboard`, toast
  sonner — molde do botão copiar do builder).

## 5. Estados

- **Loading:** `loading.tsx` da rota com `Skeleton` (existe em ui/).
- **Vazio:** turma sem duplas → cards "Sem duplas neste recorte" (não zero
  solto — zero sem contexto parece bug).
- **Parcial:** snapshot ausente → bloco de tendência oculto com nota "a
  série começa com o job diário" (quando 182 estiver viva); presenças sem
  evento `formacao` → card some (não "0").
- **Stale:** `max(dia)` dos snapshots < hoje-2 → badge "dados até <dia>".
- **Permissão:** coord-only já garantido pela página.

## 6. Perf / volume

- 1 fetch `DUPLA_SELECT` (todas ativas+pausadas) + `ciclo_eventos` +
  `presencas` + `assinaturas` + `formulario_links` + `interacoes` (30d) +
  `registros` (30d) — ~6 queries paralelas (`Promise.all`, padrão
  `queries.ts`). Compute <50ms pra 40 duplas.
- `React.cache` por request — o builder embaixo reusa o mesmo fetch de
  duplas se for a mesma query (deduplicar via query compartilhada
  `getRelatoriosDataset(filtros)` — **recomendado**: uma query só que
  retorna tudo; builder e dash consomem fatias).

## 7. O que NÃO faz

- Sem PDF/export novo (CSV do builder + 68 cobrem).
- Sem histórico de remarcações por vez (lacuna de dados — follow-up).
- Sem `turmas`/`programas` (47).
- Sem superfície pra mentor/supervisor (dash é coord — semáforo já tem
  visões por papel nas páginas certas).
