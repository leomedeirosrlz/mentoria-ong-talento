# Auditoria — IA, MCP e canais (REALIZA-399–404, 292, 179, 303)

**Data:** nov/2026 · **Branch:** `feat/ia-canais-nov` · **Método:** leitura de código, migrations, planos (`docs/planos/`), LGPD (`docs/lgpd/`) e testes — sem tocar credenciais, sem escrever no Jira, sem código de integração.

Este documento é um **mapa de decisão**, não uma implementação. Cada issue recebe: o que existe (com evidência `arquivo:linha`), o que falta, credenciais/envs necessários, riscos LGPD/segurança e o veredito com a decisão pendente e o dono provável.

> Convenção de veredito: **cumprido** (escopo da issue atendido), **parcial** (base existe, falta a superfície ou o canal), **não cumprido** (nada implementado além do acidental).

---

## 0. Sumário

| Issue | Escopo | Veredito | Depende de | Decisão de quem |
|---|---|---|---|---|
| REALIZA-399 | Login Google (Supabase provider + vínculo por e-mail) | **não cumprido** | Credenciais Google Cloud; decisão sobre conta dupla | Produto (Thiago) + infra |
| REALIZA-400 | Agenda Google sincronizada (evento + Meet) | **não cumprido** | OAuth próprio com refresh token (≠ login Supabase); migration nova; scope sensível | Produto + infra |
| REALIZA-403 | Sinais de presença (Meet API) | **não cumprido** — fase 2 por desenho | 400 feito + scope restrito (verificação Google) + base legal LGPD | Produto + jurídico/DPO |
| REALIZA-404 | FreeBusy p/ sugestão de horário | **não cumprido** | 400 feito; ou atalho barato via grade declarada | Produto |
| REALIZA-401 | Lembretes nativos (push PWA + e-mail) | **parcial** | Régua e canais parciais já existem; falta push + gatilhos T-24h | Produto |
| REALIZA-402 | WhatsApp Cloud API | **não cumprido** | Meta Business + número + templates + webhook público | Produto + infra |
| REALIZA-292 | MCP Auth — PAT no /perfil + OAuth flow | **quase cumprido** | PAT completo e endurecido; OAuth ausente | Produto (OAuth ainda faz falta?) |
| REALIZA-179 | Camada IA (chatbot + MCP + RAG) | **cumprido** (com ressalvas §8) | `IA_BOLHA` em prod; itens LGPD abaixo | Produto + jurídico |
| REALIZA-303 | Revisão planos/código de IA | **parcial** | Relatório formal nunca existiu; auditorias OWASP-LLM aplicadas; achados §9 | Produto (fechar via este doc ou relatório dedicado) |

**Dependência estrutural:** 400 → depende de um OAuth Google próprio (não do login); 403 e 404 → dependem de 400; 399 é independente mas compartilha o projeto Google Cloud com 400/403/404.

---

## 1. REALIZA-399 — Login Google

### O que existe

- Login por senha + magic link (OTP) com recuperação e handoff cross-device por nonce: `src/app/login/login-form.tsx`.
- O vínculo "primeiro login → pré-cadastro por e-mail" **já existe**: `handle_new_user` compara o e-mail canônico do `auth.users` com `profiles.email` e liga `user_id` + espelha papel (`supabase/migrations/0045_signup_allowlist.sql:63`, refinado em `0059_normalizacao_canonica.sql:78` e `0085_profile_papeis.sql:339`). A allowlist `email_liberado` rege quem pode entrar.
- Tela "Peça acesso"/cadastro-recebido para quem entra sem pré-cadastro.

### O que falta

- Provider Google no Supabase: `supabase/config.toml` só tem o template comentado (`[auth.external.apple]` como exemplo) e `oauth_server` local `enabled = false` (`:395-399`). Nenhum `signInWithOAuth` no código; nenhum botão no `/login`.
- Decisão de identidade: mesmo e-mail entrando por magic link e por Google → uma identidade linkada ou conta dupla? (Supabase linka por e-mail verificado no mesmo usuário sob certas condições — confirmar comportamento atual do provider antes do spec.)
- E2E: fake provider vs. testar só o vínculo (decisão da issue).

### Credenciais / envs

- Google Cloud: OAuth client (Web) com redirect `https://<ref>.supabase.co/auth/v1/callback`. Configuração no dashboard Supabase (`[auth.external.google]` no config.toml para dev local). **Nenhuma env de app nova.**

