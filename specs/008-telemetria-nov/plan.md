# Plano — telemetria rica e inteligência nos relatórios

**Spec:** `specs/008-telemetria-nov/spec.md` · **Status:** Draft

## Resumo técnico

- **US1 (bug):** vendor da extensão parquet do DuckDB-WASM em
  `public/duckdb-ext/<versão>/{wasm_eh,wasm_mvp}/` via script
  `scripts/vendor-duckdb-ext.mjs` + `SET custom_extension_repository =
  '<origin>/duckdb-ext'` no bootstrap antes do `parquet_scan`
  (`src/lib/adocao-duckdb.ts:62-80`). Mesmo-origem → CSP intacto.
  Guard-test novo assegura que o layout vendored casa com a versão do
  pacote pinado.
- **US2/US3:** ações novas `permanencia` e `rolagem` na whitelist (RPC
  redefinida), `data-telemetry-alvo` nos alvos declarados, e 4 RPCs
  `adocao_*` novas alimentando 3 painéis + drill por pessoa na aba
  Adoção — tudo sobre o `meta` jsonb existente, sem coluna nova no cru.
- **US4:** leitura determinística em módulo puro `src/lib/leituras-*.ts`
  (achados priorizados com métrica+denominador+ação), renderizada como
  bloco "Leitura" por aba piloto (Saúde, Adoção, Aderência).
- **US5:** tabela `relatorio_ia_cards` coord-only + action
  `perguntarLizaRelatorio` que monta contexto de agregados, consome a
  cota existente (`canal 'relatorio'` novo), gera com `chamarModelo`
  tier forte e persiste por supersede. `contexto_hash` alimenta badge
  "desatualizado" — nunca auto-regenera.
- **Não será criado:** lib de chart, endpoint público de beacon,
  `session_id`, rollup rico novo (ver decisão abaixo), segunda fonte de
  telemetria.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 ·
  Base UI · Phosphor.
- Supabase (Postgres + Auth + Storage + RPC); beacon via
  `POST /api/produto-eventos` (sempre 204); leitura coord por RPCs
  `adocao_*` invoker; cru retido 90d com rollup
  `produto_eventos_dia` (0201).
- Liza: provider OpenAI-compatible (opencode Go) em `src/lib/ia/` —
  `provider.ts` (chamarModelo/Stream), `roteador.ts` (tier),
  `rate-limit.ts` (`consumir_limite_ia`/`ia_contexto_e_limite`,
  20/min/profile, fail-closed), `config.ts` (`ia_config` + tetos),
  `prompts.ts`, `tools.ts` (registry com roles).
- Migrations em `supabase/migrations/NNNN_*.sql` — próximo número livre
  observado na auditoria: **0210** (conferir no momento da escrita).
- Testes: Vitest domínio puro · Playwright demo/app ·
  `tests/paridade-ts-sql.test.ts` trava AcaoProduto↔whitelist ·
  schema-contract no CI.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | US1 entrega o explorador funcionando de ponta a ponta (inclui estado falha/retry); painéis nascem com acumulando/vazio/erro; card da Liza sempre renderiza data+recorte ou empty state — sem placeholder | spec US1.c3, US3.c6, US5.c5; checklist de aceite |
| A2 RLS | `produto_eventos` policy self+coord cobre as ações novas sem migration de policy; `relatorio_ia_cards` nasce `my_role()='coordenacao'` com escrita só via RPC definer; `adocao_*` novas são invoker (escopo honesto do caller) | spec FR-009/013; matriz abaixo; e2e papel negado |
| A3 escritas/domínio | leitura inteligente é módulo puro `leituras-*.ts` (Vitest); action do card retorna `{ ok, card }`/`{ error }`; telemetria segue fire-and-forget (nunca lança) | spec FR-011; A3 verificação |
| A4 rota pública | nenhuma rota pública nova — beacon segue autenticado (fora de `isPublic`); nada muda no matcher | spec NFR Auth |
| A5 LGPD | payload numérico/enum (sem seletor/texto/id); inventário atualizado na PR; card = prosa sobre agregados coord-only; prompt sem `*_pessoal`/texto livre — tier liberado do brainstorm | spec NFR LGPD + FR-012; inventário diff |
| A6 UI | painéis e card usam kit viz/`ui` existente, Tailwind no JSX, copy pt-BR sem travessão, legenda nomeada, status com rótulo | spec FR-007/010 + NFR A11y |
| A7 demo | gerador sintético cobre `permanencia`/`rolagem`/alvos; leitura roda sobre dataset demo; card = resposta enlatada; export demo já fabrica o cru (route.ts:76-84) | task de paridade; spec US2.c6 |
| A8 gates | typegen+tsc, eslint, vitest, schema:check, e2e-app; guard-test novo do bundle duckdb entra em `pnpm test` | DoD da spec |
| A9 migrations | 3 migrations novas (0210–0212 planejadas), nenhuma editada; RPCs redefinidas por `create or replace` do corpo vigente | seção Dados |
| A10 spec | esta spec + plano antes de qualquer código; auditoria em `docs/audits/telemetria-2026-11.md` | specs/README.md índice |

