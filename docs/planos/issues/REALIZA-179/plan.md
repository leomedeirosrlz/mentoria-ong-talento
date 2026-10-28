# REALIZA-179 — plan.md

5 PRs na ordem: provider+chat → UI → RAG → MCP → escritas. Cada PR fica
verde sozinho; a UI pode ir no PR do chat se preferir fatiar maior.

**Status (REALIZA-310):** PRs 1–3 **entregues** — com os deltas anotados
em cada seção (SSE entrou na REALIZA-244, o assistente virou bolha na 243,
o RAG saiu na migration 0136). PRs 4–5 **pendentes** — viraram as issues
REALIZA-290–297; o desenho abaixo segue sendo a spec deles.

Regras do repo que valem aqui: actions retornam `{error}`/`{ok}`; rotas
novas de API ficam sob o middleware (só `/api/mcp` e `/api/jobs` vão pra
lista pública); `a verificar` marca o que falta confirmar.

---

## PR 1 — provider + `POST /api/ia/chat` — **ENTREGUE**

### `src/lib/ia/provider.ts` — entregue (SSE na REALIZA-244)

```ts
// env server-only: IA_API_BASE (opencode Go — https://opencode.ai/zen/go/v1),
// IA_API_KEY, IA_MODEL (default mimo-v2.6-flash — retenção 0, não treina),
// IA_TIMEOUT_MS (default 20000). Sem NEXT_PUBLIC_*.
export function providerConfigurado(): boolean;
export async function chamarModelo(messages: MsgChat[], sessao?: string):
  Promise<{ok:true; mensagem:MsgChat} | {ok:false; erro:string}>;
export async function chamarModeloStream(messages: MsgChat[], sessao,
  opts: {onToken; signal; clienteAbortou}): Promise<ResultadoStream>;
export type MsgChat = { role: "system"|"user"|"assistant"|"tool";
  content: string|null; tool_calls?: IaToolCall[]; tool_call_id?: string;
  name?: string };
```

- `fetch` nativo `POST $IA_API_BASE/chat/completions`; headers
  `Authorization: Bearer` + `User-Agent: realiza-app/1.0` +
  `x-opencode-session` (id estável da conversa = `profile_id` — o
  endpoint Go exige pra rotear/cachear; outro provider ignoraria o
  header extra). Nunca lança — retorna `{ok:false, erro}` amigável
  ("O assistente está indisponível no momento…").
- Stream entregue (REALIZA-244): `chamarModeloStream` pede `stream:true`
  + `Accept: text/event-stream`, devolve `delta.content` via `onToken` e
  **remonta `delta.tool_calls` por `index`** até o `[DONE]` (a montagem é
  obrigação desta camada, não da rota). `chamarModelo` JSON segue como
  fallback por rodada — provider que recusa SSE ou stream quebrado no
  meio refaz a rodada em JSON.
- Corpo `tools` gerado do registry: `Object.values(IA_TOOLS).map(t =>
  ({type:"function", function:{name:t.nome, description:t.descricao,
  parameters: z.toJSONSchema(t.schema)}}))` — zod 4.6.7 tem `z.toJSONSchema`
  nativo, **sem dep nova** (cache em `toolsPayload()`).
- Registry real declara `nome`, `descricao`, `schema`, `roles`, `run` por
  tool — a `descricao` pt-BR foi o campo novo (é o que o modelo lê pra
  escolher); `roles` é a allowlist efetiva do gate em `executarTool`.
- Timeout: `IA_TIMEOUT_MS` (20s) por chamada JSON via `AbortSignal.timeout`;
  na via stream o `signal` vem da rota — o orçamento é **total por request**
  com headroom sob `maxDuration=60` (cada rodada recebe o tempo restante
  do deadline; o `IA_TIMEOUT_MS×4` fixo por rodada foi corrigido porque
  podia estourar o teto da plataforma).

