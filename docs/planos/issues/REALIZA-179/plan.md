# REALIZA-179 — plan.md

5 PRs na ordem: provider+chat → UI → RAG → MCP → escritas. Cada PR fica
verde sozinho; a UI pode ir no PR do chat se preferir fatiar maior.

Regras do repo que valem aqui: actions retornam `{error}`/`{ok}`; rotas
novas de API ficam sob o middleware (só `/api/mcp` e `/api/jobs` vão pra
lista pública); `a verificar` marca o que falta confirmar.

---

## PR 1 — provider + `POST /api/ia/chat`

### `src/lib/ia/provider.ts` [NOVO]

```ts
// env server-only: IA_API_BASE (ex. https://…/v1), IA_API_KEY, IA_MODEL,
// IA_TIMEOUT_MS (default 20000). Sem NEXT_PUBLIC_*.
export function providerConfigurado(): boolean;
export async function chamarModelo(opts: {
  system: string; user?: string; messages?: MsgChat[];
  tools?: ToolDef[];            // JSON Schema (de z.toJSONSchema)
  toolChoice?: "auto" | "none";
}): Promise<{ error?: string; message?: MsgChat; toolCalls?: ToolCall[] }>;
export type MsgChat = { role: "system"|"user"|"assistant"|"tool";
  content: string; tool_call_id?: string; name?: string };
```

- `fetch` nativo + `AbortSignal.timeout(IA_TIMEOUT_MS)`; nunca lança —
  retorna `{error}` amigável ("Assistente indisponível agora…").
- Corpo `tools` gerado do registry: `Object.entries(IA_TOOLS).map(([nome,
  t]) => ({type:"function", function:{name:nome, description:t.descricao,
  parameters: z.toJSONSchema(t.args)}}))` — zod 4.6.7 tem `z.toJSONSchema`
  nativo, **sem dep nova**.
- `IA_TOOLS` precisa de `descricao: string` por tool [NOVO campo no
  registry — `tools.ts` hoje tem `args`, `papeis`, `run`; a descrição é o
  que o modelo usa pra escolher].

### `src/app/api/ia/chat/route.ts` [NOVO]

```ts
export async function POST(req: Request) {
  const supabase = await createClient();          // sessão cookie — middleware já protege /api/*
  const { data:{ user } } = await supabase.auth.getUser(); // 401 se não logado
  if (!providerConfigurado()) return 503 {error:"Assistente indisponível."};
  // rate limit: count ia_eventos próprios nos últimos 60s (select próprio já permitido)
  //   > 20 → 429 {error:"Muitas mensagens — aguarde um instante."}
  const { messages } = await req.json();          // zod: array MsgChat, máx 20 msgs, máx 4k chars/msg
  // loop: chamarModelo → se toolCalls → executarTool(cada, canal:"chat")
  //   → append {role:"tool", name, tool_call_id, content:JSON.stringify(result)}
  //   → até 6 iterações → resposta final {message, toolsUsadas:[nome]}
}
```

- `executarTool` recebe o client da sessão — **RLS faz o escopo**
  (mentor pergunta "minha dupla" e a query só vê a dupla dele).
- Resposta JSON única (não-streaming v1); streaming fica como melhoria
  documentada no sdd.
- Não grava transcript — só os `ia_eventos` por tool call (já dentro de
  `executarTool`).

### System prompt (`src/lib/ia/prompts.ts` [NOVO])

- pt-BR; "você é o assistente do Realiza.VC"; **proibido inventar
  números/dados** — sempre chamar tool; quando tool retorna erro/negado,
  explicar em linguagem simples; tom acolhedor; sem emoji.
- Não recebe dados do usuário além do `papel` (via `papeisDoUsuario`) —
  o resto vem por tools.

---

## PR 2 — `/assistente` (UI)

