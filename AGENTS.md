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

## Hierarquia de texto

Convenção: **classes Tailwind direto no JSX** — não existe nem deve existir componente de tipografia. Referências vivas: `src/components/page-header.tsx` (título/meta de página) e `src/components/ui/label.tsx` (label de campo).

**Escala (papel → classes):**

- **Título de página (h1):** `text-2xl font-semibold tracking-tight` (+`text-balance` no `PageHeader`). Kicker opcional acima do h1: `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`. Meta sob o h1: `mt-1.5 text-sm text-muted-foreground`.
- **Título de seção/card:** `text-base font-semibold` (ou `font-semibold` a sós, que já é `text-base`); seções maiores de página chegam a `sm:text-lg` com `tracking-tight`. Sub-seção dentro de card/ficha: `text-sm font-semibold`.
- **Rótulo de grupo (eyebrow):** `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` — padrão dominante (80+ usos); sempre caixa-alta, sempre muted.
- **Título de item/linha:** `text-sm font-medium` em linhas de lista; `text-sm font-semibold` quando o item é o dado-âncora (nome da dupla, evento); `font-semibold` a sós em títulos de card-trabalho (cards de dupla/visão). Nunca peso normal nem `text-muted-foreground`.
- **Corpo:** `text-sm` (ou o tamanho herdado do container). Texto explicativo/secundário: `text-sm text-muted-foreground`.
- **Metadado** (data, contador, origem, info de apoio): `text-xs text-muted-foreground` — par dominante (500+ usos). Micro-meta de linha densa: `text-[11px] text-muted-foreground`.
- **Label de campo:** `text-sm font-medium` (`ui/label`). Rótulo de dado em ficha (`<dt>`, "rótulo sobre valor"): `text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground`.
- **Micro/badge:** `text-[10px]`–`text-[11px]` só em badges, indicadores e micro-UI — nunca em texto corrido.

**Cor:** `text-foreground` é a camada primária (títulos, valores de dados, corpo). `text-muted-foreground` é a camada secundária — metadados, hints, labels e texto explicativo — **nunca** o valor principal de um dado. Não criar terceiro tom (`text-foreground/60` etc.) fora dos usos já estabelecidos. Papel por cor: lima = ação (um botão preenchido por tela, item ativo da nav, foco); amarelo (`--destaque`) = próximo passo, jornada, celebração — nunca alerta; status (`--danger` risco, `--warn` atenção, `--ok` feito, `--info` apoio, `--pausa`) sempre com rótulo de texto, nunca só cor; token de preenchimento nunca é cor de texto — texto de status usa o par `-text`, sobre o `-bg`.

**Espaçamento:** irmãos dentro de card: `gap-2`/`gap-3` ou `space-y-2`; título de item → metadado: `mt-0.5` (linha) / `mt-1` (bloco); linhas tabulares: `divide-y divide-border/60`; itens soltos: `space-y-2`; entre seções de página: `space-y-4`–`space-y-6`/`mt-4`+; `PageHeader` resolve `gap-x-4 gap-y-3` e `mt-1.5` título→meta.

**Truncate:** título de item não trunca. Metadado, legenda e linha única densa truncam — e quando o texto importa ele fica íntegro em `title`/`sr-only` ou na ficha de destino.

**Título de seção ≠ rótulo:** `h2` de seção é `text-base font-semibold` (ver escala). O estilo pequeno `text-[11px] uppercase tracking-[0.08em]` é só rótulo de grupo dentro de card (ou título de grupo da nav) — usá-lo como título de seção deixa a tela sem ponto de entrada (rodada out/2026 corrigiu ~40 casos).

**Piso no celular:** abaixo de `sm`, texto que informa tem no mínimo 12px (`text-xs`); 10–11px só em badge/contador puro, micro-label de gráfico/calendário e `<dt>`. Padrão quando o desktop precisa da densidade: `text-xs sm:text-[11px]`.

**Exceções legítimas (não "consertar"):** linhas/tabelas densas usam `text-[13px]` de corpo base (lista de duplas, fila de acompanhamento, relatório canvas); forms/instrumentos usam `text-[15px]`→`sm:text-base` em perguntas e inputs `text-base`→`md:*` (anti-zoom iOS); badges/chips em `text-[10px]`–`[11px]`; células de calendário/grade com micro-labels próprios; cores semânticas (`--warn`, `--ok`, semáforo, destructive) sobrescrevem a camada de cor quando sinalizam estado.

