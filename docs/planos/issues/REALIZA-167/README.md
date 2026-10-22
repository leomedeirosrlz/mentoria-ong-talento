# REALIZA-167 — Parametrizar turma (T2→T3): links de resumo + `turma_inscricoes`

**Jira:** [REALIZA-167] "Parametrizar turma/ciclo (T2→T3): resumo_links +
turma_inscricoes" — "Turma nova hoje = migration + código"
**Tier:** B — README, plan, sdd, sdr (leve), acceptance. Sem design.md
(superfícies existentes; UI de gestão é da 170).
**Status:** ABERTO — T2 está hardcoded em `src/lib/relatorio.ts`
(`RESUMO_SLUG_T2:5`, `FILA_T2_*:239-243`, `cfg.turma === "T2 · 2026/2027"`
:339) e o modelo Programa→Turma completo é REALIZA-47 (fora de escopo aqui).

## Resumo

T3 chega e hoje exige commit: slug público novo, arrays de fila, seed de
cronograma. A issue cria o **degrau mínimo de parametrização** — duas tabelas,
sem refactor do modelo de ciclos:

1. **`relatorio_links`** [NOVO — ver decisão de nome] — versão mínima: `slug`,
   `turma`, `criado_por`, `revogado_em`, `created_at`. É o dono do slug
   público (hoje a constante). A 170 depois faz `alter table` com
   `senha_hash`/`config`/`expira_em` — por isso o nome já nasce como a 170 o
   quer (Jira da 167 diz `resumo_links`; o nome canônico é o da spec mais
   completa — **decisão do planejador**, documentada em `_done-R.md`).
2. **`turma_inscricoes`** [NOVO] — quem pertence a qual turma sem estar em
   dupla: `(profile_id | mentorado_id, turma, papel_esperado, status)`. Substitui
   `FILA_T2_*` (a fila de espera do relatório) e dá onde gravar "este mentor é
   da T3" antes do matching. **Não** substitui `profile_papeis.escopo_turma`
   (papéis de staff — coord escopada) nem `duplas.turma` (a dupla formada).

## Escopo concreto

- Migration com as 2 tabelas + RLS + seed T2 (slug + 4 inscrições da fila
  hardcoded).
- `montarLinhas` deixa de ler `FILA_T2_*`/`"T2 · 2026/2027"` hardcoded:
  passa a receber `inscricoes` (fonte: query nova `getTurmaInscricoes`) e
  aplica a regra "sem dupla ativa → linha 'Sem dupla'" pra **qualquer** turma
  — mesma lógica do :339-372, generalizada.
- `/resumo/[slug]` deixa de comparar com a constante: valida o slug contra
  `relatorio_links` (via query — a tabela ainda não tem senha; a verificação
  é "existe e não revogado"). Quando a 170 chegar, troca o check pra RPC.
- `ResumoLinkConfig`/`relatorio-builder`: `RESUMO_SLUG_T2` sai do frontend —
  o builder consulta o slug da turma selecionada (query `getResumoSlug(turma)`)
  pra montar o link; T3 passa a funcionar sem commit.
- Seeds de cronograma de T3 seguem manuais (cronograma é dado, não código —
  criar via SQL/UI existente; fora de escopo gerador de turmas).

## Ponte com 47

`turma_inscricoes.turma` é `text` como `duplas.turma` — quando a 47 criar
`turmas(id,...)`, a migração faz lookup `text→id` (mesmo caminho que
`duplas.turma` vai precisar). Não criar `turmas` aqui — proibido pelo Jira
("modelo completo fica pra 47").

## Dependências / interações

- **170**: a mesma tabela — ordem recomendada 167 → 170 (170 faz alter add
  senha/config); se 170 vier primeiro, 167 só adiciona `turma` + seed.
- **183**: `resumo_acessos` referencia o slug por valor — sem coupling.
- **47**: ponte documentada, sem implementar.
- `montarLinhas` é usada pelo `/resumo` público, `/relatorios` interno e
  futura RPC da 170 — a assinatura nova tem que servir aos três.

## Esforço: M

Duas tabelas + generalização de `montarLinhas` + swap do gate do `/resumo` +
backfill T2 + testes. Sem superfície nova de gestão (a da 170 cobre links;
inscrições v1 = insert via SQL/coord — **BLOCKER menor**: se inscrição
precisa de UI já em v1, a UI mínima é um campo na ficha da pessoa — registrar
como decisão: v1 via SQL, UI fica pra 47 ou follow-up).

## Riscos

- **Fila por turma errada** — `turma_inscricoes.turma` é texto livre: CHECK
  não impede typo ("T3" vs "T3 · 2027"). Mitigação: inserções v1 via SQL com
  a string exata da turma; validar com query de distinct turmas antes do
  insert.
- **Slug de T3 esquecido** — sem link na tabela, `/resumo/<slug-t3>` 404a
  (comportamento certo: opt-in por turma).
- **Dupla contagem** — inscrição + dupla ativa: a regra `!ativosX.has(id)`
  existente já exclui quem tem dupla — generalizar mantém isso.
- **anon e relatorio_links** — o check de slug do `/resumo` roda server-side
  via admin/RPC; anon nunca lê a tabela diretamente (mesmo gate da 170).
