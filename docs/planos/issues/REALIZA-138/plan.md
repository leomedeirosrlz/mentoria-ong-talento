# REALIZA-138 — Plano de implementação: "Alterar view" na demo

**Escopo assumido (ver README):** Opção A — viewer de mockups na demo.
A issue pede: cookie `demo_view` + controle na `DemoBar` ("Alterar view:
Agenda 1 / 2 / 3") + cada view = organização diferente do MESMO dado. As 26
variantes em `docs/mockups/` **são** organizações diferentes do dataset
canônico único (`_brief-final.md` §2) — servi-las no produto é a forma mais
barata e mais fiel de entregar o switcher. É o que `implementacao-telas-finais.md`
WP9 já previa (`src/lib/demo/mockups.ts`, `public/demo/mockups/`, menu
"Layouts em teste") e nunca foi criado.

**Pré-requisito:** nenhum (137 entregue). Sem migration, sem schema, sem
mudança de auth. Tudo é demo.

---

## Passo 0 — mover os HTMLs pra `public/mockups/`

Os HTMLs precisam ser servidos pelo deploy (Vercel/Next). `public/` é o
caminho estático e CDN-cacheado — não envolve `fs`/serverless.

```bash
mkdir -p public/mockups
for tela in agenda chamados duplas instrumentos jovem-especialistas materiais; do
  mkdir -p "public/mockups/$tela"
  git mv "docs/mockups/$tela/"v*.html "public/mockups/$tela/" 2>/dev/null \
    || mv "docs/mockups/$tela/"v*.html "public/mockups/$tela/"
done
```

- 26 arquivos, ~1,6 MB no total (medido: `du -ch docs/mockups/*/*.html`).
- PNGs (`v*-{desktop,mobile}.png`, ~29 MB), `_brief.md`, `_brief-final.md` e
  `RELATORIO.md` **ficam** em `docs/mockups/` — são evidência da rodada
  (REALIZA-137), não assets servidos.
- Atualizar as referências de caminho em `docs/mockups/RELATORIO.md:36`
  ("Arquivos: `docs/mockups/<tela>/v{1..5}.html`" → `public/mockups/…` +
  nota de que PNGs/briefs seguem em `docs/mockups/`) e em
  `docs/planos/implementacao-telas-finais.md` (citações de `docs/mockups/…`
  → novo caminho).
- **Alternativa rejeitada:** route handler lendo `docs/` com
  `outputFileTracingIncludes` — mais moving parts (config de tracing +
  leitura por request) sem ganho; `public/` é o desenho que o WP9 descreve.
- Se os HTMLs estiverem uncommitted no remoto (nota "(não commitado)" no
  RELATORIO), o `git mv`/`mv` + commit já os versiona — checar `git status`
  antes e commitar tudo num commit só (`REALIZA-138`).

## Passo 1 — registry `src/lib/demo/mockups.ts` [NOVO]

Módulo puro (sem imports de `next/*`) — seguro no browser e no middleware:

```ts
export type MockupVariante = {
  versao: string;            // "v1"…"v6"
  arquivo: string;           // "/mockups/agenda/v1.html" (URL pública)
  rotulo: string;            // "Grade semanal" — direção da variante
  status: "final" | "vencedora" | "descartada";
};
export type MockupTela = {
  slug: string;              // "agenda" — também o subdir de /mockups/
  titulo: string;            // "Agenda"
  decidida: string;          // versão escolhida p/ implementação ("v6")
  produtos: string[];        // paths reais p/ o link contextual ("/agenda")
  resumo: string;            // 1 linha: o que a rodada decidiu
};
export const MOCKUP_TELAS: MockupTela[];
export function mockupTela(slug: string): MockupTela | null;
export function mockupTelaDoPath(pathname: string): MockupTela | null;
export function varianteDaTela(tela: MockupTela, v: string | null | undefined, cookie?: string | null): MockupVariante;
```

Conteúdo (do `RELATORIO.md` + `_brief-final.md`):

| slug | titulo | decidida | produtos | variantes (versão → rótulo → status) |
|---|---|---|---|---|
| `agenda` | Agenda | `v6` | `["/agenda"]` | v1 Grade semanal · v2 Por mentorado + mini-cal · v3 Cards por dia (vencedora R1) · v4 Duas superfícies (vencedora R2) · v5 Semana + trilha · v6 Composição final (**final**) |
| `jovem-especialistas` | Especialistas do jovem | `v6` | `["/jovem/especialistas", "/jovem"]` | v1 Aba dedicada · v2 Overflow "Mais" · v3 Card-CTA na home (vencedora R1) · v4 Trilha explícita (vencedora R2) · v5 Ciclo de vida · v6 Composição final (**final**) |
| `duplas` | Duplas | `v5` | `["/duplas"]` | v1 Tabela densa (escolha do Léo) · v2 Legenda sob demanda · v3 Seções por categoria (vencedora juízes R1) · v4 Seções + cards (descartada) · v5 Composição final (**final**) |
| `materiais` | Materiais / jornada | `v4` | `["/materiais", "/jovem/materiais"]` | v1 Portais iguais · v2 Hero jornada (vencedora juízes) · v3 Trilha narrativa · v4 Composição final (**final**) |
| `instrumentos` | Instrumentos | `v1` | `[]` (vive em `/f/*`, fora da demo) | v1 Roda + Metas/PDM + Visão (**final**) |
| `chamados` | Chamados | `v4` | `["/chamados"]` | v1 Master-detail · v2 Board por status · v3 Inbox (vencedora R1) · v4 Composição final (**final**) |

`varianteDaTela`: `?v=` válido > cookie > `decidida`. Valor inválido cai na
decidida (nunca 404 por variante — a tela é o recurso).

## Passo 2 — cookie `demo_view` em `shared.ts` + `mode.ts`

`src/lib/demo/shared.ts` (isomórfico — já entra no bundle client):

```ts
export const DEMO_VIEW_COOKIE = "demo_view";
/** "agenda:v3,materiais:v4" — mapa tela→variante; ~2KB de teto, dezenas de
 *  telas cabem. Formato delimitado (não JSON) = parse tolerante e cookie
 *  curto; slug/versão são vocabulário fechado do registry. */
export function parseDemoViews(raw: string | undefined | null): Record<string, string>;
export function serializeDemoViews(views: Record<string, string>): string;
```

`src/lib/demo/mode.ts` (server):

```ts
export async function demoViews(): Promise<Record<string, string>> {
  const store = await cookies();
  return parseDemoViews(store.get(DEMO_VIEW_COOKIE)?.value);
}
```

`limparCookiesDemo` (shared.ts:55) e `limparDemo` (mode.ts:93): incluir
`DEMO_VIEW_COOKIE` na lista — sair da demo zera a escolha de variantes.

## Passo 3 — rotas do viewer [NOVO]

- `src/app/demo/mockups/page.tsx` — índice das 6 telas (server component).
  Card por tela: título, nº de variantes, badge "virou produto" (quando
  `produtos.length > 0` → link) + link "Comparar variantes". Cabeçalho com
  logo + volta ("← Demonstração" → `/demo` se `demoRole()` ativo, senão
  "Ver a demonstração").
- `src/app/demo/mockups/[tela]/page.tsx` — viewer (server component):
  - `params.tela` fora do registry → `notFound()`.
  - `searchParams.v` → `varianteDaTela(tela, v, (await demoViews())[slug])`.
  - Chrome mínimo: barra superior (logo + título + link "Ver no produto"
    quando `produtos[0]`) + `<MockupPicker>` (client) + `<iframe>`
    `src={variante.arquivo}` `sandbox="allow-scripts"` `title`.
  - Painel de notas colapsável (`<details>`) com o resumo/status da variante.
  - `metadata.robots: { index:false }` (mesma régua de `/demo`).

`/demo/*` já é público no proxy (`src/lib/supabase/middleware.ts:55`) —
nenhuma mudança de guarda.

- `src/components/mockup-picker.tsx` [NOVO, client] — pills de variante
  (`v1`…`v6` + rótulo), `aria-current` na ativa, `<Link href="?v=vN">`;
  `onClick` escreve `demo_view` no `document.cookie` (merge via
  `parseDemoViews`/`serializeDemoViews` do shared — mesmo padrão de cookie
  legível do `limparCookiesDemo`). Também `force-dynamic` implícito via
  `cookies()`/`searchParams` na page — não precisa declarar.

## Passo 4 — DemoBar: seção "Alterar view"

`src/components/demo-bar.tsx` — inserir entre a seção "Ver como" (:141-179)
e o bloco final de ações (:181-204), uma seção nova:

- `const telaAtual = mockupTelaDoPath(usePathname())` (adicionar o import de
  `next/navigation` — o componente já é client).
- **Com tela mapeada** (ex.: em `/agenda`): label "Alterar view · Agenda" +
  linha de chips `v1 … v6` (Link para `/demo/mockups/agenda?v=vN`) + linha
  "No produto" (`aria-current` implícito — é onde a pessoa está).
- **Sem tela mapeada**: uma linha-link "Comparar layouts de tela" →
  `/demo/mockups` (ícone `SquaresFour` do Phosphor — já é dep).
- Seção visível só quando `MOCKUP_TELAS.length > 0` — a remoção futura
  (WP9) esvazia o registry e o menu some sozinho.

`personas`/`papel` props intactos; nenhuma prop nova (o registry é import
direto — já é módulo puro isomórfico).

## Passo 5 — exceção CSP em `next.config.ts`

Acrescentar **depois** da regra global `/:path*` (a doc do Next 16 —
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
— confirma: "the last header key will override the first"):

```ts
const CSP_MOCKUP = [
  "default-src 'none'",
  // HTML de prancheta commitado no repo — script inline permitido só ele
  // (radar da instrumentos/v1, filtros da duplas/v4); nenhum src externo
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "frame-ancestors 'self'",   // só a /demo/mockups do próprio app embute
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

// dentro de headers(), APÓS o objeto { source: "/:path*" }:
{
  source: "/mockups/:path*",
  headers: [
    { key: "Content-Security-Policy", value: CSP_MOCKUP },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ],
},
```

Os demais headers globais (`nosniff`, `Referrer-Policy`, `Permissions-Policy`,
HSTS) continuam aplicados — o override é por chave, não por bloco.
`frame-src 'self'` do CSP global já autoriza o iframe no lado da página-mãe.

## Passo 6 — testes

- `tests/demo-mockups.test.ts` [NOVO — Vitest]: todo `arquivo` do registry
  existe em `public/mockups/` (`fs.existsSync`); 1 `status:"final"` por
  tela; slugs únicos; `produtos` começam com `/`; `varianteDaTela` cai na
  decidida com `?v=` inválido/ausente; `parseDemoViews`/`serializeDemoViews`
  fazem round-trip e ignoram lixo.
- `tests/e2e/demo/mockups.spec.ts` [NOVO — projeto demo, seguro em prod]:
  ver `acceptance.md` (índice, viewer, troca de variante, cookie, headers
  CSP, deep-link da DemoBar em `/agenda`).

## Passo 7 — fechamento

`npx tsc --noEmit` + `npx eslint src/` + `pnpm test` → branch
`thiago/realiza-138-demo-view-switcher` → push → preview Vercel →
`e2e-preview` verde → merge. Comentário na issue: o que mudou + como
verificar (DemoBar → "Alterar view" em `/agenda`; `/demo/mockups`).

## Ordem de PR

**Um PR só** (P): passos 0–6 juntos — nada vai a meio-caminho sozinho
(registry sem viewer = dead code; viewer sem CSP = iframe quebrado).

## Arquivos tocados — resumo

| Ação | Path |
|---|---|
| Mover | `docs/mockups/<tela>/v*.html` → `public/mockups/<tela>/v*.html` (26) |
| Editar | `docs/mockups/RELATORIO.md` (caminhos) |
| Editar | `docs/planos/implementacao-telas-finais.md` (caminhos citados) |
| Novo | `src/lib/demo/mockups.ts` |
| Editar | `src/lib/demo/shared.ts` (+`DEMO_VIEW_COOKIE`, parse/serialize, `limparCookiesDemo`) |
| Editar | `src/lib/demo/mode.ts` (+`demoViews`, `limparDemo`) |
| Novo | `src/app/demo/mockups/page.tsx` |
| Novo | `src/app/demo/mockups/[tela]/page.tsx` |
| Novo | `src/components/mockup-picker.tsx` |
| Editar | `src/components/demo-bar.tsx` (seção Alterar view + `usePathname`) |
| Editar | `next.config.ts` (regra `/mockups/:path*`) |
| Novo | `tests/demo-mockups.test.ts` |
| Novo | `tests/e2e/demo/mockups.spec.ts` |

## Rollback

Todo o diff é aditivo e demo-only: reverter o PR remove rotas, seção da
DemoBar e a regra de headers — zero risco a produto/dados. `git mv` de
volta devolve os HTMLs a `docs/mockups/` se a decisão for não expor.
