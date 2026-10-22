# REALIZA-167 — critérios de aceite

## Seed / compatibilidade

1. `/resumo/t2-x7k4m9qf2w8j` continua renderizando o resumo de T2 após o
   deploy — o gate agora consulta `relatorio_links` e o seed cobre o slug.
2. `/resumo/qualquer-coisa` → 404 (inexistente) e slug com `revogado_em`
   setado → 404 idêntico (não revela que existiu).
3. O relatório T2 (interno e público) mostra as **mesmas** 4 linhas "Sem
   dupla" de antes — fila agora vem de `turma_inscricoes`, resultado igual.
4. `grep -rn "RESUMO_SLUG_T2\|FILA_T2_" src/` → 0 ocorrências (constantes
   removidas do runtime; o valor vive na migration).

## Parametrização real (a prova da issue)

5. `insert into relatorio_links (turma) values ('T3 · 2027')` → o slug gerado
   abre `/resumo/<slug>` com dados de T3 (ou "sem dados" se a turma ainda não
   tem duplas) — **zero commit**.
6. Inscrições `aguardando` de T3 aparecem como "Sem dupla" no relatório de
   T3 e **não** no de T2.
7. Inscrito que ganhou dupla ativa some da fila (regra `ativos*` existente);
   `status='desistiu'` também some.

## Constraints

8. `insert` com `profile_id` **e** `mentorado_id` preenchidos → erro (XOR).
   `papel_esperado='mentor'` com `mentorado_id` → erro (coerência).
   Duplicar `(turma, pessoa)` → conflito unique.
9. `slug='t3'` (manual, <16 chars/fora do alfabeto) → CHECK barra.

## RLS

10. Coord: `select`/`insert`/`update`/`delete` em `turma_inscricoes` ok;
    `select` em `relatorio_links` ok. Mentor/supervisor: `[]` nas duas.
    Anon: negado nas duas (grants).
11. Escrita em `relatorio_links` via REST por authenticated → negada (v1 só
        service role/SQL; RPCs de gestão são a 170).

## Gates

12. `tsc`/`eslint`/`vitest` limpos + `database.types.ts` regen + schema-contract.
13. Vitest do `montarLinhas`: `fila` parametrizada (não hardcoded) — caso
    "outra turma não vaza" e "dupla ativa exclui" cobertos.
14. Smoke pós-merge em prod: o link T2 público responde e o interno
    `/relatorios` mostra fila igual.
