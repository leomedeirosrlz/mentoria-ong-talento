# Architecture — código e domínio

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
