# Mapa de regressão — invariante ↔ o que o protege

Quem mexe no repo sem contexto precisa de duas coisas: saber **qual regra não pode quebrar** e saber **qual teste fica vermelho se quebrar**. Este mapa amarra os dois. Não é documentação de comportamento (isso é `docs/convencoes/architecture.md`); é a lista de proteção ativa.

## Proteção ativa (vitest — roda em todo push/PR)

| Invariante | Guardado por |
|---|---|
| Allowlist de rotas públicas + redirect com `next` preservado + `next` externo rejeitado | `tests/middleware-publico.test.ts` |
| Matcher do proxy (assets, metadata, tunnel do Sentry fora) | `tests/proxy-matcher.test.ts` |
| Numeração de migrations: única, lacunas conhecidas, stubs vazios | `tests/migrations-integridade.test.ts` |
| Toda tabela com RLS; `security definer` com `search_path` | `tests/migrations-integridade.test.ts` |
| Rotas de cron autenticadas; cron único do `vercel.json`; registro de jobs do tick | `tests/jobs-registry.test.ts` |
| Gates de publicação (`[deploy]`, `[e2e-preview]`, fila `e2e-staging`, gates do `ci.yml`) | `tests/deploy-gates.test.ts` |
| Migrations do base imutáveis (só entra arquivo novo) | `scripts/repo-guard.mjs` R1/R9 + job `repo-guard` do CI |
| Objeto criado em migration presente em `database.types.ts` | `scripts/repo-guard.mjs` R2 |
| Sem `.env*` nem segredo versionado; bloco do Next no `AGENTS.md`; links de docs; JSON/scripts válidos | `scripts/repo-guard.mjs` R3–R5, R10 |
| Semáforo (risco/atenção/ok, apoio fora) | `tests/ciclo-semaforo.test.ts` |
| Cron: 503 sem env, 401 bearer errado, idempotência por ledger | `tests/saude-snapshots.test.ts`, `tests/digest-semanal.test.ts`, `tests/whatsapp-lembretes.test.ts` |
| Handoff do login (nonce, cooldown, tombstone) | `tests/login-pedido.test.ts`, `tests/login-erros.test.ts` |
| Escrita valida em camada única | `tests/escritas.test.ts` |
| Emissão de documento (idempotência, menor de idade) | `tests/documentos-mentorado.test.ts` |
| `/resumo` público (allowlist de recorte, motivos) | `tests/relatorio-publico.test.ts`, `tests/relatorio.test.ts` |
| Scrub do Sentry (PII não vai pro evento) | `tests/sentry-scrub.test.ts` |
| Corpus RAG fail-closed por audiência | `tests/corpus-audiencia.test.ts` |
| Contrato do CSV de export | `tests/relatorios-csv.test.ts`, `tests/export-route.test.ts` |
| IA: impersonação, rate-limit, tokens MCP, prompt | `tests/ia-*.test.ts`, `src/lib/ia/*.test.ts`, `tests/tokens-mcp.test.ts` |
| Cronograma importado nunca persiste sem revisão; parser produz `EventoRascunho` válido | `src/lib/importar-cronograma/normalizar.test.ts` + `tests/e2e/app/turmas-importar.spec.ts` |
| PII do `/resumo` (`hashIpAcesso` por salt, null em prod sem env + aviso 1×, UA truncado) | `tests/resumo-acesso.test.ts` |
| Paridade TS × SQL de vocabulários fechados (`AcaoProduto` × RPC vigente, `AUDIENCIAS` × check/policies da `0139`, `ROLES_POR_AUDIENCIA` × check de comunicados) | `tests/paridade-ts-sql.test.ts` |
| Auth do `/api/mcp` (401 sem Bearer, 401 PAT inválido, 403 sem papel, `papeis[]` manda) e `PAPEIS_MCP` = 5 papéis | `tests/mcp-auth.test.ts` |
| Semântica do handoff em SQL (registrar resgata `failed`, falhar é `do nothing`, pegar distingue expirado) | `tests/handoff-sql.test.ts` |
| Regexes de token público consistentes com o mint (32 base64url em `/f` `/t` `/avaliar`; uuid em `/assinar` `/api/assinar-token`) | `tests/token-formato.test.ts` |
| Janela de adoção ≤ retenção do cru; RPCs `adocao_*` e export não leem o rollup | `tests/adocao-janela.test.ts` |

E2e `app` (backend real, obrigatório no PR) e `demo` cobrem os fluxos por papel — a lista de specs por subsistema está no índice do Playwright.

## Lacunas conhecidas (proteção pendente)

Gap real, com teste viável já especificado — entregar como spec de regressão, não como "melhoria":

1. **`refazer` instrumento (`0209`)**: allowlist da action × RPC × catálogo.
2. **Trigger de encerramento automático** (`0102`) e RPC `rematch_dupla` — regra de banco sem harness; cobrir por asserção de texto SQL ou e2e dedicado.
3. **251 policies RLS** — sem teste de banco; mitigação atual: policy é migration nova + caso e2e do papel negado.

## Ambiguidades que travam teste (decisão humana, não código)

- **Documento revogado**: `0206` não ressuscita; emissão manual cria row nova. Contraditório de propósito? Decidir e travar com teste.
- **Dupla tardia** sem grace period (nasce em atenção, morre em risco) — decisão de produto aberta.
- **Especialista fora de "Aguardando par"** — decisão com o Leo.
