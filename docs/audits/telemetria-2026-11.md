# Auditoria ws11 — Telemetria e inteligência (nov/2026)

**Data:** 19/nov/2026 · **Branch:** `plan/telemetria-nov` · **Escopo:** os 4
itens do brief ws11 — bug do explorador DuckDB, telemetria rica, camada de
inteligência nos gráficos e "Perguntar à Liza" nos relatórios.
**Método:** leitura do código/migrations/docs com evidência `arquivo:linha`.
Sem escrita em `src/` — esta auditoria alimenta `specs/008-telemetria-nov/`.

## 1. Bug DuckDB — explorador não abre (`parquet.duckdb_extension.wasm`)

**Erro reportado:** `Failed to load
https://extensions.duckdb.org/v1.5.4/wasm_eh/parquet.duckdb_extension.wasm`.

### Pipeline hoje

- O explorador é coord-only dentro da aba Adoção
  (`/relatorios/operacionais?aba=adocao`; a página redireciona não-coord em
  `src/app/(app)/relatorios/operacionais/page.tsx:80`; a seção renderiza
  `AdocaoExplorador` em `secao-adocao.tsx:533`).
- Abrir dispara `import()` lazy de `@/lib/adocao-duckdb`
  (`adocao-explorador.tsx:75`) → `criarBancoEventos` → `selectBundle`
  mvp/eh com wasm e workers **self-hosted**, emitidos como assets pelas
  `turbopack.rules` de `next.config.ts:72-77`
  (`src/lib/adocao-duckdb.ts:53-59`). Sem bundle `coi` → sem threads → sem
  COOP/COEP (correto; `adocao-duckdb.ts:7-8`).
- Fetch do parquet em `/api/adocao/export?formato=parquet&desde=` →
  `registerFileBuffer` → `create or replace view eventos as select * from
  parquet_scan('eventos.parquet')` (`adocao-duckdb.ts:62-80`).
- O export é escrito server-side por `hyparquet-writer` (JS puro —
  `src/app/api/adocao/export/route.ts:2,78,151`). Escrever parquet nunca
  precisou de DuckDB; **ler** dentro do wasm precisa da extensão.

### Causa raiz (ordenada por evidência)

1. **CSP bloqueia o CDN de extensões — quase certa.**
   `parquet_scan` não está linkado no wasm: o DuckDB autoloadeia
   `https://extensions.duckdb.org/v{DUCKDB_VERSION}/{plataforma}/parquet.duckdb_extension.wasm`
   no bind da query (`v1.5.4` = versão do engine embutida neste build
   `1.33.1-dev57.0`, `wasm_eh` = variante eh do `selectBundle`). O
   `connect-src` é `'self' https://*.supabase.co wss://*.supabase.co`
   (`next.config.ts:26-31`) — `extensions.duckdb.org` não está lá. O
   browser aborta o XHR do worker antes da rede. Os autores previram o
   `WebAssembly.instantiate` (`'wasm-unsafe-eval'` em
   `next.config.ts:12-18`), não o download runtime da extensão. A
   mensagem "Failed to load <url>" casa com falha de transporte, não 404.
2. **Extensão não publicada para `v1.5.4`/`wasm_eh` — secundária mas
   estrutural.** O pin é um dev-tag npm; a URL é derivada da versão do
   engine, então qualquer pin cuja versão base não tenha wasm publicado
   404a mesmo com CSP aberto. Verificar a existência do arquivo no
   ambiente antes de escolher a correção.
3. **Descartadas:** `wasm-unsafe-eval` já existe; worker é same-origin
   (`worker-src` cai em `script-src`/`default-src 'self'`); não há
   COOP/COEP necessário.

### Lacuna de proteção

Nenhum teste cobre o bootstrap (`registerFileBuffer` + `parquet_scan`).
`docs/regression-map.md:34` só trava janela×retenção do export. A classe
de regressão "dependência de rede nova dentro do worker vs. CSP" é
invisível em CI — a correção deve vir com guarda (ver plan.md).

