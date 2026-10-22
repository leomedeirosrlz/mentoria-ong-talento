# REALIZA-27 — "Agendar o Nº encontro" com número explícito

- **Jira:** [REALIZA-27](https://kelyng.atlassian.net/browse/REALIZA-27)
- **Veredito:** **FEITO** — evidência abaixo. Recomendo fechar no Jira.
- **Docs:** só este README (nada a planejar — já entregue).

## O que a issue pede

"Agendar o Nº encontro" — o dialog sabe qual passo é e o rótulo deixa claro.

## Evidência

- `AgendarEncontroDialog` recebe `numero`/`proximoNumero` explicitamente e
  abre com o título **"Nº encontro"** — o nº é o sujeito do dialog
  (`src/components/agendar-encontro-dialog.tsx`).
- O trigger padrão do dialog é "Agendar encontro" e os call-sites passam o
  `numero` correto por contexto (ficha, cards, agenda).
- `trilha-jornada.tsx:258-263` — o nó do encontro na jornada **deep-linka**
  pra `/duplas/{id}#registrar-{encounter.id}` quando a row existe: clicar no
  passo leva direto ao card daquele encontro, não a um dialog genérico.
- A aba por-mentorado e o calendário abrem o dialog no contexto da dupla
  correta — o número vem da `proximoNumero`/`encontroAlvo` daquela dupla.

## O que já não é mais débito

A issue nasceu quando "Agendar encontro" era genérico — hoje o número está
sempre no contexto (título do dialog = "Nº encontro", deep-link por passo,
`numero` como prop obrigatória). Nenhum caminho abre o dialog sem saber qual
encontro é.

## Escopo restante

Nenhum. Fechar no Jira.
