# REALIZA-297 — Cobertura e2e do servidor MCP (`/api/mcp`)

Issue: `ia`,`mcp`,`e2e`. Fonte: plano `ia-chatbot-mcp.md` §6 + batch REALIZA-290–297 (o transporte já está em staging; falta a prova e2e). Status: a fazer.

## O que exige vs. o que existe

O servidor MCP **já está implementado** em `src/app/api/mcp/route.ts` — o que falta é cobertura e2e que prove o contrato inteiro, principalmente que a execução roda sob a RLS do dono do PAT e não sob service role.

Verificado no staging (`liza-olhos`):

- **Auth**: `Authorization: Bearer rlz_mcp_…` extraído por regex (`route.ts:78`); ausente → 401 `"Token ausente"` (:80-85); `ia_mcp_autorizar` via service client (:87-97) resolve sha256 → `profile_id`, `user_id`, `papel`, `papeis`; token inválido/revogado/expirado/inativo → 401 (:98-103). PAT tem `expira_em` default 90d (0159:134-140).
- **Gate de papel**: `PAPEIS_MCP` cobre **os 5 papéis** (`route.ts:35-41`) — coord, supervisor, mentor_dpp, mentor_especialista, mentorado. 403 só quando `papeis` não intersecta (:109-114) — ou seja, hoje só perfil **sem papel** recebe 403. A issue pedia "jovem → 403"; o comportamento verificado é outro — ver Decisões.
- **Protocolo**: JSON-RPC 2.0 stateless sobre POST; `initialize` → `protocolVersion: "2025-03-26"` + `serverInfo` + `instructions` (:128-134); `ping` (:135); `notifications/*` sem id → 204 (:123-125); método desconhecido → -32601; `GET` → 405 `Allow: POST` (:215-219).
- **`tools/list`**: filtra `IA_TOOL_CATALOGO` por `roles` (:137-146) — cada papel recebe só o catálogo dele.
- **`tools/call`**: gate por papel antes do rate-limit (:170-178); `consumirLimiteIa` 20/min por dono (:181); execução via `clientImpersonado(autorizado.user_id)` (:160) — sessão GoTrue real mintada por `generateLink`+`verifyOtp` com refresh em cache (`src/lib/ia/impersonar.ts`), nunca service-role.
- **Registry**: `executarTool` (`tools.ts:1578`) valida zod, aplica o gate `roles` de novo (:1656-1661), trata `escreve` pelo envelope `pendente_confirmacao` (:1663-1707) e grava `ia_eventos` (:1770-1782).
- **E2E infra**: `tests/e2e/helpers.ts` — `appEnvOk` (:203), `jwtDoUsuario`/`tokensDoUsuario` (password grant, :444/:470), helpers service-role com hard-stop anti-prod (`PROD_REF`); `playwright.config.ts` — `testDir: "tests/e2e"` (:20), projetos `app`/`demo` por `testMatch` de subdiretório (:43,:50); fixtures em `scripts/seed-e2e-staging.mjs` com ids fixos `e2e00000-*` (mentor `…010`, dupla `…030`, dupla2 do mentorReserva `…070`, coord `…040`, jovem `…0b0`).

**Gaps**: nenhuma spec toca `/api/mcp` (grep `api/mcp` em `tests/` = zero); não existe fixture de PAT — hoje tokens só nascem pela UI em `assistente-config.tsx` (:95-105 gera `rlz_mcp_`+24B → sha256 → insert em `ia_mcp_tokens` :274-275), que é coord-gated.

## Decisões

