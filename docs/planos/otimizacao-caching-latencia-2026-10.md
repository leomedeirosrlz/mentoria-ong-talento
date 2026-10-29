# Plano de otimização de latência e caching — realizavc

**Data:** 2026-10-28 (medições rodadas contra prod `yhjzmxleotahijinjepl`, região `us-east-1`, e staging `onkosatlcvircdrfgyzq`).
**Escopo:** aplicação Next.js 16 (App Router) + Supabase remoto, ~70 usuários. Sem self-hosted, sem Redis inicialmente (per AGENTS.md).

## 1. Medições de baseline

### 1.1 Metodologia

- **DB (Postgres):** `EXPLAIN (ANALYZE, BUFFERS)` via MCP `execute_sql` (superuser, sem RLS). Mede custo puro da query.
- **REST (PostgREST + rede + serialização):** script Node com `@supabase/supabase-js`, 3 runs após 1 warmup, reportando mediana. Prod com service role (bypass RLS); staging com JWT de `coord@realiza.test` (RLS real).
- **TTFB do app:** `next build` + `next start` local (porta 3100), `curl -w time_starttransfer`.
- **Cold start:** primeira requisição após idle (808 ms medido no warmup do script; 322 ms no Next local).

### 1.2 Latência por query — prod (service role, warm, mediana de 3 runs)

| Query (função) | Linhas | REST warm (ms) | DB exec (ms) | Overhead (rede+PostgREST+ser.) |
|---|---|---|---|---|
| `getCicloEventos` | 45 | 199 | <1 | ~198 |
| `getCronogramas` | 2 | 174 | <1 | ~173 |
| `getMateriais` | 29 | 179 | n/a | ~178 |
| `getPessoas` (+papeis) | 35 | 176 | n/a | ~175 |
| `getDuplas` (full tree, DUPLA_SELECT) | 32 | 321 | 0.31 | ~320 |
| `getRegistros` (50) | 50 | 184 | 0.95 | ~183 |
| `getAlertasRegistros` apoio (head count) | 0 | 202 | n/a | ~201 |
| `getAlertasRegistros` tardio (full select) | 50 | 183 | n/a | ~182 |
| `getNotificacoes` | 32 | 173 | n/a | ~172 |
| `getChamados` | 1 | 292 (cold-ish) | n/a | — |

**Cold (1ª req após idle):** 808 ms no Supabase (script warmup) e 322 ms no Next local. Steady-state round-trip ≈ **180–320 ms por query**.

### 1.3 Latência por query — staging (RLS real, coord, warm)

| Query | REST warm (ms) |
|---|---|
| `getCicloEventos` | 549 (cold-ish) / ~280 warm |
| `getCronogramas` | 276 |
| `getMateriais` | 294 |
| `getPessoas` | 503 |
| `getDuplas` (base) | 284 |
| `getRegistros` (50) | 301 |
| `getAlertas` apoio | 277 |
| `getNotificacoes` | 266 |

RLS adiciona ~30–80 ms por query em relação ao service role. O piso de rede (TLS + PostgREST) é ~180 ms.

### 1.4 TTFB do app (local, porta 3100)

| Rota | Cold (ms) | Warm (ms) |
|---|---|---|
| `/login` | 322 | 17 |
| `/` (redirect) | — | 6 |

### 1.5 Custo do banco (EXPLAIN)

- `registros` join (50 linhas): **Execution Time 0.95 ms**, Planning 1.2 ms. DB não é gargalo.
- `duplas` left join (71 linhas): **0.31 ms**.
- `duplas` base sort (32 linhas): 15.6 ms (planning 21 ms incluído).
- **Conclusão:** o banco executa em <1 ms. A latência percebida vem de **rede (180–320 ms/round-trip) + cold start (300–800 ms) + queries em série + serialização de payloads grandes**.

### 1.6 Findings dos advisors (Supabase)

