# REALIZA-138 — Design: switcher "Alterar view" na demo

## Persona e JTBD

- **Quem:** Thiago + equipe (Léo, Kelyng) — público interno de alinhamento;
  a `/demo` também é aberta a interessados ("Ver a demonstração" no login).
- **JTBD:** *"Quero ver as alternativas de layout que avaliamos pra cada
  tela, no produto, sem abrir arquivo do repo — e comparar com o que virou
  produto."* Perguntas de 5s: (1) em que tela estou olhando variantes?
  (2) qual variante estou vendo agora? (3) como troco pra outra / volto
  pro produto?

## Reuso de componentes existentes (nada novo sem listar)

| Peça | Componente/padrão existente |
|---|---|
| Popover da DemoBar | `src/components/ui/popover` (já usado em `demo-bar.tsx:115-206`) |
| Pills de variante | mesmo visual das abas pill do app: `rounded-md px-3 py-1.5` + `bg-card` ativa — padrão `AbasAgendaMentor` (`agenda/page.tsx:543-573`) |
| Linhas de menu da DemoBar | estrutura dos rows de papel (`demo-bar.tsx:145-178`: `px-4 py-2.5`, ícone em círculo lime `size-8`, label + sublabel, `Check` na ativa) |
| Disclosure de notas | `<details>` nativo (padrão `LegendaSemaforo`, `duplas-lista.tsx:631`) |
| Cards do índice | superfície `rounded-xl bg-card shadow-[var(--shadow-border)]` ubíqua |
| Ícones | Phosphor — `SquaresFour` (layouts), `ArrowSquareOut`/`ArrowLeft` (produto/voltar), `Flask` (já usado na DemoBar) |
| Tokens | `--brand-ink`/`--brand-lime` (inversão de marca da DemoBar), `--border`, `--muted`, `--muted-foreground`, `--radius` |

## DemoBar — seção "Alterar view"

Inserida entre "Ver como" (papel) e o bloco final (Rever apresentação /
Sair) — mesma gramática visual: label uppercase 11px + rows `px-4 py-2.5`.

### Caso 1 — tela com variantes (ex.: `/agenda`)

```
───────────────────────────────
  ALTERAR VIEW · AGENDA         ← label da seção
  ┌─────────────────────────┐
  │ [▣]  v1  v2  v3  v4  v5 │   chips-pill 32px min-height, vN+ícone
  │      ●atual no produto  │   sublinha: "O produto usa a v6 (final)"
  │      Ver todas lado a   │
  │      lado na galeria →  │   → /demo/mockups/agenda
  └─────────────────────────┘
```

- Chips levam a `/demo/mockups/agenda?v=vN` (Link normal — o popover fecha
  no clique como hoje).
- Microcopy do label usa `titulo` do registry: "Alterar view · Agenda" /
  "… · Duplas" / "… · Chamados" / "… · Especialistas do jovem" /
  "… · Materiais".
- A linha "no produto" **não é chip**: é o estado atual — um row muted
  "O produto usa a v6" (texto, sem ação), pra ninguém procurar "v6" como
  destino.

### Caso 2 — tela sem variantes (qualquer outra)

Um row-link único, mesma anatomia dos rows de papel:
`[SquaresFour] Comparar layouts de tela` + sublabel "As variantes de
mockup que viraram o produto" → `/demo/mockups`.

### Regras

- Renderiza só se `MOCKUP_TELAS.length > 0` (gate de remoção futura).
- `variant="dock"` e `"float"` compartilham o `PopoverContent` — uma
  implementação cobre os dois. `w-72` do popover cabe 6 chips de ~32px
  com wrap (`flex flex-wrap gap-1`).
- `pending` durante a navegação já é comunicado pela pill (spinner) —
  reuso direto do padrão `executar()`.

## `/demo/mockups` — índice

Layout: mesma base da landing `/demo` (`src/app/demo/page.tsx:69-72`:
`flex min-h-[100dvh]`, card `max-w-xl`, logo `h-6`) — continuidade de marca,
não chrome do app (não é a shell logada).

```
 logo Realiza.vc
 AMBIENTE DE DEMONSTRAÇÃO
 Layouts avaliados                         ← h1
 "As variantes de cada tela que o processo
 de mockups comparou — a escolhida virou
 o produto."                               ← sub 14px muted

 ┌─ card ─────────────┐ ┌─ card ─────────────┐
 │ Agenda          6v │ │ Duplas          5v │
 │ "Duas superfícies…"│ │ "Tabela densa…"    │
 │ v6 = produto       │ │ v5 = produto       │
 └────────────────────┘ └────────────────────┘
 (grid min-[360px]:grid-cols-2 — mesmo breakpoint dos cards de papel)

 rodapé: "Dados fictícios · as variantes são pranchetas HTML estáticas"
         ← Voltar / Entrar na demo (condicional por demoRole)
```

