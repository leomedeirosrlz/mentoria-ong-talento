# REALIZA-179 — sdd.md

Arquitetura: **um registry (`IA_TOOLS`), dois transportes** (`/api/ia/chat`
por sessão cookie; `/api/mcp` por Bearer), um provider, um RAG, um
contrato de confirmação. Nada de SQL gerado por modelo; nada de write
direto — tools chamam as mesmas regras das actions/RPCs.

**Estado (REALIZA-310):** entregue = registry com 9 tools de **leitura**,
provider (`chamarModelo`/`chamarModeloStream`), `POST /api/ia/chat` em
SSE, assistente como **bolha** (REALIZA-243, gate `IA_BOLHA=1`), RAG
`ia_chunks` (0136). **Pendente — REALIZA-290–297**: `/api/mcp`,
`ia_tokens`/PAT, tools de escrita + confirmação (`escritas.ts`) e
`pendencias_docs` — o desenho deles segue abaixo como spec.

## 1. Mapa de módulos

```
src/lib/ia/
  tools.ts       registry ✔ — 9 tools de leitura (as 6 da fase 0 +
               guia_consulta + duplas_do_usuario + agenda_do_periodo);
               +escrita flag e tools de escrita ficam pra 290–297
  queries.ts     fetchers minimizados ✔ — matchGuiaIa via RPC entregue;
               +getPendenciasDocs pendente (290–297)
  provider.ts    ✔ cliente OpenAI-compatible (opencode Go) — chamarModelo
               JSON + chamarModeloStream SSE + providerConfigurado()
  prompts.ts     ✔ system prompt chat (papel-aware; links internos)
  rate-limit.ts  ✔ checarLimiteIa(supabase, profileId) — count ia_eventos
               próprios nos últimos 60s (teto 20)
  mensagens.ts   ✔ helpers do client (montarEnvioChat, extrairAcoes,
               msgAmigavel) — REALIZA-283/284/286
  executor.ts?   NÃO — executarTool fica em tools.ts (é o executor)
src/lib/escritas.ts      [PENDENTE 290–297] cores extraídos de
                        agendarEncontro/marcarSaidaMentorado/
                        salvarCampoRelatorio
src/app/api/ia/chat/route.ts      ✔ POST — sessão cookie → SSE
src/app/api/mcp/route.ts          [PENDENTE 290–297] MCP Streamable HTTP — Bearer
src/components/assistente-bolha.tsx + assistente-conversa.tsx
                                 ✔ FAB (Popover desktop / Sheet mobile);
                                 (app)/assistente/page.tsx virou redirect
src/app/(app)/perfil/             [PENDENTE 290–297] + seção "Conectar IA
                                 externa" (coord)
scripts/ingerir-guias.mjs         ✔ chunking docs/rag/*.md + delete+insert
                                 ia_chunks (pnpm ingerir:guias --apply)
supabase/migrations/
  0136_ia_chunks.sql   ✔ tabela + tsv + match_ia_chunks (saiu como 0136,
                        não 0109)
  ia_tokens.sql        [PENDENTE 290–297] PAT + RPCs emitir/revogar
```

## 2. Provider (`src/lib/ia/provider.ts`) — entregue

- OpenAI-compatible: `POST $IA_API_BASE/chat/completions`
  `{model:$IA_MODEL, messages, tools, tool_choice:"auto"}` (`stream:true`
  na via SSE). Provider real = **opencode Go** (`IA_API_BASE` =
  `https://opencode.ai/zen/go/v1`, plano de assinatura); modelo default
  `mimo-v2.6-flash` — retenção 0 dias e não treina com os dados (requisito
  LGPD dos dados de menores).
- Headers próprios do endpoint Go: `Authorization: Bearer $IA_API_KEY` +
  `User-Agent: realiza-app/1.0` + `x-opencode-session` — id estável por
  conversa (= `profile_id`, pseudônimo; o Go o exige pra rotear/cachear,
  outro provider ignoraria o extra).
- **Streaming entregue (REALIZA-244)**: `chamarModeloStream` pede
  `stream:true` + `Accept: text/event-stream`; `delta.content` sai ao vivo
  por `onToken` e `delta.tool_calls` é **remontado por `index`** até o
  `[DONE]` — a remontagem mora nesta camada, não na rota. `chamarModelo`
  (JSON, sem stream) segue como **fallback por rodada**: provider que
  recusa SSE (HTTP≠2xx ou corpo não-SSE) e stream que quebra no meio viram
  `{fallback:true}` e a rota refaz a rodada em JSON.
