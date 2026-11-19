# Architecture — código e domínio (as-built)

Descrição do que existe. Números voláteis (contagem de teste, próxima migration) ficam no `AGENTS.md` e no `specs/README.md`, nunca aqui.

## Fronteira de código

- `src/lib/queries*.ts` — leitura server-side com `React.cache` + `auth.getClaims()`. Getters `unstable_cache` usam service role e **bypassam RLS**: proibidos em contexto de jovem (comentário no topo de `src/lib/queries.ts`).
- `src/lib/actions*.ts` — server actions; retornam `{ error }` ou `{ ok }`, nunca lançam.
- `src/lib/escritas.ts` — núcleo de validação de escrita compartilhado entre server actions e tools da Liza. Regra nova de escrita mora aqui, senão um dos dois caminhos ignora.
- `src/lib/ciclo.ts` — domínio puro (semáforo, jornada, datas, labels de enum); não importa Next nem Supabase; consumido por app, demo e testes.
- `src/lib/demo/` — replica o escopo RLS por papel em TypeScript; mutação devolve `DEMO_MSG`. Mudar policy sem espelhar faz a demo (que roda contra **produção** no nightly) ensinar errado.
- `src/proxy.ts` — o middleware do Next 16 virou **proxy**; chama `updateSession` (`src/lib/supabase/middleware.ts`). O matcher exclui assets, metadata gerada (`opengraph-image`, `sitemap.xml`, `llms.txt`) e o tunnel do Sentry (`/monitoring`) — travado por `tests/proxy-matcher.test.ts`.
- **Rotas públicas (`isPublic`)**: `/login`, `/auth/*`, `/demo*`, `/assinar/*`, `/api/assinar-token/*`, `/f/*`, `/t/*`, `/avaliar/*`, `/resumo/*`, `/api/jobs/*`, `/api/mcp`, `/privacidade` — travado por `tests/middleware-publico.test.ts`. Sem grant de tabela para `anon`: acesso por RPC `security definer` com token de posse.

## Domínio

- **Calendário por cronograma da dupla** (`eventosDoCronograma`), com fila de recuperação de atrasados. O "16 encontros de terça" é só fallback (`TRILHA_LEN`); o teto real vem da trilha da dupla. Trilha especialista não tem calendário: esperado = feitos.
- **Semáforo** (veredito em `saudadeDaDupla`/`veredito`): `risco` = avaliação baixa **e** dificuldade no último registro, ou ≥2 encontros atrasados; `atenção` = 1 atraso, avaliação baixa, dificuldade, preventivo, limbo, registro pendente, encaminhamento vencido, estagnação; senão `ok`. **Apoio é eixo separado** (`saude.apoio.*`), nunca acende o semáforo. A régua executável está em `tests/ciclo-semaforo.test.ts`.
- **Pareamento**: uma vaga por trilha — índice único em `duplas` + trigger de capacidade com `FOR UPDATE` + checagem no app antes do insert. Fila "Aguardando par" é só DPP (especialista é acionado por solicitação). Rematch herda histórico **e** jornada e é regra de banco (RPC `rematch_dupla`, definida em várias migrations — vale a última aplicada).
- **Encerramento automático** por trigger no último encontro — irreversível.
- **Magic link** é implícito (sem PKCE) com handoff entre abas: `/auth/link` planta a sessão via nonce com TTL de 10 min; sem `?h=` nunca planta. Contrato em `0049`/`0050`/`0175`/`0181`.
- **Instrumentos** auto-emitem por janela do guia a partir do `max(realizado)`; respondido nunca re-emite; o jovem pode refazer os da própria jornada (`0209`).
- **Documentos** devidos nascem sozinhos no login (`0206`); unicidade de "uma row viva por alvo×template" é do banco (`assinaturas_viva_uk`).
- **Escrita em 2 fases** para toda tool da Liza: prévia não muta; confirmação consome atomicamente (`ia_confirmacao_consumir`). MCP por PAT sha256 sob JWT impersonado do dono.
- **Cron**: um único agendamento (`/api/jobs/tick`) orquestra todos os jobs; bearer `CRON_SECRET` (sem env → 503; errado → 401 JSON, nunca redirect). Jobs são idempotentes por ledger.
- **Telemetria**: `produto_eventos` só por RPC com whitelist de `acao`; rollup diário + retenção de 90 dias.

## Invariantes e proteção

- Matriz invariante ↔ teste que o protege: `docs/regression-map.md`.
- Ledger de migrations imutável: `scripts/repo-guard.mjs` (R1/R9) + `tests/migrations-integridade.test.ts`.
- Contrato de schema: `pnpm schema:check` contra o OpenAPI do PostgREST do ambiente alvo.
- RLS por papel: as 251 policies não têm teste de banco — policy nova é **migration nova** com caso e2e do papel negado.
