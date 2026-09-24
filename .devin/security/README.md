# Auditoria de segurança — consolidado (set/2026)

Quatro frentes auditaram o app com probes reais em produção. Relatórios completos:

- [`db-rls.md`](./db-rls.md) — RLS, RPCs security-definer, storage policies, triggers
- [`actions-api.md`](./actions-api.md) — server actions e route handlers
- [`auth-sessao.md`](./auth-sessao.md) — auth, handoff de magic link, sessão, modo demo
- [`web-client.md`](./web-client.md) — headers, XSS, segredos no bundle, uploads, deps

**Veredito geral:** arquitetura deliberadamente defensável — RLS integral, anon com zero
grant de tabela, RPCs como única porta pública, tokens de alta entropia, zero sinks de
XSS, segredos fora do bundle. Os achados são de endurecimento, não de falha estrutural.

## Achados por severidade (deduplicados)

### ALTA

| # | Achado | Onde | Status |
|---|--------|------|--------|
| A1 | **Fixação de sessão** — `/auth/link` e `/login` faziam `setSession` local sem `h=`; link adulterado plantava a sessão do atacante no browser da vítima | auth-sessao ALTA-1 | corrigido — aba do link nunca cria sessão; sem `h` = link morto |
| A2 | **Handoff bearer** — quem conhece o nonce podia roubar a sessão por corrida, envenenar ou depositar tokens próprios | auth-sessao ALTA-2 | mitigado — a aba que pediu agora confere `user.email` com o e-mail digitado antes de aceitar a sessão; falha de `setSession` sinaliza erro em vez de polling infinito |
| A3 | **Evidência de assinatura forjável** — `assinar_com_token`/`assinar_termo` aceitavam `p_ip`/`p_ua`/`p_hash`/`p_dados` verbatim; anon com o token podia forjar evidência e corromper `dados_civis` via sync-back | db-rls ALTA-2, actions-api MÉDIA-1 | corrigido na 0053 — hash SHA-256 computado no banco, `p_dados` validado (allowlist de chaves/tipos/formatos), `mentorado_nome` do snapshot vem do DB, UPDATE atômico com `status='pendente'` |
| A4 | **Bypass por NULL** — `revogar_assinatura`/`regenerar_token_assinatura` usavam `<> 'coordenacao'`; `my_role()` NULL (usuário desativado) pulava o raise | db-rls ALTA-3 | corrigido — `is distinct from`, auditoria do padrão em todo o schema |
| A5 | **Aceite de especialista fora do RPC** — PATCH direto `status='aceita'` sem `dupla_id`/`respondida_em` (confirmado em probe) | db-rls ALTA-1 | corrigido — flag transaction-local `realiza.sol_aceite` setada só por `aceitar_solicitacao`; mentor DPP não escreve `especialista_id`/`respondida_em` |
| A6 | **Zero security headers** — sem CSP, `frame-ancestors`, `nosniff`, Referrer-Policy | web-client ALTA-1 | corrigido — bloco `headers()` no `next.config` |

### MÉDIA

| # | Achado | Status |
|---|--------|--------|
| M1 | `assinatura_completa_por_token` devolvia `to_jsonb(a)` (token, ids internos, created_by) | corrigido — allowlist explícita |
| M2 | `assinatura_por_token` servia `civis` (RG/CPF/endereço) em qualquer status | corrigido — só `pendente` e válido |
| M3 | Next 16.3.5 no range da CVE-2026-94545 (não explorável — sem `next/og`) | corrigido — upgrade de patch |
| M4 | `/assinar/<token>` sem `noindex`; `/demo` indexável | corrigido — robots noindex |
| M5 | PDF de `/api/assinatura/[id]` sem `Cache-Control: no-store` | corrigido |
| M6 | `login_handoffs` com tokens em repouso (plaintext, TTL 10min) | parcial — cleanup também no `registrar`; aceito o modelo bearer (o nonce viaja no próprio link) |
| M7 | `/auth/confirm` criava sessão no browser que abre (fixação dormente) | corrigido — com `h` vai pro handoff; sem `h`, interstitial com gesto explícito |
| M8 | Troca/definição de senha sem reautenticação | corrigido — sessão fresca exigida no primeiro acesso; senha atual exigida na troca |

### BAIXA (corrigidos)

`registros` exigem encontro `realizado` · `encontro_id`/`dupla_id`/`numero` imutáveis
(coord pode corrigir) · `consent_lgpd_em` só aceita carimbo fresco (latch) ·
`supervisoes` exige vínculo supervisor↔mentor · `avatares` com SELECT pro dono
(fotos órfãs) + validação de mimetype · índices em colunas de RLS ·
`rls_auto_enable` revogado · cleanup de handoffs expirados no `registrar` ·
`linkSeguro()` nos 3 renders de `materiais.url` · UUID_RE → 404 em
`/api/material`/`/api/assinatura` · cookies com `Secure` · `?h=` sai do histórico
· `assinaturas-pessoa` sem `window` no render (useOrigem).

### Aceitos como risco / decisão documentada

- **IP/UA de evidência são app-reported** — o PostgREST só enxerga o servidor
  Next; impossível provar o IP do signatário sem edge signing. Na Vercel o
  `x-forwarded-for` é pinado pela plataforma. O hash no banco garante a
  consistência interna do conjunto gravado.
- **Nonce do handoff é bearer por design** — viaja no mesmo link que carrega os
  tokens; quem intercepta o link já tinha tudo. A verificação de e-mail no
  resgate fecha a fixação; a janela de corrida exige ler o e-mail da vítima.
- **Enumeração de e-mail no login** — resposta distinta pra cadastrado/
  inexistente é decisão de UX consciente (plataforma fechada); rate limit do
  GoTrue cobre abuso.
- **`/api/nudge` mutável via GET** — efeito benigno (log de contato dedupado,
  destino preso a `wa.me`); aceito.
- **Rascunhos em localStorage** (follow-up do encontro) — UX intencional;
  dispositivo do próprio mentor.
- **`http://` em links cadastrados** — CHECK do banco aceita; destinos reais são
  Meet/Drive (sempre https na prática).
- **Prefill civil ao portador do link** — é a feature; agora limitado a
  `pendente`+válido.

### Backlog de segurança (não bloqueante)

- Rate limiting próprio nas rotas públicas (hoje: Vercel DDoS + entropia dos
  tokens). Se abuso virar realidade: tabela de tentativas por token/IP ou
  Turnstile.
- pg_cron pra expurgo de `login_handoffs` (hoje limpa na leitura/escrita).
- `profiles.user_id` visível a autenticados — minimização, sem exploit.
- Caps de tamanho em textos livres (`interacoes.nota`, `profiles.bio`…).
- Cookie `demo_role` sem assinatura — inócuo (verificado: nenhum caminho toca
  dados reais); se migrar pra domínio com subdomínios não-confiáveis, repensar
  (cookie tossing).
- CSP com nonce (troca `'unsafe-inline'` de script-src) — exige middleware de
  nonce; `'unsafe-inline'` é o passo pragmático aceito.
- Verificador público de hash do documento assinado (página onde qualquer um
  recalcula o SHA-256 da via PDF/row) — fortalece a prova, backlog de produto.
