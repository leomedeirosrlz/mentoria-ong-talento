# REALIZA-174 — aceite

- Dado `coordenacao` em `/duplas` (`lg+`), quando a lista carrega, então
  cada dupla ocupa ~1 linha (52-60px), sem espaço entre linhas
  (`divide-y`), com header de coluna alinhado.
- Dado sinais longos, quando a linha renderiza, então o texto trunca em 1
  linha com `title` completo — nenhuma linha quebra a altura.
- Dado `supervisor` em `/duplas`, quando a lista carrega, então o padrão
  denso é o mesmo da coord (linhas, não cards altos).
- Dado `mentor`/`especialista`, quando um card tem só 1 ação, então ela
  fica inline no header — sem `border-t` vazio no rodapé do card.
- Dado o `<details>` da massa fechado, quando olho a lista, então só as
  prioridades aparecem; aberto, `LinhaMini` ainda mais baixa.
- Dado mobile, quando uso `/duplas`, então os cards têm `p-3`, gaps `gap-2`
  — sem footer morto abaixo do botão de ação.
- Demo: cobertura em 4 papéis (specs `tests/e2e/demo/` de duplas).
