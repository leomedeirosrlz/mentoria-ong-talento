# REALIZA-32 — plan.md (executável sem reler o Jira)

## Premissas verificadas

- Escopo atual do auxiliar = `duplas.supervisor_id` por dupla: `0001_init.sql:173` (select), `:177-178` (update), embutido em policies de `encontros`/`registros`/`encaminhamentos` (`:187,213,240`).
- `profile_papeis` (`0085`) já carrega `papel` + `escopo_turma text` — designação possível **sem tabela nova**.
- `podeSupervisionar(role)` (`src/lib/ciclo.ts`) já abre as superfícies do auxiliar.
- `queries-supervisao.ts:58-107` — `getSupervisaoAlvos` filtra por `supervisor_id`.
- Agregação por turma já existe na UI do auxiliar (`duplas-lista.tsx:1289+`).

## Ordem

### Etapa 0 — resolver o BLOCKER

Obter resposta da coordenação/Thiago pra "turma inteira × só designadas" (ver `sdd.md`). As etapas 1-2 são comuns às duas respostas; a 3 diverge.

### Etapa 1 — migration: helper + policies de leitura por turma

`010x_auxiliar_por_turma.sql` `[NOVO]`, idempotente, header padrão 010x, `security definer`:

1. `minhas_turmas_supervisionadas()` — setof text (ou `uuid` se 47 já migrou; SQL nos dois formatos no rodapé, um comentado).
2. Policies **aditivas** (`or`) de `select` em `duplas`, `encontros`, `registros`, `encontro_notas`, `encaminhamentos`, `avaliacoes_encontro` (a verificar nome exato `avaliacoes`), `supervisoes` (leitura das sessões das duplas do escopo), `presencas` — e nas tabelas de pessoas: `mentorados` (com dupla na turma), `profiles` (mentores/mentorados com conta das duplas na turma). **Lista exata de policies a alterar sai de `pg_policies` no ambiente antes de escrever** — nunca de memória (regra da casa).
3. Writes: **não mudam** — edição/atribuição continua `supervisor_id = my_profile_id()` ou coord (Opção A); Opção B mantém tudo e vira só feature de atribuição em massa.
4. Grants `execute` pra `authenticated`; nada pra `anon`.
5. Rodapé com SQL de reversão (drop policies novas + drop function).

### Etapa 2 — código

- `src/lib/queries.ts`: nenhuma mudança obrigatória nas leituras (RLS alarga sozinha); **revisar** filtros client-side que re-narrow indevidamente — `getDuplasResumo`/`getMinhasDuplas` usam `.or(mentor_id,supervisor_id)` (`:415`) que **restringiria** o que a RLS agora permite: remover o `supervisor_id` do `.or` quando `podeSupervisionar` for verdade (ou sempre — a RLS já escopa; a verificar impacto no mentor que também é supervisor).
- `src/lib/queries-supervisao.ts`: `getSupervisaoAlvos` inalterado; nova `getMinhasTurmasSupervisionadas()` `[NOVO]` (React.cache) lendo `profile_papeis` do usuário.
- `src/lib/agenda-auxiliar.ts` / home do supervisor: revisitar agregações — número de duplas pode dobrar; garantir agrupamento por turma (já existe) e colapso.
- `src/lib/demo/`: `profilePapeis` (`data.ts:74-81`) — persona supervisor (Paulo) ganha `escopo_turma` na T1 ou T2; `demo/queries.ts` replica o alargamento (função `demoEscopoSupervisor`).
- `scripts/seed-e2e-staging.mjs`: fixture supervisor com `profile_papeis` escopado `[NOVO]`.

### Etapa 3 — UI conforme decisão

- **Opção A:** em `/pessoas/[id]` ou diálogo de papéis, a coordenação edita `profile_papeis.escopo_turma` — verificar onde a UI de papéis já existe (a verificar: componente de edição de papéis — possivelmente em `pessoa` ficha/gerenciar). Se não houver UI de edição de `profile_papeis`, criar `[NOVO]` select "Turma" no dialog de papel do auxiliar.
- **Opção B:** ação em massa "Atribuir auxiliar a todas as duplas da turma" em `/turmas/[id]` (server action `atribuirAuxiliarTurma` `[NOVO]` `{error}`/`{ok}`).

### Etapa 4 — validação

- e2e app: supervisor escopado vê turma dele, não vê a outra; edita supervisionada, não edita não-supervisionada (Opção A) — specs novos em `tests/e2e/app/`.
- Demo: trocar persona supervisor na DemoBar → `/duplas` mostra turma do escopo + agrupamento.

## Rollback

- Migration reversa documentada no rodapé; policies novas são `drop policy` nomeadas — rollback não toca `supervisor_id` (sempre seguro).
- Código: se o `.or()` foi alargado, revert commit — a RLS antiga cobre.

## Riscos

- Alargamento acidental de `profiles`/`mentorados` — teste RLS negativo obrigatório (acceptance 6-8).
- `minhas_turmas_supervisionadas()` por label texto quebra se label mudar → depois da 47, trocar pra `escopo_turma_id` (FK sobrevive a rename).
