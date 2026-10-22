# REALIZA-138 — SDD: viewer de variantes de layout na demo

## Contexto e decisão central

A issue pede um switcher de "views" na `/demo` (cookie `demo_view` +
controle na `DemoBar`). A decisão de arquitetura é **o que é uma "view"**:

| Alternativa | Como funcionaria | Veredito |
|---|---|---|
| **A — Mockups HTML servidos em iframe** | Os 26 HTMLs de `docs/mockups/` viram assets em `public/mockups/`; `/demo/mockups/[tela]` escolhe a variante e embute num `<iframe>` | **Escolhida** |
| B — Componentes React alternativos | Cada variante vira um componente real mantido; `demo_view` troca o componente na rota real | Rejeitada |
| C — Nada (abas reais bastam) | "Minha agenda / Por mentorado / Calendário" já são "views" | Rejeitada |

**Por que A:** os HTMLs já são "organizações diferentes do MESMO dado"
(o `_brief-final.md` §2 fixou dataset canônico único justamente pra isso).
Servi-los verbatim é a comparação mais fiel — é literalmente o que os
juízes avaliaram — e custa P. É também o desenho que
`docs/planos/implementacao-telas-finais.md` WP9 prescreveu
(`src/lib/demo/mockups.ts`, `public/demo/mockups/`, "Layouts em teste").

**Por que não B:** só existe implementação real das **vencedoras** — as
perdedoras nunca foram codadas como React. Mantê-las como produto paralelo
(multiplica superfícies, queries e e2e por variante) é o caminho G e ainda
trai o propósito: comparar *o que foi avaliado*, não uma reimplementação.

**Por que não C:** as abas `?aba=` comparam **escopos** do desenho final
(minha agenda × por mentorado × calendário), não as **organizações
alternativas** que perderam (grade GCal × lista por-dupla × cards por dia).
A necessidade do pedido original — "ver a Agenda 1/2/3" — continua
descoberta dentro do produto.

## Arquitetura

```
/demo/mockups              índice (server component)
/demo/mockups/[tela]?v=vN  viewer: chrome mínimo + <iframe sandbox>
        │
        ▼  src estático (mesma origem)
/mockups/<tela>/vN.html    public/ — CDN, com CSP própria sandboxada

src/lib/demo/mockups.ts    registry puro: telas → variantes → arquivo/status
src/lib/demo/shared.ts     DEMO_VIEW_COOKIE + parse/serialize (isomórfico)
src/lib/demo/mode.ts       demoViews() (server) + limpeza no sair
src/components/demo-bar.tsx    seção "Alterar view" (contextual por pathname)
src/components/mockup-picker.tsx  pills v1…vN (Link ?v= + cookie no click)
next.config.ts             regra headers() p/ /mockups/:path*
```

### Registry (`src/lib/demo/mockups.ts`)

Fonte única de verdade: slug, título, versão decidida, paths de produto
(para o deep-link contextual e "ver no produto"), e por variante o arquivo,
rótulo de direção e status (`final` | `vencedora` | `descartada`). O status
vem do `RELATORIO.md` — rastreabilidade explícita, não inferência.

Sem import de `next/*` e sem `fs` em runtime: o componente client
(`mockup-picker`) e o teste Vitest importam o mesmo módulo. Existência dos
arquivos é garantida **por teste** (`tests/demo-mockups.test.ts` com
`fs.existsSync`), não por leitura em request — mantém o módulo isomórfico.

### Cookie `demo_view`

- Formato `tela:versao,tela:versao` (delimitado, não JSON): cookie curto,
  parse tolerante a lixo, vocabulário fechado validado contra o registry.
- Escrito no **client** (`document.cookie` no `onClick` do picker) — mesmo
  padrão de `limparCookiesDemo` (`shared.ts:55-64`): cookie de preferência
  legível, não-HttpOnly, sem server action.
- Lido no **server** pelo viewer (`cookies()` via `demoViews()`): define a
  variante default quando `?v=` ausente. `?v=` continua sendo o deep-link
  canônico (shareable); o cookie só lembra a última escolha por tela.
- Limpeza: entra em `limparCookiesDemo` (browser, login real) e
  `limparDemo` (server, sair da demo) — sair da demo zera a escolha.

### Rotas

- `/demo/mockups` e `/demo/mockups/[tela]` ficam sob o prefixo público
  `/demo/` do proxy (`middleware.ts:55`) — acessíveis **com ou sem** o
  cookie `demo_role`. Decisão deliberada: a página é material de divulgação
  interno (dados fictícios), funciona também como "preview dos mocks" sem
  entrar na demo. `robots: noindex` como `/demo`.
