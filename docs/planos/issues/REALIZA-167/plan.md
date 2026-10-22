# REALIZA-167 — plano de implementação

Descrição essencial: parametrização mínima de turma. `relatorio_links` (slug,
turma, revogação — versão sem senha; a 170 altera depois) passa a ser o dono
do slug público hoje hardcoded como `RESUMO_SLUG_T2`; `turma_inscricoes`
substitui `FILA_T2_*` e generaliza a regra "sem dupla → linha Sem dupla" do
`montarLinhas` pra qualquer turma. Modelo Programa→Turma completo = 47
(fora de escopo).

## Passo 0 — referências

- `src/lib/relatorio.ts:5` (`RESUMO_SLUG_T2`), `:239-243` (`FILA_T2_*`),
  `:339-372` (bloco da fila por turma), `montarLinhas` (:245).
- `src/app/resumo/[slug]/page.tsx:34` — gate atual.
- `src/app/(app)/relatorios/relatorio-builder.tsx:187` — `linkCompartilhavel`.
- `supabase/migrations/0085_profile_papeis.sql` — `escopo_turma` (staff) —
  **não** confundir com `turma_inscricoes` (participantes).
- `0032_anon_sem_leitura.sql` — anon zero grants.
- `pgcrypto` em 0001 (`gen_random_bytes` pro slug default).
- `_issues.json` REALIZA-47 — ponte documentada no sdd §5.

## Passo 1 — migration `0107_turma_parametrizacao.sql` (número indicativo)

1. `create table public.relatorio_links` + `turma_inscricoes` (DDL sdd §1-2).
2. Grants: `revoke all from public, anon` nas duas; `grant select` +
   policies coord-only em ambas; `turma_inscricoes` também
   `grant insert, update, delete to authenticated` + policies coord
   (`for all using (my_role()='coordenacao')` — gestão por REST/SQL enquanto
   não há UI; `relatorio_links` escrita **não** via REST — v1 por SQL
   service role; a 170 adiciona RPCs de gestão).
3. Seed: slug T2 em `relatorio_links` + as 4 inscrições `FILA_T2_*` em
   `turma_inscricoes` (ids verbatim do relatorio.ts:239-243).
4. Sem alter em `notificacoes`/enums — nada dispara notificação aqui.

## Passo 2 — `src/lib/relatorio.ts`

- `export type InscricaoFila` + `montarLinhas` com `opts.fila` (sdd §3).
- Deletar `FILA_T2_*` e o `if (cfg.turma === "T2 · 2026/2027")`.
- Manter `RESUMO_SLUG_T2` **removido** — grep final deve zerar referências
  (o valor vive no seed da migration).
- Testes Vitest `tests/relatorio.test.ts`: ajustar os que cobrem a fila pra
  passar `fila` explícita; adicionar caso "fila de outra turma não aparece"
  e "inscrito com dupla ativa some".

## Passo 3 — queries + consumidores

- `queries.ts`: `getTurmaInscricoesAguardando(turma)` (`React.cache`) +
  `getResumoLink(turma)` (select slug não-revogado da turma).
- `src/app/(app)/relatorios/page.tsx`: carregar `inscricoes` pra turma
  selecionada → passar `fila` ao builder/montarLinhas.
- `src/app/resumo/[slug]/page.tsx`: gate por `relatorio_links` (sdd §4) +
  fila via admin query? A página pública usa `createAdminClient` já — mesma
  query `turma_inscricoes` filtrada pela turma do config.
- `relatorio-builder.tsx`: `linkCompartilhavel` usa `getResumoLink(turma)`
  — prop nova ou contexto da page (decidir no PR: a page já carrega por
  turma? Se o builder permite trocar turma client-side, a lista de slugs por
  turma vem como prop `slugsPorTurma: Record<turma,slug>`).

## Passo 4 — T3 runbook (doc, não código)

No README ou `docs/runbook-turma.md` [NOVO, pequeno]: "T3 entra →
`insert into relatorio_links (turma) values ('T3 · 2027')` → anotar slug →
inscrever fila → criar cronograma pela UI/SQL → compartilhar link".
Zero commits pra ligar T3.

## Passo 5 — gates + rollout

1. Migration → staging → validador REST `_valida_0107a_rest.mjs` [NOVO]:
   coord gerencia inscrições; mentor lê `[]` nas duas tabelas; anon nega.
2. Regen `database.types.ts`; `tsc`/`eslint`/`vitest` verdes.
3. Migration em prod antes do merge.
4. Smoke pós-merge: `/resumo/t2-x7k4m9qf2w8j` renderiza igual (seed), slug
   inventado 404a, relatório T2 mostra as mesmas 4 linhas "Sem dupla".

## Rollback

Reverter código pras constantes (git revert) + `drop table` as duas — sem
dependências ainda (a 170 não existe). Se a 170 já mergeou, **não** dropar
`relatorio_links` — rollback vira só o revert de código.

## Questões em aberto

- UI de gestão de inscrições em v1? Decisão registrada: SQL/coord v1
  (policies já permitem); UI fica pra 47 ou follow-up — se o Thiago quiser
  UI já, o caminho é campo na ficha da pessoa (avaliar escopo no PR).
- `relatorio_links.revogado_em` sem UI ainda: revogação v1 via SQL
  (`update ... set revogado_em=now()`); a 170 entrega o botão.