Card = `<Link>` para `/demo/mockups/<slug>`: título + contagem de variantes,
`resumo` do registry, badge lime "v6 · virou produto" (quando `produtos`
não-vazio) ou neutro "não virou tela" (instrumentos — vive em `/f/*`).

## `/demo/mockups/[tela]` — viewer

```
┌ topbar (bg-ink, h-12, sticky) ─────────────────────────┐
│ ← Galeria   AGENDA              Ver no produto →        │
├─────────────────────────────────────────────────────────│
│ pills:  [v1] [v2] [v3*] [v4] [v5] [v6·produto]          │
│         "Cards por dia — vencedora da 1ª rodada"        │
├─ iframe flex-1 (min-h-0, w-full) ───────────────────────│
│              (HTML da variante, sandboxed)              │
└──────────────────────────────────────────────────────────┘
```

- **Topbar:** inversão de marca (`bg-[var(--brand-ink)]` +
  `text-[var(--brand-lime)]`) = mesma assinatura "modo alternativo" da
  DemoBar — a pessoa entende que saiu do app real sem ler nada.
  "Ver no produto" → `produtos[0]`; ausente (instrumentos) → some.
- **Trilha de pills** (`MockupPicker`, client): scroll horizontal no
  mobile (`overflow-x-auto`, `min-h-11` por alvo); pill ativa =
  `bg-card text-foreground shadow-sm` dentro de trilha `bg-muted p-1`
  (padrão das abas da agenda). Versão da decidida ganha marcador
  "· produto" no rótulo (ex.: `v6 · produto`).
- **Linha de direção** (`rotulo` da variante + nota de status):
  12–13px muted — "Grade semanal" · "descartada na R1" · "vencedora R2" ·
  "composição final — virou o produto".
- **`<details>` "Notas da variante"** abaixo da trilha: `resumo` +
  rastreabilidade (da RELATORIO: "base v3", "resgate da v5").
- **iframe:** `sandbox="allow-scripts"`, `title="Mockup {tela} {versao}"`,
  `className="h-full w-full flex-1 border-0"`. Altura: viewer é
  `h-[100dvh] flex flex-col` — chrome fora, canvas dentro.

### Estados

| Estado | Render |
|---|---|
| Variante ativa | pill destacada + iframe carrega `variante.arquivo` |
| `?v=` inválido | cai na `decidida` silenciosamente (é a escolha sã) |
| `tela` inválida | `notFound()` (404 padrão do app) |
| iframe falha (asset ausente) | browser mostra página de erro dentro do frame — aceitável: o teste Vitest garante o arquivo no disco; estado extra não se paga |
| Carregando | o chrome responde na hora; o iframe tem fundo `--background` — transição instantânea percebida |
| Sem `demo_role` | página funciona igual (pública); o rodapé oferece "Ver a demonstração" |
| Mobile 390px | pills com scroll-x; iframe ocupando o resto — o próprio mockup é responsivo (foi exigência do brief) |

## Microcopy pt-BR (final)

- Seção DemoBar: `Alterar view · {Tela}` / `Comparar layouts de tela` /
  sublabel `As variantes de mockup que viraram o produto` /
  info `O produto usa a {decidida}`.
- Índice h1: `Layouts avaliados` · sub: `As variantes de cada tela que o
  processo de mockups comparou. A escolhida virou o produto.` · badge:
  `{v} · virou produto` / `não virou tela` · CTA card: título+contagem.
- Viewer: `← Galeria` · `Ver no produto →` · `Notas da variante` ·
  status: `vencedora da {rodada}` · `descartada na {rodada}` ·
  `composição final — virou o produto`.
- iframe title: `Mockup {titulo} {versao}`.

## A11y

- Pills com `aria-current="true"` na ativa; trilha com
  `role="group" aria-label="Variantes de {tela}"`.
- Chips/alvos ≥ 44px (`min-h-11` — padrão `ui/*`).
- Status nunca só por cor: pill ativa tem fundo + rótulo de versão; a linha
  de direção escreve o status por extenso.
- `focus-visible` herdado dos padrões (`outline`/ring já nos componentes).
- O mockup embutido já segue as próprias regras de a11y do brief
  (≥12px, ícone+rótulo, reduced-motion) — o chrome do viewer não piora:
  navegação por teclado entra no frame naturalmente.
- `prefers-reduced-motion`: nenhuma animação nova introduzida.
- Texto mínimo 12px (sublabels 12–13px, corpo 14px) — régua do público
  até 60 anos (RELATORIO transversal).
