# REALIZA-138 — Critérios de aceite

Mapeados ao aceite da issue: *"Se modos reais: troca de view sem reload de
dados, persiste por cookie, dataset demo cobre as 3"* — lidos sob a Opção A
(o dataset "canônico" dos mocks É o dado único coberto; "sem reload de
dados" = nenhuma query refeita na troca).

## Funcional

| # | Dado | Quando | Então |
|---|---|---|---|
| A1 | `/demo` acessível | `GET /demo/mockups` | 200, lista as 6 telas do registry (Agenda, Duplas, Materiais, Chamados, Especialistas do jovem, Instrumentos) com contagem de variantes e badge "virou produto" nas 5 que têm `produtos` |
| A2 | tela válida | `GET /demo/mockups/agenda` | 200; iframe presente com `src="/mockups/agenda/v6.html"` (a `decidida`) e `sandbox="allow-scripts"` sem `allow-same-origin` |
| A3 | `?v=v3` na URL | `GET /demo/mockups/agenda?v=v3` | iframe com `src="/mockups/agenda/v3.html"`; pill `v3` com `aria-current` |
| A4 | `?v=` inválido (`?v=zzz`, `?v=v99`) | mesma página | cai na `decidida` (v6) — sem 404, sem erro |
| A5 | tela inválida | `GET /demo/mockups/foo` | 404 |
| A6 | clique no pill `v3` | viewer `/demo/mockups/agenda` | URL vira `?v=v3`, iframe troca o src, **nenhuma chamada ao Supabase** é feita (o conteúdo é asset estático) |
| A7 | cookie persistido | após A6, `goto /demo/mockups/agenda` (sem `?v=`) | iframe abre em `v3` — `demo_view` lido server-side |
| A8 | cookie adulterado | `demo_view=agenda:zzz` ou lixo | cai na `decidida`, sem erro |
| A9 | DemoBar na demo | entrar na demo (`entrarNaDemo`) → abrir pill | seção "Alterar view"/"Comparar layouts" visível no popover |
| A10 | DemoBar contextual | demo ativa, em `/agenda` → abrir popover | seção rotulada `Alterar view · Agenda` com chips `v1…v6`; chip `v3` tem `href="/demo/mockups/agenda?v=v3"`; texto "O produto usa a v6" |
| A11 | DemoBar fora de tela mapeada | demo ativa, em `/perfil` | row único "Comparar layouts de tela" → `/demo/mockups` |
| A12 | sair da demo | `sairDaDemo` | cookie `demo_view` removido (junto de `demo_role`/`demo_lidas`) |
| A13 | "Ver no produto" | viewer de `/demo/mockups/agenda` | link presente com `href="/agenda"`; em `/demo/mockups/instrumentos` o link **não existe** (sem produto mapeado) |
| A14 | acesso sem cookie demo | `GET /demo/mockups` deslogado | 200 — página pública funcional (decisão deliberada) |

## Headers / segurança (e2e `apiGetApp`)

| # | Assert |
|---|---|
| B1 | `GET /mockups/agenda/v6.html` → `content-security-policy` contém `default-src 'none'` **e** `frame-ancestors 'self'`; `x-frame-options: SAMEORIGIN` |
| B2 | `GET /demo/mockups/agenda` → `content-security-policy` contém `frame-ancestors 'none'` (global intacta) |
| B3 | `GET /duplas` → CSP global inalterada (`frame-ancestors 'none'`, `script-src` com `'unsafe-inline'` mas sem a regra de mockup) |
| B4 | `GET /mockups/agenda/v6.html` → `x-content-type-options: nosniff` presente (headers globais seguem herdados) |

## Vitest (`tests/demo-mockups.test.ts`)

| # | Assert |
|---|---|
| C1 | todo `variante.arquivo` do registry existe em `public/mockups/` (`fs.existsSync`) — drift registry↔disco quebra o build |
| C2 | exatamente 1 `status:"final"` por tela; `decidida` corresponde a uma variante existente |
| C3 | slugs de `MOCKUP_TELAS` únicos; `produtos` iniciam com `/` |
| C4 | `varianteDaTela`: `?v=` válido vence cookie; cookie válido usado sem `?v=`; ambos inválidos/ausentes → `decidida` |
| C5 | `parseDemoViews`/`serializeDemoViews`: round-trip preserva entradas válidas; descarta `tela`/`versao` fora do registry; `""`/lixo → `{}` |
| C6 | `mockupTelaDoPath`: `/agenda` → agenda; `/duplas/x` → duplas; `/perfil` → `null` |

## e2e (`tests/e2e/demo/mockups.spec.ts` — projeto `demo`, seguro em prod)

Specs cobrindo A1, A2, A3, A6, A7, A9, A10, A11, B1, B2. Usar
`entrarNaDemo`/`apiGetApp` de `tests/e2e/helpers.ts`. O spec é leitura-only
→ pode entrar na suite que roda em qualquer ambiente (incl. nightly demo
contra produção).

## Casos de borda

- Mockup com `<script>` inline (`duplas/v4`, `instrumentos/v1`) → conteúdo
  interativo funciona dentro do sandbox (assert: radar da instrumentos/v1
  renderiza `<svg>` no frame — `frameLocator`).
- `?v=` repetido na URL (`?v=v1&v=v3`) → primeiro valor vale (ou o último —
  definir deterministicamente: usar o primeiro match válido).
- Troca de papel na demo **não** zera `demo_view` (só `limparDemo` zera —
  decisão: preferência de layout sobrevive à troca de persona).
- Mobile 390px: trilha de pills rola horizontalmente; alvos ≥44px.

## Gates

- `npx tsc --noEmit` ✅ · `npx eslint src/` ✅ · `pnpm test` ✅
- e2e-demo verde no preview (`e2e-preview` workflow) antes do merge —
  specs são públicos, rodam também em prod pós-deploy (nightly).
- Sem migration → `schema-contract` intocado.
