# REALIZA-175 — nota de dados sensíveis

- `registros` contêm follow-ups de mentores sobre encontros com **menores** —
  o agrupamento não muda escopo: RLS por papel segue valendo (mentor vê as
  próprias, coord tudo). Nenhum campo novo é exposto.
- `?grupo=`/`?q=` em URL: termos de busca podem conter nomes de mentorado —
  a URL é same-origin e protegida pelo middleware de auth; **não** logar
  `q` em analytics externo (a verificar se existe algum — o repo não usa
  tracker externo no app interno; manter assim).
- Headers de grupo mostram nomes de dupla — já aparecem no `RegistroCard`;
  sem disclosure novo.
