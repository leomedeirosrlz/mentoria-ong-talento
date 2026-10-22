# REALIZA-98 — plan.md

## Objetivo

Tornar a relação "dupla de especialista pertence a uma dupla DPP (dupla de
jornada)" um fato declarativo em `duplas`, preservando
`solicitacoes_especialista.dupla_dpp_id` como proveniência do pedido.

## Estado atual (verificado)

| Ponto | Hoje | Arquivo |
|---|---|---|
| Relação DPP→esp | Só em `solicitacoes_especialista.dupla_dpp_id` | `0074_solicitacao_v2.sql`, `0086:50-54` |
| Insert da dupla esp | `sol_efetivar` grava `solicitacao_id`, não grava mãe | `0101_especialistas_globais.sql:211-217` |
| Turma/cronograma | Derivados de `s.dupla_dpp_id` dentro do RPC | `0101:167-193` |
| Rematch | Herdeira perde o vínculo com a DPP | `0105_review_fixes.sql:318-326` |
| Coord cria esp manual | Deriva `turma` da DPP mais recente, não grava mãe | `src/lib/actions.ts:748-816` |
| Consumidores | `getSolicitacoesDaDupla` filtra mural por `dupla_dpp_id`; encerramento esp lê a solicitação pra revalidar rota | `queries-especialista.ts:83-110`, `actions-encerramento.ts` |
| CHECK trilha-esp | `duplas_encerramento_esp` (campos de encerramento só em esp) | `0074_solicitacao_v2.sql` |

## Passos

1. **Migration `supabase/migrations/0106_dupla_dpp_id.sql`** [NOVO]
   (cabeçalho padrão: idempotente, grants explícitos, comentários):
   ```sql
   alter table public.duplas
     add column if not exists dupla_dpp_id uuid
       references public.duplas(id) on delete set null;
   -- só trilha esp tem mãe; nunca aponta pra si
   alter table public.duplas
     add constraint duplas_dpp_pai check (
       dupla_dpp_id is null
       or (trilha = 'especialista' and dupla_dpp_id is distinct from id));
   create index if not exists duplas_dpp_pai_idx
     on public.duplas(dupla_dpp_id) where dupla_dpp_id is not null;
   -- backfill: solicitação já validada por solicitacao_integridade
   update public.duplas d
      set dupla_dpp_id = s.dupla_dpp_id
     from public.solicitacoes_especialista s
    where s.dupla_id = d.id
      and s.dupla_dpp_id is not null
      and d.dupla_dpp_id is null;
   ```
   - `on delete set null`: dupla DPP deletada não derruba a trilha esp
     (espelha a semântica de "origem", não de posse).
   - O CHECK não impõe que a mãe seja `trilha='dpp'` — cross-row CHECK não
     existe em Postgres; a garantia vem da escrita (RPCs copiam de fonte já
     validada por `solicitacao_integridade`, 0086:98-103).
2. **`sol_efetivar`** — `create or replace` do corpo de
   `0101_especialistas_globais.sql:206-218`, adicionando `dupla_dpp_id` na
   lista do insert e `s.dupla_dpp_id` nos values. Manter todo o resto
   verbatim (turma/cronograma/budget/avaliação). Revoke igual ao final.
3. **`rematch_dupla`** — `create or replace` do corpo de
   `0105_review_fixes.sql:392+`, adicionando `dupla_dpp_id` ao insert da
   herdeira com valor `antiga.dupla_dpp_id`. (Em rematch de DPP a coluna
   já é null; em esp preserva a mãe.)
4. **`aceitar_solicitacao`** — verificar se a versão viva ainda é a de
   `0074_solicitacao_v2.sql` (superada por `sol_efetivar` no fluxo mural) ou
   se permanece como path do mural; se continuar gerando dupla esp,
   aplicar o mesmo delta. Conferir `pg_get_functiondef` antes de escrever.
5. **`createDupla`** (`src/lib/actions.ts:748-816`): no branch
   `trilha === 'especialista'`, trocar `.select("turma")` por
   `.select("id, turma")` no lookup da DPP e incluir
   `dupla_dpp_id: dpp?.id ?? null` no insert.
6. **Consumidores** (mesmo PR ou follow-up pequeno):
   - `actions-encerramento.ts`: preferir `dupla.dupla_dpp_id` com fallback
     pra solicitação (rows antigas sem backfill são cobertas pelo update,
     mas o fallback é defensivo e barato).
   - Ficha esp: mostrar "Trilha a pedido da dupla de X" reusando
     `getDuplaVinculo(id)` — que hoje resolve `remanejada_de`; estender pra
     também resolver `dupla_dpp_id` (mesma shape `DuplaVinculo` +
     `kind: "mae"`). **Decisão de escopo:** se for cosmético demais, deixar
     pra follow-up — o essencial é schema+escritas.
7. **Tipos/demo:** `Dupla.dupla_dpp_id?: string | null` em `types.ts`;
   `database.types.ts` regen; `demo/data.ts` — popular o campo nas duplas
   esp do fixture (já existe o id correspondente nas solicitações demo).
8. **View `jovem_duplas`:** conferir a projeção — se `select d.*` implícito,
   reescrever listando colunas e omitindo `dupla_dpp_id` (menor exposição;
   o jovem não precisa da mãe). Se já lista colunas, nada a fazer.

## Casos de borda

- Dupla esp sem DPP (jovem pediu trilha sem jornada ativa): `null` — o
  CHECK permite; a ficha DPP não existirá pra mostrá-la mesmo.
- Backfill encontra 2+ solicitações com `dupla_id = d.id`: impossível —
  `solicitacao_integridade` exige `d.trilha='especialista'` + mesmo
  mentorado, e `sol_efetivar` grava uma solicitação por dupla; usar
  `limit 1`/distinct on por segurança no update.
- Rematch da DPP (não da esp): a mãe morre (`encerrada`) mas a esp filha
  continua apontando pra ela — **correto**: a origem era aquela dupla;
  `remanejada_de` resolve a cadeia pra frente se a UI precisar da mãe viva.
- Coord edita dupla esp via `updateDupla`: trilha e mentorado não mudam —
  nada a propagar.

## Verificação

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · migration no
staging (`db push --db-url`) antes do push da branch · schema-contract CI ·
REST staging: `select id,dupla_dpp_id from duplas where trilha='especialista'`
· e2e app: aceite de solicitação gera dupla com mãe; rematch esp preserva
mãe; ficha DPP ainda lista a trilha pós-rematch.
