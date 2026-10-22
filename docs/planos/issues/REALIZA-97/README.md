# REALIZA-97 — Duplicata de REALIZA-22

- **Jira:** [REALIZA-97](https://kelyng.atlassian.net/browse/REALIZA-97)
- **Veredito:** **DUPE** — clone de [REALIZA-22](../REALIZA-22/README.md)
  (polish de agendamento: posição do Agendar + microcopy).
- **Recomendação:** fechar esta issue no Jira como duplicata — o trabalho é
  planejado uma única vez em REALIZA-22.

## Por que é a mesma coisa

Os dois pedidos são o mesmo recorte: "Agendar encontro" acessível quando há
pendência de registro (não enterrado no "Mais") + microcopy explicando que
data oficial é sugestão. Mesmo componente
(`AgendarEncontroDialog`), mesma superfície (header da ficha + `/agenda`).

O plano canônico está em
[REALIZA-22/plan.md](../REALIZA-22/plan.md): remover o `maisItens.push` do
ramo `pendenteRegistro` (`page.tsx:566-583`), renderizar o Agendar sempre
visível quando `podeAgendar` (primário sem pendência, outline ao lado do
Registrar com pendência) e a linha "oficial = sugestão" nas superfícies do
mentor.

## Escopo restante

Nenhum aqui — ver REALIZA-22.