## Padrões de interface (rodada out/2026)

Contexto e decisões em `docs/planos/dores-ux-2026-10/` (README + `_convencoes-execucao.md`).

- **Uma dupla, um desenho:** toda lista de duplas de staff usa `DuplaLinha` (`src/components/dupla-linha.tsx`) — situação + apoio, nomes (não truncam), motivo em até 2 linhas, encontros n/total, nota do mentor, UMA ação contextual + ⋯ + Ver ficha. Superfície neutra; cor só na pill/quadrados. A regra Lembrar/Chamar mora em `src/lib/acao-lembrete.ts`.
- **Uma contagem de saúde:** números de situação das duplas vêm só de `saudeDoRecorte` (`src/lib/agenda-coordenacao.ts`) e aparecem só via `SaudePrograma` (`src/components/saude-programa.tsx`) — home, /duplas, /agenda e /registros mostram os mesmos números por construção. Apoio é sobreposição (pill), nunca fatia nem tira do risco. Dupla em dia é neutra.
- **Container queries em componentes reutilizados:** componente que aparece em colunas de larguras diferentes (home 2/3, /duplas inteira) responde ao container (`@container` + `@4xl:`), não à tela (`lg:`). Colunas de grade compartilhadas entre linhas têm largura fixa nas bordas — `auto` desalinha a tabela.
- **A interface não explica a si mesma:** definição de regra de negócio vai num popover "Como calculamos" ou no onboarding do papel, nunca em parágrafo fixo ("Você vê / Você não faz", "não é falha da dupla" e afins saíram).
- **Páginas longas viram abas por URL** (`?aba=`, `Link` + `role=tablist`, setas/Home/End, rolagem horizontal no mobile): ficha da dupla (agora/encontros/instrumentos/pessoas), /materiais (jornada/instrumentos/biblioteca). Deep link `#registrar-<id>` sem `aba` cai na aba certa.
- **Copy:** sem travessão em texto exibido (inclusive strings geradas em `src/lib`), sem jargão interno ("semáforo", "eixo", "janela", "estação"), "Turma 1" por extenso em texto corrido (`turmaLonga`); siglas "T1" só em pill/chip.
- **Server component + ícones:** em arquivo sem `"use client"`, importar Phosphor de `@phosphor-icons/react/dist/ssr` — a entrada padrão usa `createContext` e quebra o `next build` ("createContext is not a function") quando um server component passa a importar o componente.

## Movimento

Entrada de lista/card: `.animate-enter` + `--i` inline (stagger 0–10). **Troca de filtro, busca ou ordenação sempre anima** — re-key no container da lista remonta as linhas e re-roda a entrada (≤300ms, fade+slide); nunca um repaint seco de tabela inteira. O guard global de `prefers-reduced-motion` em `globals.css` já zera tudo — não adicionar media query por componente nem desligar a animação à mão.

## Modo demo (`/demo`)

- Público, sem login: cookie `demo_role` (middleware libera) + `demo_onboarded` (gate do wizard). `DemoBar` troca de papel / re-rever onboarding / sai.
- `src/lib/demo/`: `data.ts` (dataset evergreen — datas derivam de `new Date()`, encontro 5 = terça da semana corrente), `queries.ts` (replica o escopo RLS por papel), `client-stub.ts` (supabase-js falso pro browser; `supabase/client.ts` desvia com cookie), `mode.ts`/`actions.ts`/`shared.ts`, `pdf.ts` (PDF placeholder pras rotas de download).
- Queries reais checam `demoRole()` antes de criar o client; actions retornam `{ error: DEMO_MSG }` (onboarding funciona via cookie; `signOut` sai da demo). IDs mock são `de000000-…-<decimal>`.

## CI & e2e (automação)

