# REALIZA-138 — SDR: superfície pública de mockups + cookie demo_view

## Inventário de exposição

| Superfície | Tipo | Dados |
|---|---|---|
| `GET /mockups/<tela>/vN.html` | asset público estático | HTML de prancheta — **só dados fictícios** (dataset canônico, `_brief-final.md` §2) |
| `GET /demo/mockups[/<tela>]` | página pública (prefixo `/demo/` já é público no proxy) | registry estático — nomes de telas/variantes |
| Cookie `demo_view` | preferência client, não-HttpOnly | mapa `tela:versao` — nenhum dado pessoal |

**LGPD:** nenhum dado pessoal novo é coletado, exibido ou persistido. Os
mocks usam pessoas fictícias (Ana Souza, Caio Martins — `_brief-final.md`);
o cookie guarda preferência de layout anônima — mesma categoria dos
cookies `demo_role`/`demo_lidas` existentes. **Nada a adicionar à
`/privacidade`.**

## Ameaças e mitigação

| Ameaça | Mitigação |
|---|---|
| **Clickjacking reverso** — site externo embeda `/demo/mockups` | Inalterado: a página continua sob `frame-ancestors 'none'` + `X-Frame-Options: DENY` da regra global (a exceção é só em `/mockups/*`, não em `/demo/*`) |
| **XSS no conteúdo do mockup** (inline script/script injetado) | Conteúdo commitado e revisado no repo (mesma confiança do código); + iframe `sandbox="allow-scripts"` **sem** `allow-same-origin` → origem opaca, **não lê cookies/storage da origem-mãe** e não pode top-navigar |
| **Exfiltração/rede a partir do frame** | `CSP_MOCKUP` = `default-src 'none'`: só permite `script-src 'unsafe-inline'` (o próprio arquivo — nenhum `<script src>` externo carrega), `style-src 'unsafe-inline' fonts.googleapis.com`, `font-src fonts.gstatic.com`, `img-src 'self' data:`. Sem `connect-src` → fetch/XHR/WebSocket bloqueados por política |
| **Nosso app ser embedado por origem maliciosa** | `frame-ancestors 'self'` na CSP dos assets: só páginas da mesma origem os embutem |
| **Enfraquecimento da CSP global** | Override por chave (`headers.md`: última regra vence por chave, não por bloco) — `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS seguem herdados em `/mockups/*`; nada muda no resto do app |
| **Cookie `demo_view` envenenado** | Valor é validado contra o registry (`varianteDaTela` ignora slug/versão fora do vocabulário); pior caso = preferência inválida descartada → fallback na decidida. Sem trust em conteúdo do cookie |
| **Indexação** | `metadata.robots noindex` (mesma régua de `/demo`) + a Vercel já manda `x-robots-tag: noindex` em previews |
| **Cache errado** | Assets em `public/` são imutáveis por nome (`vN.html`) — cache CDN seguro; se um mockup for atualizado, novo deploy versiona (conteúdo muda em release, não no mesmo nome — caso necessário, `?v=` busta) |

## Por que NÃO precisa de mais nada

- **Sem rate limit:** assets estáticos na borda — o custo de abuso é o
  mesmo de qualquer arquivo público (`/logo-realiza.png`); não há
  computação por request.
- **Sem auth/escopo:** a decisão é deliberada — a página é material de
  avaliação interno divulgável (dados fictícios); restringir exigiria
  auth que a própria `/demo` não tem. Não vaza schema, query ou dado real.
- **Sem auditoria/log:** nenhum write, nenhum PII — nada a auditar além
  do Sentry padrão (erros de página).
- **Sem RLS/RPC:** nenhuma query ao Supabase — nem leitura.
- **Camada Sentry scrub:** páginas novas entram no pipeline existente;
  o iframe não roda SDK nosso — nenhum evento novo a sanear.

## Verificação (vira teste — ver acceptance.md)

- `GET /mockups/agenda/v6.html` → `Content-Security-Policy` contém
  `frame-ancestors 'self'` e `default-src 'none'`; `X-Frame-Options:
  SAMEORIGIN`.
- `GET /demo/mockups/agenda` → resposta tem `frame-ancestors 'none'`
  (CSP global intacta).
- `GET /duplas` (ou qualquer rota real) → CSP global inalterada.
- Iframe renderiza com `sandbox="allow-scripts"` e sem
  `allow-same-origin` (assert de atributo no e2e).
