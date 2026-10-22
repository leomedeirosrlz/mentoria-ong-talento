# REALIZA-143 — Roda da Vida: layout visual (labels no desktop, título separado, controles verdes)

- **Jira**: REALIZA-143 · Tarefa · Medium · Plano de origem: `docs/planos/ux-revisao-chamados.md` (frente G2) · Depende de REALIZA-18 e da variante de mockup (REALIZA-137)
- **Veredito**: **PARCIAL** — PR #50 já entregou nav verde, título acima e indicador de volta. Resta: labels das 16 áreas no desktop + refinamentos de hierarquia/controles.

## Estado atual (verificado em `roda-vida.tsx`/`roda-svg.tsx`)

- Card de foco lime com número+rótulo do eixo, setas anterior/próximo na barra — mobile "um eixo por vez" ✅ entregue.
- Roda SVG com **números** 1–16 nas pontas (não rótulos de área) + quadrantes.
- Lista completa: os 16 eixos como sliders agrupados por quadrante — já visíveis, mas em coluna única longa (mesmo padrão mobile repetido no desktop).
- −/+ abaixo da roda, cor `muted-foreground` (não brand).

## Escopo restante (da issue)

- **Desktop**: os 16 rótulos de área visíveis de uma vez "como no PDF" — duas variantes a decidir no mockup (137): (a) rótulos ao redor do SVG; (b) grade de sliders em 2 colunas por quadrante ao lado da roda.
- **Título em fundo branco separado** dos controles (hoje o foco é o card lime).
- **Linha própria de navegação**: setas anterior/próximo **acima** dos −/+.
- **−/+ /setas = verdes** (tokens da marca, setas em ink) — ações primárias.
- **Escalonamento responsivo** da roda em telas médias (breakpoint intermediário).

## Dependências / bloqueios

- REALIZA-18 (componente/overlay — já existe a base; o overlay e este layout convivem no mesmo SVG).
- REALIZA-137: variante de mockup decide labels-ao-redor × grade-2-col.
- BLOCKER: mockup 137 ainda não rodou? Se não, a decisão (a)×(b) fica pendente — a implementação só começa com a variante escolhida.

## Esforço: **P** (UI only)

## Riscos

- 16 labels ao redor podem colidir/estourar em viewports ~1024px — a grade 2 col é fallback seguro.
- Regressão no payload de resposta e no `instrumento-resultado` (aceite explícito da issue).
