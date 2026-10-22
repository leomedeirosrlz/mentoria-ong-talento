# REALIZA-98 — sdd.md (schema & dados)

## DDL proposta [NOVO]

```sql
-- 0106_dupla_dpp_id.sql — REALIZA-98: vínculo direto esp→DPP em duplas.
-- A solicitação segue dona da proveniência do pedido; esta coluna é o
-- vínculo operacional vivo (sobrevive a rematch).
alter table public.duplas
  add column if not exists dupla_dpp_id uuid
    references public.duplas(id) on delete set null;

alter table public.duplas
  add constraint duplas_dpp_pai check (
    dupla_dpp_id is null
    or (trilha = 'especialista' and dupla_dpp_id is distinct from id));

create index if not exists duplas_dpp_pai_idx
  on public.duplas(dupla_dpp_id) where dupla_dpp_id is not null;

-- backfill idempotente: uma solicitação aceita por dupla esp
update public.duplas d
   set dupla_dpp_id = src.dupla_dpp_id
  from (
    select distinct on (s.dupla_id) s.dupla_id, s.dupla_dpp_id
      from public.solicitacoes_especialista s
     where s.dupla_id is not null and s.dupla_dpp_id is not null
     order by s.dupla_id, s.respondida_em desc nulls last
  ) src
 where d.id = src.dupla_id and d.dupla_dpp_id is null;
```

## Escritas (todas dentro de RPC definer existente — sem trigger nova)

| Escritor | Delta | Arquivo-base do rewrite |
|---|---|---|
| `sol_efetivar` | `dupla_dpp_id` no insert = `s.dupla_dpp_id` | `0101_especialistas_globais.sql:206-235` |
| `aceitar_solicitacao` | idem, **se** ainda gerar dupla (conferir versão viva) | `0074_solicitacao_v2.sql:580+` |
| `rematch_dupla` | herdeira recebe `antiga.dupla_dpp_id` | `0105_review_fixes.sql:392+` (insert em :318-326) |
| `createDupla` (action) | `dupla_dpp_id: dpp?.id ?? null` | `src/lib/actions.ts:748-816` |

Nenhum desses caminhos pode escrever mãe inválida: `s.dupla_dpp_id` foi
validado como dupla DPP do mesmo jovem por `solicitacao_integridade`
(0086:98-103); `createDupla` busca explicitamente `trilha='dpp'` do mesmo
`mentorado_id`. Escrita direta por outro caminho é impossível — `duplas`
não tem INSERT pra authenticated fora do RPC coord (RLS).

## Leitura / RLS

- Sem policy nova: quem lê a dupla lê a coluna (uuid neutro).
- `jovem_duplas` (view do mentorado): omitir `dupla_dpp_id` na projeção —
  conferir definição atual e reescrever se `select *`.
- Grants: nenhum (coluna herda grants da tabela).

## Dados / backfill

- Cobertura esperada: 100% das duplas esp com solicitação aceita.
- Rows órfãs de backfill (dupla esp criada por `createDupla` coord antes da
  feature, sem solicitação): ficam `null` — aceitável e sinaliza "sem mãe
  conhecida"; documentar no release note.

## Tipos gerados

`database.types.ts` — regen contra staging pós-push (CI schema-contract
falha antes disso). `src/lib/types.ts` `Dupla` (+`dupla_dpp_id?: string |
null`) — opcional pra não quebrar demo fixtures até popular.