- **`unindexed_foreign_keys`**: 52 FKs sem índice cobrindo (incluindo `registros.created_by`, `registro_anexos.registro_id`, `registro_tentativas.*`, `dupla_saude_snapshots.dupla_id`, `trilha_lembretes.dupla_id`, `terceiros_consolidacao.*`, `avaliacao_links.dupla_id`, `chamados.dupla_id`, `solicitacoes_especialista.*`, `formulario_links.*`, `mentorados.profile_id`).
- **`auth_rls_initplan`**: 3 policies (`profiles.profiles_self_update`, `profiles.profiles_select`, `solicitacoes_especialista.sol_update`) re-avaliam `auth.uid()` por linha.
- **`multiple_permissive_policies`**: 74 ocorrências (várias policies permissivas por role/ação — subótimo).
- **`unused_index`**: 16 índices nunca usados (candidatos a remoção, mas validar antes — alguns podem ser recentes).

## 2. Gargalos identificados (ordenados por impacto)

1. **Ausência de cache cross-request.** Só `React.cache()` (por request). Cada navegação re-roda todas as queries. `revalidatePath` é a única invalidação (grossa).
2. **Cold start.** ~300 ms (Next) + até 800 ms (Supabase) na 1ª requisição após idle.
3. **Queries em série.** `duplas/[id]` tem ~15 `await` sequenciais após o 1º `Promise.all` (linhas 282–399). `/registros` deep-link loop chama `getRegistros` até 50 vezes em série (linhas 190–197). Home supervisor aninha `.then` dentro do `Promise.all`.
4. **Payloads grandes.** `DUPLA_SELECT` usa `*` e embeds `registros(*)`, `encontros(*)`. Serialização do full tree = 321 ms REST vs 0.31 ms DB.
5. **Sem cache no cliente.** Zero TanStack Query/SWR. Voltar a uma tela re-busca tudo.
6. **Sem streaming interno.** `loading.tsx` cobre o segmento, mas nenhuma página usa `Suspense` para conteúdo secundário (panorama, métricas, abas).
7. **8 funções sem `cache()`.** `getRegistros`, `getAlertasRegistros`, `getEncontrosPorDuplas`, `getPropostasMap`, `getPdmResumo`, `getAssinaturasPessoa`, `getInstrumentosDaDuplaIa`, `matchGuiaIa` — sem dedup por request.
8. **Dialogs fazem N queries no open.** `nova-dupla-dialog` = 5 queries no `useEffect`. `notificacoes` faz polling a cada 60 s via Server Action.

## 3. Plano de otimização (com ganhos esperados)

### Slice A — DB: índices nas FKs quentes (baixo risco, ganho futuro)

**Ação:** migration `0141_perf_indexes.sql` com índices nas FKs filtradas por RLS/app (lista na §1.6 + `mentorados.profile_id`, `especialista_grade.profile_id`, `pdm_itens.parent_id`).
**Ganho de latência atual:** ~0 ms (DB já executa em <1 ms). **Ganho real:** proteção contra degradação quando tabelas crescerem (hoje 32 duplas/50 registros; com 500+ duplas os seq-scans viram gargalo). Também destrava as policies RLS que fazem subqueries em `duplas`/`encontros`.
**Esforço:** 1 migration + apply staging/prod. **Risco:** baixo (índices `if not exists`).

Também corrigir as 3 policies `auth_rls_initplan` (wrap `auth.uid()` em `(select auth.uid())`). Ganho: reduz overhead per-row em tabelas grandes. Esforço: pequeno.

**Não** consolidar as 74 `multiple_permissive_policies` agora — alto risco de regressão de segurança; deixar para auditoria dedicada.

### Slice B — Server: fechar as 8 funções não-cacheadas

**Ação:** wrap em `cache(...)` as 8 funções listadas.
**Ganho:** dedup dentro do mesmo request (evita round-trips duplicados quando a mesma função é chamada 2× numa página). Estimativa: −1 round-trip em `/registros` e `/duplas/[id]` → **−180 a −200 ms** por página.
**Esforço:** trivial. **Risco:** baixo (funções puras, sem side effects).

