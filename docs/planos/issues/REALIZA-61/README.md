# REALIZA-61 — Copy orientada ao executor (mentor faz, não "sistema faz")

- **Jira:** [REALIZA-61](https://kelyng.atlassian.net/browse/REALIZA-61)
- **Veredito:** **FEITO** — evidência abaixo. Recomendo fechar no Jira.
- **Docs:** só este README.

## O que a issue pede

Microcopy que fala com quem executa — CTAs na voz do mentor ("como foi"),
não em voz de sistema ("registro não encontrado").

## Evidência

- `agenda-calendario.tsx` — CTA do encontro passado sem registro:
  **"Como foi o Nº encontro"** — pergunta que o mentor se faz, não ordem de
  sistema.
- `encontro-detalhe-dialog.tsx` — estado sem registro:
  **"Sem registro: o mentor ainda não contou como foi"** — explica a
  pendência na perspectiva humana, não "404 de dados".
- Botão **"Registrar como foi"** — a ação nomeia o gesto (contar como foi),
  não o objeto ("salvar registro").
- `EncontroRow`/header: **"Registrar encontro"** quando pendente — o CTA
  primário é a ação do mentor.

## Escopo restante

Nenhum. Fechar no Jira.
