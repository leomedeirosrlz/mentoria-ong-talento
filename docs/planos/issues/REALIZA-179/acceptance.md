# REALIZA-179 — acceptance.md

Critérios executáveis por QA. "Provider mock" = `IA_API_BASE` apontando
pra stub local/MSW que devolve tool_call e texto sob demanda.

## Provider + chat (`/api/ia/chat`)

- [ ] Sem sessão → 401. Com sessão e sem `IA_API_KEY` → 503 amigável.
- [ ] `{"messages":[{"role":"user","content":"como está minha semana?"}]}`
  com provider mock → resposta em texto; se o mock pedir `resumo_semana`,
  a rota chama `executarTool` e devolve prosa com os dados do usuário.
- [ ] `ia_eventos` recebe row por tool call com `canal='chat'`, `tool`,
  `ok`, `duracao_ms` — visível pro próprio usuário e pra coord.
- [ ] Args inválidos → tool devolve `erro` → modelo reformula ou explica;
  `ia_eventos` tem `ok=false` com `erro`.
- [ ] 21ª mensagem em <60s → 429 com copy pt-BR.
- [ ] `messages` >20 ou content >4000 → 400 (zod).
- [ ] Mentor pergunta "minha dupla" → `ficha_dupla`/`resumo_semana` só
  devolvem a dupla dele (RLS) — nunca dados de outra dupla (testar com 2
  duplas em staging).
- [ ] Loop: provider mock pedindo 7 tool calls → para em 6 e responde com
  o que tem (sem travar).
- [ ] Transcript: refresh da página limpa a conversa; nenhuma tabela nova
  de conversas existe.

## UI `/assistente`

- [ ] Nav mostra "Assistente" pros papéis definidos; página carrega
  boas-vindas + chips por papel.
- [ ] Chip → envia e responde; bolhas user/assistente; fontes do guia
  aparecem como badge "Guia … · p.N".
- [ ] Provider off → card de indisponível, composer escondido.
- [ ] Demo: chips respondem com exemplos fixos; input livre → aviso
  "respostas de exemplo"; nenhum fetch ao provider.
- [ ] Mobile: composer sticky acima da bottom-nav; chips scrollam.

## RAG

- [ ] `scripts/ingerir-guias.ts` roda idempotente (2× → mesmos chunks).
- [ ] `match_ia_chunks('o que fazer quando a dupla não se encontra')`
  retorna chunks com `guia`, `pagina`, `trecho` — via SQL no staging.
- [ ] Tool `guia_consulta` no chat devolve `fontes`; a bolha cita
  "Guia do Mentor · p.N".
- [ ] Corpus: nenhum chunk contém nome de pessoa real (verificação do
  script + amostra manual).
- [ ] `anon`/não-logado não acessa `ia_chunks` (REST direto → 401/sem
  grant).

## MCP

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

## Escritas (flag `IA_ESCRITAS_OK=1`)

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
  testes Vitest: schema-to-JSON das tools, rate-limit, confirmação,
  `guia_consulta` args, resolver-identidade (PAT hash/verify).
- [ ] `ia-tools.test.ts` existente continua verde (registry só cresce).
- [ ] `check-schema-contract.mjs` verde após `db push` das migrations.
- [ ] e2e app (`tests/e2e/app/assistente.spec.ts`): coord abre
  `/assistente`, chips presentes; `/api/ia/chat` sem sessão 401; `/api/mcp`
  sem bearer 401; em `/perfil` a seção de token aparece só pra coord.
- [ ] e2e demo (`tests/e2e/demo/assistente.spec.ts`): página abre, chips
  respondem fixo, sem chamada de rede ao provider.
- [ ] Migrations: 0109/0110 idempotentes (`db push` 2× no staging limpo);
  `registrar_ia_evento` intacto.

## Fora de escopo

- Streaming SSE; OAuth flow end-to-end com cliente real (se OAuth server
  estiver off no projeto, PAT cobre o requisito — documentar).
- Histórico de conversas; múltiplos idiomas.
- Embeddings/pgvector (upgrade futuro se FTS falhar nos testes de recall).
