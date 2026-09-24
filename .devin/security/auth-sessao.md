# Auditoria de segurança — auth, sessão e modo demo

**Escopo:** camada de autenticação, sessão e modo demo do realiza.vc — Next.js 16
(App Router, `src/proxy.ts`) + Supabase Auth (`@supabase/ssr` 0.12.7,
`@supabase/supabase-js` 2.116.0), produção `https://realizavc.vercel.app`
(projeto `yhjzmxleotahijinjepl`).

**Método:** revisão estática de `src/` e `supabase/migrations/` + probes ao vivo
em produção com a anon key (OTP, RPCs do handoff, cookie demo forjado, rotas
públicas). Nenhuma correção foi aplicada — relatório de auditoria.

**Modelo de ameaça assumido:** o cookie `demo_role` é forjável por design; a
propriedade de segurança exigida é que requests demo nunca toquem o banco real.
O nonce do handoff é bearer por design; avalia-se o que acontece quando ele vaza.

---

## Achados

Formato: `SEVERIDADE | título | evidência | impacto | correção sugerida`

---

### ALTA | Fixação de sessão (login CSRF) na página de pouso do magic link

**Evidência:** `src/app/auth/link/link-landing.tsx:88-89` — sem `?h=` na URL a
aba chama `entrarAqui()` → `supabase.auth.setSession({access_token,
refresh_token})` com os tokens do hash. `link-landing.tsx:82-84` — se
`registrar_login_handoff` falha (ex.: `h=x` não-uuid → erro 400 da RPC), o
fallback também é `entrarAqui()`. O mesmo padrão existe no pouso legado em
`src/app/login/login-form.tsx:134-159`. O `redirect_to` do link do GoTrue é
editável pelo destinatário do e-mail: o verify valida só o prefixo contra a
allowlist, então remover `&h=` do `redirect_to` continua allowlisted.

**Exploit:** qualquer usuário cadastrado (atacante) pede o magic link da própria
conta, edita o `redirect_to` do e-mail removendo `&h=` (ou pondo `h=x`) e manda
o link para a vítima. A vítima clica → GoTrue verifica o link válido do
atacante → 302 para `/auth/link#access_token=<do atacante>` → a página executa
`setSession` → **o navegador da vítima fica logado como o atacante**, sem
nenhum aviso. A partir daí: tudo que a vítima escreve (registros semanais,
respostas de formulário, senha nova no onboarding) cai na conta do atacante —
integridade e atribuição quebradas — e a vítima vê os dados do papel do
atacante (se o atacante for coordenação, a vítima navega com visão coord-only).
Requisitos: conta cadastrada + um clique da vítima. Sem corrida, sem nonce.

**Correção sugerida:** a aba que abre o link nunca deve criar sessão local:
- `h` presente e `registrar` falhou → mostrar "link inválido" (chamar
  `falhar_login_handoff`), não `entrarAqui()`.
