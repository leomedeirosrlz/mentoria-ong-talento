# REALIZA-143 — Design

## Persona / JTBD

- **Jovem respondendo no desktop** (casa, biblioteca, escola): "quero ver o
  mapa inteiro como no papel — não descobrir eixo por eixo".
- Mobile segue focado (aceite explícito).

## Hierarquia da tela (desktop `lg:`)

```
┌──────────────────────────────────────────┐
│ Título da estação + instrução  (fundo branco, fora do card de controle) │
├──────────────────────────────────────────┤
│ ← anterior   Eixo 7 de 16 · Família   próximo →   (linha própria, acima)│
├──────────────────────┬───────────────────┤
│                      │  Quadrante · Self │
│      RODA SVG        │  ○ slider área 1  │
│   (labels ao redor   │  ○ slider área 2  │
│     ou limpa)        │  Quadrante · …    │
│                      │  (2 col de sliders)│
├──────────────────────┴───────────────────┤
│      −  [ 7 ]  +      (controles verdes) │
└──────────────────────────────────────────┘
```

Variante A (labels-ao-redor): a roda ocupa mais largura, grade de sliders
permanece abaixo/lado como reforço. Variante B: roda limpa à esquerda,
grade nomeada à direita — **a fazer agora** = ajuste rápido sem tocar a
roda.

## Mobile (`<md`) — inalterado

Card de foco por eixo + roda compacta + lista. Nenhuma regressão.

## Detalhes pedidos na issue

- **Título**: sai do card lime → header próprio `bg-card`/`bg-background`
  separado dos controles (o card lime vira só "área de ajuste").
- **Nav própria**: setas anterior/próximo em linha própria **acima** da
  linha −/+ — ordem de leitura: navegar → ajustar.
- **Cores**: − / + / setas = `bg-[var(--brand-lime)]` com
  `text-[var(--brand-ink)]` (ink nas setas, como pede a issue) —
  `hover`/`active` com leve elevação; `disabled` muted.
- **Escalonamento**: `md` (768–1024) — verificar quebra atual; roda
  `max-w` intermediário e labels desligadas até `lg`.

## Reuso (`src/components/ui/` + instrumentos)

- `Button`/`Badge`/`Slider`(se existir na base — a lista usa input
  `type="range"` estilizado já existente em `roda-vida.tsx`) — reusar.
- Setas: `CaretLeft`/`CaretRight` (Phosphor, já importados).
- Nenhum componente novo: layout por `cn()` + grid.

## Microcopy pt-BR

- Nav: "Eixo {n} de 16 · {label}" / setas com `aria-label` "Área
  anterior"/"Próxima área".
- Ajuste: "−" `aria-label="Diminuir nota"`, "+" `aria-label="Aumentar nota"`.
- Quadrantes: nomes do guia (já presentes no form).

## Estados

- Sem alterações de estado funcional — a tela já trata
  vazio/loading/erro/sucesso em `flow.tsx`.
- `prefers-reduced-motion`: transições de foco existentes já respeitam —
  manter.

## a11y

- Ordem de tabulação: nav → roda (se interativa por teclado) → −/+ →
  sliders (os sliders **já** são a interface acessível completa — labels
  visuais não criam segunda fonte de verdade: `<text>` decorativo com
  `aria-hidden`, a lista de sliders cobre leitores de tela).
- Contraste dos rótulos externos ≥ 4.5:1.
