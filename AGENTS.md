<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Regras do projeto (Thiago)

- **SLC, não MVP.** Uma vertical slice completa e polida. Nada de placeholder, stub, template genérico ou "depois a gente melhora". Cada tela sai pronta.
- **Sem gambiarras.** Não contornar infra quebrada com workarounds. Se uma integração não está pronta, faz o passo a passo correto — não inventa caminho alternativo.
- **Integrações reais quando forem necessárias.** Resend, Supabase, Vercel, WhatsApp Cloud API: quando entrar, entra de verdade — config, keys, fluxo completo.
- **Supabase:** usar `supabase start` oficial do CLI. Docker local quebrado (iptables) → pedir `sudo systemctl restart docker` ao Thiago; não montar stack manual.
- **Copy em pt-BR** em toda interface.
- Fonte da verdade do domínio: os guias do programa (PDFs). A dupla agenda os encontros; a coordenação monitora e faz nudge — não agenda por ela.

# Estado do projeto (set/2026)

Plataforma operacional do Programa de Mentoria — vertical slice funcionando contra o **Supabase remoto** (project ref `yhjzmxleotahijinjepl`, MCP `supabase` em `.devin/mcp_config.json`). `.env.local` aponta pra nuvem; o `supabase start` local não está em uso no dia a dia. Banco com dados reais — **não re-seedar dados demo** (o `seed.sql` agora só tem domínio: `ciclo_eventos` + `materiais`).

## Stack & verificação

- Next.js 16 (App Router) + React 19, Tailwind v4, Base UI (`src/components/ui`), Phosphor Icons.
- `pnpm dev` · antes de dar por pronto: `npx tsc --noEmit` e `npx eslint src/` — ambos saem limpos.

## Arquitetura

- `src/lib/queries.ts` — leituras server-side com `React.cache` + `auth.getClaims()` (valida JWT local, sem round-trip).
- `src/lib/actions.ts` — server actions; retornam `{ error }` ou `{ ok }`, nunca lançam.
- `src/lib/ciclo.ts` — domínio puro: semáforo (`saudadeDaDupla`), labels/opções dos enums, datas, `waLink`.
- `src/lib/supabase/{server,client,middleware}.ts` — um client por contexto; middleware protege tudo exceto `/login` e `/auth/*`.

## Domínio