### Opções de correção

| # | Opção | Efeito | Trade-off |
|---|---|---|---|
| A | `extensions.duckdb.org` no `connect-src` (`next.config.ts:26`) | desbloqueio em 1 linha | dependência externa em runtime (coord abre → hit no CDN; IP/availability/offline); continua 404ando em pin sem extensão publicada |
| B | **Self-host da extensão + `SET custom_extension_repository`** — vendor `parquet.duckdb_extension.wasm` de `wasm_eh` **e** `wasm_mvp` em `public/duckdb-ext/v1.5.4/{wasm_eh,wasm_mvp}/`, `SET` antes do `parquet_scan` (`adocao-duckdb.ts:62-80`, roda fora do guard do usuário) | mesmo-origem → sem CSP novo, determinístico, offline-ok, assinatura válida | layout `{versão}/{plataforma}/` precisa espelhar o pacote — re-vendor a cada bump + script de verificação |
| C | `registerFileBuffer` do `.duckdb_extension.wasm` + `LOAD` do path registrado | mesmos ganhos de B sem `public/` | depende de a build wasm aceitar extensão por path — confirmar na API da versão pinada |
| D | Remover a extensão: decodificar parquet no client com **`hyparquet@1.32.0` (já está na árvore via `hyparquet-writer`, `pnpm-lock.yaml:2659`)** e `conn.insertArrowTable` (`apache-arrow@17` já é dep do duckdb-wasm, `pnpm-lock.yaml:4511-4514`) | zero rede de terceiro | segundo leitor de parquet + passo de conversão a mais; mais código que B |
| E | Trocar o formato do export (JSON/CSV) | remove a extensão | quebra o contrato do attachment parquet pra análise externa (`route.ts:12-14`) e perde compressão |

**Recomendação:** B (durável, coerente com o wasm/worker já vendored).
A como mitigação imediata se o bug estiver bloqueando operação — mas a
janela de exposição fica registrada como desvio.

## 2. Telemetria rica — o que já existe × o que falta

### Existe (REALIZA-417 + 433, já em produção)

- Tabela `produto_eventos(id, profile_id, papel, superficie, acao, meta
  jsonb, created_at)` (`supabase/migrations/0197_produto_eventos.sql:16-24`)
  + índices `(profile_id,created_at)`, `(created_at)`,
  `(superficie,acao,created_at)` (`0197:26-31`).
- Escrita só por RPC `registrar_produto_eventos(jsonb)`, `security
  definer`, whitelist `WHERE e.acao IN (...)` — última versão em
  `0203_produto_eventos_clique.sql:15-56`; `profile_id`/`papel` saem do
  JWT, `meta.ts` honrado em ±1h/+5min (`0203:29-45`); `LIMIT 20`/lote
  (`0203:53`); execute → `authenticated` (`0203:61-64`).
- RLS: `select` para `authenticated`, policy `profile_id=my_profile_id()
  OR my_role()='coordenacao'` (`0197:33-46`). Revoke de anon/public.
- Beacon client `ProdutoTelemetry` montado nos 2 shells autenticados
  (`src/app/(app)/layout.tsx:219`, `src/app/(jovem)/jovem/layout.tsx:189`):
  fila 20 + flush 8s/pagehide/hidden, `sendBeacon`→`fetch keepalive`
  (`src/components/produto-telemetry.tsx:22-53`). Endpoint
  `POST /api/produto-eventos` sempre 204 (`src/app/api/produto-eventos/route.ts:12-38`).
- Gestos automáticos já coletados: **pageview** com `meta={ts,vw,vh,dev}`
  (`produto-telemetry.tsx:82-101`) e **clique** com `meta={x,y,vw,vh}` +
  `alvo` opt-in via `data-telemetry-alvo` ≤48c (`:103-160`) — vw/vh e
  x/y do brief **já são coletados** desde o 0203.
- Emissor server-side espelhado (`src/lib/produto-eventos-server.ts:38-50`)
  + `superficieDaOrigem()` por Referer (`:20-34`).