- `src/app/(app)/assistente/page.tsx` [NOVO] + `assistente-chat.tsx`
  (client): lista de mensagens em `useState` (nada persiste; refresh
  limpa — decisão do doc-fonte), `textarea`+botão enviar, chips de
  sugestão por papel ("como está minha semana?", "quem está aguardando
  par?", "o que diz o guia sobre…").
- Nav: item "Assistente" (`Sparkle`/`ChatCircle`) para todos os papéis
  staff + mentorado — o registry já devolve "essa pergunta não é pro seu
  papel" de forma honesta. Se preferir lançar staff-only primeiro:
  `roles` no item da nav — decisão de produto, default = todos os papéis.
- Loading: bolha "…"; erro de provider: card "Assistente indisponível
  agora — tente de novo em instantes."
- Card de confirmação (fase 3): quando a resposta traz
  `requer_confirmacao`, renderiza resumo + "Confirmar"/"Cancelar" — o
  clique reenvia `{confirmado:true}` no tool call.
- **Demo**: assistente presente mas com respostas fixas — `executarTool`
  não roda contra demo (o client stub é browser-side). Demo renderiza 2–3
  trocas enlatadas sobre o dataset + aviso "No ambiente real o assistente
  responde com seus dados." (Detalhe no design/sdd — não finge LLM.)

## PR 3 — RAG `guia_consulta`

### Migration [NOVO] `0109_ia_chunks.sql`

```sql
create table public.ia_chunks (
  id uuid pk default gen_random_uuid(),
  guia text not null,              -- 'guia-mentor' | 'guia-mentorado' | 'manual-coordenacao' | …
  secao text, pagina int,
  texto text not null,
  tsv tsvector generated always as
    (to_tsvector('portuguese', texto)) stored,
  created_at timestamptz default now()
);
create index on public.ia_chunks using gin (tsv);
grant select on public.ia_chunks to authenticated;   -- conteúdo = guias oficiais, sem PII
create policy ia_chunks_select … using (true);       -- qualquer logado lê (guia não é segredo)
create or replace function public.match_ia_chunks(p_query text, p_limit int default 4)
  returns table(guia text, secao text, pagina int, trecho text, score real)
  language sql stable security definer … plainto_tsquery + ts_rank …
```

- **Sem pgvector nesta fase**: FTS `portuguese` é Postgres nativo —
  zero extensão/provider extra, e o corpus é pequeno (dezenas de chunks).
  pgvector + embeddings fica documentado como upgrade (sdd §6) se o
  recall em testes reais decepcionar.
- **Ingestão** `scripts/ingerir-guias.ts` [NOVO]: lê os PDFs oficiais
  (fonte: `Documentos`/materiais — `a verificar` path exato dos guias no
  repo ou storage), quebra em chunks ~800 chars por seção/página, upsert
  por `(guia, secao, pagina)` — idempotente. Rodar via `pnpm` script com
  service role local (padrão `scripts/seed-*.mjs`).

### Tool `guia_consulta` no registry

```ts
guia_consulta: { papeis: null /* todos os papéis */, descricao: "Busca nos guias oficiais…",
  args: z.object({ pergunta: z.string().min(3).max(300) }),
  run: ({pergunta}, supabase) => supabase.rpc("match_ia_chunks", {p_query:pergunta, p_limit:4}) }
```

- Retorna `{fontes:[{guia,secao,pagina,trecho}]}` — o chat renderiza
  citação "Guia do Mentor · p.12".
- `pendencias_docs` (da 124, leitura): conta assinaturas pendentes +
  `formacao_ok=false` + currículo pendente por papel — query em
  `queries.ts` nova `getPendenciasDocs` (coord+supervisor).

## PR 4 — MCP `/api/mcp` + PAT

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

## PR 5 — tools de escrita + confirmação (REALIZA-126)

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

- `BLOCKER`: provider com DPA/retenção zero (confirmação do contrato
  opencode API — doc-fonte).
- `a verificar`: localização canônica dos PDFs dos guias pra ingestão
  (storage `materiais` vs. docs locais).
- `a verificar`: versão estável do `mcp-handler` compatível com Next 16.
- OAuth Supabase pro MCP: `a verificar` se o OAuth server está
  habilitado no projeto (Dashboard → Authentication → OAuth). Se sim, é
  o caminho preferido do cliente; PAT cobre independentemente — a rota
  aceita os dois (sdd §4).

## Rollback

- Provider: unset `IA_API_KEY` → assistente oculto; `/api/ia/chat` → 503
  limpo.
- MCP: revoga tokens (`/perfil`) ou remove a rota; `ia_tokens` fica.
- RAG: drop `ia_chunks` se necessário — tabela isolada.
- Escrita: `IA_TOOLS` ganha flag `habilitada` por env? Não — mais simples:
  cada tool de escrita só é exposta quando `IA_ESCRITAS_OK=1` (mesmo
  padrão `IA_NARRATIVA_OK`) — **incluir no PR 5**.