### LGPD / segurança

- Menores: só muda o canal de entrada; modelo de consentimento inalterado (o termo já cobre cadastro por e-mail).
- O Supabase retém apenas tokens de sessão próprios; o `provider_token` do Google é efêmero de sessão — **não serve para Calendar** (ver §2).
- Risco baixo; o ponto frágil é a UX de quem não tem Gmail pessoal cadastrado igual ao do pré-cadastro (e-mail diferente → nova identidade não linkada → "cadastro não encontrado").

### Veredito: **não cumprido**

Custo estimado: pequeno (spec + botão + provider + E2E do vínculo). Recomendação: fazer **antes** de qualquer trabalho de Calendar — o projeto Google Cloud e o OAuth client são compartilhados com 400/403/404.

---

## 2. REALIZA-400 — Agenda Google sincronizada (evento + Meet)

### O que existe

- Agenda interna substancial: `src/components/agenda-calendario.tsx`, `src/lib/agenda-{minha,coordenacao,auxiliar,especialista}.ts`, `/agenda` e `/jovem/agenda`.
- `encontros.link text` + `origem ('plataforma'|'externo')` (`0001_init.sql:74-75`): link de chamada **manual** — placeholder `https://meet.google.com/…` em `agendar-encontro-dialog.tsx:452` e `jovem-agendar-dialog.tsx:273`.
- Remarcação com motivo e desfecho `nao_aconteceu` já têm regra de domínio (`agendarEncontroCore`/`desmarcar_encontro`) — são os gatilhos naturais do sync.

### O que falta — tudo da integração

- Nenhum OAuth Google, `events.insert`/`patch`/`delete`, `conferenceData`, event ID externo, watch/webhook, nem tabela de tokens.
- **Ponto arquitetural chave:** o OAuth do login Supabase **não resolve** o Calendar. `provider_token` é efêmero (só na sessão). Para `events.insert` no servidor é preciso um **fluxo OAuth próprio** (`access_type=offline`, `calendar.events` incremental) com **refresh token criptografado** em tabela nova (decisão: `pgsodium`/Vault vs. chave de app) — ou seja, exatamente o que a issue pede ("conexão separada do login básico, opt-in").
- Migration nova: `encontros.google_event_id` (e possivelmente `meet_link` derivado) — `link` manual continua como fallback.

### Credenciais / envs

- Mesmo OAuth client do §1 com scope incremental `calendar.events` (**scope sensível** → verificação Google obrigatória em produção; em dev, test users).
- Envs novas prováveis: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, chave de criptografia de tokens (verificar Supabase Vault antes de inventar).

### LGPD / segurança

- Evento criado **na conta pessoal do mentor** (dono por desenho da issue): minimizar payload — título genérico ("Encontro de mentoria"), **sem nome do menor**, sem dados além de data/link. Attendee do jovem só quando ele conectar (fase posterior, conforme issue).
- Refresh token em repouso = credencial poderosa → criptografia, RLS, e revogação no disconnect.
- Sync reversa (watch/webhook) é fase 2 da própria issue; webhook novo = rota pública → `isPublic` + e2e de token inválido (regra do AGENTS).

### Veredito: **não cumprido**

Custo: médio-alto (spec A10 obrigatória — integração externa + schema + auth). Recomendação: é a âncora de 403/404; priorizar depois de 399.

---

## 3. REALIZA-403 — Sinais de presença (Meet API, fase 2)

### O que existe

Nada — e é **fase 2 por desenho da própria issue**.

### O que falta / bloqueios

- Meet REST API (`conferenceRecords`, `participants`, attendance): exige scopes **restritos** (`meetings.space.*`) → verificação OAuth + possível security assessment — semanas de lead time.
- Depende de 400: sem evento Meet criado pela integração, não há `conferenceRecord` confiável para consultar.
- Já existe cobertura parcial do problema real: registro semanal do mentor + semáforo detectam ausência (o que a issue chama de "presença" pode ser sinal de risco já coberto por instrumento).

### LGPD — o gate real

- Dados de presença de **menores**: base legal (legítimo interesse? consentimento?), termo/imagem atualizado, retenção de `participants`, identidade de attendees exposta ao mentor. `docs/lgpd/lacunas-e-riscos.md` já mantém lacunas abertas de base legal — adicionar este item.
- Minimização forte: presença binária ("esteve/não esteve") em vez de duração/endpoint de entrada.