- **Local do teste: `tests/e2e/app/mcp.spec.ts`**, não `tests/e2e/mcp.spec.ts`. A issue nomeia o caminho raiz, mas `testMatch: "app/**/*.spec.ts"` (config :50) exige o subdiretório — arquivo na raiz não rodaria em nenhum projeto. Dentro de `app/` a spec herda de graça o gate `appEnvOk`, os shards do CI e a proteção `PROD_REF`. Alternativa (novo projeto `mcp` + dir próprio) rejeitada: config nova e shard novo pra uma única spec.
- **Transporte via Playwright `request`**, não um client MCP Node. O servidor é JSON-RPC sobre POST puro — `request.post(url, {headers, data})` cobre o contrato inteiro sem dependência de SDK e sem subir processo extra. O que o teste exercita é o contrato HTTP/JSON-RPC da nossa rota, não conformidade com a spec MCP de um cliente real.
- **Fixture de PAT no seed**, não mint pela UI: `seed-e2e-staging.mjs` ganha bloco que insere em `ia_mcp_tokens` via service-role REST (bypassa a RLS owner-only, mesmo caminho dos inserts atuais do seed) com `token_hash = sha256(tokenFixo)` via `node:crypto`. Tokens crus são constantes determinísticas (`rlz_mcp_e2e_<papel>_…`) declaradas no seed e referenciadas pela spec — segue o padrão `e2e-senha-teste`: credencial de teste em ambiente descartável, nunca prod. `expira_em` usa o default de 90d. Rejeitado: mintar pela tela (lento, e o insert é coord-only na UI — não geraria PAT de mentor/jovem/sem-papel).
- **403 testado com perfil sem papel**, não com jovem. `PAPEIS_MCP` já inclui `mentorado` — um PAT de jovem **conecta** (o gate virou "tem papel no programa", comentário `route.ts:31-34`). A spec do issue pedia "jovem → 403" assumindo o gate coord-only da fase 1 do plano — comportamento já expirado. O que a spec prova: (a) PAT de perfil `role: null` → 403 (`papeis` vazio não intersecta); (b) PAT de jovem conecta mas `tools/list`/`tools/call` de staff nega — defesa em profundidade que cobre a intenção original. Seed ganha `semPapelProfile` (`role: null`, `ativo: true`) + PAT.
- **Prova de RLS pelo conteúdo, não pelo status**: mentor chama `duplas_do_usuario` → recebe `…030` e **não** `…070` (dupla do mentorReserva); `ficha_dupla` com `…070` → `dados` `null` (a tool devolve null quando a RLS esconde). Se a execução fosse service-role, as duas viriam — é o teste que detecta a regressão priv-esc que o `clientImpersonado` existe pra impedir.
- **`guia_consulta` com corpus de fixture**: seed insere 1 chunk em `ia_chunks` (guia `"guia-e2e"`, texto com termo conhecido — colunas `guia`/`secao`/`pagina`/`texto`, `tsv` é generated, 0136). Sem corpus o e2e só provaria envelope vazio. Assert: `fontes` contém a fonte citável; `guias` lista o catálogo.
- **Cleanup**: fixtures de PAT são estáveis (hash de token fixo, idempotente no seed por `token_hash` unique) — sem teardown por spec. Linhas de `ia_eventos`/`ia_confirmacoes` geradas pelos calls são auditoria legítima, não lixo de teste.

## Schema

**Nenhuma** — cobertura de teste + fixture em script. `ia_mcp_tokens` (0149), `ia_mcp_autorizar` (0149/0159) e `ia_chunks` (0136) já existem.

## Domínio (src/lib/)

Nenhum. Rota, registry, impersonation e rate-limit já estão entregues — a spec é de testes.

## UI

Nenhuma.

## Seed + demo

`scripts/seed-e2e-staging.mjs` (idempotente, service-role REST):

- Bloco `ia_mcp_tokens`: uma row por fixture — `mentorProfile` (…010), `coordProfile` (…040), `jovemProfile` (…0b0), `semPapelProfile` (novo id `e2e00000-…-00f4`), cada um com `rotulo` `"e2e <papel>"` e `token_hash` = sha256 da constante de token correspondente. Bloco é defensivo igual aos de `profile_papeis`: se a tabela não existir no ambiente, pula.
- `semPapelProfile`: `profiles` com `role: null`, `ativo: true`, e-mail `e2e-sempapel@realiza.test` — **sem auth user** (não precisa logar; o PAT é o caminho). Garante o caso 403 sem depender de estado instável de outra fixture.
- 1 row em `ia_chunks`: `guia: "guia-e2e"`, `secao: "Regras"`, `pagina: 1`, `texto` com termo determinístico (ex.: "repescagem e2e" + conteúdo de regra plausível) pra `guia_consulta` achar via FTS.
- Tokens crus fixos (constantes no topo do script, exportados/nomeados por papel) — a spec os importa de `tests/e2e/helpers.ts` ou redeclara como constantes locais copiadas do seed (documentado nos dois lados pra não divergir).

## Testes