- `ciclo_eventos` = calendário oficial do ciclo (16 encontros, terças). O semáforo compara encontros esperados (datas já passadas) vs. realizados.
- `encontros` são agendados pela dupla (`unique(dupla_id, numero)`); `registros` = follow-up pós-encontro com os campos do form semanal de mentores (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`) + tema/instrumento do guia.
- Semáforo: pedido de apoio, avaliação baixa **+** dificuldade, ou ≥2 encontros atrasados → `risco`; 1 atraso, avaliação baixa, dificuldade identificada, registro pendente ou encaminhamento vencido → `atencao`.
- RLS inteiro via `my_role()` / `my_profile_id()`; mentor escreve só na própria dupla, supervisor lê as supervisionadas, coordenação tudo.
- Auth: magic link **implícito** + **handoff** — `createOtpClient` (supabase-js solto, `flowType: "implicit"`, sem persist) manda o link sem PKCE porque o client ssr força pkce e o verifier morria no browser que pediu. O link pousa em **`/auth/link`** (client page dedicada — não `/login`: lá o middleware desvia usuário já logado antes da página rodar e o `#access_token` morria no redirect, quebrando o handoff quando o browser do e-mail tinha sessão). O pedido gera um nonce (`?h=`); a aba que abre o link publica os tokens em `login_handoffs` (RPC `registrar_login_handoff`, 0049) e cai em `/auth/confirmado`; a aba que pediu resgata via poll `pegar_login_handoff` (uso único, TTL 10min) → `setSession` → entra (primeiro acesso → `/auth/definir-senha`, dispensável via `user_metadata.senha_dispensada`). Sem nonce (links antigos) a aba do link entra direto; se a RPC falhar, idem (fallback). Link queimado/expirado (`#error=`): a aba do e-mail chama `falhar_login_handoff` (0050) e mostra card sem botão (pedir link ali abriria login no dispositivo errado); a aba que pediu recebe `{failed:true}` no poll e cai no mesmo card de erro — com botão, porque é o mesmo navegador. RPCs do postgrest são lazy: `void supabase.rpc(...)` não envia nada, precisa de `.then()`. `/login` ainda resolve `#access_token` solto pra links antigos/fallback do Site URL; `/auth/confirm` só atende `token_hash` e links pkce antigos — entra direto também. Profiles pré-cadastrados pela coordenação e o trigger `handle_new_user` vincula `user_id` no 1º login (sem papel → tela "cadastro recebido"). Login por senha existe só pra teste.

## Modo demo (`/demo`)

- Público, sem login: cookie `demo_role` (middleware libera) + `demo_onboarded` (gate do wizard). `DemoBar` troca de papel / re-rever onboarding / sai.
- `src/lib/demo/`: `data.ts` (dataset evergreen — datas derivam de `new Date()`, encontro 5 = terça da semana corrente), `queries.ts` (replica o escopo RLS por papel), `client-stub.ts` (supabase-js falso pro browser; `supabase/client.ts` desvia com cookie), `mode.ts`/`actions.ts`/`shared.ts`, `pdf.ts` (PDF placeholder pras rotas de download).
- Queries reais checam `demoRole()` antes de criar o client; actions retornam `{ error: DEMO_MSG }` (onboarding funciona via cookie; `signOut` sai da demo). IDs mock são `de000000-…-<decimal>`.

## CI & e2e (automação)

- **Regra de ouro: nada vai pra prod sem passar por preview.** Todo trabalho vai pra uma branch → push → Vercel sobe o preview → `e2e-preview` roda a suite completa nele (demo + app com writes no staging). Só mergeia/pusha `main` com o check do preview verde — `main` deploya produção imediatamente, não existe segundo gate depois.
- **Migration nova também obedece a ordem:** aplicar no staging (`supabase db push --db-url postgresql://postgres:<senha>@db.onkosatlcvircdrfgyzq.supabase.co:5432/postgres`) antes ou junto do push da branch — senão o e2e-preview do app real quebra. E aplicar em prod **antes** do merge (o schema-contract falha enquanto o remoto não tiver as colunas). Senha do staging: `supabase projects list` → dashboard do projeto → Database settings.
- `.github/workflows/ci.yml` — todo push/PR: `tsc --noEmit` + `eslint src/` + `vitest` + **schema-contract** (`scripts/check-schema-contract.mjs` compara `database.types.ts` com o OpenAPI do PostgREST remoto — falha se o código declara coluna que o remoto não tem; é o guard contra "migration não aplicada"). Secrets: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (produção).
- `e2e-app.yml` — push/PR: `supabase start` no runner (Docker funciona lá) aplica todas as migrations + seed, `pnpm build`+`start` contra o stack local, fixtures via `scripts/seed-e2e-staging.mjs` e Playwright roda demo+app com backend real — sem nenhum secret externo.
- `e2e-preview.yml` — `deployment_status` do Vercel (state=success, env=Preview) → re-seeda fixtures no staging e roda a suite inteira contra a `target_url`. Secrets: `VERCEL_AUTOMATION_BYPASS` (previews têm SSO) + `E2E_*` apontando pro staging. Pula com notice se o bypass faltar.
- `e2e-nightly.yml` — cron 09:00 BRT: spec `demo` contra produção (público, sem secrets).
- Playwright: `pnpm test:e2e` / `:demo` / `:app`; `E2E_BASE_URL` aponta o alvo (default localhost). Specs `tests/e2e/demo` são seguras em qualquer ambiente (não escrevem); `tests/e2e/app` fazem login real por senha + writes — rodam no stack local do CI e nos previews; hard-stop se `E2E_SUPABASE_URL` contiver o ref de prod.
- **Supabase staging**: projeto `realiza-staging` (ref `onkosatlcvircdrfgyzq`, org realiza.vc) — os previews do Vercel falam com ele (vars do escopo Preview apontam pra lá, incluindo `SUPABASE_SERVICE_ROLE_KEY`). Dados descartáveis: `db push --db-url` + `pnpm seed:e2e` reaplicam tudo. Nunca re-seedar prod.
- Fixtures e2e: `scripts/seed-e2e-staging.mjs` (`pnpm seed:e2e`, idempotente, IDs `e2e00000-*`) — roda contra `supabase start` local, staging remoto ou o staging real; credenciais locais em `.env.staging` (gitignored).

## Pendências conhecidas

Backlog completo e priorizado em **`BACKLOG.md`**. Resumo do que mais dói:

- Trilha `mentor_especialista` completa (`0027`+`0037`): `duplas.trilha`, 5 passos em `especialista_eventos`, solicitação → mural → aceite atômico, prazo de 3 meses com badge (`TrilhaPrazoBadge`), encerramento antecipado (`encerrar_trilha_especialista`) e `devolutiva_pdm` chegando ao mentor DPP.
- Forms engine nativa (`0036`+`0042`): coord cria formulários (`/formularios`, builder com 8 tipos de campo), gera links individuais por token e o público responde sem login em `/f/[token]` — é o canal do mentorado (avaliação de sessão, 360, anamnese). Forms oficiais do sistema (Anamnese Social, Avaliação 360º, Autoavaliação) são imutáveis (`sistema=true`); resposta 360º auto-marca o checklist do encerramento.
- Encerramento do ciclo (`0037`): `encerramentos` com checklist do rito, autoavaliação do mentor via RPC, status `concluida` × `encerrada`, resumo da jornada print-friendly na ficha da dupla.
- Campos de matching (`0034`+`0038`): ficha rica em profiles/mentorados (sensíveis coord-only via `*_pessoal`), grade `disponibilidade` dos dois lados, `AfinidadePar` no board de matching e no NovaDuplaDialog; aviso `&lt;18` → autorização do responsável.
- Assinatura eletrônica (`0033`+`0046`): termos versionados, CPF com DV, IP/UA + hash SHA-256, PDF com página de evidências, `/assinar` logado e `/assinar/[token]` público pro responsável (link único por documento, reemitível; botão WhatsApp na ficha). `termo_ok` deriva da assinatura; dados civis (RG/CPF/endereço) moram em `profiles/mentorados.dados_civis` jsonb coord-only, preenchem o form e sincronizam de volta ao assinar. Status "assinou vs. não" vira badge em `/pessoas`; backup CSV em `/api/export?tipo=assinaturas`. Templates: `termo-voluntario` (verbatim do docx oficial), `termo-mentorando`, `autorizacao-responsavel`. Pendente: termo da equipe executiva (BACKLOG) e a imagem da contra-assinatura do presidente (`documentos/sistema/contra-assinatura.png`).
- Presenças de formação (`0040`): `presencas` por evento×profile; coord faz a chamada na agenda; `mentor_profiles.formacao_ok` deriva das presenças (bypass transaction-local do guard).
- Supervisão (`0041`): `supervisoes` (supervisor×mentor, `dupla_id` opcional) — supervisor registra, mentor vê a sessão sobre ele (transparência), coord modera; notificação `supervisao_registrada`.
- Guards novos: `0043` encontro `realizado` é imutável (status); `0044` `duplas.pdm_url` via RPC escopada; `0045` allowlist de signup — **só entra quem está pré-cadastrado em `profiles`** (magic link de e-mail novo falha; coord pré-cadastra); `0047` DELETE em `encontros`/`registros` é coord-only (o write `for all` cobria delete do mentor e derrubava registro em cascata).
- Materiais com upload real (`0010`): `materiais.path` + bucket privado `materiais` + policies de storage espelhando audiência; `/api/material/[id]` → signed URL 300s. Documentos oficiais chegam ao longo do ciclo — material sem `path` nem `url` renderiza "em breve" (estado legítimo). Anexos de evidência por registro seguem separados (`registro_anexos` + bucket `registro-anexos`).
- Qualidade: `pnpm test` (Vitest, 136 testes das funções puras); `src/lib/database.types.ts` gerado do remoto — adoção gradual nos casts.
- Produção (só o Thiago): sender Resend `no-reply@realiza.vc` (domínio preso em outra conta — liberar/recriar). ~~Site URL~~ feito: `https://realizavc.vercel.app` + redirect `/**` na allowlist.