### `src/app/api/ia/chat/route.ts` — entregue (SSE na REALIZA-244)

```ts
export const maxDuration = 60;
export async function POST(req: Request) {
  const supabase = await createClient();          // sessão cookie — middleware já protege /api/*
  const { data:{ user } } = await supabase.auth.getUser(); // 401 se não logado
  if (!providerConfigurado()) return 503 {error:"Assistente indisponível."};
  // rate limit ENTREGUE: checarLimiteIa conta ia_eventos do próprio profile
  //   nos últimos 60s — ≥20 → 429 {"Muitas mensagens seguidas — aguarde um
  //   instante."}; cada mensagem recebida grava um evento tool='mensagem'
  const { messages } = await req.json();          // zod strict: ≤20 msgs, role user|assistant, máx 4k chars/msg
  // loop ENTREGUE: chamarModeloStream → toolCalls → executarTool(cada, "chat")
  //   → append {role:"tool", name, tool_call_id, content:JSON.stringify(result)}
  //   → até 6 iterações (MAX_ITERACOES=6) → SSE {type:"done", tools:[…]}
}
```

- `executarTool` recebe o client da sessão — **RLS faz o escopo**
  (mentor pergunta "minha dupla" e a query só vê a dupla dele).
- Resposta **SSE** entregue (REALIZA-244): `data: {type:"status"|
  "token"|"done"|"error"}`; os gates (401/503/429/400) respondem JSON
  **antes** do stream abrir (status e header ficam comprometidos depois do
  primeiro byte); primeiro byte `: ok` (vence o buffer de 1KB do Safari);
  `Cache-Control: no-cache, no-transform` + `X-Accel-Buffering: no`;
  fallback por rodada via `chamarModelo` (re-emite só o trecho que não
  saiu como token); abort do client interrompe o fetch ao provider
  (`AbortSignal.any`).
- Orçamento de tempo: `maxDuration=60` com **deadline total por request +
  headroom** — cada rodada recebe o restante do orçamento (substituiu o
  `IA_TIMEOUT_MS×4` por rodada, que podia estourar o teto).
- Guards anti-loop entregues: `guia_consulta` máx 1× por resposta (a
  segunda tentativa recebe "busca já realizada…") + nudge "Responda agora
  com base no que você já encontrou" a partir da 2ª rodada.
- Não grava transcript — só `ia_eventos`: `tool='mensagem'` por envio
  (é o que o rate limit conta) + um por tool call (dentro de
  `executarTool`).

### System prompt (`src/lib/ia/prompts.ts`) — entregue

- pt-BR; "você é o assistente do Realiza.vc"; **proibido inventar
  números/dados** — sempre chamar tool; quando tool retorna erro/negado,
  explicar em linguagem simples; tom acolhedor; sem emoji.
- Recebe só os `papeis` do usuário (via `getMe`/my_papeis) — o resto vem
  por tools.
- Evoluiu na implementação: markdown leve liberado (negrito/listas/código,
  sem tabelas), links internos `[rótulo](/rota)` viram chips de ação na
  bolha (REALIZA-286), `guia_consulta` com teto de 1 chamada por pergunta,
  limites explícitos (sem terapia/promessa de emprego; crise → coordenação;
  não processar PII colada na conversa).

---

## PR 2 — assistente (UI) — **ENTREGUE como bolha (REALIZA-243)**

- Saiu da nav/página: o assistente é um **FAB** no AppShell —
  `assistente-bolha.tsx` (Popover não-modal no desktop, Sheet de rodapé
  no mobile) + `assistente-conversa.tsx` (transcript + composer).
  `src/app/(app)/assistente/page.tsx` virou stub `redirect("/")` pra
  bookmarks antigos.
- Gate real: env `IA_BOLHA=1` + papéis staff/mentores
  (coordenacao/supervisor/mentor_dpp/mentor_especialista) — o jovem não
  entra (shell próprio). Desligada por default enquanto a rodada de UI
  fecha; o e2e liga explicitamente.
