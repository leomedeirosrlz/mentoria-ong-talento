# REALIZA-179 — sdd.md

Arquitetura: **um registry (`IA_TOOLS`), dois transportes** (`/api/ia/chat`
por sessão cookie; `/api/mcp` por Bearer), um provider, um RAG, um
contrato de confirmação. Nada de SQL gerado por modelo; nada de write
direto — tools chamam as mesmas regras das actions/RPCs.

## 1. Mapa de módulos

```
src/lib/ia/
  tools.ts       registry (fase 0 ✔) — +descricao por tool, +escrita flag, +7 tools novas
  queries.ts     fetchers minimizados (fase 0 ✔) — +getPendenciasDocs, +match via RPC
  provider.ts    [NOVO] cliente OpenAI-compatible + providerConfigurado()
  prompts.ts     [NOVO] system prompt chat + prompt de extração (180 reusa provider)
  rate-limit.ts  [NOVO] checarLimiteIa(supabase) — count ia_eventos próprios 60s
  executor.ts?   NÃO — executarTool fica em tools.ts (já é o executor)
src/lib/escritas.ts      [NOVO] cores extraídos de agendarEncontro/
                        marcarSaidaMentorado/salvarCampoRelatorio
src/app/api/ia/chat/route.ts      [NOVO] POST — sessão cookie
src/app/api/mcp/route.ts          [NOVO] MCP Streamable HTTP — Bearer
src/app/(app)/assistente/         [NOVO] page.tsx + assistente-chat.tsx
src/app/(app)/perfil/             + seção "Conectar IA externa" (coord)
scripts/ingerir-guias.ts          [NOVO] chunking + upsert ia_chunks
supabase/migrations/
  0109_ia_chunks.sql   [NOVO] tabela + tsv + match_ia_chunks
  0110_ia_tokens.sql   [NOVO] PAT + RPCs emitir/revogar
```

## 2. Provider (`src/lib/ia/provider.ts`)

- OpenAI-compatible: `POST $IA_API_BASE/chat/completions`
  `{model:$IA_MODEL, messages, tools, tool_choice:"auto"}`.
- Timeout `IA_TIMEOUT_MS` (20s) via `AbortSignal.timeout`; **não streaming
  na v1** — trade-off registrado: SSE passthrough com tool-loop exige
  re-montar tool calls no meio do stream; ganho de UX não paga a
  complexidade agora. Bolha "pensando" cobre a espera (~3–8s típico).
- `z.toJSONSchema(tool.args)` gera `parameters` (zod 4 nativo — sem dep).
- Erros mapeados: timeout/5xx → `{error:"Assistente indisponível agora —
  tente de novo em instantes."}`; 401/403 (key) → mesmo texto pro usuário
  + log do status no `ia_eventos`/console.
- `providerConfigurado()` = `IA_API_BASE && IA_API_KEY && IA_MODEL` —
  usado por `/api/ia/chat` (503), `/assistente` (aviso no lugar do
  composer) e 178 (botão narrativa).

## 3. Transporte chat (`POST /api/ia/chat`)

```ts
const Body = z.object({ messages: z.array(MsgSchema).min(1).max(20) });
// MsgSchema: {role:'user'|'assistant'|'tool', content:string ≤4000, ...}
```

1. `createClient()` sessão → `auth.getUser()` → 401.
2. `providerConfigurado()` → 503.
3. `checarLimiteIa(supabase, 20/min)`: `count` em `ia_eventos` do próprio
   profile nos últimos 60s (select próprio já permitido pela policy) →
   429.
4. Loop até 6: `chamarModelo(system, messages, tools=jsonSchema)` →
   - `toolCalls`: para cada, `executarTool(nome, args, supabase, "chat")`
     → append `{role:"tool", tool_call_id, name, content:JSON.stringify(res)}`.
     Args inválidos/papel negado/tool desconhecida voltam como `erro` na
     resposta da tool — o modelo recebe e reformula (contrato de
     `executarTool` já é assim — `tools.ts`).
   - resposta final → `{message, toolsUsadas}`.
5. Tool de escrita no loop: retorna `{requer_confirmacao:true, resumo}` →
   o loop **para** e devolve ao client com `pendente:{tool,args,resumo}`.
   O client renderiza o card; ao confirmar, reenvia incluindo
   `{confirmado:true}` como mensagem tool (ver §7).
6. **Sem persistência de mensagens** — a rota é stateless; o client é o
   dono do transcript (memória). Só `ia_eventos` registra tool calls.

Middleware: `/api/ia/*` **não** entra na lista pública — sessão cookie é
a auth. `updateSession` já redireciona/protege (`middleware.ts:51-74`).

## 4. Transporte MCP (`/api/mcp`) — identidade real sem duplicar RLS

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
- Rate limit: `checarLimiteIa` por profile resolvido (30/min MCP).
- Escrita via MCP: flag `IA_MCP_ESCRITAS=0` inicial — tools com
  `escrita:true` não aparecem no `tools/list` do MCP até validarmos o
  fluxo de aprovação no chat.

## 5. RAG `guia_consulta` + `ia_chunks`

- `ia_chunks(guia, secao, pagina, texto, tsv generated)` — corpus =
  **guias oficiais** (conteúdo institucional, sem PII nem dados de
  pessoas). `grant select to authenticated` + policy `using(true)`:
  qualquer papel logado lê guia — é material que já circula.
- `match_ia_chunks(p_query, p_limit)` security definer:
  `ts_rank(tsv, plainto_tsquery('portuguese', p_query))` + `ts_headline`
  pra trecho citável. Retorna `(guia, secao, pagina, trecho, score)`.