### Veredito: **não cumprido** — recomendação: **adiar**. Só entrar quando 400 estiver provada em produção e a base legal estiver registrada. Decisão: Thiago + DPO/jurídico.

---

## 4. REALIZA-404 — FreeBusy para sugestão de horário

### O que existe

- Grade de disponibilidade **declarada** já vive no cadastro: `disponibilidade Json` em `profiles` e `mentorados` (`database.types.ts:3564`, `:6039`), usada no onboarding — cobre a metade "rotina do jovem" sem OAuth nenhum.
- Nenhuma chamada `freebusy.query`, nenhum scope `calendar.freebusy`.

### O que falta

- FreeBusy exige o OAuth de 400 (scope `calendar.events` ou `calendar.freebusy` — mais leve) **dos dois lados** (mentor e jovem) para ser autoritativo — hoje o jovem nem conecta conta.
- Regras de produto ausentes: janelas de trabalho, fuso (tudo `America/Sao_Paulo` no app), sugestão autoritativa vs. consultiva.

### Veredito: **não cumprido**

Recomendação: **entregar primeiro a sugestão por grade declarada** (barato, sem credencial, cobre ~80% do valor — a rotina do menor é estável) e tratar FreeBusy real como fase 2 de 400. Decisão de produto: qual nível de precisão a sugestão precisa ter.

---

## 5. REALIZA-401 — Lembretes nativos (push PWA + e-mail)

### O que existe (bastante — o "quando" já está resolvido)

- **Régua única de lembrete:** `src/lib/acao-lembrete.ts` + `casoLembrete` decide quando uma dupla deve ser lembrada (registro pendente, sem encontro etc.), testada em `tests/whatsapp-lembretes.test.ts`.
- **Lembretes in-app:** `registro_lembretes` ledger + notificação ao mentor (`0094_lembrete.sql`, idempotente por `(encontro_id, marco)`); lembretes de trilha 15d/7d/vencida (`0108_trilha_lembretes.sql`); `enviar_lembrete` RPC com cap 48h (`0094:34`, refinado `0125:526`).
- **Jobs diários:** `/api/jobs/tick` (`vercel.json`, `0 6 * * *`) roda `saude_snapshots`, `lembretes_trilha`, `lembretes_registro`, `digest_semanal`, `retencao_produto`.
- **E-mail Resend pronto:** `src/lib/email.ts` + `actions-email.ts` — comunicados, materiais, instrumentos, desfechos, digest semanal da coord, chamado urgente. Enviar lembrete de encontro por e-mail é reaproveitamento, não infra nova.
- **PWA manifest + ícones:** `src/app/manifest.ts`, `public/icons/`.

### O que falta

- **Push de verdade:** nenhum service worker, `pushManager`, `Notification.requestPermission`, tabela `push_subscriptions`, nem envs `VAPID_*`.
- **Gatilho T-24h/T-2h de encontro:** os jobs são diários e lembram débito (registro/trilha), não o encontro de amanhã.
- **Preferências/opt-in por canal e tipo.**

### Credenciais / envs

- E-mail: **nenhuma nova** (`RESEND_API_KEY`, `EMAIL_FROM` já existem).
- Web push: par `VAPID` (pública `NEXT_PUBLIC_*` + privada server-only), lib `web-push` ou implementação própria.

### LGPD / segurança

- Push token = identificador pessoal → retenção, revogação, e payload minimizado (sem dados do encontro no corpo — só "Você tem encontro amanhã").
- iOS: push só em PWA instalado — limitação de produto a comunicar.
- Menores recebem push → conteúdo neutro, quiet hours.

### Veredito: **parcial**

Caminho recomendado: (1) e-mail T-24h via Resend + `jobs/tick` — barato, zero credencial nova; (2) web push depois com spec própria. Decisão de produto: opt-in no onboarding vs. opt-in lazy.

---

## 6. REALIZA-402 — WhatsApp Cloud API

### O que existe (canal manual, bem construído)

- Catálogo de mensagens por contexto (`apoio`, `limbo`, `registro_pendente`, `sem_encontro`, `combinado`, `atencao`): `src/lib/whatsapp-msgs.ts`, com voz distinta staff/mentor.
- Botões `wa.me` com texto pronto: `whatsapp-rapido.tsx`, `nudge-button.tsx`, `dupla-wa-acao.tsx`.
- **`/api/nudge` loga e redireciona:** valida `wa.me` estrito (`route.ts:21-32`), grava `interacoes` (`canal: 'whatsapp'`, `:118-123`), dedup 60s, cap 48h via `enviar_lembrete`, telemetria `lembrete_whatsapp`.
- Débito conhecido em `BACKLOG.md`: links `wa.me` diretos na página da dupla **bypassam `/api/nudge` e não logam**.