- Transcript em `useState` (nada persiste; refresh limpa — decisão do
  doc-fonte), `textarea`+enviar (Enter/Shift+Enter), chips de sugestão
  por papel, markdown-lite na bolha, links internos `[rótulo](/rota)`
  viram chips de ação (REALIZA-286), stop (aborta o fetch no meio),
  retry com uma retentativa automática em 503/rede (REALIZA-284),
  copy/hora/"fontes: tools" na meta da bolha, cursor de stream
  (REALIZA-280), empty state com saudação pelo nome (REALIZA-289).
- Client lê o SSE com `getReader`+`TextDecoder`; tokens descem por
  rAF-batched setState (`mensagens.ts`: `montarEnvioChat`,
  `extrairAcoes`, `msgAmigavel`).
- Card de confirmação: **pendente** — depende das tools de escrita
  (PR 5 → REALIZA-290–297); quando a resposta trouxer
  `requer_confirmacao`, renderiza resumo + "Confirmar"/"Cancelar".
- **Demo** entregue: respostas enlatadas por regex (`DEMO_RESPOSTAS` —
  resumo/fila/capacidade/dupla) + fallback fixo + aviso "Na demonstração,
  o assistente responde com exemplos fixos." — não chama provider nem API.

## PR 3 — RAG `guia_consulta` — **ENTREGUE (com deltas)**

### Migration — entregue como `0136_ia_chunks.sql` (não 0109)

```sql
create table public.ia_chunks (            -- como entregue:
  id uuid pk default gen_random_uuid(),
  guia text not null check (…80),          -- slug do frontmatter: guia-mentor-dpp, ciclo-cronograma, …
  secao text check (…200), pagina int check (>=0),
  texto text not null check (…4000),       -- chunk ~700–900 chars, overlap ~120
  tsv tsvector generated always as
    (to_tsvector('portuguese', texto)) stored,
  created_at timestamptz default now(),
  unique nulls not distinct (guia, secao, pagina)   -- ia_chunks_origem_key
);
create index ia_chunks_tsv_idx on public.ia_chunks using gin (tsv);
revoke all … ; grant select on public.ia_chunks to authenticated;
create policy ia_chunks_select … using (true);       -- qualquer logado lê (guia não é segredo)
create or replace function public.match_ia_chunks(p_query text, p_limit int default 4)
  returns table(guia text, secao text, pagina int, trecho text, score real)
  language sql stable security definer set search_path = ''
  … plainto_tsquery + ts_rank + ts_headline (MaxWords=40) ; p_limit clamp 1–10
```

- **Sem pgvector**: FTS `portuguese` nativo — entregue assim; pgvector +
  embeddings segue como upgrade documentado (sdd §6) se o recall
  decepcionar.
- **Ingestão** `scripts/ingerir-guias.mjs` [entregue — `.mjs`, não `.ts`]:
  o corpus canônico são **markdowns com frontmatter em `docs/rag/*.md`**
  (resolve o `a verificar` da fonte — não são PDFs). Chunks ~800 chars por
  seção com overlap ~120; escrita = delete-por-guia + insert (o PostgREST
  não expressa upsert com `NULLS NOT DISTINCT` — igualmente idempotente);
  gate anti-PII (doc com marcador de dado pessoal é recusado — o termo de
  adesão exemplar nunca entra). `pnpm ingerir:guias` = dry-run,
  `--apply` grava com service role de `.env.local`.

### Tool `guia_consulta` no registry — entregue

```ts
guia_consulta: { roles: TODOS_PAPEIS, descricao: "Busca nos guias oficiais…",
  schema: z.object({ pergunta: z.string().min(3).max(300) }).strict(),
  run: ({pergunta}, ctx) => matchGuiaIa(ctx.supabase, pergunta, 4) }
```

