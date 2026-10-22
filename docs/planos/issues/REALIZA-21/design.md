# REALIZA-21 — Design / UX

Checklist de intenções no card do encontro. Framework: `.devin/skills/ux-review/SKILL.md`.

## Persona & JTBD

**Mentor DPP** — a ficha da dupla é a tela de trabalho dele ("a telinha de
dupla é a tela de trabalho do mentor"). Antes do encontro ele anota intenções
("perguntar do ENEM", "enviar o vídeo depois"); depois do encontro quer ver o
que ficou pendente **sem reabrir o WhatsApp**. As perguntas nos primeiros 5s:

1. "O que eu queria fazer neste encontro?"
2. "O que ficou pendente de encontros anteriores?"
3. "O que já resolvi?"

**Coord/supervisor** — leem o plano do mentor no detalhe do encontro
(`EncontroDetalheDialog`), sem editar.

## Hierarquia no card do encontro

O `EncontroRow` (`src/app/(app)/duplas/[id]/page.tsx:1370+`) já tem a anatomia:
disco do nº → título/datas → ações → `NotaEncontro` (Collapsible,
`:1689-1698`) → `RegistroDetails`. A checklist entra **na mesma section
`border-t` que a nota**, logo abaixo dela — as duas são "preparo do mentor" e
formam grupo por proximidade (Gestalt).

Ordem dentro do bloco: `NotaEncontro` (texto livre, plano longo) →
`IntencoesEncontro` (itens acionáveis). A nota responde "como quero conduzir";
as intenções respondem "o que não posso esquecer".

## Componente: `IntencoesEncontro` [NOVO]

`src/components/intencoes-encontro.tsx` — reuso máximo:

- **`Collapsible.Root/Trigger/Panel`** de `@base-ui/react/collapsible` — idêntico
  ao `NotaEncontro` (`nota-encontro.tsx:111-149`): trigger min-h-11, caret que
  gira, painel animado por `--collapsible-panel-height`.
- **Checkbox nativo sr-only + quadrado estilizado** — o padrão de
  `jovem-combinados.tsx:66-103` / `encaminhamentos-list.tsx`: label envolve
  input+quadrado+texto, `peer-focus-visible:ring-2` no quadrado. Teclado e
  leitor de tela de graça.
- **`Input`** de `src/components/ui/input` para "Adicionar intenção…" (Enter
  submete — sem botão visível pra não inflar a linha; `aria-label` descreve).
- **`Button variant="ghost" size="sm"`** × pra remover item próprio.
- **`toast`** (sonner) nos erros — padrão da casa.

### Anatomia

```
▼ Intenções                              · 2 pendentes
   ☐ Perguntar do ENEM                         [×]
   ☑ Enviar vídeo do primeiro dia              [×]
   ── De antes ───────────────────────────────
   ☐ do 3º encontro · Levar guia de rotina     [×]
```

- **Trigger**: `Intenções` (font-medium text-foreground/80, como
  `NotaEncontro`) + sufixo muted `· N pendentes` quando houver pendente na
  soma (próprias + carry-over). Sem pendente e sem item: sufixo some.
- **Itens do encontro atual**: checkbox + texto; feito = `line-through
  text-muted-foreground` (mesma transição de cor do encaminhamento —
  `encaminhamentos-list.tsx:92`).
- **Bloco "De antes"**: divisor `border-t border-border/60` + label overline
  `DE ANTES`; cada linha leva tag muted `do Nº encontro` antes do texto — a
  origem evita que pendente antigo leia como item novo (o risco do README).
- **Input**: placeholder `"Adicionar intenção…"`; Enter (submit) ou blur com
  texto → `criarIntencao`. `maxLength={280}`.
- **Remover**: ghost × visível em `group-hover`/`focus-within` — nunca só
  hover (mobile não tem hover): sempre visível em `opacity-60`, sobe pra
  `opacity-100` no hover/focus.

### Estados

| Estado | Render |
|---|---|
| Vazio (sem item, sem pendente) | Trigger `Intenções` + painel com input e empty copy `"Coisas que precisam acontecer neste encontro — ex.: enviar material depois."` |
| Salvando item | `opacity-60` + `disabled` só no item em trânsito (`pendingId` — padrão `jovem-combinados.tsx:26,70`) |
| Erro | `toast.error(res.error)`; o checkbox volta ao estado anterior (não fazer optimistic flip — padrão da lista de combinados) |
| `somenteLeitura` (coord/sup, dupla inativa, trilha esp sem edição) | Lista plana sem inputs e sem collapse quando há itens; `null` quando vazio — idêntico ao ramo read-only de `NotaEncontro` (`:94-106`) |
| Demo | `demoAtivoClient` gate (espelhar `nota-encontro.tsx:45-57`): estado local funciona, nenhuma action dispara, sem toast DEMO_MSG |
| Encontro realizado | Continua editável — "enviar vídeo depois" é o caso central; só `dupla.status !== 'ativa'` congela |

### Carry-over — regra de exibição

No card do passo `N`: itens com `numero = N` (próprios) + `numero < N &&
!feito` (carry-over, tag `do Nº encontro`). Item feito nunca carrega — some
da lista de "De antes" no refresh seguinte.

### Microcopy (pt-BR)

- Trigger: `Intenções` / `· N pendentes` / `· tudo feito` (quando só há
  feitos — feedback positivo barato).
- Vazio: `"Coisas que precisam acontecer neste encontro — ex.: enviar material depois."`
- Carry-over: `DE ANTES` + `do Nº encontro`.
- Input: `"Adicionar intenção…"`, `aria-label="Nova intenção do {numero}º encontro"`.
- Read-only no detalhe (coord): `Intenções do mentor`.

### Aviso na Minha agenda

`avisosDaDupla` (`agenda-minha.ts:304`) — **uma** linha na seção "Hoje",
reutilizando `AvisoAgenda`/`LinhaAviso` já existentes:

- Título: `Intenções em aberto · {nome1} · {turma}`
- Detalhe: `{N} itens — o mais antigo é do {N}º encontro.`
- CTA: `Ver intenções` → `/duplas/{id}` (deep link pra ficha; a section de
  encontros é o destino — mesma âncora dos avisos de registro se houver id de
  bloco estável; senão a ficha inteira).
- Quando aparece: `!feito` em qualquer `numero` (a pendência é do mentor,
  independente de qual encontro é o próximo). Some quando tudo feito.

### EncontroDetalheDialog (leitura)

Bloco após "Plano do mentor" (`encontro-detalhe-dialog.tsx:186-193`), mesmo
chrome `rounded-lg bg-muted/40 px-3.5 py-2.5`: label `Intenções do mentor` +
lista `☑/☐` textual (line-through nos feitos). Sem checkbox — quem lê não
opera.

## Layout mobile→desktop

- Mobile: linhas full-width, hit area ≥44px (input + label cobrem a linha
  inteira), wrap natural do texto (`break-words` — o texto pode ter 280
  chars).
- Desktop: mesma coluna do card (o bloco é `px-4`, coluna estreita por
  desenho — não estica); carry-over continua dentro do collapse, não vira
  sidebar.

## A11y

- Checkbox nativo → estado anunciado (`checked`), label clicável,
  `peer-focus-visible:ring` visível.
- `aria-live="polite"` na linha de status se houver texto de salvamento (a
  checklist não mostra "salvo às hh:mm" — o toggle é instantâneo como o
  combinado; status só em erro).
- Remover: `aria-label="Remover intenção"`.
- Cor nunca é canal único: feito = cor + `line-through`; pendente carry-over
  = tag textual `do Nº encontro`, não só cor.

## O que NÃO fazer

- Não reutilizar o visual de `EncaminhamentosList` (responsável/prazo) — os
  itens não têm responsável nem data; copiar a anatomia inteira sugeriria
  combinado.
- Não colocar o checklist no registro/follow-up — intenção é preparo, não
  follow-up.
- Não esconder atrás de dialog — é a mesma visibilidade da nota (sempre
  visível no card, colapsável).