### O que falta — todo o transporte Cloud API

- Nenhuma env `WHATSAPP_*`, nenhum webhook, nenhuma chamada à Graph API.
- Pré-requisitos fora de código: Meta Business da ONG, número verificado, system user + token de longa duração, **templates aprovados** (janela de 24h de conversa exige template fora dela).
- Webhook público novo → `isPublic` + e2e de token inválido + verificação de assinatura Meta.
- Operacional: custo por conversa, opt-out (`STOP`), quiet hours, idempotência de envio, "não fingir ser pessoa" (a issue mesma marca).

### LGPD — pesado

- Mensagens para **menores** via terceiro internacional (Meta): base legal + consentimento no cadastro + Meta como subprocessador (hoje `docs/lgpd/base-legal.md:51` registra: subprocessadores **sem DPA formal** — item já aberto).
- Conteúdo minimizado no template; número do jovem é o identificador — política de opt-out real.

### Veredito: **não cumprido**

Custo: alto (setup Meta + webhook + templates + spec). Recomendação: antes de Cloud API, fechar o débito barato — fazer todos os `wa.me` passarem por `/api/nudge` (log consistente hoje). Cloud API só se a ré­gua de lembretes justificar envio automatizado. Decisão: produto + infra.

---

## 7. REALIZA-292 — MCP Auth (PAT no /perfil + OAuth flow)

### O que existe (PAT — completo e mais seguro que o pedido)

- `ia_mcp_tokens`: `rlz_mcp_` + 24 bytes aleatórios, **sha256-only** em repouso, exibido uma vez, `rotulo`, `expira_em` (~90d), `revogado_em`, `ultimo_uso_em` — `src/lib/ia/mcp-token.ts`.
- Emissão self-service: `/perfil` staff (`perfil-form.tsx`, `src/components/tokens-mcp.tsx`) + bolha de config da coord (`assistente-config.tsx`); **seção do mentorado removida por decisão** (E2E cobre a ausência — `tests/e2e/app/tokens-mcp.spec.ts`).
- `/api/mcp` público no proxy com Bearer próprio (`middleware.ts:80-84`), service role **só para resolver o PAT**; execução via `clientImpersonado` — JWT real do dono, **RLS decide**, falha fechada (`src/lib/ia/impersonar.ts`, `src/app/api/mcp/route.ts`).
- Rate-limit compartilhado com chat (20/min/profile), escritas sob `pendente_confirmacao`, allowlist por papel nas tools.
- Divergência documentada do plano: o plano original dizia "MCP coord-only na fase 1"; o código explicita "todos os papéis conectam via MCP" com allowlist fina por tool (`route.ts`, `mcp-papeis.ts`). **Decisão intencional a confirmar** — ver §9.

### O que falta

- **OAuth flow alternativo** (device flow/PKCE para clients que suportam): nada — Supabase `oauth_server` está `enabled = false` (`config.toml:395-399`), nenhum endpoint de authorize/token no app.
- (A issue original propunha `ia_tokens`/`actions-ia.ts`; o real é `ia_mcp_tokens` + `mcp-token.ts` — mesma substância, nomes diferentes.)

### LGPD / segurança

- PAT = credencial de longa vida que executa **sob a identidade do dono** — tratamento correto: hash-only, expiração, revogação, último-uso, e e2e de token inválido. Falta documentar resposta a vazamento (revogação em massa) e orientação ao usuário na UI.
- Scrub de `rlz_mcp_` em telemetria: `sentry-scrub.ts` cobre paths/query de bearer — o header Authorization não vai para eventos por padrão; revisar se algum log ecoa o token.

### Veredito: **quase cumprido**

PAT: cumprido. OAuth: não implementado — **decisão de produto**: Claude Desktop e similares aceitam token no config; OAuth só faz falta se o público-alvo usar clients sem campo de token (ChatGPT connectors). Recomendação: confirmar se OAuth segue no escopo ou vira issue nova backlog.

---

## 8. REALIZA-179 — Camada de IA (chatbot + MCP server + RAG)

