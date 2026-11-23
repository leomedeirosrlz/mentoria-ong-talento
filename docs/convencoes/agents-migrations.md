# Migrations e agentes — regra local

**Decisão:** 23/nov/2026 · **Vale para:** Devin, Claude, subagents e qualquer agente que trabalhe neste repo.

## Regra

Agentes **não criam, editam nem aplicam migrations**. Eles podem apenas **sugerir** SQL e explicar a necessidade.

- Proibido criar/alterar arquivo em `supabase/migrations/`.
- Proibido rodar `supabase db push`, `supabase migration up`, `psql`, `ALTER/UPDATE/INSERT` de schema ou qualquer escrita no ledger de migrations.
- A sugestão vai como texto no comentário da issue, no `research.md`/`plan.md` da spec ou no relatório do agente, com:
  - objetivo e invariantes;
  - DDL/DML proposto;
  - impacto em RLS, grants, dados existentes e rollback;
  - ordem em relação a outras migrations.
- O **lead/orquestrador** revisa o schema real (`information_schema`, `pg_policies`, `pg_enum`), decide o número livre, escreve o arquivo final e aplica no ambiente autorizado.
- Aplicação em staging/produção só com autorização explícita do Thiago. Nunca no meio do backlog, nunca em produção por agente.

## Exceções desta rodada (mantidas para revisão)

O Thiago autorizou **manter** o que já foi produzido, mas tudo entra na revisão do lead antes de integração:

| Migration | Origem | Estado | Revisão pendente |
|---|---|---|---|
| `0223_pdm_metas_extras.sql` | agente 011 (PDM) | arquivo no worktree `wpdm3`; aplicada **só no Supabase local** | revisar template/campos, RLS, projeção `meta_1..10`, rollback e numeração |
| `0224_plano_aceite_bilateral.sql` | agente 013 (ficar em dia) | arquivo no worktree `wemdia3`; **não aplicada** no local | revisar aceite bilateral, ritmo 1..7, supervisor, expiração e policies |

- Hashes registrados em 23/11/2026:
  - `0223`: `440e4e5d36d0f04525ee1e885592e17d053f9e2de35baeeb02c4abb65d68ca61`
  - `0224`: `4b2b77a4b67ed6da26354670feca763ff9cd1128ef5c1ca50acbca444588cf9f`
- `0223` aparece no ledger local; `0224` ainda não.
- Nenhuma das duas foi para staging/produção.
- A integração só começa depois de o lead revisar e assumir os arquivos.

## Brief futuro

Todo brief de agente deve conter, literalmente:

> Não crie, edite nem aplique migrations. Se precisar de schema, escreva a sugestão de SQL na issue/spec e pare nesse ponto. O lead escreve e aplica a migration.

## Por quê

Migrations são o ponto de maior risco: numeração, RLS, dados existentes, ledger e ambientes. Dois agentes podem escolher o mesmo número (foi o que aconteceu com 0223) ou aplicar algo que o outro ainda não conhece. A revisão central evita drift e perda de controle.
