# REALIZA-143 — Plano de implementação

## Contexto embutido

A roda interativa (PR #50+) já tem: barra de navegação verde com setas,
título acima, indicador de posição, sliders completos em lista única,
SVG com números. A issue cobre o que falta pro desktop mostrar **as 16
áreas nomeadas de uma vez** — "como no PDF oficial" — e o polish de
hierarquia/cor dos controles.

## Decisão de variante (vem do mockup REALIZA-137)

- **Variante A — labels ao redor da roda**: `RodaSvg` ganha
  `mostrarLabels` (desktop): `<text>` por eixo posicionado no raio externo,
  `text-anchor` por hemisfério, 2 linhas se > ~14 chars. Risco: colisão em
  telas médias — esconder abaixo de `lg:`.
- **Variante B — grade 2 colunas**: manter a lista de sliders (que já
  mostra os 16 nomes) e, em `lg:`, reorganizar em grid 2 col ao lado da
  roda (layout `lg:grid-cols-[minmax(0,420px)_1fr]`); cada quadrante um
  subgrupo. Mais seguro em qualquer largura.

**Recomendação se 137 não decidir**: B no desktop, A desligada; a roda
grande continua visualmente central e a grade garante os 16 rótulos.
`BLOCKER` no README cobre a escolha.

## Passos

1. `src/components/instrumentos/roda-vida.tsx` — reestruturar o layout:
   - Título do instrumento sai do card de foco: `<header>` branco próprio
     acima (texto da estação já vem de `flow.tsx` — **a verificar** onde o
     título mora hoje; a issue pede título "em fundo branco separado dos
     controles").
   - Linha de navegação própria: setas anterior/próximo + "Eixo N de 16 ·
     {label}" — **acima** da área de ajuste (já está na barra lime; a issue
     pede linha própria acima dos −/+ — confirmar se "acima" = posição
     já cumprida ou novo slot entre foco e roda).
   - −/+/setas com tokens brand: `bg-[var(--brand-lime)] text-[var(--brand-ink)]`
     nas ações primárias; foco visível `focus-visible:ring-ring`.
   - Desktop `lg:`: grid `[roda | grade-sliders]`; mobile: fluxo atual
     inalterado.
2. `src/components/instrumentos/roda-svg.tsx` —
   - prop `rotuloEixos?: boolean` (default false): labels `<text>` ao
     redor (variante A) — usada só `lg:` via CSS (`hidden lg:block` num
     `<g>` wrapper) ou render condicional por breakpoint hook se já houver
     um (`useMediaQuery` — **a verificar** se existe na base).
   - Escalonamento: `viewBox` já existe; checar `min-height`/aspect em
     telas `md` (768–1024) — a issue aponta quebra em telas médias;
     ajustar `max-width` por breakpoint.
3. `src/components/instrumento-resultado.tsx` — mesma variante de labels
   no modo leitura (consistência) — **sem alterar payload**.
4. Breakpoints: mobile <md = exatamente como hoje; `md` = roda maior,
   lista 1 col; `lg`+ = variante escolhida.
5. Demo/spec e2e: nenhuma mudança funcional — visual; atualizar snapshot
   visual se houver (specs são DOM-based, não pixel — confirmar).

## Ordem de PR

PR único de UI. Se a variante A for escolhida, pode quebrar em:
PR1 = hierarquia/cores/breakpoints (independente de labels);
PR2 = labels ao redor.

## Rollback

Pure-CSS/markup: revert do commit. Nenhum dado muda.
