# REALIZA-177 — aceite

- Dado o inventário do PR, quando reviso, então toda instância de
  `DialogContent` está na tabela com largura atual + degrau novo —
  **nenhum** dialog ficou fora do sweep.
- Dado `registros-filtros` aberto em `sm+`, quando meço, então a largura é
  `max-w-md` e o conteúdo preenche — sem fundo ocioso lateral.
- Dado qualquer dialog de form de 1 coluna, quando abro, então a largura é
  `md` ou menor — `lg`+ só com justificativa na tabela.
- Dado `evento-cronograma`/`jornada-rever`/`instrumentos-dupla`, quando o
  conteúdo excede a viewport, então o scroll vem **só** da base
  (`calc(100dvh-2rem)`) — nenhum `max-h` por instância.
- Dado cada dialog, quando abro, então `DialogTitle` + `DialogDescription`
  estão presentes (a11y) — auditoria do passo 3 sem pendências.
- Dado mobile (`<sm`), quando abro qualquer dialog, então a largura é a
  da base (`calc(100%-2rem)`) — o sweep não quebrou o responsivo.
- Dado `importar-registros` (tabela de prévia), quando abro, então ou
  permanece `6xl` **justificado** na tabela ou foi rebaixado com a prévia
  legível — decisão documentada, não arbitrária.
- E2E: suite demo + app verde — nenhum spec de dialog quebra
  (formularios, solicitacao-esp, operacional, jovem-* etc.).