- Retorna `{fontes:[{guia,secao,pagina,trecho}]}` — score fica fora (número
  de ranking não ajuda o modelo a citar); a bolha mostra as tools usadas
  na meta ("fontes: guia_consulta").
- `pendencias_docs` (da 124, leitura): **pendente** — não entrou no
  registry; fica pra rodada junto das demais tools novas
  (REALIZA-290–297). Spec mantida: assinaturas pendentes +
  `formacao_ok=false` + currículo pendente por papel — query nova
  `getPendenciasDocs` (coord+supervisor).

## PR 4 — MCP `/api/mcp` + PAT — **PENDENTE (REALIZA-290–297)**

Nada deste PR existe ainda: nem a rota `/api/mcp`, nem `ia_tokens`, nem a
seção no `/perfil`, nem o dep `mcp-handler`. O desenho abaixo segue sendo
a spec da fase.

### `ia_tokens` [NOVO] `0110_ia_tokens.sql`

```sql
create table public.ia_tokens (
  id uuid pk default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  nome text not null,                    -- "Claude desktop"
  prefix text not null unique,           -- rlz_ + 6 chars (lookup)
  token_hash text not null,              -- sha256(token)
  ultimo_uso_em timestamptz, criado_em timestamptz default now(),
  revogado_em timestamptz
);
alter table public.ia_tokens enable row level security;
revoke all on public.ia_tokens from public, anon, authenticated;
grant select, delete on public.ia_tokens to authenticated;
-- policies: select/delete só a própria row (profile_id = my_profile_id())
-- escrita (insert + ultimo_uso_em/revogado_em) só via RPCs security
-- definer emitir_ia_token/revogar_ia_token — mesmo padrão do
-- registrar_ia_evento (0083): o token_hash nunca passa por policy de linha
```

- Token `rlz_<32B base64url>` mostrado **uma vez** no `/perfil`
  ("Conectar IA externa" — coord only; `PasswordInput`/copy pattern do
  app). Verificação: `prefix` → row → `sha256(token)==token_hash` →
  `revogado_em is null` → `ultimo_uso_em=now()`.
- RPC `emitir_ia_token`/`revogar_ia_token` (security definer, gate
  `my_role()='coordenacao'` — MCP é coord-only inicialmente).

### `/api/mcp` [NOVO] + `mcp-handler` [NOVO dep]

- Route handler stateless Streamable HTTP (`createMcpHandler` do
  `mcp-handler` — pacote da Vercel pra Next route handlers; `a verificar`
  versão atual na implementação).
- Auth: `Authorization: Bearer <JWT-Supabase | rlz_…>` →
  `resolverIdentidade(bearer)` (sdd §4): JWT valida com
  `auth.getUser()` direto; PAT faz lookup por `prefix` → verifica
  `sha256` → minta sessão real do dono via
  `admin.generateLink`+`verifyOtp` (cache por `tokenHash`, expira ~1h).
  Nos dois casos o resultado é um **client user-scoped com JWT do
  usuário** → `executarTool` roda intacto, RLS faz o escopo. Gate
  `coordenacao` nos papéis resolvidos → senão 403.
- Middleware: `/api/mcp` na lista pública (Bearer não usa cookie).
- `tools/list` devolve as tools permitidas pro papel do dono do token;
  `tools/call` → `executarTool` canal `mcp` (já audita).
- Rate limit: mesmo mecanismo do chat (count `ia_eventos` por profile).
- Sem writes via MCP na primeira entrega das tools de escrita: MCP expõe
  `confirmar` via o mesmo contrato (`requer_confirmacao` → o cliente MCP
  mostra o approve) — mas manter `escritaHabilitadaMcp=false` flag na
  fase inicial, ligando depois de validado no chat.

## PR 5 — tools de escrita + confirmação (REALIZA-126) — **PENDENTE (REALIZA-290–297)**

