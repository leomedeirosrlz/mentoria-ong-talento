# REALIZA-64 — Link de formulário identifica destinatário errado

- **Jira:** [REALIZA-64](https://kelyng.atlassian.net/browse/REALIZA-64)
- **Veredito:** **FEITO** — evidência abaixo. Recomendo fechar no Jira.
- **Docs:** só este README.

## O que a issue pede

Quando alguém abre um link `/f/[token]` que não é pra ela, a tela diz isso —
não deixa responder o form de outra pessoa nem cai num erro genérico.

## Evidência

`src/app/(jovem)/f/[token]/page.tsx:144-155`:

- O token resolve o destinatário (`info.destinatario`).
- Quem abre com sessão de outra pessoa vê **"Este link é de outra pessoa"**
  com o contexto do destinatário — bloqueio explícito, não erro silencioso.

## Escopo restante

Nenhum. Fechar no Jira.
