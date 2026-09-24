# Auditoria — superfície web/client

**Data:** 2026-09-24 · **Escopo:** Next.js 16.3.5 em produção (`https://realizavc.vercel.app`), páginas públicas `/assinar/<token>` (coleta RG/CPF/endereço), `/f/<token>`, `/demo`, headers, XSS, segredos no bundle, uploads, CSRF, token-in-URL, info disclosure e dependências. Probes reais via `curl` + leitura dos 19 chunks JS servidos. Público-alvo inclui menores → peso maior pra dados civis.

Formato: `SEVERIDADE | título | evidência | impacto | correção sugerida`

---

## ALTA

| # | SEVERIDADE | Título | Evidência | Impacto | Correção sugerida |
|---|-----------|--------|-----------|---------|-------------------|
| 1 | **ALTA** | **Nenhum security header configurado** — sem CSP, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` é literalmente vazio (7 linhas, sem `headers()`). `curl -sI` em `/`, `/login`, `/demo`, `/f/<token>`, `/assinar/<token>`: só `strict-transport-security` (injetado pela Vercel) + `cache-control` + `content-type`. Nada mais. | **Clickjacking**: `/assinar/<token>` (coleta dados civis de responsável por menor) e `/f/<token>` podem ser emoldurados em domínio de phishing — o frame legítimo empresta credibilidade a um golpe, ou um overlay induz cliques/aceite. **Sem CSP**: qualquer futuro sink de XSS (hoje zero) fica sem segunda barreira. **Sem `nosniff`**: respostas podem ser sniffed como conteúdo ativo. **Sem Referrer-Policy explícita**: depende do default do browser (hoje seguro, ver "verificado como seguro"). | `headers()` no `next.config.ts` aplicando a `/:path*`: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com; connect-src 'self' https://*.supabase.co; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (ou `'self'` se a demo for emoldurada em apresentações) + `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` + `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`. `'unsafe-inline'` em script-src é exigência do hydration/RSC do Next sem nonce middleware — aceitável como primeiro passo. |

## MÉDIA

| # | SEVERIDADE | Título | Evidência | Impacto | Correção sugerida |
|---|-----------|--------|-----------|---------|-------------------|
| 2 | **MÉDIA** (ação urgente) | **Next 16.3.5 está no range da CVE-2026-94545** (RCE crítica, CVSS 9.5, via `ImageResponse`/`next/og` no runtime Node) | `node_modules/next/package.json` → `"version": "16.3.5"`. Advisory GHSA-vcvr-r3jv-pc5j / blog Vercel 22-set-2026: afeta `>=16.2.0 <16.3.6`; fix emergencial `16.3.6` publicado há 2 dias. | Exploração exige `next/og` `ImageResponse` recebendo input do atacante — **o app não usa** (`grep next/og\|ImageResponse` em `src/`: zero matches; não há `opengraph-image.*`). Hoje o vetor é inalcançável → não explorável. Risco residual: é a versão em produção com CVE crítica publicada; qualquer uso futuro de `ImageResponse` (ex.: og:image de form público) herdaria o bug silenciosamente. | `pnpm up next@16.3.6 eslint-config-next@16.3.6` + redeploy. Trivial, sem breaking change (patch release). Fazer já. |
| 3 | **MÉDIA** | **`/assinar/<token>` indexável** — `metadata` não define `robots` | `src/app/assinar/[token]/page.tsx:31-35` — `metadata = { title, description }`, sem `robots`. Comparar com `/f/[token]/page.tsx:36` que tem `robots: { index: false, follow: false }`. | Link tokenizado que vazar em lugar público (repost de WhatsApp, indexação por toolbar/extension) entra em índice de buscador → exposição do prefill de dados civis + do fluxo de assinatura do jovem. A descoberta exige o token, mas noindex é defesa barata e `/f` já provou a intenção. | `robots: { index: false, follow: false }` no metadata de `/assinar/[token]` (e revisar `/demo`, `/auth/*`). |
| 4 | **MÉDIA** | **PDF da assinatura (PII: RG/CPF/endereço/IP/UA/hash) sem `Cache-Control` na rota logada** | `src/app/api/assinatura/[id]/route.ts:94-99` — headers só `Content-Type`/`Content-Disposition`. O irmão `/api/assinar-token/[token]/route.ts:22` tem `Cache-Control: private, no-store`. | Sem header explícito, browser pode aplicar cache heurístico ao GET: a via com dados civis fica em disco no dispositivo do mentor/coord (inclusive compartilhado). Inconsistente com a rota pública, que já trata disso. | Adicionar `"Cache-Control": "private, no-store"` (e na resposta demo) — mesma linha do `assinar-token`. |

## BAIXA

| # | SEVERIDADE | Título | Evidência | Impacto | Correção sugerida |
|---|-----------|--------|-----------|---------|-------------------|
| 5 | BAIXA | **`materiais.url` renderizada em `href` sem `linkSeguro`** em 3 pontos | `src/app/(app)/materiais/page.tsx:150` (`const href = m.path ? … : m.url`), `src/components/agenda-calendario.tsx:2487`, `src/app/(app)/duplas/[id]/page.tsx:685`. Todo o resto do app passa por `linkSeguro()` (`src/lib/ciclo.ts:1124`). | `javascript:`/`data:` em `m.url` viraria XSS de 1 clique. **Mitigado**: CHECK `materiais_url_http` (migration `0023_hardening.sql:14`) exige `^https?://` no banco e `urlOk()` valida no action (`actions.ts:2165,2221`). Sobra só dado escrito fora do app (SQL direto, import futuro). Defesa em profundidade inconsistente. | Envolver os 3 pontos em `linkSeguro(m.url)` — custo zero, mesma regra do resto. |
| 6 | BAIXA | **Mutação via GET: `/api/nudge` grava `interacoes`** | `src/app/api/nudge/route.ts:19-82` — GET com cookie SameSite=Lax é enviado em navegação top-level cross-site → log forjável via `<a>`/redirect de terceiro. | Entradas falsas de "nudge/contato" no log de interações (ruído de auditoria). Sem escalada: `to` tem allowlist estrita `^https://wa\.me/\d+$` (anti-open-redirect correta, com comentário sobre userinfo) e o insert é dedupado 60s. | Aceitar como está (o efeito colateral é intencional e benigno) ou trocar o log pra POST + página de confirmação. Documentar a decisão. |
| 7 | BAIXA | **`registrar_login_handoff` anônimo aceita inserts arbitrários** | `supabase/migrations/0049_login_handoff.sql` — `grant execute … to anon, authenticated`, `on conflict do nothing`, sem rate limit nem captcha. | Qualquer um pode encher `login_handoffs` com lixo (o cleanup `delete where expires_at < now()` só roda dentro de `pegar_login_handoff` — sem reads, a tabela cresce). DoS de tabela, não de sessão (nonce uuid = credencial, tokens do atacante só valem pra quem conhece o nonce — que é o próprio atacante). | Cron/pg_cron de expurgo ou `delete` de expirados também no `registrar`; opcional: rate limit por IP na edge. |
| 8 | BAIXA | **Cookie `demo_role` sem `Secure` explícito + forjável** | `src/lib/demo/mode.ts:14-18` — `COOKIE_OPTS` tem `path/maxAge/sameSite:lax`, sem `secure`. Qualquer visitante pode setar `demo_role=coordenacao` manualmente. | Bypass do middleware proposital — **não vaza dado real**: todas as queries checam `demoRole()` primeiro (verificado: zero `queries*.ts` sem o check) e `0032` revogou todos os grants de `anon`, então mesmo uma query sem check não lê nada. Risco: confusão (usuário real entra em modo demo se cookie for plantado) — e cookie tossing é bloqueado porque `vercel.app` está na PSL. | Adicionar `secure: true` em `COOKIE_OPTS` (harmless) e aceitar o resto como design. |
| 9 | BAIXA | **Sem rate limiting no app layer nas rotas públicas por token** | `submeterRespostaFormulario` (`src/lib/forms/actions.ts:400-429`), `assinarComToken` (`src/lib/actions-assinaturas.ts:284-332`), `assinaturaPorToken`/`assinatura_completa_por_token` — cada request bate RPC no Postgres. | Enumeração de token é inviável (uuid v4 122 bits / base64url 24 bytes) e respostas são single-use + honeypot + cap 200KB — o que sobra é abuso de volume (custos de DB) e spam de assinatura *para quem já tem o token* (i.e., o legítimo). Baixa prioridade real. | Confiar no DDoS da Vercel hoje; se quiser, `x-forwarded-for` + tabela de tentativas por token na RPC. |
| 10 | BAIXA | **`x-forwarded-for` como evidência de assinatura é spoofável fora da Vercel** | `src/lib/actions-assinaturas.ts:31-38` — `ipUa()` lê `x-forwarded-for[0]`/`x-real-ip`. | Na Vercel o header é pinado pela plataforma (seguro). Em self-host/preview sem edge confiável, o signatário forjaria o próprio IP de evidência — enfraquece (não anula) a prova, pois hash + timestamp + UA continuam. | Documentar dependência de plataforma; se migrar, usar `request.ip`/header da edge. |
| 11 | BAIXA | **Rascunhos sensíveis em `localStorage`** | `src/components/registro-form.tsx:60,180-183` (autosave do follow-up do encontro — texto livre sobre menor) e `src/components/pessoa-mural.tsx:38-105` (mural da ficha). Demo desliga de propósito (`shared.ts:30-32`). | Em dispositivo compartilhado do mentor, rascunho com conteúdo sensível do jovem persiste indefinidamente além da sessão. Mitiga parcial: só o próprio mentor vê a máquina dele; rascunho é apagado no submit. | Aceitável pra UX; se quiser endurecer, `sessionStorage` ou TTL no draft. |
| 12 | BAIXA | **`http://` aceito em links do banco** | `urlOk()` (`actions.ts:1510`) e `linkSeguro()` (`ciclo.ts:1124`) aceitam `http:` e `https:`; CHECKs `0023`/`0030` idem (`^https?://`). | Link `http://` salvo (chamada, PDM, material, LinkedIn) é downgrade de TLS — conteúdo MITM-able. Impacto prático pequeno (destinos são Google Meet/Drive etc., sempre https). | Restringir a `https:` nos três pontos; ou aceitar e registrar como decisão. |
| 13 | BAIXA | **Prefill de dados civis completos ao portador do link** | `assinaturaPorToken` (`actions-assinaturas.ts:266-282`) → RPC `assinatura_por_token` devolve `civis` (RG/CPF/endereço) pra qualquer um com o token — feature 0046, explícita. | Por design: o link vai pro responsável via WhatsApp e o token é fator de posse (128 bits, expira 30d, revogável, single-use no `assinado`). Mas quem intercepta/segura o link vê PII antes mesmo de autenticar intenção. | Manter (o prefill é a feature), ou mascarar parcialmente (ex.: CPF `***.***.***-09`) — trade-off de UX. Combinar com o fix #3 (noindex). |
| 14 | INFO | **`/demo` e `/login` indexáveis; `/robots.txt`/`/sitemap.xml` inexistem** | `curl /robots.txt` → `307 /login` (middleware intercepta). `metadata` de `/demo` sem robots. | Não é vazamento — nenhuma rota interna aparece em sitemap (inexistente). Decisão de produto: a demo diz "uso interno pra alinhamento", então indexação talvez não seja desejada. | Se quiser: `robots.txt` estático com `Disallow: /demo` + `robots: noindex` nas páginas internas. |

---

## Verificado como seguro

**XSS / injeção de markup**
- Zero `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, `new Function` em `src/` — todo dado do banco sai pelo escaping do React.
- `target="_blank"`: **20/20 com `rel="noopener noreferrer"`**.
- URLs vindas do banco (`encontro.link`, `duplas.pdm_url`, `linkedin`, `materiais.url`) validadas em 3 camadas: `urlOk()`/`linkSeguro()` no app + CHECK `^https?://` no banco (0023/0030). Ressalva dos 3 pontos sem `linkSeguro` = achado #5.
- `waLink()` (`ciclo.ts:1098`) sanitiza telefone a dígitos e `encodeURIComponent` na mensagem — sem `javascript:` possível.
- `/api/nudge`: allowlist `^https://wa\.me/\d+$` com âncora de fim — o bypass `wa.me/1@evil.com` está explicitamente coberto (comentário + teste real: `to=https://evil.com` → 400, `wa.me/5511…` → 302).
- CSV export com guard de formula injection (`celula()` prefixa `'`, `export/route.ts:401-407`) — campos de texto livre do mentor não viram fórmula no Excel.

**Segredos no client**
- Bundle servido: 19 chunks baixados e grepados — único JWT presente é `NEXT_PUBLIC_SUPABASE_ANON_KEY` (payload decodificado: `"role":"anon"`). Zero `service_role`, zero chave privada.
- `.env.local` tem só `NEXT_PUBLIC_*` + `VERCEL_OIDC_TOKEN`; `.env*` inteiro no `.gitignore`; `git log -- .env.local` vazio (nunca commitado).
- `NEXT_PUBLIC_SITE_URL` existe no env mas não é usado no código (dead var, sem risco).

**Uploads / storage**
- Avatar: allowlist `image/png|jpeg|webp` + 2 MB **na server action** (`actions.ts:51-77`) e policy do bucket público `avatares` exige extensão `png|jpe?g|webp` no path + pasta = `my_profile_id()` (0024) — SVG/HTML barrado por extensão.
- `documentos`, `materiais`, `registro-anexos`: buckets **privados**, acesso só via signed URL 300s emitida por route handler autenticado; policy de INSERT exige o `name` já referenciado por `documento_path`/`materiais.path`/`registro_anexos.path` — objeto órfão/não-referenciado não entra.
- `definirDocumentoPessoa` valida path server-side (`DOCUMENTO_PATH_RE`, `actions.ts:2295`) — sem path traversal, coord-only.
- Contra-assinatura: PNG ≤1 MB, path fixo `sistema/contra-assinatura.png`, coord-only.
- Ressalva registrada: MIME vem do header `file.type` (não há magic-byte sniffing) — aceitável porque buckets privados servem com o content-type declarado em domínio separado (`*.supabase.co`), não no domínio do app.

**CSRF / mutações**
- Server actions protegidas pelo origin-check nativo do Next; a versão 16.3.5 já contém o fix da CVE-2026-27978 (`origin:null` tratado como ausente, fix em 16.1.7). Cookies de sessão Supabase são SameSite=Lax → não viajam em POST cross-site.
- Única mutação via GET = `/api/nudge` (achado #6). `/auth/confirm` cria sessão por GET — intencional (magic link).
- `/assinar` e `/f` são públicas mas o **token é a credencial** — CSRF não se aplica (não há ambient credential).

**Token-in-URL**
- HTML de `/login`, `/demo`, `/f/<token>`, `/assinar/<token>` servido e inspecionado: **zero origens externas** — fonts self-hosted via `next/font` (baixadas no build), sem analytics, sem CDN, sem imagem remota. Logo é `/logo-realiza.png` local.
- Único recurso externo do app inteiro é `gravatar.com` (avatar fallback, só no app logado) — e o Referer default `strict-origin-when-cross-origin` já envia só a origem cross-site. Token não pode vazar via Referer hoje.
- RPCs públicas (`assinatura_por_token`, `assinatura_completa_por_token`, `formulario_por_token`, `submeter_resposta_formulario`, handoffs) são `security definer` com grants a `anon` — tabelas continuam sem grant nenhum pra anon (0032). Token regex validado antes do RPC (`TOKEN_RE` nas duas páginas e nas actions).
- Respostas de erro idênticas pra token malformado vs. inexistente — sem oracle de enumeração (probe real: `/api/assinar-token/zzz` → 400 genérico; uuid válido inexistente → mesma tela "não encontrado").

**Info disclosure**
- Páginas de erro genéricas em pt-BR (`error.tsx`, `not-found.tsx`) — sem stack, sem SQL, sem `digest` exibido. `erroAmigavel()` traduz códigos PG pra copy neutra (`utils.ts:21-52`).
- `console.error` em client components loga objetos de erro — visíveis só no console do próprio usuário.
- Sourcemaps não publicados (probe: `.js.map` → 403). Sem `x-powered-by` em produção.
- `/api/*` sem auth → 307 pro login (probe real em `/api/export`, `/api/anexo/foo`); route handlers têm segunda checagem `getClaims()` + 401 — defesa em profundidade correta.
- `/api/export` é coord-only com role check server-side (demo replica a regra).

**Auth / sessão**
- Signup bloqueado por allowlist (0045) — magic link só entra quem está pré-cadastrado em `profiles`.
- `?next=` sanitizado por `pathInterno()` (`utils.ts:13`) em middleware, `/auth/confirm`, login-form, definir-senha — `//host` e `/\host` barrados (open redirect).
- Handoff de magic link (0049): nonce uuid = credencial, tokens single-use (delete on read), expiração 10 min, tabela sem grants diretos — modelo correto.
- Implicit flow `#access_token` é decisão consciente e documentada (handoff cross-browser); tokens saem da barra via `history.replaceState` antes de qualquer await.
- JWT validado localmente por `getClaims()` no middleware — sem round-trip, sem bypass de cache.
- Conta sem papel / inativa → telas bloqueadas dedicadas (sem acesso ao shell).

**Modo demo**
- Cookie `demo_role` forjável porém inócuo pra dados reais: todas as `queries*.ts` checam `demoRole()` primeiro (verificado arquivo a arquivo) e `anon` tem zero grants (0032). Ações reais retornam `DEMO_MSG`. Route handlers servem PDF placeholder, nunca storage real.
- `pnpm audit --prod`: **0 vulnerabilidades** na árvore instalada.
- Demais CVEs de 2026 avaliadas vs. 16.3.5: middleware bypass Turbopack+i18n (fix 16.2.11 — app nem usa i18n), RCE Windows (16.3.3 — prod é Linux/Vercel), SSRF server actions host-header (16.2.11 — Vercel pin o host), cache confusion UTF-8 (16.2.11), origin:null CSRF (16.1.7) — **todas já cobertas pela versão instalada**, exceto 16.3.6 (achado #2).

---

### Recomendação imediata (ordem)
1. `pnpm up next@16.3.6 eslint-config-next@16.3.6` + redeploy — fecha o range da CVE-2026-94545.
2. Bloco `headers()` no `next.config.ts` com CSP + `frame-ancestors` + `nosniff` + `Referrer-Policy` + `Permissions-Policy` — é o gap real de defesa em profundidade (especialmente em `/assinar` e `/f`).
3. `robots: noindex` em `/assinar/[token]` + `Cache-Control: private, no-store` no PDF de `/api/assinatura/[id]` — duas linhas cada.
4. Opcional: `linkSeguro()` nos 3 `materiais.url`, `secure: true` nos cookies demo, expurgo de `login_handoffs`.
