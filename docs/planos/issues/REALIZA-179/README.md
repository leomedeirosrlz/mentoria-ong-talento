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

**FASE 0 ENTREGUE.** Existe e está testado (`tests/ia-tools.test.ts`):

- `IA_TOOLS` com 6 tools de leitura (`resumo_semana`, `ficha_dupla`,
  `registros_da_dupla`, `aguardando_par`, `capacidade_mentores`,
  `instrumentos_da_dupla`) — `src/lib/ia/tools.ts`.
- `executarTool(nome, args, supabase, canal)`: validação Zod dos args,
  allowlist de papel via `papeisDoUsuario()` (multi-papel via RPC
  `my_papeis`), auditoria de sucesso/erro/args inválidos/papel negado via
  RPC `registrar_ia_evento`.
- `src/lib/ia/queries.ts`: selects com allowlist de colunas — **já exclui
  `dados_civis`, currículo, contatos brutos e texto livre** (reflexões,
  observações, temas).
- `ia_eventos` (0083): `canal` CHECK `('chat','mcp')`, insert só via RPC
  `registrar_ia_evento` (security definer, carimba `my_profile_id()`),
  select próprio + coord.
- RLS é o bound real: tools rodam com o client da sessão — mentor só
  enxerga a própria dupla.

**Não existe:** provider client, transporte de chat (`/api/ia/chat`), UI,
`guia_consulta`/RAG, MCP (`/api/mcp`), auth de token pessoal, tools de
escrita, `pendencias_docs` (listada na 124, não implementada).

## Escopo (4 blocos)

1. **Provider + transporte chat** — `src/lib/ia/provider.ts` [NOVO]
   (cliente OpenAI-compatible: `IA_API_BASE`/`IA_API_KEY`/`IA_MODEL`/
   `IA_TIMEOUT_MS`, `chat.completions` com `tools`, não-streaming v1) +
   `POST /api/ia/chat` [NOVO] (sessão → loop de tool calls →
   `executarTool` canal `chat` → resposta). Rate limit por `profile_id`
   contando `ia_eventos` recentes.
2. **UI `/assistente`** [NOVO] — página no app (todos os papéis; item no
   nav). Histórico só em memória do client — **transcript não persiste**
   (decisão do doc-fonte). Chips de sugestão por papel, citações do guia,
   card de confirmação pras tools de escrita.
3. **RAG `guia_consulta`** — tool nova no registry + `ia_chunks` [NOVO]
   (guia/seção/página/texto/tsv) + RPC `match_ia_chunks` [NOVO] +
   `scripts/ingerir-guias.ts` [NOVO]. Busca **Full-Text `portuguese`**
   nativo (sem extensão nova); pgvector fica como upgrade documentado se o
   recall decepcionar — decisão no sdd §6.
4. **MCP `/api/mcp`** — servidor MCP stateless (Streamable HTTP) com
   `mcp-handler` [NOVO dep] expondo o **mesmo** `IA_TOOLS` (canal `mcp`).
   Auth: PAT `rlz_…` (`ia_tokens` [NOVO]: hash+prefix, criado/revogado em
   `/perfil`, `ultimo_uso_em`) — OAuth Supabase como alternativa
   documentada. Gate `coordenacao` no handshake. Rota precisa entrar na
   lista pública do middleware (auth é Bearer, não cookie).
5. **Tools de escrita (fase 3, da 126)** — `registrar_interacao`,
   `marcar_situacao_mentorado`, `emitir_link_instrumento`,
   `agendar_encontro`, `editar_campo_pessoa` + `pendencias_docs` (leitura,
   da 124). Contrato de confirmação: primeiro call retorna
   `{requer_confirmacao:true, resumo}` (card no chat / approve no cliente
   MCP); só executa com `confirmado:true`. Escritas delegam às mesmas
   regras das actions/RPCs existentes — **extrair o core dos writes em
   `src/lib/escritas.ts` [NOVO]** pra action e tool compartilharem a regra.
   `agendar_encontro` herda o guard real: coord recebe "Quem agenda é a
   dupla" (o banco/a action já recusam — a tool reflete, não contorna).

## Dependências / bloqueios

- **BLOCKER:** provider com **DPA + retenção zero** antes de ligar em prod
  (doc-fonte aponta opencode API — confirmar contrato). Sem `IA_API_KEY`
  o assistente fica oculto; MCP não depende do provider (serve tools
  direto) e pode sair antes.
- **`vercel.json`/middleware**: `/api/mcp` e nada mais na lista pública —
  `/api/ia/chat` usa sessão cookie (já protegida).
- **REALIZA-42** registra a decisão; **178** reusa `provider.ts`.
- MCP em preview/staging: `ia_tokens` criados contra staging apontam pra
  staging — documentar no `/perfil`.

## Esforço

| Bloco | Est. | Risco |
|---|---|---|
| Provider + `/api/ia/chat` + `/assistente` | M | Médio — primeira integração LLM |
| RAG (chunks + FTS + tool + ingestão) | M | Médio — curadoria dos guias |
| MCP + PAT (`ia_tokens`) | M | Médio — auth nova; surface coord-only |
| Tools de escrita + confirmação | M | Alto — writes do domínio; testes duplos |

Total: **G** — quebrável nos PRs do plan.md (cada bloco vira PR).

## Riscos

- Provider fora do ar → assistente indisponível: UI degrada com aviso,
  tools de leitura pura (MCP) seguem.
- PAT vazado: escopo = só leitura no escopo RLS do dono + revoke em
  `/perfil`; token guardado como hash (igual senha).
- Alucinação sobre operação: respostas de dados vêm **só de tool calls**
  (o system prompt proíbe inventar números); citação de fonte por chunk.
- Custo: rate limit por profile + narrativa/importação (178/180) sob o
  mesmo provider — `duracao_ms` + contagem de eventos dá observabilidade.
