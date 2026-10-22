# REALIZA-172 — nota de dados sensíveis

- **Item 1 (`atribuido_nome` no jovem)**: o nome do responsável é dado de
  staff exposto a menor. A recomendação (renderizar) é disclosure mínimo —
  primeiro nome apenas; se a decisão for esconder, remover o fetch batched
  do ramo jovem é a opção LGPD-correta (não coletar o que não se usa).
- **Item 4 (`/assinar/[token]` faixa demo)**: página pública que recebe dados
  civis (CPF, endereço — `mentorados.dados_civis`, coord-only). A faixa demo
  previne que um token real seja "testado" por visitante do `/demo`; nada de
  PII aparece no banner.
- **Item 5 (`outra_pessoa` demo)**: o ramo existe exatamente pra impedir que
  usuário logado veja dados de assinatura de outra pessoa — o stub demo deve
  devolver identidade mismatch sem vazar `dados_civis` (o stub já trabalha
  com fixture próprio, não com dados reais).
- **Item 7 (expirado terceiros)**: se a RPC passar a fazer flip lazy de
  status, garantir que o `UPDATE` é scoped ao token tocado (`p_token`) —
  security-definer, nunca bulk update.
