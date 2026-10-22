# REALIZA-26 — Plano de implementação

Ordem: **migration primeiro** (tabela + trigger + RLS), depois queries,
depois UI. Aplicar no staging antes do push da branch (regra de CI:
schema-contract quebra sem a coluna no remoto).

## Passo 0 — checar o schema real antes de escrever SQL

Contra o banco alvo (regra AGENTS: nunca DDL de memória):
- `information_schema.columns` em `encontros` — confirmar `data_hora`,
  `motivo_reagendamento`, `status`, `unique(dupla_id, numero)`.
- `pg_policies` em `encontros` — confirmar que `update`/`delete` existem e
  quem escreve (0098 + 0047 delete coord-only — o DELETE trigger precisa
  estar ciente de quem pode deletar).
- `pg_get_functiondef` em `my_role()`/`my_profile_id()` — assinatura exata.
- Definição atual de `desmarcar_encontro` (0072) — confirma se ela DELETE a
  row ou só UPDATE status (a :301-329 indica DELETE da row futura; validar).

## Passo 1 — `supabase/migrations/0107_encontro_reagendamentos.sql` [NOVO]

Estilo da casa (0094 header, `security definer`, `search_path`, grants,
`if not exists`):

1.1. `create table if not exists encontro_reagendamentos` — colunas exatas do
[sdd.md](sdd.md#decisão-3):
`id uuid pk default gen_random_uuid()`,
`dupla_id uuid not null references duplas(id) on delete cascade`,
`numero smallint not null`,
`de_data_hora timestamptz`,
`para_data_hora timestamptz`,
`motivo text`,
`motivo_detalhe text`,
`acao text not null check (acao in ('agendado','remarcado','desmarcado'))`,
`ator_id uuid references profiles(id) on delete set null`,
`ator_papel text`,
`origem text not null check (origem in ('acao_mentor','rpc_jovem','sql_direto'))`,
`created_at timestamptz not null default now()`.
Sem CHECK exigindo `para_data_hora`/`de_data_hora` por ação — a combinação
`de/para null` varia por `acao` e o trigger é a única escritora; um CHECK
complexo aqui só adiciona superfície de bug. Comentar a semântica por `acao`
no header da migration.

1.2. Índices: `(dupla_id, numero, created_at)` e
`(dupla_id, numero) where acao='remarcado'`.

1.3. `create or replace function origem_reagendamento()` [NOVO] `stable`
`security definer set search_path=public` — `my_role()` → `'rpc_jovem'` |
`'acao_mentor'` | `'sql_direto'`.

1.4. `create or replace function registrar_reagendamento_encontro()` [NOVO] —
corpo exato do [sdd.md](sdd.md#função-do-trigger) (security definer,
`search_path=public`).

1.5. `drop trigger if exists trg_encontro_reagendamentos on encontros;
create trigger trg_encontro_reagendamentos after insert or update of data_hora
or delete on encontros for each row execute function
registrar_reagendamento_encontro();`

1.6. `alter table encontro_reagendamentos enable row level security;`
policies:
- `encontro_reagendamentos_select` — `my_role()='coordenacao'` ou
  (`my_role()='mentor_dpp'` e `dupla_id` in minhas duplas) ou
  (`my_role()='supervisor'` e dupla supervisionada). **Sem** ramo mentorado
  nem `mentor_especialista` nesta versão.
- Nenhuma policy de insert/update/delete — a tabela é write-through-trigger
  (security definer bypassa RLS).

1.7. `grant select on encontro_reagendamentos to authenticated;` — sem insert/
update/delete pra ninguém. `grant execute` nas 2 funções só onde necessário
(o trigger chama internamente; grant pra `authenticated` nas funções não é
preciso se forem só-called-by-trigger — manter `revoke`/`no grant` pra RPC
direta: ninguém chama `registrar_reagendamento_encontro()` manualmente).

## Passo 2 — types e queries

2.1. `src/lib/database.types.ts` — regenerar do remoto **depois** de aplicar
a migration no staging (schema-contract).

2.2. `src/lib/queries.ts` — `historicoEncontro(duplaId, numero)`:
`.from('encontro_reagendamentos').select('id, numero, de_data_hora,
para_data_hora, motivo, acao, ator_papel, origem, created_at,
ator:ator_id(nome)').eq('dupla_id', …).eq('numero', …).order('created_at')`.
Com `React.cache` como as demais. `demoRole()` gate →
`historicoEncontroDemo`.

2.3. `src/lib/queries.ts` — `contagemRemarcacoes(duplaId)`:
`.select('numero').eq('dupla_id',…).eq('acao','remarcado')` → aggregate em
TS (count por numero) — PostgREST não tem `count` grouped limpo; o dataset é
pequeno (≤16 encontros/dupla).

2.4. `src/lib/demo/data.ts` — fixture: dupla demo com 2-3 linhas de histórico
no encontro 4 (agendado → remarcado ×2, motivos variados), IDs `de000000-*`.
`src/lib/demo/queries.ts` — `historicoEncontroDemo` filtrando o fixture;
`contagemRemarcacoesDemo` derivando.

## Passo 3 — UI

3.1. `src/components/encontro-detalhe-dialog.tsx` — bloco "Histórico de
agendamento" após o motivo atual (`:116-129`), mesmo chrome
`rounded-lg bg-muted/40 px-3.5 py-2.5`: lista cronológica reversa (mais
recente primeiro) de linhas:
- `remarcado`: `{formatDiaHora(de)} → {formatDiaHora(para)} · {motivoLabel} ·
  {ator_papel_label}`;
- `agendado`: `Agendado pra {formatDiaHora(para)} · {ator_papel_label}`;
- `desmarcado`: `Desmarcado (era {formatDiaHora(de)}) · {ator_papel_label}`.
`motivoLabel` via `MOTIVOS_REAGENDAMENTO` lookup + fallback `motivo` cru.
`ator_papel_label` via labels de papel de `ciclo.ts`. Loading state: skeleton
ou "carregando histórico…" se o fetch for client-side.
Render só quando `historico.length > 0` e quem vê tem policy (o fetch já
retorna vazio pro não-autorizado via RLS — a UI só esconde o bloco vazio).

3.2. `src/components/agenda-por-mentorado.tsx` — chip `· N remarcações`
muted ao lado do nº do encontro quando `count > 1` (a :484-498 já renderiza
metadados por encontro; inserir o chip no mesmo slot). Sem coluna nova na
tabela — o detalhe completo fica no dialog.

3.3. `jovem/agenda` — **sem mudança** (decisão: histórico é visão staff nesta
versão; o jovem segue vendo `motivo_reagendamento` atual).

## Passo 4 — gates

- `npx tsc --noEmit` + `npx eslint src/` limpos.
- `pnpm test` — unit do `motivoLabel`/`ator_papel_label` se virarem helper
  puro em `ciclo.ts` (senão cobertura via e2e).
- Aplicar migration no **staging** (`db push --db-url`), regenerar types,
  rodar `schema-contract` (CI).
- e2e: spec demo (histórico renderiza no dialog) + spec app (remarcar via UI
  gera linha de histórico, delete gera `desmarcado`).

## Rollback

`drop trigger trg_encontro_reagendamentos` + `drop table
encontro_reagendamentos` + `drop function`s — uma migration de rollback.
`motivo_reagendamento` nunca foi tocado → zero impacto nos consumidores.

## Questões em aberto

- Se quisermos expor ao mentorado depois (a issue cita "transparência"), é só
  uma policy a mais — a tabela já está modelada pra isso. Fica pra próxima.
