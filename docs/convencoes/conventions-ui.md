# Convenções de interface

Ler quando tocar qualquer UI. Convenção geral: **classes Tailwind direto no JSX** — não existe nem deve existir componente de tipografia. Referências vivas: `src/components/page-header.tsx` (título/meta de página) e `src/components/ui/label.tsx` (label de campo).

## Hierarquia de texto — escala (papel → classes)

- **Título de página (h1):** `text-2xl font-semibold tracking-tight` (+`text-balance` no `PageHeader`). Kicker opcional acima do h1: `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`. Meta sob o h1: `mt-1.5 text-sm text-muted-foreground`.
- **Título de seção/card:** `text-base font-semibold` (ou `font-semibold` a sós, que já é `text-base`); seções maiores de página chegam a `sm:text-lg` com `tracking-tight`. Sub-seção dentro de card/ficha: `text-sm font-semibold`.
- **Rótulo de grupo (eyebrow):** `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` — padrão dominante (80+ usos); sempre caixa-alta, sempre muted.
- **Título de item/linha:** `text-sm font-medium` em linhas de lista; `text-sm font-semibold` quando o item é o dado-âncora (nome da dupla, evento); `font-semibold` a sós em títulos de card-trabalho (cards de dupla/visão). Nunca peso normal nem `text-muted-foreground`.
- **Corpo:** `text-sm` (ou o tamanho herdado do container). Texto explicativo/secundário: `text-sm text-muted-foreground`.
- **Metadado** (data, contador, origem, info de apoio): `text-xs text-muted-foreground` — par dominante (500+ usos). Micro-meta de linha densa: `text-[11px] text-muted-foreground`.
- **Label de campo:** `text-sm font-medium` (`ui/label`). Rótulo de dado em ficha (`<dt>`, "rótulo sobre valor"): `text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground`.
- **Micro/badge:** `text-[10px]`–`text-[11px]` só em badges, indicadores e micro-UI — nunca em texto corrido.

**Cor:** `text-foreground` é a camada primária (títulos, valores de dados, corpo). `text-muted-foreground` é a camada secundária — metadados, hints, labels e texto explicativo — **nunca** o valor principal de um dado. Não criar terceiro tom (`text-foreground/60` etc.) fora dos usos já estabelecidos. Papel por cor: lima = ação (um botão preenchido por tela, item ativo da nav, foco); amarelo (`--destaque`) = próximo passo, jornada, celebração — nunca alerta; status (`--danger` risco, `--warn` atenção, `--ok` feito, `--info` apoio, `--pausa`) sempre com rótulo de texto, nunca só cor; token de preenchimento nunca é cor de texto — texto de status usa o par `-text`, sobre o `-bg`.

**Espaçamento:** irmãos dentro de card: `gap-2`/`gap-3` ou `space-y-2`; título de item → metadado: `mt-0.5` (linha) / `mt-1` (bloco); linhas tabulares: `divide-y divide-border/60`; itens soltos: `space-y-2`; entre seções de página: `space-y-4`–`space-y-6`/`mt-4`+; `PageHeader` resolve `gap-x-4 gap-y-3` e `mt-1.5` título→meta.

**Truncate:** título de item não trunca. Metadado, legenda e linha única densa truncam — e quando o texto importa ele fica íntegro em `title`/`sr-only` ou na ficha de destino.

**Título de seção ≠ rótulo:** `h2` de seção é `text-base font-semibold` (ver escala). O estilo pequeno `text-[11px] uppercase tracking-[0.08em]` é só rótulo de grupo dentro de card (ou título de grupo da nav) — usá-lo como título de seção deixa a tela sem ponto de entrada (rodada out/2026 corrigiu ~40 casos).

**Piso no celular:** abaixo de `sm`, texto que informa tem no mínimo 12px (`text-xs`); 10–11px só em badge/contador puro, micro-label de gráfico/calendário e `<dt>`. Padrão quando o desktop precisa da densidade: `text-xs sm:text-[11px]`.

**Exceções legítimas (não "consertar"):** linhas/tabelas densas usam `text-[13px]` de corpo base (lista de duplas, fila de acompanhamento, relatório canvas); forms/instrumentos usam `text-[15px]`→`sm:text-base` em perguntas e inputs `text-base`→`md:*` (anti-zoom iOS); badges/chips em `text-[10px]`–`[11px]`; células de calendário/grade com micro-labels próprios; cores semânticas (`--warn`, `--ok`, semáforo, destructive) sobrescrevem a camada de cor quando sinalizam estado.

## Padrões de interface (rodada out/2026)

Contexto e decisões em `docs/planos/dores-ux-2026-10/` (README + `_convencoes-execucao.md`).

- **Uma dupla, um desenho:** toda lista de duplas de staff usa `DuplaLinha` (`src/components/dupla-linha.tsx`) — situação + apoio, nomes (não truncam), motivo em até 2 linhas, encontros n/total, nota do mentor, UMA ação contextual + ⋯ + Ver ficha. Superfície neutra; cor só na pill/quadrados. A regra Lembrar/Chamar mora em `src/lib/acao-lembrete.ts`.
- **Uma contagem de saúde:** números de situação das duplas vêm só de `saudeDoRecorte` (`src/lib/agenda-coordenacao.ts`) e aparecem só via `SaudePrograma` (`src/components/saude-programa.tsx`) — home, /duplas, /agenda e /registros mostram os mesmos números por construção. Apoio é sobreposição (pill), nunca fatia nem tira do risco. Dupla em dia é neutra.
- **Container queries em componentes reutilizados:** componente que aparece em colunas de larguras diferentes (home 2/3, /duplas inteira) responde ao container (`@container` + `@4xl:`), não à tela (`lg:`). Colunas de grade compartilhadas entre linhas têm largura fixa nas bordas — `auto` desalinha a tabela.
- **A interface não explica a si mesma:** definição de regra de negócio vai num popover "Como calculamos" ou no onboarding do papel, nunca em parágrafo fixo ("Você vê / Você não faz", "não é falha da dupla" e afins saíram).
- **Páginas longas viram abas por URL** (`?aba=`, `Link` + `role=tablist`, setas/Home/End, rolagem horizontal no mobile): ficha da dupla (agora/encontros/instrumentos/pessoas), /materiais (jornada/instrumentos/biblioteca). Deep link `#registrar-<id>` sem `aba` cai na aba certa.
- **Copy:** sem travessão em texto exibido (inclusive strings geradas em `src/lib`), sem jargão interno ("semáforo", "eixo", "janela", "estação"), "Turma 1" por extenso em texto corrido (`turmaLonga`); siglas "T1" só em pill/chip.
- **Server component + ícones:** em arquivo sem `"use client"`, importar Phosphor de `@phosphor-icons/react/dist/ssr` — a entrada padrão usa `createContext` e quebra o `next build` ("createContext is not a function") quando um server component passa a importar o componente.

## Movimento

Entrada de lista/card: `.animate-enter` + `--i` inline (stagger 0–10). **Troca de filtro, busca ou ordenação sempre anima** — re-key no container da lista remonta as linhas e re-roda a entrada (≤300ms, fade+slide); nunca um repaint seco de tabela inteira. O guard global de `prefers-reduced-motion` em `globals.css` já zera tudo — não adicionar media query por componente nem desligar a animação à mão.