- **FTS, não embeddings**: corpus pequeno (~dezenas–centenas de chunks),
  zero extensão/provider extra. Se testes reais mostrarem recall ruim em
  perguntas naturais ("o que faço quando a dupla não se encontra?"),
  upgrade documentado: `create extension vector` + coluna `embedding` +
  embeddings pelo provider (mesma chave) — a RPC muda por dentro, a tool
  e a UI não mudam.
- Ingestão `scripts/ingerir-guias.ts`: extrai texto dos PDFs oficiais
  (`pdf-lib` já é dep; ou `pdftotext` local — `a verificar` localização
  canônica dos guias: bucket `materiais` categoria guia ou docs locais),
  chunk ~700–900 chars por seção com overlap ~120, upsert por
  `(guia,secao,pagina)` — idempotente, roda com service role local.
- Tool devolve `{fontes:[…]}` — o model cita; a UI renderiza
  "Guia do Mentor · p.12" sob a resposta (se a mensagem mencionar fontes).

## 6. Tools novas (registry)

| Tool | Tipo | Papeis | Implementação |
|---|---|---|---|
| `guia_consulta` | leitura | todos | RPC `match_ia_chunks` |
| `pendencias_docs` | leitura | coord, supervisor | `getPendenciasDocs` (queries.ts): assinaturas pendentes/vencendo + `mentor_profiles.formacao_ok=false` + anamnese pendente |
| `registrar_interacao` | escrita | coord, supervisor, mentor_dpp (dupla dele) | insert `interacoes` — canal CHECK `('whatsapp','email','outro','in_app')` (0094:11-12), tipo `('nudge','contato','apoio')` (0008:10) → tool fixa `canal='in_app'`, `tipo` arg em `contato`/`apoio`; policy já permite |
| `emitir_link_instrumento` | escrita | coord, mentor_dpp | RPC `emitir_link_instrumento` existente |
| `editar_campo_pessoa` | escrita | coord | `salvarCampoRelatorioCore` (allowlist nome/email/whatsapp/cidade/uf) |
| `marcar_situacao_mentorado` | escrita | coord | `marcarSaidaMentoradoCore` (bloqueia dupla viva — herdado) |
| `agendar_encontro` | escrita | mentor_dpp | `agendarEncontroCore` — coord recebe a recusa real "Quem agenda é a dupla" |

`papeis` por tool é allowlist **informativa** — o bound real continua
sendo a query com RLS (mentor que chamar `registrar_interacao` pra dupla
alheia falha no insert pela policy — defesa em profundidade: allowlist
recusa cedo + RLS garante).

## 7. Confirmação de escrita (contrato único)

```ts
type ResTool = … | { requer_confirmacao: true; resumo: string;
                     args_retomada: Record<string,unknown> };
```

- `escrita:true` + sem `args.confirmado===true` → dry-run: valida as
  mesmas regras do write (dupla viva? enum válido? campo na allowlist?) e
  retorna `requer_confirmacao` + `resumo` pt-BR ("Registrar contato com a
  dupla Ana · Luisa sobre remarcação?").
- `confirmado:true` → executa → `{ok, refId}` ou `{erro}`.
- Chat: a rota devolve `pendente` → `assistente-chat` renderiza card
  Confirmar/Cancelar → confirmar repete o `tools/call` com
  `confirmado:true`.
- MCP: `requer_confirmacao` aparece no resultado da tool — o cliente MCP
  (Claude) pede confirmação ao humano por UX própria e re-invoca.
- Auditoria: dry-run e execução são 2 `ia_eventos` (`args.confirmado`
  false/true) — o par conta "o que foi proposto vs. aprovado".

## 8. Demo mode

- `/assistente` acessível em demo com **transcript enlatado**: o composer
  aceita input mas responde de uma tabela de pares pergunta→resposta
  fixos sobre o dataset demo (2–3 sugestões nos chips) + aviso fixo "No
  ambiente real, o assistente responde com seus dados e guias oficiais."
  Não chama provider nem tools (demo não tem sessão nem key) — honesto,
  sem fingir.
- `emails`/`registrar_ia_evento` não roda em demo (sem sessão) — esperado.

## 9. Prompts (`src/lib/ia/prompts.ts`)

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
| 1 | OpenAI-compatible `chat.completions` genérico | SDK de vendor específico (acopla; zero-retention é contratual não técnico) |
| 2 | Não-streaming v1 | SSE com tool-loop — complexidade × ganho não compensam agora |
| 3 | FTS `portuguese` pro RAG | pgvector+embeddings na v1 — extensão+chamadas extras pra corpus pequeno |
| 4 | PAT→sessão mintada / JWT OAuth → client user-scoped | admin client+filtros explícitos (drift de RLS); PAT sem sessão |
| 5 | Transcript em memória | persistir conversas — LGPD: transcript não é necessário ao serviço |
| 6 | Rate limit via count em `ia_eventos` | tabela `ia_rate` — eventos já são o ledger; uma query a mais por chamada é aceitável |
| 7 | Escritas via core extraído `escritas.ts` | reimplementar regra na tool — duplicaria guards do domínio |
| 8 | `IA_MCP_ESCRITAS`/flags de rollout | expor tudo de uma vez — rollout por superfície |

## 11. Segredos novos

`IA_API_BASE`, `IA_API_KEY`, `IA_MODEL`, `IA_TIMEOUT_MS`,
`IA_NARRATIVA_OK` (178), `IA_ESCRITAS_OK`, `IA_MCP_ESCRITAS` — todas
server-only (sem `NEXT_PUBLIC_`), Vercel prod+preview+staging. PATs são
gerados pelo app (não env).