- **Builds Vercel só sob pedido do Thiago** (quota free esgota). O deploy é gated por `[deploy]` na mensagem do commit — sem a tag o Ignored Build Step cancela. Dia a dia: push de branch roda só CI do GitHub (gates/schema-contract) + **e2e local** — `supabase db reset` → restart `rest`+`kong` → `pnpm seed:e2e` + `seed:demo` → `pnpm build`/`start` em `:3100` **com `NEXT_PUBLIC_*` locais exportadas ANTES do build** (são embutidas no bundle; setar só no start não vale) → `pnpm test:e2e` (148 specs ~6min, zero quota, mesma cobertura do preview). `[deploy]` e e2e-preview só quando o Thiago autorizar — inclusive no squash de `main` (mensagem sem a tag não deploya prod; deploy manual fica pro Thiago).
- **Regra de ouro: nada vai pra prod sem passar por preview.** Todo trabalho vai pra uma branch → push → Vercel sobe o preview → `e2e-preview` roda a suite completa nele (demo + app com writes no staging). Só mergeia/pusha `main` com o check do preview verde — `main` deploya produção imediatamente, não existe segundo gate depois.
- **Migration nova também obedece a ordem:** aplicar no staging (`supabase db push --db-url postgresql://postgres:<senha>@db.onkosatlcvircdrfgyzq.supabase.co:5432/postgres`) antes ou junto do push da branch — senão o e2e-preview do app real quebra. E aplicar em prod **antes** do merge (o schema-contract falha enquanto o remoto não tiver as colunas). Senha do staging: `supabase projects list` → dashboard do projeto → Database settings.
- **Antes de escrever ou aplicar SQL contra o banco, conferir o schema real.** Nunca escrever DDL de memória: checar colunas (`information_schema.columns` ou MCP `list_tables`), policies (`pg_policies`), enums (`pg_enum`) e definições de função (`pg_get_functiondef`) no ambiente alvo. E nunca redigitar SQL no MCP `apply_migration` — passar o conteúdo **verbatim** do arquivo de migration (a versão que o staging já validou).
- `.github/workflows/ci.yml` — todo push/PR: `tsc --noEmit` + `eslint src/` + `vitest` + **schema-contract** (`scripts/check-schema-contract.mjs` compara `database.types.ts` com o OpenAPI do PostgREST remoto — falha se o código declara coluna que o remoto não tem; é o guard contra "migration não aplicada"). Secrets: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (produção).
- `e2e-app.yml` — **gate do dia a dia**: push em branch ≠ `main`, PR → `main` e nightly 10:00 BRT rodam a suite inteira contra o **Supabase de staging** — o app do push builda no runner (`pnpm build`+`start` em :3000) com `NEXT_PUBLIC_*`/service do staging via secrets `E2E_*` (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`; `E2E_COORD_PASSWORD` opcional). Não depende de deploy Vercel → imune ao Ignored Build Step. O guard **falha** com `::error::` se secret falta ou a URL contém o ref de prod — `e2e-app / e2e` é **required check** do `main` (skip contaria como verde). `workflow_dispatch` com `backend=local` preserva o modo antigo: `supabase start` no runner aplica migrations + seed frescos, gate de freshness dos types e roda a suite sem nenhum secret — pra validar migration/stack local à mão.
- `e2e-preview.yml` — `deployment_status` do Vercel (state=success, env=Preview) → roda a suite inteira contra a `target_url`. Segue existindo como validação do artefato deployado (env/middleware da Vercel); o gate do push é o e2e-app. Secrets: `VERCEL_AUTOMATION_BYPASS` (mantido por segurança mesmo com SSO desligado) + `E2E_*` apontando pro staging.
- **Fila global `e2e-staging`**: `concurrency.group` repo-wide compartilhado entre e2e-app e e2e-preview — as fixtures `e2e00000-*`/`de*` do staging são globais e dois runs simultâneos se apagam (flake). `cancel-in-progress:false` sempre: run cortado deixa fixture em estado parcial. Fixtures **não** são re-seedadas por run (pisos `convergirPiso` re-criam o volátil; re-seed por push derrubava o PostgREST free tier) — staging recriado → `pnpm seed:e2e` manual com `.env.staging`.
- `e2e-nightly.yml` — cron 09:00 BRT: spec `demo` contra produção (público, sem secrets).
- Playwright: `pnpm test:e2e` / `:demo` / `:app`; `E2E_BASE_URL` aponta o alvo (default localhost). Specs `tests/e2e/demo` são seguras em qualquer ambiente (não escrevem); `tests/e2e/app` fazem login real por senha + writes — rodam no e2e-app (runner → staging), nos previews e no stack local do dispatch `backend=local`; hard-stop se `E2E_SUPABASE_URL` contiver o ref de prod.
- **Supabase staging**: projeto `realiza-staging` (ref `onkosatlcvircdrfgyzq`, org realiza.vc) — os previews do Vercel falam com ele (vars do escopo Preview apontam pra lá, incluindo `SUPABASE_SERVICE_ROLE_KEY`). Dados descartáveis: `db push --db-url` + `pnpm seed:e2e` reaplicam tudo. Nunca re-seedar prod.
- Fixtures e2e: `scripts/seed-e2e-staging.mjs` (`pnpm seed:e2e`, idempotente, IDs `e2e00000-*`) — roda contra `supabase start` local, staging remoto ou o staging real; credenciais locais em `.env.staging` (gitignored).
- **Dados demo no staging**: `scripts/seed-demo-staging.mjs` (`pnpm seed:demo`, idempotente, IDs `de000000-*`) — dataset realista (24 profiles, 16 duplas, ~94 encontros, avaliações, mural, supervisões, assinaturas, formulários). Cleanup é só do range `de*` — preserva fixtures `e2e00000-*` e dados manuais. Contas de teste (senha `realiza123`, `DEMO_PASSWORD` sobrescreve): `coord@` / `supervisora@` / `mentor@` / `especialista@` / `jovem@realiza.test`. Rode com `.env.staging` carregado; recusa se `E2E_SUPABASE_URL` apontar pra prod.
- **Convenção de piso nos specs app**: quem depende de fixture compartilhada **re-cria** o que precisa no beforeEach (padrão `convergirPiso` — PATCH-only morre em retry depois que o afterAll de outro arquivo deleta a row). Asserts pós-write usam `{ timeout: 15_000 }` — o roundtrip server action + `router.refresh()` em preview frio passa dos 5s default.
- **Previews públicos**: `ssoProtection` do projeto = `null` — URLs `.vercel.app` abrem sem SSO da Vercel (a auth do app segue valendo; signup é allowlist; Vercel manda `x-robots-tag: noindex` em previews). Todo deploy tem alias de branch: `realizavc-git-<branch>-thisux1s-projects.vercel.app`.
- **Branch `staging` + `staging.realiza.vc`**: branch permanente espelhando `main`; o domínio é atribuído a ela na Vercel (`gitBranch`) — sempre aponta pro último deploy com backend de staging. Atualizar o ambiente = merge `main → staging`. Depende do registro na Cloudflare: `A staging → 76.76.21.21` com proxy desligado (DNS only).

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
- Produção (só o Thiago): e-mail consolidado na conta Resend do Léo — transacional `noreply@realiza.vc` (`EMAIL_FROM` + `RESEND_API_KEY` em Vercel prod/preview + `.env.local`) e magic link `auth@realiza.vc` (Supabase → Auth → SMTP, `smtp.resend.com:465`). ~~Site URL~~ feito: `https://realizavc.vercel.app` + redirect `/**` na allowlist. **DNS pendente na Cloudflare**: registro `A staging → 76.76.21.21` com proxy desligado — libera `staging.realiza.vc` (branch `staging`, ver "CI & e2e").
- Observabilidade: **Sentry** org `realizavc`, projeto `realizamentoria-nextjs` (DSN público inline nos configs — não é segredo). `@sentry/nextjs` com `src/instrumentation.ts` (`onRequestError`), `src/instrumentation-client.ts`, `sentry.{server,edge}.config.ts` na raiz e `withSentryConfig` no `next.config.ts`. Browser posta via tunnel `/monitoring` (rewrite próprio — CSP não precisa de domínio Sentry e o path está excluído do matcher do `proxy.ts`). Privacidade: `dataCollection.userInfo:false` + `stackFrameVariables:false` + `src/lib/sentry-scrub.ts` (`beforeSend`/`beforeSendSpan`) redacta bearer tokens do path (`/f/`, `/t/`, `/assinar/`, `/avaliar/`, `/resumo/`), credenciais de auth em query/fragment (`#access_token`, `?h=`, `?code=`, `?token_hash=`, `?next=`, `?to=`) e ecoa o mesmo scrub em breadcrumbs/mensagens; sem Session Replay (menores). `proxy.ts` captura exceções manualmente — `onRequestError` não dispara pra erros do proxy (bug upstream vercel/next.js#85261). `environment` = `VERCEL_ENV`/`NEXT_PUBLIC_VERCEL_ENV`. Source maps: `SENTRY_AUTH_TOKEN` (org token, escopo CI) em `.env.sentry-build-plugin` local e **env var na Vercel** — sem ele o build segue mas skipa upload silencioso. `SENTRY_DEBUG=1` loga envelopes em dev (o flag é treeshaken do bundle de prod).
