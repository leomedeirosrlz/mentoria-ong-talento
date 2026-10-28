# REALIZA-179 — acceptance.md

Critérios executáveis por QA. "Provider mock" = `IA_API_BASE` apontando
pra stub local/MSW que devolve tool_call e texto sob demanda.

**Status (REALIZA-310):** blocos Provider+chat, UI (virou bolha na
REALIZA-243) e RAG **entregues** — os critérios abaixo valem, com os
deltas do contrato anotados inline (respostas são SSE, não JSON único).
Blocos MCP e Escritas **pendentes — REALIZA-290–297**: critérios
guardados pra quando a fase sair.

## Provider + chat (`/api/ia/chat`) — entregue (SSE na REALIZA-244)

- [ ] Sem sessão → 401. Com sessão e sem `IA_API_KEY` → 503 amigável.
  *(gates respondem JSON antes do stream abrir — o contrato de erro não
  mudou)*
- [ ] `{"messages":[{"role":"user","content":"como está minha semana?"}]}`
  com provider mock → **stream SSE**: tokens `data:{type:"token"}` ao
  vivo + `{type:"done"}` no fim; se o mock pedir `resumo_semana`, a rota
  chama `executarTool`, emite `{type:"status"}` na rodada e a prosa vem
  com os dados do usuário. Provider sem SSE → a rodada refaz em JSON
  (fallback) e o resultado chega como `token`.
- [ ] `ia_eventos` recebe row `tool='mensagem'` por envio + row por tool
  call com `canal='chat'`, `tool`, `ok`, `duracao_ms` — visível pro
  próprio usuário e pra coord.
- [ ] Args inválidos → tool devolve `erro` → modelo reformula ou explica;
  `ia_eventos` tem `ok=false` com `erro`.
- [ ] 21ª mensagem em <60s → 429 com copy pt-BR (o count inclui os
  eventos `mensagem`).
- [ ] `messages` >20, content >4000, role fora de `user|assistant` ou
  campo extra → 400 (zod strict).
- [ ] Mentor pergunta "minha dupla" → `ficha_dupla`/`resumo_semana` só
  devolvem a dupla dele (RLS) — nunca dados de outra dupla (testar com 2
  duplas em staging).
- [ ] Loop: provider mock pedindo 7 tool calls → para em 6
  (`MAX_ITERACOES=6`) e responde com o que tem (sem travar; `guia_consulta`
  repetida é cortada na 1ª com "busca já realizada").
- [ ] Transcript: fechar/reabrir a bolha limpa a conversa; nenhuma tabela
  nova de conversas existe.

## UI do assistente — entregue como bolha (REALIZA-243)

- [ ] Com `IA_BOLHA=1` e papel staff/mentor, o FAB `Sparkle` aparece no
  AppShell; jovem e `IA_BOLHA` unset → sem FAB. `/assistente` → redirect.
- [ ] Chip → envia e responde; bolhas user/assistente com stream ao vivo
  (cursor piscante), status "consultando dados…" nas rodadas de tool,
  meta com "fontes: tools" e chips de ação dos links internos; stop
  aborta, retry reenvia.
- [ ] Provider off → chips/composer desligados; erro de provider → bolha
  com mensagem amigável + "Tentar de novo".
- [ ] Demo: chips respondem com exemplos fixos; input livre → resposta
  fixa "Na demonstração…"; nenhum fetch ao provider/API.
- [ ] Mobile: FAB acima da bottom-nav; abre `Sheet` de rodapé com o mesmo
  painel.

## RAG — entregue (migration 0136)

- [ ] `pnpm ingerir:guias --apply` (`scripts/ingerir-guias.mjs` lendo
  `docs/rag/*.md`) roda idempotente (2× → mesmos chunks; delete+insert
  por guia).
- [ ] `match_ia_chunks('o que fazer quando a dupla não se encontra')`
  retorna chunks com `guia`, `pagina`, `trecho` — via SQL no staging.
- [ ] Tool `guia_consulta` no chat devolve `fontes`; a resposta cita o
  guia/seção na prosa e a meta da bolha mostra "fontes: guia_consulta".