## Arquitetura da mudança (paths reais)

```text
src/lib/adocao-duckdb.ts             # SET custom_extension_repository + bootstrap robusto (US1)
public/duckdb-ext/vX.Y.Z/{wasm_eh,wasm_mvp}/parquet.duckdb_extension.wasm  # vendored (US1)
scripts/vendor-duckdb-ext.mjs        # baixa/pina a extensão por versão+plataforma (US1)
tests/duckdb-ext-vendor.test.ts      # guard: layout vendored ≡ pacote (US1)
src/components/produto-telemetry.tsx # permanencia na saída + rolagem por marcos + alvo (US2)
src/lib/produto-eventos.ts           # AcaoProduto += permanencia|rolagem (US2)
supabase/migrations/0210_produto_eventos_rico.sql      # whitelist + teto meta (US2)
src/app/api/produto-eventos/route.ts # LOTE_MAX alinhado (US2)
supabase/migrations/0211_adocao_rico_rpcs.sql          # heatmap/permanencia/rolagem/trilha (US3)
src/lib/relatorios/adocao.ts         # fetchers + tipos dos painéis (US3)
src/lib/adocao.ts                    # derivações puras (grade, percentis) (US3)
src/components/viz/*.tsx             # MapaCalorCliques reusa MapaCalor; barras de marco (US3)
src/app/(app)/relatorios/operacionais/secao-adocao.tsx # L2/L3 novos (US3)
src/lib/leituras.ts + leituras-*.ts  # regra pura de achados (US4)
src/components/leitura-painel.tsx    # bloco "Leitura" + "como ler" (US4)
supabase/migrations/0212_relatorio_ia_cards.sql        # tabela + RPCs + canal 'relatorio' (US5)
src/lib/ia/relatorio-cards.ts        # recorte canônico, contexto_hash, contexto de agregados (US5)
src/lib/actions-relatorio-ia.ts      # perguntarLizaRelatorio/regenerar ({ ok }|{ error }) (US5)
src/components/perguntar-liza.tsx    # botão por seção + card render (US5)
```

## Dados e migrations

- **0210_produto_eventos_rico.sql** — `create or replace
  registrar_produto_eventos` (corpo vigente da 0203 copiado verbatim):
  whitelist += `'permanencia','rolagem'`; guarda nova de `meta` —
  `jsonb_typeof(meta)='object' AND octet_length(meta::text) <= 1024`,
  gesto fora da régua é **pulado** com o lote seguindo (recusar o lote
  inteiro puniria gestos válidos; o retorno `int` já sinaliza parcial —
  decidir no review se prefere recusar tudo). Teto do lote 20 → 30
  alinhado nos 3 pontos (`produto-telemetry.tsx`, `route.ts`, RPC).
- **0211_adocao_rico_rpcs.sql** — `security invoker`, grant
  authenticated (mesmo padrão 0198): `adocao_heatmap_cliques(p_desde,
  p_papel)` → grade 10×10 por superfície (mesma normalização do preset);
  `adocao_permanencia(p_desde, p_papel)` → mediana/p25/p75/sessões por
  superfície; `adocao_rolagem(p_desde, p_papel)` → % sessões por marco
  por superfície; `adocao_trilha_pessoa(p_desde, p_profile_id)` →
  gestos ordenados (RLS já limita a coord ou ao próprio id).
- **0212_relatorio_ia_cards.sql** — tabela `(id, secao, recorte jsonb,
  recorte_key text, contexto_hash text, pergunta text, resposta_md
  text, modelo text, tier text, request_id text, gerado_por uuid ref
  profiles, gerado_em, superseded_by uuid null)`; RLS select/insert
  coord-only, zero update/delete grant; índice único parcial
  `(secao, recorte_key) where superseded_by is null` = uma vigente por
  recorte (dá o dedup do FR-015 por constraint); RPC definer
  `relatorio_ia_card_registrar` que valida `my_role()='coordenacao'`,
  marca a vigente anterior com `superseded_by` e insere a nova —
  atômico; canal `'relatorio'` entra em **dois** lugares como na 0193:
  `alter table ia_eventos drop/add CHECK canal` (`0193:19-22`) **e** a
  redefinição de `registrar_ia_eventos_lote`, que valida o canal com
  `raise exception` (`0193:51-52`). Retenção do card: permanente, como
  `ia_eventos` (é ledger de decisão, não dado de titular) — linha nova
  no inventário LGPD na mesma PR.
