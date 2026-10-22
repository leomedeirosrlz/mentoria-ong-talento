# REALIZA-28 — Calendário da agenda com discos/marcadores/painel

- **Jira:** [REALIZA-28](https://kelyng.atlassian.net/browse/REALIZA-28)
- **Veredito:** **FEITO** — evidência abaixo. Recomendo fechar no Jira.
- **Docs:** só este README.

## O que a issue pede

Aba calendário em `/agenda` com discos de status, marcador de data oficial,
popup/painel por dia e visualização de disponibilidade.

## Evidência

`src/components/agenda-calendario.tsx` — o componente inteiro entrega a
spec:

- **Discos por status** — encontro agendado/realizado/etc. como disco no dia;
  a legenda (`LegendaAgenda`, `:3823-3902`) explica cada um.
- **Marcador de data oficial** — o dia oficial do `ciclo_eventos` é ancorado
  visualmente (disco maior vs. dot da data real que a dupla marcou); os
  comentários do componente descrevem explicitamente o comportamento "fora
  do dia oficial".
- **Popup/painel por dia** — clique no dia abre detalhe com os itens
  daquele dia.
- **Disponibilidade** — grade de disponibilidade dos dois lados visível
  (swatch próprio na legenda).
- **Ações por estado** — os itens do painel levam aos gestos relevantes
  (registrar, detalhar, agendar).
- **Recesso/eventos do ciclo** — feriados e eventos aparecem como marcadores
  próprios (na legenda).

`EncontroDetalheDialog` (`encontro-detalhe-dialog.tsx`) cobre o "detalhe do
encontro" clicado a partir do calendário/ficha.

## Escopo restante

Nenhum. Fechar no Jira.
