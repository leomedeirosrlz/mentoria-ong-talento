# REALIZA-179 — Chatbot público + MCP + RAG

**Jira:** [REALIZA-179](https://kelyng.atlassian.net/browse/REALIZA-179) ·
Doc-fonte: `docs/planos/ia-chatbot-mcp.md` · Tier A ·
**Absorve REALIZA-124 (assistente), 125 (MCP), 126 (tools de escrita).**

## Resumo

Transforma a fase 0 já entregue (`src/lib/ia/tools.ts` — registry tipado com
Zod + gate de papel + auditoria `ia_eventos`) em produto: **(1)** chat
dentro do app pra todos os papéis, **(2)** RAG sobre os guias oficiais,
**(3)** endpoint MCP `/api/mcp` coord-only pra Claude/ChatGPT externo com a
identidade real do usuário, **(4)** tools de escrita com confirmação
explícita. Dois transportes (chat + MCP) sobre **um só registry**.

## Veredito de status

**ENTREGUE** (registry + provider + chat SSE + bolha + RAG — REALIZA-179
com a rodada 243/244 e ajustes 280–289). O assistente hoje é
**read-only**.

- `IA_TOOLS` com 9 tools de leitura (`resumo_semana`, `ficha_dupla`,
  `registros_da_dupla`, `aguardando_par`, `capacidade_mentores`,
  `duplas_do_usuario`, `agenda_do_periodo`, `guia_consulta`,
  `instrumentos_da_dupla`) — `src/lib/ia/tools.ts`.
- `executarTool(nome, args, supabase, canal)`: validação Zod dos args,
  allowlist de papel via `papeisDoUsuario()` (multi-papel via RPC
  `my_papeis`), auditoria de sucesso/erro/args inválidos/papel negado via
  RPC `registrar_ia_evento`.
- `src/lib/ia/provider.ts`: cliente OpenAI-compatible — opencode Go
  (`IA_API_BASE`, modelo `mimo-v2.6-flash`, `stream:true`, headers
  `x-opencode-session` + `User-Agent`) — `chamarModeloStream` (SSE,
  remonta `tool_calls` por `index`) + `chamarModelo` JSON como fallback
  por rodada.
- `POST /api/ia/chat`: sessão cookie → SSE `status/token/done/error`
  (REALIZA-244), loop ≤6 iterações, rate limit 20 msg/60s por profile
  contando `ia_eventos` (`rate-limit.ts` + evento `mensagem` por envio).
- Assistente = **bolha** (REALIZA-243), não página: `AssistenteBolha`
  (FAB; Popover desktop / Sheet mobile) + `AssistenteConversa` — gate
  `IA_BOLHA=1` + papéis staff/mentores. `/assistente` virou redirect.
- RAG: `ia_chunks` + `match_ia_chunks` (migration **0136**), corpus
  `docs/rag/*.md` ingerido por `scripts/ingerir-guias.mjs`.
- `src/lib/ia/queries.ts`: selects com allowlist de colunas — **já exclui
  `dados_civis`, currículo, contatos brutos e texto livre** (reflexões,
  observações, temas).
- `ia_eventos` (0083): `canal` CHECK `('chat','mcp')`, insert só via RPC
  `registrar_ia_evento` (security definer, carimba `my_profile_id()`),
  select próprio + coord.
- RLS é o bound real: tools rodam com o client da sessão — mentor só
  enxerga a própria dupla.

**Pendente — REALIZA-290–297** (próximas fases; a spec abaixo segue
valendo como desenho delas): MCP `/api/mcp` + `resolverIdentidade`, PAT
`ia_tokens` + seção "Conectar IA externa" no `/perfil`, tools de escrita +
contrato `requer_confirmacao` (+ `src/lib/escritas.ts`), `pendencias_docs`
(leitura, listada na 124).

## Escopo (5 blocos)

1. **Provider + transporte chat — ENTREGUE** — `src/lib/ia/provider.ts`
   (cliente OpenAI-compatible: `IA_API_BASE`/`IA_API_KEY`/`IA_MODEL`/
   `IA_TIMEOUT_MS`, `chat.completions` com `tools`, `stream:true` —
   opencode Go, `mimo-v2.6-flash`) + `POST /api/ia/chat` (sessão → loop
   ≤6 de tool calls → `executarTool` canal `chat` → SSE; fallback JSON
   por rodada). Rate limit por `profile_id` contando `ia_eventos`
   recentes (20 msg/60s).
2. **UI do assistente — ENTREGUE como bolha (REALIZA-243)** — FAB no
   AppShell (Popover desktop / Sheet mobile), não página no nav; a gate é
   `IA_BOLHA=1` + papéis staff/mentores (jovem fora). Histórico só em
   memória do client — **transcript não persiste** (decisão do doc-fonte).
   Chips de sugestão por papel, chips de ação extraídos dos links internos
   da resposta, stop/retry/copy. O card de confirmação pras tools de
   escrita fica pra fase pendente (item 5).
3. **RAG `guia_consulta` — ENTREGUE** — tool no registry + `ia_chunks`
   (guia/seção/página/texto/tsv, unique NULLS NOT DISTINCT em
   (guia,secao,pagina)) + RPC `match_ia_chunks` — migration **0136** — +
   `scripts/ingerir-guias.mjs` lendo `docs/rag/*.md` (corpus markdown com
   frontmatter, não PDFs; delete+insert por guia; gate anti-PII). Busca
   **Full-Text `portuguese`** nativo (sem extensão nova); pgvector fica
   como upgrade documentado se o recall decepcionar — decisão no sdd §6.
4. **MCP `/api/mcp` — PENDENTE (REALIZA-290–297)** — servidor MCP
   stateless (Streamable HTTP) com `mcp-handler` expondo o **mesmo**
   `IA_TOOLS` (canal `mcp`). Auth: PAT `rlz_…` (`ia_tokens`: hash+prefix,
   criado/revogado em `/perfil`, `ultimo_uso_em`) — OAuth Supabase como
   alternativa documentada. Gate `coordenacao` no handshake. Rota precisa
   entrar na lista pública do middleware (auth é Bearer, não cookie).
5. **Tools de escrita (da 126) — PENDENTE (REALIZA-290–297)** —
   `registrar_interacao`, `marcar_situacao_mentorado`,
   `emitir_link_instrumento`, `agendar_encontro`, `editar_campo_pessoa` +
   `pendencias_docs` (leitura, da 124). Contrato de confirmação: primeiro
   call retorna `{requer_confirmacao:true, resumo}` (card no chat /
   approve no cliente MCP); só executa com `confirmado:true`. Escritas
   delegam às mesmas regras das actions/RPCs existentes — **extrair o core
   dos writes em `src/lib/escritas.ts`** pra action e tool compartilharem
   a regra. `agendar_encontro` herda o guard real: coord recebe "Quem
   agenda é a dupla" (o banco/a action já recusam — a tool reflete, não
   contorna).