O assistente entregue é **read-only**: nenhuma tool abaixo existe no
registry, `src/lib/escritas.ts` não foi criado e o contrato
`requer_confirmacao` não está implementado. Spec mantida:

| Tool | Regra existente delegada | Quem |
|---|---|---|
| `registrar_interacao` | insert `interacoes` (`canal='in_app'` fixo, `tipo` arg `contato`/`apoio` — CHECKs 0094/0008) — policy atual permite coord/mentor/supervisor da dupla | staff |
| `marcar_situacao_mentorado` | `marcarSaidaMentorado` core (actions.ts:1292) — extrair pra `src/lib/escritas.ts` | coord |
| `emitir_link_instrumento` | RPC `emitir_link_instrumento` (já scopada) | coord/mentor |
| `agendar_encontro` | `agendarEncontro` core (actions.ts:2440) — **guard coord "Quem agenda é a dupla" permanece**: a tool retorna a recusa como explicação | mentor (na dupla dele) |
| `editar_campo_pessoa` | `salvarCampoRelatorio` core (actions.ts:1354, allowlist nome/email/whatsapp/cidade/uf) | coord |
| `pendencias_docs` | leitura (PR 3) | coord/supervisor |

Contrato: tool de escrita declara `escrita: true` no registry; chamada
sem `confirmado:true` executa **dry-run** (monta o resumo e valida as
mesmas regras — ex.: dupla viva, situação válida) e retorna
`{requer_confirmacao:true, resumo}`; com `confirmado:true` executa e
retorna `{ok, refId}`. O `ia_eventos` registra as duas chamadas (dry-run
e write) — auditável "o que o humano aprovou".

`src/lib/escritas.ts` [NOVO]: extrai os cores `agendarEncontro`,
`marcarSaidaMentorado`, `salvarCampoRelatorio` das actions (mesma função,
mesmo `{error}`/`{ok}`) — a action vira wrapper (sessão + DEMO_MSG +
redirect/revalidate) e a tool chama o core. **Sem duplicar regra.**

## Questões em aberto

- ~~`BLOCKER`: provider com DPA/retenção zero~~ → **resolvido na prática**:
  o provider em uso é o opencode Go (plano de assinatura) e o modelo
  default `mimo-v2.6-flash` declara retenção 0 dias e não treina — a
  confirmação formal do DPA segue como pendência do jurídico, não bloqueia
  código.
- ~~`a verificar`: localização dos guias~~ → **resolvido**: corpus canônico
  = `docs/rag/*.md` (markdown com frontmatter), ingerido por
  `scripts/ingerir-guias.mjs`.
- `a verificar` *(pendente — REALIZA-290–297)*: versão estável do
  `mcp-handler` compatível com Next 16.
- OAuth Supabase pro MCP *(pendente — REALIZA-290–297)*: `a verificar` se o
  OAuth server está habilitado no projeto (Dashboard → Authentication →
  OAuth). Se sim, é o caminho preferido do cliente; PAT cobre
  independentemente — a rota aceita os dois (sdd §4).

## Rollback

- Provider: unset `IA_API_KEY` → assistente indisponível; `/api/ia/chat` →
  503 limpo. A **bolha** tem gate próprio: `IA_BOLHA=0`/unset esconde o FAB
  sem desligar a rota (o e2e liga `IA_BOLHA=1` explicitamente).
- MCP *(pendente — REALIZA-290–297)*: revoga tokens (`/perfil`) ou remove
  a rota; `ia_tokens` fica.
- RAG: drop `ia_chunks` se necessário — tabela isolada (0136).
- Escrita *(pendente — REALIZA-290–297)*: `IA_TOOLS` ganha flag
  `habilitada` por env? Não — mais simples: cada tool de escrita só é
  exposta quando `IA_ESCRITAS_OK=1` (mesmo padrão `IA_NARRATIVA_OK`) —
  **incluir no PR 5**.
