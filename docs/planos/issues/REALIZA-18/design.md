# REALIZA-18 — Design

## Persona / JTBD

- **Jovem**: "refiz a roda no fim — quero VER o quanto mudei desde o
  começo".
- **Mentor DPP**: "no último encontro quero abrir a ficha e conversar sobre
  onde ela cresceu — visual, não planilha".
- **Coord/supervisor**: acompanhar evolução por dupla.

## Composição (reuso primeiro)

- `RodaSvg` existente + prop `valoresAnterior` — nenhum componente novo.
- Legenda: `Badge`/texto muted padrão — "— Inicial (enc. 1)" tracejado,
  "● Formal (enc. N)" lime preenchido.
- Delta: linha de resumo "Evolução média: +1,2 · maior salto em {área}" —
  computed por `resumoDelta`.
- `instrumento-resultado.tsx` já tem bloco Roda — o comparativo entra como
  variante quando `antes` existe.

## Visual do overlay

- **Depois (formal)**: polígono atual — fill `var(--brand-lime)` ~35%,
  stroke ink 2px, vértices com dot.
- **Antes (inicial)**: path fechado só com stroke tracejado
  (`stroke-dasharray: 4 3`, cor `muted-foreground`), fill ~8% — nunca
  compete com o preenchido.
- Pontos `null` (eixo sem par): o path recua ao centro naquele ângulo com
  opacidade reduzida; legenda nota "eixos sem comparação aparecem
  recolhidos" (caso raro — form editado).
- Títulos/copy:
  - Ficha: "Roda da Vida — antes e depois" + sub "Leitura do enc. 1
    (tracejado) × formal (preenchido)".
  - Jovem: "Sua roda: começo × agora" + "O tracejado é onde você estava —
    o preenchido é você hoje."

## Estados

- Só inicial respondida: render atual (sem overlay) + hint "o comparativo
  aparece quando a roda formal for respondida".
- Só formal (sem inicial — dupla importada): render normal + sem hint de
  comparação.
- Estrutura divergente entre momentos: overlay renderiza o que casa;
  eixos órfãos listados em nota abaixo ("2 áreas mudaram de nome entre as
  leituras").
- Mobile: overlay funciona (SVG escala); se labels ficarem densos demais,
  manter roda + legenda — decisão final com o trabalho de layout da
  REALIZA-143 (desktop mostra mais).

## a11y

- `role="img"` + `aria-label` descrevendo ambas as camadas.
- Tabela sr-only com antes/depois/delta por eixo (screen reader lê o que o
  SVG mostra).
- Não depender só de cor: tracejado × sólido já é canal redundante.