`tests/e2e/app/mcp.spec.ts` — `test`/`expect` de `../helpers`, `test.skip(!appEnvOk())`. Helper local `rpc(token, method, params)` fazendo `request.post("/api/mcp", …)` com `Authorization: Bearer ${token}` e devolvendo `{status, body}`.

Casos:

1. `initialize` com PAT do mentor → 200, `result.serverInfo.name === "realiza-mcp"`, `protocolVersion === "2025-03-26"`, `instructions` presente.
2. `tools/list` mentor → nomes contêm `ficha_dupla`, `duplas_do_usuario`, `guia_consulta`, `agenda_do_periodo`; **não** contêm `aguardando_par`, `capacidade_mentores`, `resumo_semana` (coord/sup-only), nem `minha_dupla`/`meu_progresso` (mentorado-only).
3. `tools/list` jovem → contém `minha_dupla`, `minha_agenda`, `meus_combinados`, `meu_progresso`, `guia_consulta`, `ficha_dupla`, `instrumentos_da_dupla`; **não** contém `resumo_semana`, `duplas_do_usuario`, `aguardando_par`, `pessoas_busca`, `registros_da_dupla`.
4. Sem `Authorization` → 401 `"Token ausente"`. `Bearer rlz_mcp_lixo` → 401 `"Token inválido ou revogado"`.
5. PAT do `semPapelProfile` → 403 `"O acesso por IA externa ainda não está disponível pro seu papel."`.
6. RLS: `tools/call duplas_do_usuario` (mentor) → `duplas` contém `…030` e não `…070`; `tools/call ficha_dupla {dupla_id: "…070"}` → resultado `null` dentro de `content[0].text` (JSON), sem `isError`.
7. `tools/call guia_consulta {pergunta: "repescagem e2e"}` → `fontes` com a fonte do `guia-e2e`.
8. Gate por tool: jovem chama `resumo_semana` → resposta JSON-RPC com `isError: true` / erro "não está disponível pro seu papel" (o gate :172-178 devolve `-32000` no envelope ou `ErroTool` no content — a spec aceita os dois formatos documentando qual).
9. `GET /api/mcp` → 405 com `Allow: POST`.
10. `notifications/initialized` (sem id) → 204.

## Critérios de aceite

- [ ] `tests/e2e/app/mcp.spec.ts` existe dentro do projeto `app` do Playwright e roda no CI local (supabase start + seed).
- [ ] `initialize` e `tools/list` com PAT válido de mentor retornam o catálogo filtrado por papel (coord-only tools ausentes).
- [ ] PAT inválido/ausente → 401; PAT de perfil sem papel → 403; `tools/call` de tool fora do papel → erro "não está disponível pro seu papel".
- [ ] `duplas_do_usuario` do mentor retorna `…030` e **não** retorna `…070` — prova de execução sob RLS, não service-role.
- [ ] `ficha_dupla` de dupla fora do escopo do mentor devolve `null` sem `isError`.
- [ ] `guia_consulta` retorna fonte citável do chunk fixture `guia-e2e`.
- [ ] Jovem conecta e vê apenas tools `mentorado`/`TODOS_PAPEIS` — nenhuma tool de staff listada nem executável.
- [ ] `GET` → 405 `Allow: POST`; `notifications/*` → 204.
- [ ] Seed insere PATs e o chunk `guia-e2e` de forma idempotente; rerun do seed não duplica (constraint `token_hash` unique + upsert por `ia_chunks_origem_key`).
- [ ] Nenhum teste usa service-role pra chamar `/api/mcp` — apenas pra montar fixtures (espelho do que a UI faria).

## Fora de escopo

- Conformidade com SDK MCP oficial / client real (Claude Desktop) — o teste cobre nosso contrato JSON-RPC, não o protocolo de um terceiro.
- Escritas MCP (`escreve` + `pendente_confirmacao`) — cobertura e2e das tools de escrita vem com REALIZA-126.
- OAuth Supabase como Bearer alternativo — `a verificar` pendente do sdd 179 §4; a spec testa só PAT.
- Rate-limit 429 (20/min) — exercitá-lo queimaria a cota dos demais casos no mesmo minuto; o caminho negativo fica pro vitest da rota, não pro e2e.
- Revogação/expiração de PAT em runtime — o caminho existe (`revogado_em`/`expira_em`), mas o teste de expiração exigiria manipular `expira_em` por spec; fica como caso unitário se houver necessidade.