- Agregações coord: 7 RPCs `adocao_*` `security invoker`
  (`0198:77-303`); aba completa em `secao-adocao.tsx` (KPIs, MapaCalor
  superfície×papel, série diária, funil, coorte, caminhos, tabela L3,
  feed Realtime `gestos-vivos.tsx`, explorador SQL).
- Retenção: cru 90d → poda diária `produto_eventos_reter` +
  rollup `produto_eventos_dia(papel×superficie×ação, sem profile_id)`
  (`0201:19-91`); job `retencao_produto` no tick
  (`src/lib/jobs-retencao.ts:10-17`, `src/app/api/jobs/tick/route.ts:45`,
  `vercel.json:7-8`).
- Precedente de sessão/duração: `registro_tentativas` (0126) —
  `duracao_ms`, `etapas jsonb`, `dispositivo`, RPCs definer
  iniciar/atualizar/concluir, self+coord/supervisor (`0126:74-79`).
- Paridade travada: `tests/paridade-ts-sql.test.ts:36-54` exige
  `AcaoProduto` (TS, `src/lib/produto-eventos.ts:7-16`) ≡ whitelist da
  RPC. Ação nova = migration + union + `ROTULO_ACAO`
  (`gestos-vivos.tsx`) + pesos demo (`relatorios/adocao.ts`).
- Presets do explorador **já consultam** heatmap 10×10 normalizado por
  vw/vh (`src/lib/adocao-sql.ts:84-103`) e viewport/dev (`:105-125`) —
  o SQL de renderização existe, falta a coleta completa e o painel fixo.

### Falta (o delta do brief)

- **Gestos além de pointerdown:** rolagem (profundidade), gestos de
  arrastar/swipe, permanência/duração por superfície — nada instrumentado.
- **Duração em tela:** hoje só derivável por delta entre pageviews —
  frágil porque o pageview é deduplicado por superfície
  (`produto-telemetry.tsx:82-101`: ficha A→ficha B não emite) e
  "tempo na última tela" nunca sai (sem evento de saída).
- **`data-telemetry-alvo` definido e nunca usado** — zero JSX carrega o
  atributo (`produto-telemetry.tsx:137-143`): gestos nomeados (CTA, FAB)
  dependem de instrumentação que ainda não existe.
- **Dimensão por pessoa nos painéis:** existe no cru e no preset
  "jornada" (`adocao-sql.ts:62-82`) e no feed `adocao_recentes`, mas
  nenhum painel fixo renderiza trilha por pessoa.
- **Rollup perde o rico:** `produto_eventos_dia` é papel×superficie×ação
  — heatmap/scroll/duração morrem no dia 91. Decisão de design pendente:
  aceitar janela de 90d pro rico ou rollup dedicado (ex.: grade 10×10
  por dia×superficie×papel).
- **Caps que o volume rico vai estourar:** fila/lote de 20 em 3 lugares
  que precisam andar juntos (`produto-telemetry.tsx:23`,
  `api/produto-eventos/route.ts:10`, `0203:53`); `meta` sem teto de bytes
  (só `superficie` é truncada, `0203:34-38`).
- **Drift de doc LGPD (corrigido nesta PR):**
  `docs/lgpd/inventario-dados.md` citava "0197/0198/0202" e omitia
  `clique` e as chaves `x/y/vw/vh/dev/alvo` de `meta` — a migration real
  é a 0203 (0202 é `jovem_ficha_sem_origem`).
- **Disciplina sem-PII já é regra de código** — meta só numérica/enum,
  sem seletor CSS nem texto de elemento (`produto-telemetry.tsx:103-149`);
  a telemetria rica herda a mesma régua.

## 3. Camada de inteligência nos gráficos — bases e buracos