### O que existe — o plano `docs/planos/ia-chatbot-mcp.md` foi executado além do escopo

| Peça do plano | Estado | Evidência |
|---|---|---|
| Registry tipado de tools (modelo nunca gera SQL) | ✅ ~40 tools, zod + `roles` + `escreve` | `src/lib/ia/tools.ts` (2.5k linhas) |
| Execução sob RLS/JWT do usuário nos dois canais | ✅ sessão no chat; JWT impersonado no MCP, fail-closed | `chat/route.ts`, `impersonar.ts` |
| Audit log `ia_eventos` (metadata, não transcript) | ✅ + telemetria tokens/custo/tier/request_id | `0083`, `0159`, `0160`, `metricas.ts` |
| RAG corpus conhecimento (sem PII) | ✅ `ia_chunks` pgvector + FTS fallback + audiência por papel | `0150`, `0161`, `0162`, `0165`, `0168`; `guias.ts`, `embed.ts`, `docs/rag/` |
| Busca operacional via tools (não embeddings sobre PII) | ✅ | `queries.ts`, allowlists de campos |
| Escrita com confirmação humana | ✅ `pendente_confirmacao` em **ambos** canais + endpoint determinístico | `0163`, `tools.ts`, `api/ia/confirmacao/route.ts` |
| Kill-switch de escritas | ✅ `IA_ESCRITAS` | `tools.ts:302-308` |
| Rate-limit | ✅ RPC com advisory lock, 20/60s/profile, fail-closed | `rate-limit.ts` |
| Chatbot "público" | ✅ **todos os papéis autenticados**, atrás de `IA_BOLHA` | `assistente-bolha.tsx`, shells staff+jovem, `prompts.ts` |
| Roteador por tier | ✅ + roteamento por papel/tarefa | `roteador.ts`, `config.ts` |
| Evals | ✅ corpus live + grid modelos×reps + `/ia` dashboard | `evals.ts`, `tests/evals/casos.json`, `(app)/ia/page.tsx` |
| Dashboard de uso/custo | ✅ "Uso da Liza" | `(app)/ia/page.tsx` |

**Nota sobre "público":** o plano definia "público = cada usuário opera dentro das permissões do próprio perfil" — ou seja, autenticado e escopado, **não** um bot anônimo de internet. Isso está cumprido (e é o desenho correto, dada a RLS).

### O que falta / ressalvas

1. `IA_BOLHA` em produção — flag de rollout, decisão do Thiago (presente em `.env.local`; verificar Vercel).
2. Itens LGPD já registrados no backlog, ainda em aberto — ver §9 (matching com `form_bruto` ao provider; limpeza global de `ia_confirmacoes`; DPA/retention-zero do provider é **contratual**, não verificável em código).
3. OAuth do MCP (§7) — a issue 179 não cobria, mas o ecossistema sim.

### Veredito: **cumprido** (com as ressalvas LGPD acima, que pertencem à governança, não à completude funcional)

---

## 9. REALIZA-303 — Revisão de planos/código de IA

### Histórico verificado

- O entregável formal `docs/planos/ia-auditoria-2026.md` **nunca existiu** — porém auditorias posteriores aconteceram: OWASP-LLM → decisões D1–D8 do pacote Liza nov/2026 **implementadas** (JWT impersonado, rate-limit atômico, args minimizados `{n,hash12}`, `confirmacao_id` nunca ao modelo, tools fora do payload por papel), e `docs/planos/backlog-2026-11/_audit-findings.md` + `audit-fixes.md`.
- Verificação direta nesta auditoria dos guard-rails: confirmados em código — `tools.ts` (allowlists por papel, `escreve`, schemas estritos), `impersonar.ts` (fail-closed), `rate-limit.ts` (RPC + advisory lock), `chat/route.ts` (SSE, `confirmacao_id` sanitizado antes do modelo, nudge anti-loop, lote `ia_eventos` com `request_id`), `prompts.ts` (rotas allowlistadas, escopo por papel, `America/Sao_Paulo`).

### Achados desta auditoria (prioridade)

