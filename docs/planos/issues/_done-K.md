# _done-K — Cluster K (Mockups & demo): 137, 138

## Produzido

### `REALIZA-137/README.md` — veredito **FEITO** (não replanejar)

Evidência completa da rodada de mockups no disco:
`docs/mockups/` = 26 HTMLs em 6 telas (agenda v1–v6, jovem-especialistas
v1–v6, duplas v1–v5, materiais v1–v4, chamados v1–v4, instrumentos v1) +
50 PNGs desktop/mobile + `_brief.md` + `_brief-final.md` + `RELATORIO.md`
(3 rodadas, juízes, rubrica de domínio, vencedoras). Aceite coberto:
~15 mocks ✓, duas visões da agenda por persona ✓ (`agenda/v6.html:357-358`),
aprovação do Thiago ✓ (`implementacao-telas-finais.md:6`). Downstream já
implementado (WP0b–WP9). **Ação: fechar a issue no Jira.**

### `REALIZA-138/` — Tier A completo (README + plan + sdd + design + sdr + acceptance)

**Veredito: parcialmente absorvida — resta o viewer de mockups.**

Achado-chave do recon: a decisão aberta da issue ("variantes viram modos
reais × switcher só na avaliação") já foi respondida pela implementação —
as vencedoras viraram O produto (`/agenda` tem modos reais
`?aba=minha|por-mentorado|calendario` etc.), e o plano
`implementacao-telas-finais.md` WP9 já prescrevia o mecanismo nunca criado
(registry `src/lib/demo/mockups.ts`, assets públicos, `/demo/mockups` com
iframe, "Layouts em teste").

Plano resultante (**Opção A**, ~P, um PR):
- `git mv` dos 26 HTMLs `docs/mockups/*/` → `public/mockups/*/`
  (~1,6 MB; PNGs/briefs/RELATORIO ficam em `docs/` como evidência).
- `src/lib/demo/mockups.ts` — registry puro (6 telas × variantes, status
  final/vencedora/descartada, paths de produto p/ deep-link contextual).
- Cookie `demo_view` (`tela:versao` delimitado) — escrito no client pelo
  picker, lido no server pelo viewer; limpo no `limparDemo`/`limparCookiesDemo`.
- Rotas novas `/demo/mockups` (índice) e `/demo/mockups/[tela]?v=` (viewer:
  chrome ink + pills + `<iframe sandbox="allow-scripts">` — sem
  `allow-same-origin`).
- `DemoBar` ganha seção "Alterar view" contextual (`usePathname` →
  `mockupTelaDoPath`): em `/agenda` mostra chips v1…v6 direto no popover.
- `next.config.ts`: regra `/mockups/:path*` **após** a global — CSP
  sandboxada (`default-src 'none'`, `frame-ancestors 'self'`,
  `script-src 'unsafe-inline'` pras 2 pranchetas com script inline) +
  `X-Frame-Options: SAMEORIGIN`. Confirmado na doc do Next 16 que a
  última definição da mesma chave vence.
- Testes: `tests/demo-mockups.test.ts` (Vitest — registry×disco, parse,
  fallbacks) + `tests/e2e/demo/mockups.spec.ts` (público/leitura-only —
  roda em qualquer ambiente, nightly incluso).

**BLOCKER registrado no README:** o plano assume a Opção A. Se o Thiago
quiser modos **reais** paralelos (Opção B), a issue vira épico — pergunta
exata documentada.

## Verificações feitas no código

- `src/components/demo-bar.tsx` — popover "Ver como" por papel existe;
  nenhum switcher de variante.
- `src/lib/demo/{shared,mode,actions}.ts` — padrão de cookies demo
  (`demo_role`, `demo_onboarded_*`, `demo_lidas`) que `demo_view` segue.
- `src/app/(app)/agenda/page.tsx:194-362` — modos reais já implementados
  (WP3/WP5): a agenda já "troca de view" por abas.
- `src/lib/supabase/middleware.ts:55` — `/demo/*` já é prefixo público.
- `next.config.ts:4-31` — CSP global `frame-ancestors 'none'` +
  `X-Frame-Options: DENY` em `/:path*` → exceção escopada obrigatória
  (doc oficial `next/dist/docs/.../headers.md`: última chave vence).
- `docs/mockups/` — 26 HTMLs, só `duplas/v4` e `instrumentos/v1` usam
  `<script>` inline; único externo = Google Fonts.
- `public/` existe e só tem `demo/avatars`, `email`, `icons`, logo, og —
  `public/mockups/` é path novo sem colisão.

## Não produzido (fora de escopo)

- Nenhuma alteração em código do app — cluster só planeja.
- Modos reais paralelos (Opção B) — rejeitada/registrada, não planejada.