### Slice C — Paralelização de cadeias sequenciais (maior ganho de latência)

**`duplas/[id]/page.tsx`:** mover os ~15 `await` sequenciais (linhas 282–399) para um único 2º `Promise.all` (todos dependem apenas de `dupla`/`me`, já resolvidos).
- Antes: latência = soma (≈ 15 × 200 ms = **3 s**).
- Depois: latência = max (≈ **300 ms**).
- **Ganho: −2.5 a −2.7 s** nessa página.

**`/registros` deep-link loop:** paralelizar os até 50 `getRegistros` em chunks de `Promise.all` (ou limitar a janela). Ganho: **−9 s** no pior caso (raro, mas catastrófico).

**Home supervisor:** mover `getUltimasInteracoes` e `getPropostasMap` para um 2º bloco paralelo. Ganho: −200 a −400 ms.

**`/materiais`:** mover `getUltimasInteracoes` e `getFormularios()` para o `Promise.all` inicial. Ganho: −200 ms.

**Esforço:** médio (refatoração cuidadosa de dependências). **Risco:** médio (condicionais `souCoord`/`ehEsp` precisam ser preservadas).

### Slice D — Streaming progressivo (Suspense)

**Ação:** envolver conteúdo secundário em `<Suspense fallback={<Skeleton/>}>`:
- `/registros`: `PanoramaDoCiclo` e `MetricasRegistro` separados da lista.
- `duplas/[id]`: abas "encontros"/"instrumentos"/"pessoas" streamam em paralelo.
- Home coord: `SaudePrograma` separado.

**Ganho:** TTFB percebido da seção principal cai ~180–200 ms (secundários não bloqueiam). **Esforço:** médio. **Risco:** baixo (Next 16 suporta nativo).

> **Não** ativar `cacheComponents: true` agora — exige migração de route segment configs. Streaming via Suspense já funciona sem a flag.

### Slice E — Cross-request cache (Next 16 `use cache`)

**Ação:** migrar para `"use cache"` + `cacheLife` + `cacheTag` apenas dados compartilhados de baixa mutação:
- `getCicloEventos()` — TTL horas, tag `ciclo-eventos`. Invalidar em actions de cronograma.
- `getCronogramas()` — tag `cronogramas`.
- `getMateriais()` — tag `materiais`.
- `getEspecialistaEventos()` — estático (5 passos), TTL muito longo.

Trocar `revalidatePath` por `revalidateTag` nas actions correspondentes (manter `revalidatePath` nas demais).

**Ganho:** navegação repetida a `/`, `/agenda`, `/materiais` não re-busca esses dados → **TTFB cai de ~320 ms para ~120–150 ms** (só queries dinâmicas). Repeat visits: shell instantâneo + revalidação em background.
**NÃO cachear** `getDuplas`/`getMe`/`getRegistros`/`getPessoas` em cache global sem isolamento por usuário+org (risco de vazamento de dados de mentorados). Se for cachear por usuário, usar `use cache: private` com chave `my_profile_id()` — complexidade alta; pular para 70 usuários.

**Esforço:** médio. **Risco:** médio (invalidação precisa ser correta).

### Slice F — Client: TanStack Query

**Ação:** introduzir `@tanstack/react-query` gradualmente:
1. `nova-dupla-dialog` (5 queries no open) → `useQuery({ enabled: open })`.
2. `notificacoes` (polling 60 s) → `useQuery({ refetchInterval: 60000, refetchOnWindowFocus: true })`.
3. Listas/dashboards → `staleTime` por tipo (30 s listas, 5 min configs), chaves com `userId` + role.

**Ganho:** voltar a uma tela mostra dados stale instantaneamente (0 ms percebido) + refetch em background. Elimina re-fetch em navegação back/forward.
**Esforço:** médio-alto. **Risco:** médio (invalidação após mutations precisa chamar `invalidateQueries`).

### Slice G — Payload e bundle