- `h` ausente → tratar como link morto ("peça um novo link na página onde
  pediu"): links pré-handoff já expiraram há muito (OTP do GoTrue ~1h), o
  branch só serve a links forjados.
- Se a UX de "entrar neste navegador" for indispensável, exigir gesto explícito
  (botão "Entrar neste navegador") **e** só depois de `registrar` confirmar —
  reduz a janela, não elimina; o ideal é remover.
- Aplicar o mesmo ao branch idêntico do `/login` (login-form.tsx:134-159).

---

### ALTA | Handoff: nonce bearer + RPCs anônimas — corrida de resgate, envenenamento e fixação na aba que pediu

**Evidência:** `supabase/migrations/0049_login_handoff.sql` —
`grant execute … to anon, authenticated` (linhas 53-56); `registrar` aceita
`p_access`/`p_refresh` text arbitrários sem qualquer validação (21-32);
`pegar` faz delete+return atômico — uso único (35-51). `0050` — `falhar` insere
marcador com tokens vazios (7-14); tudo `on conflict (nonce) do nothing` →
**o primeiro escritor vence sempre**.

Probes ao vivo com anon key confirmaram: primeiro `registrar` vence (segundo
retorna 204 mas não sobrescreve); `pegar` devolve e consome; `falhar` antes do
`registrar` fixa o estado de falha; uuid inválido → erro 22P02.

**Impacto — quem conhece o nonce `h` tem três jogadas:**

1. **Roubo de sessão por corrida.** O `h` viaja na URL do e-mail
   (`login-form.tsx:257`). Um atacante que leia o e-mail (caixa compartilhada,
   e-mail encaminhado "não consigo entrar" com o link intacto, proxy
   corporativo que termina TLS, scanner de links) chama `pegar_login_handoff`
   em loop apertado; a aba legítima só consulta a cada 2,5s
   (`login-form.tsx:226`). No instante em que a aba do e-mail deposita os
   tokens, o atacante os resgata primeiro → access+refresh tokens **reais** da
   vítima → sessão completa. Janela: até 10 min por nonce. O diferencial contra
   "só clicar no link": furtividade — o link do GoTrue não precisa ser queimado;
   a vítima clica, vê "E-mail confirmado" e só acha que o login falhou.
2. **DoS por envenenamento.** `registrar` com lixo (ou `falhar`) antes do clique
   legítimo → `on conflict do nothing` descarta o depósito real; a aba do
   e-mail mostra "confirmado" mesmo assim; a aba que pediu consome lixo —
   `setSession` falha e o poll continua indefinidamente sobre um nonce já
   consumido (`login-form.tsx:211-219` não sinaliza esse caso).
3. **Fixação na aba que pediu.** `registrar` com os tokens válidos **do
   atacante** → a aba da vítima faz `setSession` com eles → vítima logada como
   atacante na própria aba — mesmo impacto do achado anterior, sem editar link.

**Correções sugeridas (combinar):**
- Na aba que pediu, após `setSession` comparar `session.user.email` com o
  e-mail digitado no formulário → mismatch = `signOut` + erro "o link não
  corresponde a este e-mail". Mata a jogada 3 no client e detecta a 2.
- O `registrar` pode extrair `sub`/`email` do JWT depositado (parse local sem
  verificar assinatura — quem valida de verdade é o `setSession` contra o
  GoTrue) e a aba que resgata confere o identificador — defesa no servidor.
- Reduzir o TTL de 10 min para ~3-5 min e sinalizar no client quando o resgate
  traz tokens que o `setSession` rejeita (hoje falha silenciosa).
- Rate-limit/monitoramento das RPCs (contagem de `pegar` por nonce/IP) — a
  corrida do atacante depende de poll agressivo.
- Aceitar-só-o-primeiro-registrar já existe (`on conflict do nothing`) — é o
  comportamento certo, mas não impede o primeiro registro ser o malicioso.

---

### MÉDIA | Tokens de sessão em repouso em plaintext na tabela

**Evidência:** `login_handoffs` guarda `access_token`/`refresh_token` em text
plano (`0049:8-11`). RLS habilitada, zero policies, `revoke all` de
public/anon/authenticated (14-16) — leitura só pelas RPCs definer.

**Impacto:** sessões vivas legíveis por até 10 min por quem tem acesso ao banco
(service key, dashboard Supabase, backups, logs). Rows abandonadas agravam:
reenvio gera nonce novo (`login-form.tsx:245,260` sobrescreve `handoffRef`) e o
link do e-mail antigo, se clicado, deposita tokens reais num nonce que ninguém
mais consulta — sessão válida parada na tabela até o TTL, resgatável por quem
tiver o nonce antigo.

**Correção sugerida:** TTL menor + limpeza agendada (pg_cron) em vez de só no
`pegar`; opcionalmente cifrar as colunas (pgcrypto) com chave em env — protege
contra dump/backup. Considerar invalidar nonces anteriores do mesmo e-mail no
reenvio (coluna `email_hash` permitiria o cleanup sem vazar o e-mail).

---

### MÉDIA | `/auth/confirm` cria sessão no navegador que abre — mesmo vetor de fixação, dormente

**Evidência:** `src/app/auth/confirm/route.ts:33-48` — `exchangeCodeForSession`
(`?code=`) e `verifyOtp` (`token_hash`+`type`) gravam a sessão nos cookies do
navegador que abriu o link. Com o template atual emitindo link implícito para
`/auth/link` (`login-form.tsx:252-257`), essa rota só dispara para `token_hash`
(template `{{ .TokenHash }}`) ou `code` PKCE legado.

**Impacto:** se o template do Supabase estiver com `{{ .TokenHash }}` (ou alguém
o alterar), o atacante envia à vítima um link `token_hash` da própria conta →
vítima clica → sessão do atacante plantada server-side, mesmo mecanismo e
impacto do achado ALTA acima. PKCE (`?code=`) falha cross-browser
(code_verifier fica no browser do atacante), então o vetor prático é o
`token_hash`.

**Correção sugerida:** confirmar o template no dashboard (deve ser
`{{ .ConfirmationURL }}` puro, sem TokenHash); se `token_hash` precisar existir,
rotear via handoff também — ou exigir confirmação explícita antes de consumir.

---

### MÉDIA | Definição e troca de senha sem reautenticação

**Evidência:** `src/app/auth/definir-senha/definir-senha-form.tsx:45-48` e
`src/app/(app)/perfil/perfil-form.tsx:235-238` — `updateUser({password})` com
qualquer sessão válida; sem senha atual, sem verificação de sessão recente
(GoTrue aceita por default). A página `/auth/definir-senha` é pública no
middleware (`middleware.ts:40`) — o gate é `getSession()` no client
(definir-senha-form.tsx:29-34), o que é suficiente porque `updateUser` exige
JWT válido — mas não exige JWT **fresco**.

**Impacto:** sessão roubada (cookie legível por JS — ver achado de cookies; ou
dispositivo alheio esquecido logado) → atacante define senha → credencial
persistente que **sobrevive a `signOut` global** e à expiração da sessão
roubada. É a ponte de sessão-roubada → takeover.

**Correção sugerida:** exigir reautenticação antes de trocar/definir senha —
`signInWithPassword` com a senha atual quando existir, ou reenvio de um magic
link de confirmação e checagem de `iat` recente no JWT antes do `updateUser`.

---

### BAIXA | Cookies de sessão sem `Secure` explícito; `httpOnly:false` por design do ssr

**Evidência:** `DEFAULT_COOKIE_OPTIONS` do `@supabase/ssr` 0.12.7 =
`{path:"/", sameSite:"lax", httpOnly:false, maxAge:400d}` — sem `secure`
(`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`); nem
`server.ts` nem `middleware.ts` sobrepõem `cookieOptions`. `demo_role` idem
(`src/lib/demo/mode.ts:14-18`).

**Impacto:** sem `Secure`, o cookie iria em HTTP plano — mitigado na prática:
produção responde `Strict-Transport-Security: max-age=63072000;
includeSubDomains; preload` (verificado) e `vercel.app` consta na preload list.
`httpOnly:false` é exigência do padrão ssr (o browser client rotaciona o
refresh token via `document.cookie`) — consequência real: **qualquer XSS vira
furto de sessão** (superfície hoje baixa: sem `dangerouslySetInnerHTML`,
`eval` ou `innerHTML` em `src/`).

**Correção sugerida:** `cookieOptions: { secure: true }` nos dois
`createServerClient` e no `cookies().set` do demo — defesa em profundidade
gratuita.

---

### BAIXA | Enumeração de e-mail cadastrado via resposta do OTP

**Evidência:** `signInWithOtp` com `shouldCreateUser:false`
(`login-form.tsx:251`): e-mail cadastrado → 200 e link enviado; desconhecido →
422 `otp_disabled` ("Signups not allowed for otp" — confirmado em probe). A UI
explicita a diferença: "E-mail não cadastrado — fale com a coordenação"
(`mensagemErro`, login-form.tsx:28-30). Com `shouldCreateUser:true` (API
direta) o desconhecido recebe a exceção da allowlist (0045) — também distinto.

**Impacto:** enumeração pública de quais e-mails estão no programa → phishing
direcionado. É uma decisão de UX consciente (plataforma fechada — o usuário
precisa saber que deve falar com a coordenação), mas é bom documentar como
aceito ou repensar.

**Correção sugerida (se quiser fechar):** resposta genérica "Se o e-mail
estiver cadastrado, enviamos o link" — custa UX no caso legítimo. Alternativa:
manter a mensagem mas rate-limitar o endpoint de OTP de forma mais agressiva.

---

### BAIXA | Rate limiting depende do Supabase Auth; app só trata a UX do 429

**Evidência:** `login-form.tsx:264-267` parseia `"after N seconds"` do 429 e
mostra o painel com cooldown — tratamento correto de UX. Não há captcha nem
backoff próprio; lockout de senha e limites de OTP são config do GoTrue
(dashboard → Auth → Rate Limits). `signInWithPassword` (`login-form.tsx:287`)
também depende do limite remoto.

**Impacto:** brute force de senha e spam de OTP ficam por conta dos limites
configurados no projeto Supabase — se estiverem frouxos/default, são o único
controle.

**Correção sugerida:** confirmar no dashboard os limites de sign-in/OTP (e
habilitar proteção de senha vazada, se disponível no plano); considerar
Turnstile/captcha no pedido de link se o abuso virar realidade.

---

### BAIXA | `assinatura_por_token` devolve dados civis (PII) mesmo com link expirado/revogado

**Evidência:** `supabase/migrations/0046_dados_civis.sql:96-152` — a RPC
retorna `civis` (nome civil, RG, CPF, nascimento, endereço — o prefill do
termo) para **qualquer status** da assinatura; só a escrita é bloqueada por
status/validade em `assinar_com_token`.

**Impacto:** quem tem o token (link) lê os dados civis do alvo mesmo depois de
o link expirar ou ser revogado pela coordenação — exposição residual de PII de
menor/responsável para além da janela intencional de posse.

**Correção sugerida:** devolver `civis` apenas quando `status='pendente'` e
dentro de `token_expira_em` (a UI não precisa do prefill nos demais estados).

---

### BAIXA | `assinar_com_token` grava `p_dados` jsonb arbitrário na ficha

**Evidência:** `0046` — o sync-back faz `update profiles set dados_civis =
p_dados` / `mentorados.responsavel`/`dados_civis` com o jsonb recebido; a RPC é
executável por `anon` e não valida shape nem tamanho (o app valida via
`parseDadosCivis`, mas quem tem o token pode chamar a RPC direto com a anon
key). CHECK só exige `jsonb_typeof = 'object'`.

**Impacto:** portador do link pode poluir `dados_civis`/`responsavel` da ficha
real com objeto arbitrário (chaves extras, lixo aninhado, payload grande) —
integridade da ficha; escopo limitado à linha daquela assinatura. `p_ip`/`p_ua`
também são auto-reportados — limitação probatória da evidência, não
vulnerabilidade nova.

**Correção sugerida:** validar dentro da RPC a allowlist de campos do
DadosCivis (nome_civil, rg, cpf, data_nascimento, endereco, parentesco), tipos
string e tamanho máximo — como `formularios_limpa_respostas` já faz para forms.

---

### BAIXA | Isolação demo→real é correta hoje, mas arquiteturalmente fail-open

**Evidência:** verificado — todos os `createClient()` de leitura real são
precedidos de `demoRole()`/`demoAtivo()` (23/23 em `queries.ts`, idem nos
`queries-*.ts`; actions retornam `DEMO_MSG` antes de escrever; as 7 rotas de
API fazem demo-branch primeiro; o browser client vira stub —
`src/lib/supabase/client.ts:13-19`). Probe em produção com `demo_role` forjado:
`/` → 200 com dados mock; `/api/export?tipo=pessoas` (demo coord) → CSV do
dataset fictício; (demo mentor) → 403. **Nenhum caminho demo→real encontrado.**

**Impacto:** o risco é regressão: a proteção depende de cada action/query nova
lembrar o guard. Uma action futura sem `demoAtivo()` escreve no banco real "em
nome da demo"; uma query nova sem `demoRole()` renderiza dado real para um
cookie forjável — e o cookie nem assinatura tem.

**Correção sugerida:** tornar o servidor fail-closed — wrapper
`createAuthedClient()` que lança quando `demoAtivo()` (usado por todo código
não-público; os dois call sites públicos — `formularioPorToken`,
`assinaturaPorToken` — já são gated pelos callers) + regra de lint/teste CI que
proíba `createClient()` direto fora de allowlist.

---

### INFO | Observações menores

- **`?h=` fica no histórico da aba do e-mail** até o `router.replace` —
  `history.replaceState` remove o hash mas mantém `location.search`
  (`link-landing.tsx:50`). Pós-consumo o nonce é morto; janela pequena.
- **`emailRedirectTo` usa `location.origin`** (`login-form.tsx:257`) — correto
  em produção, mas confirmar no dashboard que a allowlist de Redirect URLs
  aceita só `https://realizavc.vercel.app/**` (+ localhost em dev): wildcard
  largo permitiria `redirect_to` adulterado entregar tokens a outra origem.
- **Sessões concorrentes ilimitadas**, sem UI de gerenciamento — e `signOut()`
  usa escopo global (default do auth-js): sair no celular desloga o desktop.
  Seguro, mas pode surpreender; documentar.
- **`demo_role` não é assinado** — forja trivial, assumido. Hoje `vercel.app`
  está na Public Suffix List → apps irmãos não escrevem cookie aqui. Se migrar
  para domínio próprio com subdomínios não-confiáveis, cookie tossing poderia
  forçar o modo demo (downgrade: vítima vê mock achando que é real).
- **`assinatura_completa_por_token` devolve a row inteira** (snapshot, IP, UA,
  hash) a quem tem o token — modelo "envelope" intencional; IP/UA são
  auto-declarados e spoofáveis — evidência fraca.
- **Cookie demo não expira sessão real em paralelo**: com `demo_role` ativo o
  middleware não chama `getClaims` → o refresh não roda; ao sair da demo, uma
  sessão antiga pode ter expirado → flash de `/login` até o browser client
  renovar. Só UX.

---

## Verificado como seguro

**Middleware / classificação de rotas**
- Matcher cobre tudo exceto assets estáticos e favicon/manifest
  (`src/proxy.ts:9`) — inclui `/api/*`: probe `GET /api/export` sem cookie →
  307 para `/login?next=…`.
- Rotas públicas corretas e mínimas (`middleware.ts:38-53`): `/login`,
  `/auth/*`, `/demo`, `/assinar/<token>`, `/api/assinar-token/<token>`, `/f/`,
  `/privacidade`. `/assinar` raiz (fluxo logado) **não** está na lista —
  correto.
- Sem sessão e fora das públicas → redirect `/login?next=<path+query>`
  (`middleware.ts:55-63`); logado em `/login` → redirect com `pathInterno`
  (65-69). Probe: `GET /` sem cookie → 307 `/login?next=%2F`.
- Next 16 usa `proxy.ts` (não `middleware.ts`) — fora do alcance do
  CVE-2025-29927 (bypass via `x-middleware-subrequest`).

**Demo → real**
- `demoRole()`/`demoAtivo()` leem só cookie e validam contra allowlist de
  papéis (`src/lib/demo/mode.ts:21-28`, `shared.ts:24`) — valor inválido
  forjado não ativa nada.
- Cobertura verificada: `queries.ts` 23/23 `createClient` precedidos de
  `demoRole()`; `queries-assinaturas/encerramento/especialista/presenca/
  supervisao` idem (5/5, 2/2, 3/3, 3/3, 4/4); todas as server actions com
  `demoAtivo()` → `DEMO_MSG` antes de escrever (43 guards em `actions.ts` +
  demais módulos); `signOut` limpa a demo (`actions.ts:2541-2548`).
- APIs com demo-branch antes de qualquer client real: `/api/export`,
  `/api/nudge`, `/api/material/[id]`, `/api/anexo/[id]`, `/api/documento/[id]`,
  `/api/assinatura/[id]`, `/api/assinar-token/[token]`.
- Browser client troca por stub local (`client.ts:13-19` →
  `demo/client-stub.ts`) — leitura resolve do dataset mock, escrita retorna
  `DEMO_MSG`; componentes cliente só importam o wrapper.
- Probe com `demo_role=coordenacao` forjado: `/` 200 com personas fictícias;
  `/api/export?tipo=pessoas` devolveu o CSV **mock** (nomes batem com
  `src/lib/demo/data.ts`), nenhum registro real; `demo_role=mentor_dpp` → 403 —
  a regra de papel se replica na demo.

**Handoff — propriedades corretas**
- Nonce UUID v4 (128 bits), gerado no client que pede
  (`login-form.tsx:245`).
- Tabela com RLS + `revoke all` de public/anon/authenticated
  (`0049:14-16`) — acesso só via RPCs security definer.
- `pegar` = delete+return atômico, uso único, expira em 10 min, limpa
  expirados no caminho (`0049:35-51`); probes confirmaram: segundo `pegar` →
  null; segundo `registrar` → 204 sem sobrescrever; `falhar` é sticky.
- Tokens viajam no `#hash` da URL (nunca em query) — não entram em logs de
  servidor/proxy; `history.replaceState` antes do primeiro await
  (`link-landing.tsx:50`).
- `falhar_login_handoff` propaga link queimado/expirado para a aba que pediu —
  sem espera infinita (`link-landing.tsx:30-39`).

**Sessão / cookies / fluxos de auth**
- `getClaims()` valida o JWT localmente no middleware e nas APIs — sem
  round-trip, sem confiar em cookie não verificado.
- `/auth/confirm` consome `token_hash` via `verifyOtp` e `code` via
  `exchangeCodeForSession`, sanitiza `next` com `pathInterno` e falha para
  `/login?erro=link-invalido` (`route.ts:9,33-53`). Probe com `token_hash`
  inválido → redirect correto.
- `pathInterno` (`src/lib/utils.ts:13`) rejeita `//host`, `/\host`, esquemas e
  tudo que não é `/x` — usado no middleware, `/auth/confirm`, `/auth/link`,
  `/login`, `/auth/definir-senha`, `/auth/confirmado`. **Sem open redirect por
  `next`.**
- `destinoFinal` só repassa âncora `#registrar-*` — `#access_token`/`#error=`
  do GoTrue não vazam para o destino (`login-form.tsx:65-70`); `#error=`
  expirado é normalizado para `?erro=link-invalido` (81-84).
- `sameSite:"lax"` em todos os cookies + server actions são POST com
  origin-check do Next → CSRF cross-site coberto.
- `signOut()` do auth-js com escopo global default → revoga todas as sessões
  no servidor; refresh token rotation + reuse detection são default do
  GoTrue.
- Definir senha exige sessão válida (gate client-side + `updateUser` exige
  JWT); mínimo 8 chars no client + `weak_password` do servidor tratado.

**Enumeração / signup**
- `shouldCreateUser:false` no pedido de link (`login-form.tsx:251`) — impede
  criação implícita e o 500 "Database error saving new user".
- Allowlist no banco (0045): trigger em `auth.users` exige `profiles.email`
  pré-existente (case-insensitive) — signup por OTP de e-mail desconhecido
  falha com mensagem pt-BR controlada; `handle_new_user` vincula `user_id` no
  primeiro login.
- Probes: desconhecido+`false` → 422 `otp_disabled`; desconhecido+`true` →
  exceção da allowlist; e-mail malformado → resposta genérica.

**Rotas públicas por token**
- `assinatura_por_token`: payload mínimo (status, template, nome, civis de
  prefill), expiração lazy (`0033`/`0046`). `assinar_com_token`: idempotente,
  impõe `pendente`+validade, registra IP/UA/hash (`0046`).
- `assinatura_completa_por_token` só devolve a row com `status='assinado'` —
  pendência nunca vaza snapshot (`0033`).
- `formulario_por_token`: só definição+estado do link; `submeter_resposta_
  formulario` valida token/usado_em/validade, sanitiza o jsonb contra o schema
  do form, first-write-wins em corrida (`0036`/`0042`). Tokens de link com 192
  bits (`randomBytes(24)` base64url); honeypot no submit.
- `/api/nudge`: destino validado por `^https://wa\.me/\d+$` — probe:
  `wa.me/1@evil.com` → 400, `wa.me/<dígitos>` → 302; sem sessão → login com
  `next` preservado; demo valida igual.
- `/api/export`: coord-only no real e na demo (probe mentor demo → 403);
  sensíveis via `demoPessoalMap`/`profiles_pessoal` (coord-only).
- `/privacidade`, `/f`, `/assinar` — páginas públicas que não servem dado real
  além do escopo do token; probes confirmaram 200 com estados internos
  tratados.

**Config**
- HSTS `max-age=63072000; includeSubDomains; preload` em produção
  (verificado); HTTP → 308 HTTPS.
- Anon key só tem grants de execute nas RPCs desenhadas para anon; tabelas com
  RLS integral via `my_role()`/`my_profile_id()`.
- Nenhum `dangerouslySetInnerHTML`, `eval` ou `innerHTML` em `src/`.