| # | Prioridade | Achado | Evidência | Ação proposta |
|---|---|---|---|---|
| A1 | **P1** | `matching.ts` envia `form_bruto`/campos livres de **menores** (motivação, objetivos, escolaridade, ONG) ao provider LLM + OpenAI embeddings — base legal não registrada; transferência internacional sem DPA formal | `src/lib/ia/matching.ts:63-66`, `docs/lgpd/base-legal.md:51` | Registrar base legal + DPA com os providers **ou** limitar doc a campos estruturados. Já consta no BACKLOG — promover a item com dono |
| A2 | **P1** | `ia_confirmacoes` retém args completos (mensagens ≤4000c); limpeza só oportunista por dono — falta job global de retenção | `0163`, BACKLOG (LGPD) | Job no `tick` diário ou retenção na RPC |
| A3 | **P2** | Drift plano↔código: `ia-chatbot-mcp.md` diz "MCP coord-only fase 1"; código permite os 5 papéis | `docs/planos/ia-chatbot-mcp.md`, `api/mcp/route.ts`, `mcp-papeis.ts` | Confirmar com produto e atualizar o plano (ou registrar decisão aqui: **este doc** registra o delta) |
| A4 | **P2** | Evals live dependem de `EVAL_*` envs e não rodam em CI por default | `evals.ts`, `tests/evals/casos.json` (35 casos) | Decidir se eval vira gate (workflow) ou segue manual |
| A5 | **P2** | Retention-zero/no-training do provider é premissa **contratual**, não verificável em código | `provider.ts` (comentário), `base-legal.md` | Obter DPA/termos do plano Zen Go + OpenAI embeddings e registrar em `docs/lgpd/` |
| A6 | **P3** | `guia_consulta`: prompt pede "no máximo uma vez" e o código marca `guiaChamado` — enforcement é soft | `chat/route.ts`, `tools.ts:1121` | OK — registrar como risco aceito |

Pontos fortes a manter (não regredir): allowlist de campos estruturados em `registros_da_dupla` (`tools.ts:621-649`), contato cru fora das tools (`:659-660`), `chamados_resumo` sem conteúdo de mensagem (`:1147`), `pessoas_busca` só coord/supervisor e sem contatos (`:1175-1200`), scrub de segredos no Sentry (`sentry-scrub.ts`).

### Veredito: **parcial**

A revisão aconteceu na prática (OWASP-LLM aplicado), mas o **artefato formal** pedido pela issue não existe. Caminho: este documento cobre a matriz; se quiserem o relatório dedicado + issues-filhas P0/P1 no Jira, é um follow-up de uma sessão.

---

## 10. Envs e credenciais — mapa consolidado

**Já em uso (não expor valores):** `IA_API_BASE`, `IA_API_KEY`, `IA_MODEL`, `IA_EMBED_API_KEY`, `IA_EMBED_MODEL` (`text-embedding-3-small`), `IA_EMBED_DIM` (512), `IA_ESCRITAS`, `IA_BOLHA`, `IA_EVAL_KEY`, `EVAL_EMAIL`/`EVAL_SENHA`(+`_JOVEM`), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.

| Issue | Credencial nova | Onde configurar |
|---|---|---|
| 399 | Google OAuth client (id/secret) | Dashboard Supabase `[auth.external.google]`; `supabase/config.toml` p/ dev |
| 400/404 | OAuth client próprio + refresh tokens criptografados | Envs de app + tabela nova (decisão Vault); mesmo projeto GCP de 399 |
| 403 | Scopes restritos Meet (`meetings.space.*`) | Mesmo OAuth de 400 + verificação Google |
| 401 | Par `VAPID` (pública/privada) | Envs de app + `NEXT_PUBLIC_VAPID_KEY` |
| 402 | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Meta Business + envs + rota webhook em `isPublic` |
| 292 | nenhuma | (OAuth: `oauth_server` do Supabase, hoje `enabled=false`) |

**Nunca commitar** credenciais — descrever nomes e locais, como acima.

---

## 11. Caminhos de implementação recomendados (ordem)

1. **399** — login Google: barato, destrava projeto GCP e OAuth client compartilhado.
2. **292** — decidir se OAuth MCP segue no escopo (PAT já entrega o valor).
3. **401** — lembrete por e-mail T-24h (reaproveita Resend + `tick`); push depois.
4. **400** — Calendar + Meet: âncora de 403/404; spec A10 completa.
5. **404** — sugestão por grade declarada primeiro; FreeBusy real como fase 2 de 400.
6. **402** — fechar débito `wa.me`→`/api/nudge` antes de Cloud API.
7. **403** — adiar até 400 provada + base legal registrada.
8. **179/303** — `IA_BOLHA` em prod; fechar itens A1/A2/A5 (LGPD) e o relatório formal se exigido.
