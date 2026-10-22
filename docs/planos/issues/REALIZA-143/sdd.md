# REALIZA-143 — SDD (leve — decisão é de layout)

## Decisões técnicas

- **Breakpoint hook vs CSS**: labels por `<text>` SVG só em `lg:` — a forma
  mais limpa é CSS (`<g class="hidden lg:block">`) — evita hook de viewport
  e hydration mismatch (SSR renderiza ambos, CSS decide). Se colisão de
  texto exigir medida real de largura, aí sim um `useMediaQuery` client-only
  com fallback "sem labels" no SSR. Preferir CSS.
- **Rótulos ao redor**: posição = mesmo cálculo polar do vértice, raio +
  offset; `text-anchor` = `start`/`end` por hemisfério; `dominant-baseline`
  middle; quebra em 2 `<tspan>` por `\n` quando label > N chars (os rótulos
  do guia cabem em ≤2 linhas; truncar com `…` além disso, `title`/`<title>`
  com o nome completo).
- **Grade 2 col**: a lista de sliders existente (agrupada por quadrante)
  vira `grid sm:grid-cols-2` dentro de `lg:` — sem duplicar markup;
  `grid-template-areas` por quadrante mantém a ordem do guia.

## Trade-offs

| | labels-ao-redor | grade 2 col |
|---|---|---|
| parecido com o PDF | ✅ muito | parcial |
| colisão 1024px | alto risco | nenhum |
| custo | médio (geometria) | baixo (CSS) |
| leitura durante ajuste | label sempre à vista | mesma |

Decisão registrada no mockup 137; recomendação default = grade (B) com
labels-ao-redor como progressivo (`xl:`+) se couber sem colisão.

## Invariantes

1. Payload de resposta idêntico — nenhum `campo_id` muda.
2. `instrumento-resultado` compartilha o SVG — a variante de labels vale
   pros dois modos; o overlay da REALIZA-18 convive (labels ficam fora do
   polígono).
3. Mobile não piora — experiência focada mantida (aceite da issue).
4. Controles −/+ e setas = ações primárias com tokens da marca.

## Performance

16 `<text>` extra no SVG — trivial. Nenhum estado novo.