- `?v=` inválido → variante `decidida` (variante não é recurso 404; a tela
  é). `tela` fora do registry → `notFound()`.
- Sem `generateStaticParams`/ISR deliberado: a page lê `cookies()` +
  `searchParams`, é pequena e o iframe carrega o conteúdo pesado (estático).

### CSP — a parte delicada

Hoje `/:path*` aplica `frame-ancestors 'none'` + `X-Frame-Options: DENY`
(`next.config.ts:35`, `:63`) — **qualquer iframe same-origin é bloqueado**,
inclusive em `/demo/mockups`. A exceção escopada é obrigatória:

- Regra `source: "/mockups/:path*"` **depois** da global: doc oficial do
  Next 16 (`…/01-next-config-js/headers.md`, "Header Overriding Behavior")
  garante que a última definição da mesma chave vence → CSP e XFO do path
  dos mockups sobrescrevem; `nosniff`/`Referrer-Policy`/`Permissions-Policy`/
  HSTS seguem herdados.
- `CSP_MOCKUP`: `default-src 'none'` + `script-src 'unsafe-inline'` (2
  mocks usam `<script>` inline: filtro de `duplas/v4`, radar de
  `instrumentos/v1` — conteúdo commitado, mesmo nível de confiança do
  próprio código) + `style-src 'unsafe-inline' https://fonts.googleapis.com`
  + `font-src https://fonts.gstatic.com` + `img-src 'self' data:` +
  `frame-ancestors 'self'` + `form-action 'none'` + `base-uri 'none'`.
  Nada de conexões externas além de fontes — é sandbox por política, não
  por confiança.
- `X-Frame-Options: SAMEORIGIN` (fallback de browser antigo).
- Iframe com `sandbox="allow-scripts"` — **sem `allow-same-origin`**: origem
  opaca, não lê cookies nem storage da origem-mãe; scripts rodam (o radar
  precisa) mas não têm credenciais.
- `frame-src 'self'` do CSP global já autoriza o embed no lado da mãe —
  nenhuma outra diretiva precisa abrir.

### Por que `public/` e não route handler com `fs`

- `public/` é servido pela borda (Vercel/static) — zero compute por request;
  o conteúdo é literalmente estático.
- Route handler lendo `docs/` exigiria `outputFileTracingIncludes` e
  leitura por request — complexidade sem ganho (rejeitada).
- `public/mockups/` em vez de `public/demo/mockups/`: evita colisão de
  namespace entre assets (`/mockups/agenda/v6.html`) e rotas app
  (`/demo/mockups/agenda`) — paths distintos, sem ambiguidade de resolução.

## Modelo de dados

Nenhum. Zero migration, zero query nova — o viewer não toca no Supabase nem
no dataset demo (o dado exibido é o estático canônico dos mocks).

## Integrações e invariantes respeitadas

- `src/proxy.ts`/`middleware.ts`: inalterado (`/demo/` já público).
- `limparCookiesDemo`/`limparDemo`: `demo_view` entra na lista de remoção —
  invariante "sair da demo zera tudo" preservada.
- Sentry: páginas novas caem no scrub global existente; o iframe carrega
  HTML estático sem SDK — nada a fazer.
- i18n/copy: pt-BR em toda a UI nova.
- `DemoBar` é client e recebe `usePathname()` — já é o padrão do app shell.

## Performance

- Assets: ~1,6 MB de HTML total (26 arquivos), CDN-cacheados;
  carregamento sob demanda (um iframe por vez).
- Registry é ~4 KB de TS — entra no bundle client via DemoBar/picker;
  custo desprezível.
- A troca de variante navega só `?v=` — server component re-renderiza o
  chrome e troca `iframe.src`; **nenhum dado é rebuscado** (aceite da
  issue: "troca de view sem reload de dados").

## Removibilidade (WP9)

Tudo marcado `// REALIZA-138` em comentário de header. Remoção = apagar
`public/mockups/`, as 2 rotas, `mockup-picker`, o registry, a seção da
DemoBar, a regra CSP e os 2 testes. `MOCKUP_TELAS.length > 0` como gate da
seção torna a remoção graceful até se feita por etapas.

## Questões em aberto

- **BLOCKER (já no README):** se o Thiago quiser modos **reais** paralelos
  em vez de viewer de mockups, esta issue vira épico — o plano assume A.
- Side-by-side (duas variantes na mesma viewport): fora de escopo — a troca
  rápida por pills responde o mesmo JTBD; fica como evolução trivial do
  viewer (2 iframes) se pedirem.