- Timeout: `IA_TIMEOUT_MS` (20s) por chamada JSON via `AbortSignal.timeout`;
  na via stream o `signal` vem da rota (`AbortSignal.any` de `req.signal`
  + restante do orçamento — ver §3). Abort do client interrompe o fetch
  ao provider na hora.
- `z.toJSONSchema(tool.schema)` gera `parameters` (zod 4 nativo — sem
  dep); payload montado/cacheado em `toolsPayload()` a partir de
  `nome`/`descricao`/`schema` do registry.
- Erros mapeados: timeout/5xx → `{ok:false, erro:"O assistente está
  indisponível no momento — tente de novo em instantes."}`; 401/403 (key)
  → mesmo texto pro usuário + log do status no console.
- `providerConfigurado()` = `IA_API_BASE && IA_API_KEY && IA_MODEL` —
  usado por `/api/ia/chat` (503), pela bolha (prop `configurado` desliga
  chips/composer) e 178 (botão narrativa).

## 3. Transporte chat (`POST /api/ia/chat`) — entregue

```ts
const Body = z.object({ messages: z.array(MsgSchema).min(1).max(20) }).strict();
// MsgSchema: {role:'user'|'assistant', content:string 1..4000} — strict:
// campos de UI derrubam o parse ("Pedido inválido"); o client saneia com
// montarEnvioChat (mensagens.ts)
export const maxDuration = 60;
```

1. `createClient()` sessão → `auth.getUser()` → 401; `getMe()` → 401.
2. `providerConfigurado()` → 503.
3. `checarLimiteIa(supabase, me.id, 20)`: `count` em `ia_eventos` do
   próprio profile nos últimos 60s (select próprio já permitido pela
   policy) → 429. **Entregue** — e a rota grava um `ia_eventos`
   `tool='mensagem'` (args `{n_mensagens}`, sem conteúdo) a cada envio,
   então o limite mede mensagens, não só tool calls.
4. Loop **até 6 iterações** (`MAX_ITERACOES=6` — spec e código alinhados;
   o modelo que chama tool pra sempre para e responde com o que tem):
   `chamarModeloStream(historico, sessao, {onToken, signal, clienteAbortou})`
   →
   - `toolCalls`: para cada, `executarTool(nome, args, supabase, "chat")`
     → append `{role:"tool", tool_call_id, name, content:JSON.stringify(res)}`.
     Args inválidos/JSON quebrado (vira `{}`)/papel negado/tool
     desconhecida voltam como `erro` na resposta da tool — o modelo recebe
     e reformula (contrato de `executarTool` já é assim — `tools.ts`).
   - resposta final → SSE `{type:"done", tools:[nomes]}`.
   - Guards anti-loop: `guia_consulta` máx 1× por resposta (a repetição
     recebe `{fontes:[], nota:"busca já realizada…"}`) + a partir da 2ª
     rodada um nudge `role:user` "Responda agora com base no que você já
     encontrou…".