- **Decisão — sem rollup rico:** painéis declaram "últimos 90 dias"
  (janela do cru). Justificativa: grade 10×10×17 superfícies×N dias
  agrega a pergunta errada (onde se clica muda com a UI); se a necessidade
  de série longa aparecer, `produto_eventos_heatmap_dia` é migration
  futura — o job `produto_eventos_reter` é o template pronto.
- **Retroativo:** `permanencia`/`rolagem` começam do zero (eventos
  antigos não têm o gesto) — painéis mostram "acumulando desde";
  `clique` x/y já existe desde a 0203 então o heatmap tem dado real.
- **Rollback:** 0210/0211 reversíveis (redefinir/dropar); 0212 dropar
  tabela+RPC e reverter o CHECK — todas simples, fora de janela.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| emitir gestos (RPC) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ler próprio cru/agg | ✅ | ✅ self | ✅ self | ✅ self | ✅ self | ❌ |
| ler cru/agg de todos | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| painéis ricos / explorador / trilha por pessoa | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| gerar/ler card da Liza | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| export parquet | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ invoker retorna escopo honesto do caller (como hoje nas `adocao_*` —
documentado na 0198). ❌ = e2e do papel negado no painel e na RPC.

## Superfícies e rotas

- Nenhuma rota nova, nenhuma pública nova. `isPublic` intocado.
- Beacon: mesmo `POST /api/produto-eventos`; payload novo são chaves de
  `meta`, não campo de rota.
- `public/duckdb-ext/` — assets estáticos same-origin; CSP `img-src`/
  `connect-src` já cobre `'self'`; sem entrada nova.
- Canal `'relatorio'` em `ia_eventos` — aparece em `/ia` (painel de
  consumo) sem tela nova.

## Paridade demo

- `dadosAdocaoEventosDemo` (`src/lib/relatorios/adocao.ts`) ganha
  permanencia/rolagem sintéticos + `alvo` em cliques; `ACOES_PESO`
  atualizado; heatmap demo nasce com dados.
- Leitura: mesma derivação pura sobre o dataset demo — achados
  demonstráveis sem banco.
- Card da Liza: `demoRole()` → resposta enlatada por seção
  (precedente `responderDemoIa`), nunca chamada real; card demo é
  renderizado de fixture, sem persistência.
- Explorador demo já coberto pelo export sintético — US1 verificável em
  `/demo` também.

## Testes

- **Unit:** `leituras-*.test.ts` (achados, ordem, "nada a declarar");
  derivações de grade/percentis em `adocao.test.ts`; paridade
  TS↔SQL cobre as ações novas; `duckdb-ext-vendor.test.ts` (layout
  vendored ≡ `package.json`); recorte_key/contexto_hash canônicos.
- **E2E demo:** aba Adoção com painéis novos + legenda; leitura visível;
  card enlatado; explorador abre (jsdom real — valida que nenhuma
  origem externa aparece nas requests).
- **E2E app:** papel negado nos painéis/ações/RPCs novas; beacon grava
  permanencia/rolagem (consulta no cru); card: gerar → persistir →
  reler → regenerar (vigente troca, anterior linkada); cota estourada →
  erro pt-BR com card preservado.
- **Schema:** `pnpm schema:check` após cada migration em staging.

## Observabilidade e erro

- Falha do bootstrap DuckDB → estado `falha` com retry (já existe) +
  `console.error` — sem PII. Falha de geração do card → `{ error }`
  pt-BR, card anterior preservado; custo/tokens sempre gravados em
  `ia_eventos` quando a chamada sai.
- Estados: painéis com "acumulando desde {data}" (padrão da aba);
  card vazio = "Nenhuma resposta gerada ainda — pergunte à Liza".

## Rollout

1. **PR-A (US1):** vendor + SET + guard-test — pode mergear sozinho.
2. 0210 em staging → código US2 (coleta) → 0211 + US3 (painéis) →
   0212 + US5 (card) → US4 (leitura) — fatias verticais por história,
   cada PR com gates verdes.
3. Migrations: staging antes do push; produção só na janela do release.
4. `[deploy]` só com autorização do Thiago.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| Binário `.wasm` de extensão vendored no repo (`public/duckdb-ext/`) | única forma de servir a extensão same-origin sem CSP novo nem dependência externa — coerente com wasm/worker já servidos localmente | abrir `connect-src` p/ `extensions.duckdb.org` (dependência externa em runtime, IP disclosure, 404 por versão); decodificar parquet no JS com `hyparquet` + `insertArrowTable` (mais código que vendor) |
| `superseded_by` exige UPDATE na linha antiga do card | apontar a vigente é metadado de ciclo de vida, não reescrita de conteúdo — o histórico íntegro se preserva | flag `vigente bool` (mesma update, sem rastro de quem substituiu); tabela separada de vigência (join a mais sem ganho) |