## Dependências / bloqueios

- **Provider em uso:** opencode Go (plano de assinatura — o modelo
  default `mimo-v2.6-flash` declara retenção 0 dias e não treina com os
  dados, requisito LGPD dos dados de menores). A confirmação formal do
  DPA segue registrada como gate do jurídico; sem `IA_API_KEY` o
  assistente fica oculto e a bolha nem aparece (`IA_BOLHA` gate separado).
  MCP — quando entrar (REALIZA-290–297) — não depende do provider (serve
  tools direto) e pode sair antes.
- **`vercel.json`/middleware** *(fase pendente — REALIZA-290–297)*:
  `/api/mcp` e nada mais na lista pública — `/api/ia/chat` usa sessão
  cookie (já protegida).
- **REALIZA-42** registra a decisão; **178** reusa `provider.ts`.
- MCP em preview/staging: `ia_tokens` criados contra staging apontam pra
  staging — documentar no `/perfil` quando a fase 290–297 sair.

## Esforço

| Bloco | Est. | Risco | Status |
|---|---|---|---|
| Provider + `/api/ia/chat` + assistente | M | Médio — primeira integração LLM | entregue (virou bolha, 243; SSE, 244) |
| RAG (chunks + FTS + tool + ingestão) | M | Médio — curadoria dos guias | entregue (0136) |
| MCP + PAT (`ia_tokens`) | M | Médio — auth nova; surface coord-only | pendente — REALIZA-290–297 |
| Tools de escrita + confirmação | M | Alto — writes do domínio; testes duplos | pendente — REALIZA-290–297 |

Total: **G** — quebrável nos PRs do plan.md (cada bloco vira PR).

## Riscos

- Provider fora do ar → assistente indisponível: UI degrada com aviso
  (a bolha mostra o erro amigável; 503 tem retry automático no client).
- PAT vazado *(fase pendente — REALIZA-290–297)*: escopo = só leitura no
  escopo RLS do dono + revoke em `/perfil`; token guardado como hash
  (igual senha).
- Alucinação sobre operação: respostas de dados vêm **só de tool calls**
  (o system prompt proíbe inventar números); citação de fonte por chunk.
- Custo: rate limit por profile + narrativa/importação (178/180) sob o
  mesmo provider — `duracao_ms` + contagem de eventos dá observabilidade.
