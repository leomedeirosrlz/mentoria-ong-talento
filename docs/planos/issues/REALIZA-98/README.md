# REALIZA-98 — Vínculo direto DPP→especialista: `duplas.dupla_dpp_id` self-FK

**Jira:** REALIZA-98 · **Tier:** A · **Status:** aberta — proposta validada com ressalvas (ver Decisão)

## Contexto

Uma dupla de especialista (`trilha='especialista'`) sempre nasce de um pedido
em `solicitacoes_especialista`, que já guarda `dupla_dpp_id` = a dupla DPP
("dupla de jornada") do mesmo jovem — `supabase/migrations/0074_solicitacao_v2.sql`
(`solicitacao_integridade`, 0086:46-114, garante `mentorado` consistente e
trilha `'dpp'` quando `origem='mentor'`). A relação DPP→esp, porém, **só
existe na solicitação**: a dupla esp criada em `sol_efetivar` grava
`solicitacao_id` mas não aponta direto pra dupla-mãe — insert atual em
`supabase/migrations/0101_especialistas_globais.sql:211-217`.

Hoje o código atravessa a solicitação pra achar a dupla-mãe:

- `queries-especialista.ts` `getSolicitacoesDaDupla(duplaDppId)` — a ficha DPP
  lista pedidos filtrando `solicitacoes_mural.dupla_dpp_id` (~:83-110);
- `actions-encerramento.ts` — no encerramento esp consulta a solicitação pela
  `dupla_id` e usa `dupla_dpp_id` pra revalidar a rota da ficha DPP;
- `0101_especialistas_globais.sql:174,190` — `sol_efetivar` deriva
  `turma`/`cronograma_id` da dupla DPP **lendo a solicitação**.

A issue propõe `duplas.dupla_dpp_id` (self-FK) pra virar a fonte da relação.

## Decisão de planejamento (recomendada — não precisa de Thiago)

**Adotar a coluna**, com escopo honesto: o ganho não é performance (as duas
travessias atuais são baratas e por índice), é **integridade declarativa +
queries diretas**:

- `rematch_dupla` hoje **perde a linhagem DPP→esp**: a herdeira nasce com
  `solicitacao_id` nulo (`0105_review_fixes.sql:487-497` copia campos
  fixos; solicitação fica apontando pra dupla encerrada). Com a coluna, a
  herdeira herda `dupla_dpp_id` — a ficha DPP continua achando a trilha esp
  mesmo depois de remanejos.
- O lookup "qual a dupla-mãe desta trilha?" vira `select dupla_dpp_id` em vez
  de join em `solicitacoes_especialista` com filtro de status.
- Backfill é 1 UPDATE (toda dupla esp viva tem solicitação com
  `dupla_id`+`dupla_dpp_id` populados — `solicitacao_integridade` garante).

**Não remover** `solicitacoes_especialista.dupla_dpp_id`: é a proveniência do
pedido (quem pediu, de qual dupla, quando) e alimenta o mural/triagem. As duas
colunas coexistem — a da solicitação é histórico do pedido; a da dupla é o
vínculo operacional vivo.

## Pontos de implementação

- Migration **[NOVO]** `0106_dupla_dpp_id.sql` (próximo número livre —
  `0063` do texto da issue já é `0063_dupla_remanejada_de.sql`; último
  arquivo hoje = `0105_review_fixes.sql`):
  `duplas.dupla_dpp_id uuid references duplas(id) on delete set null` +
  CHECK `dupla_dpp_id is null or trilha='especialista'` (reforço do
  `duplas_encerramento_esp`) + `check (dupla_dpp_id is distinct from id)` +
  índice parcial `where dupla_dpp_id is not null` + backfill via
  `solicitacoes_especialista`.
- `sol_efetivar` (rewrite do corpo de 0101): gravar `dupla_dpp_id =
  s.dupla_dpp_id` no insert — atômico dentro do RPC, **sem trigger nova**.
- `rematch_dupla` (rewrite de 0105): copiar `antiga.dupla_dpp_id` na
  herdeira.
- `createDupla` (`actions.ts:748-816`): o path coord já busca a DPP mais
  recente do jovem pra derivar `turma` (`.select("turma")`); estender pra
  `"id, turma"` e gravar `dupla_dpp_id = dpp.id ?? null`. Quando não há
  dupla DPP, a coluna fica nula — legítimo (pedido pode existir sem dupla
  DPP ativa, vide comentário de turma em 0101:167-171).
- `updateDupla`: não precisa — trilha não é editável pelo dialog.
- Consumidores novos (opcional no mesmo PR): `actions-encerramento` passa a
  ler `dupla_dpp_id` da dupla com fallback na solicitação; ficha esp pode
  exibir link "a pedido da dupla de <mentor DPP>" via `getDuplaVinculo`.
- Tipos: `Dupla.dupla_dpp_id?: string | null` em `types.ts:479-505` +
  regen `database.types.ts` (CI schema-contract).
- Demo: `demo/data.ts` já tem `solicitacoes_especialista.dupla_dpp_id`;
  espelhar nos objetos `Dupla` esp do dataset (campo opcional no tipo).

## RLS / exposição

`duplas` segue com RLS por vínculo — coluna extra **não muda policies**
(mentorado já lê a própria dupla esp; a coluna é um uuid sem dado pessoal).
`jovem_duplas` view: se ela projeta colunas explicitamente, **não expor** a
coluna nova (jovem não precisa saber a dupla-mãe — decisão conservadora,
barata). Coord/staff leem pela tabela/views existentes.

## Dependências

- Nenhuma dura. Ressonância com REALIZA-159? Nenhuma.
- E2E: spec existente de trilha esp continua passando (só adiciona coluna);
  novo assert da relação pós-rematch.

## Esforço

**M** — 1 migration com backfill + 2 rewrites verbatim de RPC + 1 linha de
action + tipos. Risco baixo-médio: o rewrite de `sol_efetivar` (0101, 524
linhas) e `rematch_dupla` (0105) tem que ser verbatim + delta cirúrgico.