- **Filosofia registrada** (`docs/planos/relatorios-inteligencia.md:110-130`):
  "o que é conta fica em SQL/TS; o que é linguagem pode virar LLM —
  depois". Capacidade 3 = risco explicável por **regras + pesos em TS**
  (o semáforo `saudadeDaDupla` já prova o padrão); LLM só redige sobre
  agregados. Regra prática: LLM trafega agregados/estruturados; texto
  livre de/sobre menor exige parecer (gate REALIZA-178/179/180,
  `docs/lgpd/README.md`).
- **Kit viz próprio** (`src/components/viz/`): `MapaCalor`,
  `GraficoTempo`, `BarraSegmentada`, `CoorteGrade`, `CaminhosFluxo`,
  `FunilEtapas`, `MetricTile`, `Sparkline` — SVG/DOM sem lib de chart;
  gramática: denominador exposto, status nunca só-cor, leitura/tabela
  fallback (`docs/planos/issues/REALIZA-417/design.md:18-23`).
- **Filas acionáveis já existem** nas abas operacionais (padrão
  spec-003: resumo + fila + tabela colapsada) — a camada de inteligência
  adiciona o "por que agora" e a priorização, não o inventário.
- **Buraco:** nada hoje transforma número em leitura — não há derivação
  tipo "o que mudou / o que pede ação / por que". É derivação pura
  testável (Vitest), não LLM — coerente com o brainstorm e com a A3.
- **Legenda clara:** os viz já carregam legenda nomeada/denominador; a
  camada deve padronizar "como ler este gráfico" por painel.

## 4. "Perguntar à Liza" nos relatórios — bases e buracos

- **Ponte existe:** `pedirALiza(pergunta)` → CustomEvent
  `realiza:liza-pedido` → bolha abre e envia (`src/lib/liza-pedido.ts:7-13`,
  `assistente-bolha.tsx:767-789`); consumidores atuais:
  `PedirLizaPersonalizar` em documentos/materiais. Limitações: chega como
  texto puro; `pagina` é só pathname (regex sem `?` — `?aba=`/`?turma=`
  do recorte se perdem); a bolha só monta com `IA_BOLHA=1` ou demo
  (`layout.tsx:185-195`).
- **Fluxo chat:** `POST /api/ia/chat` → `ia_contexto_e_limite` (20
  req/60s por profile, fail-closed, emite `request_id`) →
  `systemPromptIa(papeis, pagina)` → roteador de tier → provider
  OpenAI-compatible (opencode Go, `IA_API_BASE/KEY/MODEL`,
  `src/lib/ia/provider.ts`) → tools por papel → SSE. Telemetria por
  mensagem em `ia_eventos` (tokens/custo/tier/`prompt_v`).
- **Persistência:** nenhuma tabela de artefato IA em relatórios hoje —
  transcript é client-side `localStorage` 30d (`assistente-conversa.tsx:105-141`).
  Precedente certo: `matching_perfis` (`0151`) — artefato gerado com
  `doc_hash` gateando regeneração + campos preservados em falha
  (`matching.ts:97-126`); `ia_confirmacoes` (`0163`) — RPC definer +
  sha256 de args canônicos; `ia_eventos` append-only ⇒ card novo =
  supersede-insert, não update.
- **Custo/cota:** reuso direto de `consumir_limite_ia` (mesmo slot
  20/min); canal novo `'relatorio'` pede migration de CHECK (precedente
  `'importacao'` na 0193). Cache de resposta completa **não existe** —
  `contexto_hash` (sha256 do recorte+dados canônicos) decide
  servir-ou-regenerar, espelhando `docHash`.
- **Escopo de papel:** relatórios são coord-only (página redireciona) —
  o card nasce coord-only; tool/toolset de leitura de relatórios já
  existe parcialmente (`adocao_*` tools, `tools.ts:722-819`).
- **LGPD:** prompt carrega agregados/estruturados — nunca texto livre de
  registro nem `*_pessoal` (mesma régua das tools com SELECT allowlist,
  `src/lib/ia/queries.ts:11-14`). Ainda assim é prosa persistida sobre o
  programa: decisão registrada no brainstorm como "ativa amanhã" só no
  tier de agregados (`relatorios-inteligencia.md:123-130`).