**Ação:**
1. `DUPLA_SELECT`: trocar `*` e `registros(*)` por colunas explícitas (só campos usados pelos componentes). Estimativa de redução de payload: 30–50% → getDuplas 321 ms → **~200 ms**.
2. Code-split das abas da ficha de dupla (`next/dynamic` com `ssr: false` para "instrumentos"/"pessoas").
3. Virtualização de listas longas (`@tanstack/react-virtual`) em `AgendaCalendario` e `DuplasLista`.

**Ganho:** −100 a −120 ms em getDuplas; −20 a −30% no cold start do bundle; scroll suave em listas grandes.
**Esforço:** médio. **Risco:** baixo.

### Slice H — Fixar região no Vercel

**Ação:** adicionar `"regions": ["iad1"]` no `vercel.json` (hoje default, mas implícito). Garante que não mude.
**Ganho:** 0 (já alinhado), mas remove risco de drift. **Esforço:** trivial.

## 4. Ganhos esperados consolidados

| Otimização | Ganho de latência percebida | Esforço | Risco |
|---|---|---|---|
| Slice C (paralelizar duplas/[id]) | −2.5 a −2.7 s | Médio | Médio |
| Slice C (/registros deep-link) | −9 s (pior caso) | Pequeno | Baixo |
| Slice E (cross-request cache) | TTFB 320 → 120–150 ms | Médio | Médio |
| Slice F (TanStack Query) | navegação back: 0 ms percebido | Médio-alto | Médio |
| Slice D (Suspense) | −180 a −200 ms | Médio | Baixo |
| Slice G (payload trim) | −100 a −120 ms | Médio | Baixo |
| Slice B (cache() nas 8) | −180 a −200 ms | Trivial | Baixo |
| Slice A (índices DB) | 0 ms hoje; protege escala | Pequeno | Baixo |
| Slice A (auth_rls_initplan) | −pequeno per-row | Pequeno | Baixo |
| Slice H (região) | 0 | Trivial | Nenhum |

**Cenário combinado (warm, após Slices B+C+D+E+G):**
- Home: 320 ms → ~100 ms.
- `/registros`: 320 ms → ~120 ms (lista) + secundários em stream.
- `duplas/[id]`: 3 s → ~300 ms.
- Repeat visits: instantâneo (cache).

## 5. Ordem de execução (vertical slices)

1. **Slice B** (trivial, −200 ms) — commit rápido.
2. **Slice H** (trivial).
3. **Slice A** (índices + auth_rls_initplan) — migration + apply staging/prod.
4. **Slice C** (paralelização) — maior ganho, requer cuidado.
5. **Slice D** (Suspense).
6. **Slice G** (payload trim + code-split).
7. **Slice E** (cross-request cache) — após medir estabilidade.
8. **Slice F** (TanStack Query) — por último, maior esforço.

## 6. O que NÃO fazer

- Sem Redis (70 usuários → complexidade sem benefício proporcional).
- Sem self-hosted Supabase.
- Sem cache global de `getDuplas`/`getMe`/`getRegistros`/`getPessoas` sem isolamento por usuário+org (vazamento de dados de mentorados).
- Sem desligar RLS — cache não substitui autorização.
- Sem re-seedar dados demo em prod/staging.
- Sem consolidar as 74 `multiple_permissive_policies` sem auditoria dedicada.

## 7. Medição pós-implantação

Re-rodar o script de medição (§1.1) após cada slice e comparar. Critérios de sucesso:
- TTFB warm de `/registros` e home < 150 ms.
- `duplas/[id]` < 500 ms.
- Repeat visit (cache hit) < 50 ms.
- `tsc --noEmit` e `eslint src/` limpos.
- E2E (148 specs) verde.

---

**Próximo passo sugerido:** implementar Slice B (wrap das 8 funções em `cache()`) + Slice H agora (trivial, baixo risco), e preparar a migration do Slice A para aplicar em staging primeiro. Posso começar quando autorizar.