5. Resposta **SSE** (REALIZA-244): `data: {type}` — `status` ("consultando
   dados…" por rodada de tool), `token` (delta ao vivo), `done`
   (`{tools, interrompido?}`), `error` (falha pós-stream). Os gates
   (401/503/429/400) respondem **JSON antes do stream abrir** — depois do
   primeiro byte tudo vira evento. Primeiro byte `: ok` (comentário SSE —
   vence o buffer de 1KB do Safari); headers `Cache-Control: no-cache,
   no-transform` + `X-Accel-Buffering: no`; client desconectando aborta o
   fetch ao provider (`AbortSignal.any` de `req.signal` + timeout da
   rodada) e a rodada cai fora sem `error`.
6. **Orçamento de tempo total por request**: `maxDuration=60` com headroom
   — cada rodada recebe o **restante do deadline**, não um múltiplo fixo
   (o `IA_TIMEOUT_MS×4` por rodada foi corrigido: 6 rodadas × ~80s
   estouravam o teto da plataforma).
7. Tool de escrita no loop *(pendente — REALIZA-290–297)*: retorna
   `{requer_confirmacao:true, resumo}` → o loop **para** e devolve ao
   client com `pendente:{tool,args,resumo}`. O client renderiza o card; ao
   confirmar, reenvia incluindo `{confirmado:true}` como mensagem tool
   (ver §7).
8. **Sem persistência de mensagens** — a rota é stateless; o client é o
   dono do transcript (memória). Só `ia_eventos` registra `mensagem` +
   tool calls.

Middleware: `/api/ia/*` **não** entra na lista pública — sessão cookie é
a auth. `updateSession` já redireciona/protege (`middleware.ts:51-74`).

## 4. Transporte MCP (`/api/mcp`) — **PENDENTE (REALIZA-290–297)** — identidade real sem duplicar RLS

Não implementado — nem a rota, nem `ia_tokens`, nem o dep `mcp-handler`.
A decisão e os fluxos abaixo seguem sendo a spec da fase.

Decisão central: tools **sempre** rodam com um client user-scoped (RLS =
bound). O Bearer pode ser dois formatos — ambos resolvem pra um
`SupabaseClient` com JWT do usuário:

```ts
async function resolverIdentidade(bearer: string):
  Promise<{ error } | { ok; supabase: SupabaseClient; profileId: string }> {
  // (a) JWT Supabase (OAuth): anon client c/ global header Bearer →
  //     auth.getUser() valida → papeisDoUsuario → gate 'coordenacao'
  // (b) PAT 'rlz_…': prefix lookup ia_tokens (admin client) → sha256 ==
  //     token_hash → revogado_em null → minta sessão real via
  //     admin.auth.generateLink({type:'magiclink',email}) +
  //     verifyOtp({token_hash}) → access_token (~1h) → client user-scoped
  //     (cache: Map<tokenHash,{token,exp}> em memória; refresh no 401)
}
```

- **(a) OAuth Supabase**: clientes MCP modernos fazem OAuth 2.1+PKCE com
  o próprio Supabase (`/auth/v1/oauth/authorize`) — `a verificar` se o
  OAuth server está habilitado no projeto `yhjzmxleotahijinjepl`
  (Dashboard → Authentication → OAuth). Se sim: documentar no `/perfil`
  "conecte pelo fluxo OAuth do seu cliente". Sem código novo de auth.
- **(b) PAT `rlz_`**: o mint via `generateLink`+`verifyOtp` cria uma
  sessão GoTrue **real** do usuário (aparece na lista de sessões dele —
  feature de auditoria, não bug). `ultimo_uso_em` atualiza por PAT. Se o
  fluxo OAuth (a) estiver disponível, PAT vira opcional/legado — a rota
  aceita os dois de qualquer forma (mesmo `resolverIdentidade`).
- **Rejeitada**: admin client + filtros explícitos `eq(mentor_id,…)` por
  tool — duplicaria as policies RLS em TS com risco de drift (testes
  teriam que re-verificar cada policy). A solução acima **reusa o RLS**.
- Gate coord: `papeisDoUsuario` inclui `coordenacao` → senão 403
  `{error:"MCP é restrito à coordenação."}`. **Auditoria do negado**: com
  identidade resolvida (PAT/sessão mintada), `registrar_ia_evento`
  funciona (`profile_id` = o do dono) — registrar
  `{tool:'mcp_gate', ok:false, erro:'papel_negado', args:{papeis}}` antes
  do 403; request sem bearer válido nem isso faz (sem profile → sem
  linha — só response/console).
- Handler: `createMcpHandler` de `mcp-handler` [NOVO dep] — `tools/list`
  (filtra `papeis`), `tools/call` → `executarTool(canal:"mcp")`.
  Streamable HTTP, stateless (sem SSE session state — `sessionId` não é
  necessário pro nosso uso).
- Middleware: `p.startsWith("/api/mcp")` na lista pública.
- Rate limit: `checarLimiteIa` por profile resolvido (30/min MCP — teto
  separado do chat, que é 20/min; a função já recebe o limite por arg).
- Escrita via MCP *(depende da fase de escritas — 290–297)*: flag
  `IA_MCP_ESCRITAS=0` inicial — tools com `escrita:true` não aparecem no
  `tools/list` do MCP até validarmos o fluxo de aprovação no chat.

## 5. RAG `guia_consulta` + `ia_chunks` — entregue (migration 0136)

- `ia_chunks(guia, secao, pagina, texto, tsv generated)` — corpus =
  **guias oficiais** (conteúdo institucional, sem PII nem dados de
  pessoas). Entregue com CHECKs de tamanho e `unique nulls not distinct
  (guia, secao, pagina)` (`ia_chunks_origem_key` — identidade do chunk e
  rede contra duplicata). `grant select to authenticated` + policy
  `using(true)` (+ `revoke all` antes — padrão do repo): qualquer papel
  logado lê guia.
- `match_ia_chunks(p_query, p_limit)` security definer `set search_path
  = ''`: `ts_rank(tsv, plainto_tsquery('portuguese', p_query))` +
  `ts_headline` (MaxWords=40) pra trecho citável; `p_limit` clamp 1–10.
  Retorna `(guia, secao, pagina, trecho, score)` — a tool descarta o
  score.
- **FTS, não embeddings**: entregue assim. Se testes reais mostrarem
  recall ruim em perguntas naturais ("o que faço quando a dupla não se
  encontra?"), upgrade documentado: `create extension vector` + coluna
  `embedding` + embeddings pelo provider (mesma chave) — a RPC muda por
  dentro, a tool e a UI não mudam.
- Ingestão `scripts/ingerir-guias.mjs` **entregue**: a fonte canônica
  virou **`docs/rag/*.md`** (markdown com frontmatter — resolve o `a
  verificar`; não são PDFs). Chunk ~700–900 chars por seção, overlap
  ~120; escrita = delete-por-guia + insert (PostgREST não expressa upsert
  com `NULLS NOT DISTINCT` — igualmente idempotente); gate anti-PII
  recusa doc com marcador de dado pessoal. `pnpm ingerir:guias` dry-run /
  `--apply` com service role de `.env.local`.
- Tool devolve `{fontes:[{guia,secao,pagina,trecho}]}` — o model cita o
  guia/seção na prosa; a bolha mostra as tools usadas na meta
  ("fontes: guia_consulta").

## 6. Tools novas (registry)

Registry entregue hoje: 9 tools, **todas de leitura** — `resumo_semana`,
`ficha_dupla`, `registros_da_dupla`, `aguardando_par`,
`capacidade_mentores`, `duplas_do_usuario`, `agenda_do_periodo`,
`guia_consulta`, `instrumentos_da_dupla`. A tabela abaixo é o backlog de
tools novas: `guia_consulta` já entregue; as demais são **pendentes
(REALIZA-290–297)**.

| Tool | Tipo | Papeis | Implementação | Status |
|---|---|---|---|---|
| `guia_consulta` | leitura | todos | RPC `match_ia_chunks` | entregue |
| `pendencias_docs` | leitura | coord, supervisor | `getPendenciasDocs` (queries.ts): assinaturas pendentes/vencendo + `mentor_profiles.formacao_ok=false` + anamnese pendente | pendente — 290–297 |
| `registrar_interacao` | escrita | coord, supervisor, mentor_dpp (dupla dele) | insert `interacoes` — canal CHECK `('whatsapp','email','outro','in_app')` (0094:11-12), tipo `('nudge','contato','apoio')` (0008:10) → tool fixa `canal='in_app'`, `tipo` arg em `contato`/`apoio`; policy já permite | pendente — 290–297 |
| `emitir_link_instrumento` | escrita | coord, mentor_dpp | RPC `emitir_link_instrumento` existente | pendente — 290–297 |
| `editar_campo_pessoa` | escrita | coord | `salvarCampoRelatorioCore` (allowlist nome/email/whatsapp/cidade/uf) | pendente — 290–297 |
| `marcar_situacao_mentorado` | escrita | coord | `marcarSaidaMentoradoCore` (bloqueia dupla viva — herdado) | pendente — 290–297 |
| `agendar_encontro` | escrita | mentor_dpp | `agendarEncontroCore` — coord recebe a recusa real "Quem agenda é a dupla" | pendente — 290–297 |

`roles` por tool é a allowlist do gate em `executarTool` (resolvida contra
`my_papeis` — papel efetivo, não só o primário); o bound real continua
sendo a query com RLS (mentor que chamar `registrar_interacao` pra dupla
alheia falhará no insert pela policy — defesa em profundidade: allowlist
recusa cedo + RLS garante).

## 7. Confirmação de escrita (contrato único) — **PENDENTE (REALIZA-290–297)**

```ts
type ResTool = … | { requer_confirmacao: true; resumo: string;
                     args_retomada: Record<string,unknown> };
```

- `escrita:true` + sem `args.confirmado===true` → dry-run: valida as
  mesmas regras do write (dupla viva? enum válido? campo na allowlist?) e
  retorna `requer_confirmacao` + `resumo` pt-BR ("Registrar contato com a
  dupla Ana · Luisa sobre remarcação?").
- `confirmado:true` → executa → `{ok, refId}` ou `{erro}`.
- Chat: a rota devolve `pendente` → a conversa da bolha
  (`assistente-conversa`) renderiza card Confirmar/Cancelar → confirmar
  repete o `tools/call` com `confirmado:true`.
- MCP: `requer_confirmacao` aparece no resultado da tool — o cliente MCP
  (Claude) pede confirmação ao humano por UX própria e re-invoca.
- Auditoria: dry-run e execução são 2 `ia_eventos` (`args.confirmado`
  false/true) — o par conta "o que foi proposto vs. aprovado".

## 8. Demo mode — entregue

- A bolha abre em demo com **respostas enlatadas**: o composer aceita
  input mas responde de uma tabela regex→resposta fixa sobre o dataset
  demo (`DEMO_RESPOSTAS`: resumo/fila/capacidade/dupla) + fallback fixo +
  aviso "Na demonstração, o assistente responde com exemplos fixos."
  Não chama provider nem `/api/ia/chat` — honesto, sem fingir.
- `registrar_ia_evento` não roda em demo (sem sessão) — esperado.

## 9. Prompts (`src/lib/ia/prompts.ts`) — entregue

O prompt real evoluiu do rascunho abaixo: recebe os `papeis` (labels
pt-BR concatenados), libera markdown leve (negrito/listas/código, sem
tabelas), ensina **links internos** `[rótulo](/rota)` de uma allowlist de
rotas — a bolha os transforma em chips de ação (REALIZA-286) — e fixa
`guia_consulta` máx 1× por pergunta + limites de escopo (sem terapia/
promessa de emprego; crise → coordenação; não processar PII colada).
Rascunho original mantido pra referência:

System chat (rascunho a refinar na implementação):

> "Você é o assistente do Realiza.VC, a plataforma do Programa de
> Mentoria. Responda em pt-BR, curto e acolhedor, sem emoji. NUNCA
> invente dados: números, nomes e fatos sobre a operação vêm
> exclusivamente das ferramentas — se a ferramenta negar ou não existir,
> diga que não tem acesso e sugira falar com a coordenação. Para
> perguntas sobre o programa, use guia_consulta e cite o guia/página.
> Antes de qualquer ação que altere dados, a ferramenta pedirá
> confirmação — repasse o resumo ao usuário."

## 10. Decisões registradas

| # | Decisão | Alternativa rejeitada |
|---|---|---|
| 1 | OpenAI-compatible `chat.completions` genérico — entregue: opencode Go, `mimo-v2.6-flash`, headers `x-opencode-session` + `User-Agent` | SDK de vendor específico (acopla; zero-retention é contratual não técnico) |
| 2 | ~~Não-streaming v1~~ → **superseded pela REALIZA-244**: SSE entregue — a remontagem de `tool_calls` por `index` (o custo que o trade-off temia) ficou encapsulada no provider; `chamarModelo` JSON virou fallback por rodada | manter JSON único — UX de token ao vivo valeu a complexidade, e ela ficou barata isolada |
| 3 | FTS `portuguese` pro RAG — entregue (0136) | pgvector+embeddings na v1 — extensão+chamadas extras pra corpus pequeno |
| 4 | PAT→sessão mintada / JWT OAuth → client user-scoped — **pendente (REALIZA-290–297)** | admin client+filtros explícitos (drift de RLS); PAT sem sessão |
| 5 | Transcript em memória — entregue (nada de conversa no banco; `ia_eventos` guarda só `mensagem` + tool calls) | persistir conversas — LGPD: transcript não é necessário ao serviço |
| 6 | Rate limit via count em `ia_eventos` — entregue (20 msg/60s chat; 30/min MCP quando entrar) | tabela `ia_rate` — eventos já são o ledger; uma query a mais por chamada é aceitável |
| 7 | Escritas via core extraído `escritas.ts` — **pendente (290–297)** | reimplementar regra na tool — duplicaria guards do domínio |
| 8 | `IA_MCP_ESCRITAS`/flags de rollout — **pendente (290–297)**; na prática `IA_BOLHA` já opera como flag de superfície da UI | expor tudo de uma vez — rollout por superfície |

## 11. Segredos novos

Em uso: `IA_API_BASE` (opencode Go), `IA_API_KEY`, `IA_MODEL`
(`mimo-v2.6-flash`), `IA_TIMEOUT_MS`, `IA_NARRATIVA_OK` (178) e
`IA_BOLHA` (gate da bolha — desligada por default; o e2e liga `=1`).
Planejados pra fase pendente (REALIZA-290–297): `IA_ESCRITAS_OK`,
`IA_MCP_ESCRITAS`. Todas server-only (sem `NEXT_PUBLIC_`), Vercel
prod+preview+staging. PATs serão gerados pelo app (não env).