- [ ] Corpus: nenhum chunk contém nome de pessoa real (gate anti-PII do
  script + amostra manual).
- [ ] `anon`/não-logado não acessa `ia_chunks` (REST direto → 401/sem
  grant).

## MCP — PENDENTE (REALIZA-290–297)

Critérios guardados pra fase — nada disso existe hoje (rota, `ia_tokens`,
seção no `/perfil`, dep `mcp-handler`).

- [ ] `/api/mcp` sem Bearer → 401 JSON (não redirect pra `/login`).
- [ ] `GET`/`POST` com JWT do coord → `tools/list` responde as tools
  permitidas; `tools/call resumo_semana` retorna dados — `ia_eventos`
  com `canal='mcp'`.
- [ ] PAT: coord cria token em `/perfil` → `rlz_…` mostrado uma vez;
  Bearer PAT → `tools/call` funciona; `ultimo_uso_em` atualiza.
- [ ] PAT revogado → 401/403 imediato; sessão mintada não se renova.
- [ ] JWT/PAT de mentor → 403 "restrito à coordenação" (gate).
- [ ] Tools de escrita **não aparecem** no `tools/list` MCP com
  `IA_MCP_ESCRITAS` unset.
- [ ] Rate limit MCP: >30 calls/min → 429.

## Escritas (flag `IA_ESCRITAS_OK=1`) — PENDENTE (REALIZA-290–297)

Assistente hoje é read-only — critérios guardados pra fase.

- [ ] `registrar_interacao` sem `confirmado` → resposta
  `{requer_confirmacao, resumo}` → chat mostra card → Confirmar →
  interação criada (visível na ficha da dupla) + 2 `ia_eventos`
  (dry-run + execução).
- [ ] Cancelar → nada escrito; transcript mostra "Ação cancelada".
- [ ] `marcar_situacao_mentorado` pra mentorado com dupla viva →
  `{erro}` com a recusa real do domínio (sem contornar).
- [ ] `agendar_encontro` chamado como coord → resposta "Quem agenda é a
  dupla" (guard herdado).
- [ ] `editar_campo_pessoa` com campo fora da allowlist → `erro`.
- [ ] `emitir_link_instrumento` → token de link real emitido (mesmo
  comportamento do botão na ficha).
- [ ] Mentor chama `editar_campo_pessoa` → negado por papel (evento
  auditado `papel_negado`).

## Regressão / gates

- [ ] `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` — inclui novos
  testes Vitest: schema-to-JSON das tools, rate-limit, `guia_consulta`
  args; *(pendentes — 290–297)* confirmação, resolver-identidade (PAT
  hash/verify).
- [ ] `ia-tools.test.ts` existente continua verde (registry só cresce).
- [ ] `check-schema-contract.mjs` verde após `db push` das migrations.
- [ ] e2e app (`tests/e2e/app/assistente.spec.ts`): com `IA_BOLHA=1`,
  coord vê o FAB e abre a bolha, chips presentes; `/api/ia/chat` sem
  sessão 401. *(pendentes: `/api/mcp` sem bearer 401; seção de token no
  `/perfil` só pra coord — REALIZA-290–297)*
- [ ] e2e demo (`tests/e2e/demo/assistente.spec.ts`): bolha abre, chips
  respondem fixo, sem chamada de rede ao provider.
- [ ] Migrations: 0136 idempotente (`db push` 2× no staging limpo);
  `registrar_ia_evento` intacto. *(a migration de `ia_tokens` chega na
  fase 290–297)*

## Fora de escopo

- ~~Streaming SSE~~ → **entregue na REALIZA-244** (`status/token/done/
  error` + fallback JSON por rodada).
- OAuth flow end-to-end com cliente real (fase REALIZA-290–297 — se o
  OAuth server estiver off no projeto, PAT cobre o requisito; documentar).
- Histórico de conversas; múltiplos idiomas.
- Embeddings/pgvector (upgrade futuro se FTS falhar nos testes de recall).
