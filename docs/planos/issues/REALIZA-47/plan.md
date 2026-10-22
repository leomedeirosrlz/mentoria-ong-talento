# REALIZA-47 — plan.md (executável sem reler o Jira)

## Premissas verificadas no repo

- `cronogramas.turma` é `text not null` — `supabase/migrations/0061_cronogramas.sql:30`.
- `duplas.turma` é `text` (rename de `ciclo`, default removido) — `0061:110-113`.
- `profile_papeis.escopo_turma` é `text` — `supabase/migrations/0085_profile_papeis.sql`.
- View `mentorados_turma` casa colegas por string de turma — `supabase/migrations/0076_diretorio_jovem.sql:71+`.
- `turma_inscricoes`/`resumo_links` chegam na **167** (cluster R, outro agente) — antes dessa issue. Se 167 ainda não tiver aterrissado, esta migration já nasce com `turma_id` (a verificar no plano da 167).
- Consumidores do label texto hoje: `getCronogramas`/`getCicloEventos`/`getDuplas*` (`src/lib/queries.ts`), `partesTurma`/`rotuloCronograma` (`src/lib/ciclo.ts:1884,943`), `NovaDuplaDialog` (`src/components/nova-dupla-dialog.tsx:659`), `PessoasListas` (sem turma hoje), `duplas-lista.tsx` (chips por `d.turma` `:857-918`), `agenda-partes.tsx` `PillTurma` (`:54-64`), `src/lib/demo/data.ts` (2 cronogramas), `src/app/api/export/route.ts`.

## PR 1 — schema: `programas` + `turmas` + FKs com backfill

Migration `010x_programas_turmas.sql` `[NOVO]`, idempotente, header no padrão 010x:

```sql
-- 010x: programas + turmas — turma vira entidade (REALIZA-47)
--   programas                    — guarda-chuva ("Mentoria DPP")
--   turmas                       — entidade; rotulo único casa com o texto
--                                  legado (duplas.turma / cronogramas.turma /
--                                  profile_papeis.escopo_turma / turma_inscricoes.turma)
--   <t>.turma_id                 — FKs novas; backfill por match exato de label
--   mentorados_turma (view)      — recriada casando por turma_id
```

1. `create table public.programas (id uuid pk default gen_random_uuid(), nome text not null, ativo boolean not null default true, created_at timestamptz not null default now())` `[NOVO]` — seed 1 linha: "Programa de Mentoria" (nome oficial a verificar com coordenação).
2. `create table public.turmas (id uuid pk, programa_id uuid not null references programas, rotulo text not null unique, ano text, inicio_em date, fim_em date, status text not null default 'ativa' check (status in ('planejada','ativa','encerrada')), created_at)` `[NOVO]`.
   - `rotulo` carrega o texto legado verbatim ("T1 · 2026/2027") — é a chave do backfill e o que a UI continua exibindo.
3. Backfill `turmas`: `insert ... select distinct turma from cronogramas union select distinct turma from duplas union select distinct escopo_turma from profile_papeis where escopo_turma is not null [+ turma_inscricoes.turma / resumo_links.turma se 167 já migrou]` — labels sem `cronogramas` associado entram como `status='planejada'`.
4. `alter table cronogramas add column turma_id uuid references turmas(id)` `[NOVO]` + `update ... set turma_id = t.id from turmas t where t.rotulo = cronogramas.turma`. Idem `duplas.turma_id`, `profile_papeis.escopo_turma_id`, `turma_inscricoes.turma_id`, `resumo_links.turma_id` (estas duas só se 167 já existe — senão a 167 já nasce com FK).
5. **Auditoria de orfãos**: `select ... where turma_id is null and turma is not null` → se >0, criar turma de rótulo exato (não falhar a migration — label divergente é dado real, não erro).
6. Recriar `mentorados_turma` casando por `turma_id` via join `duplas.turma_id` (a view hoje casa por string — `0076:71+`).
7. RLS: `turmas`/`programas` leitura `my_role() is not null` (staff lê tudo; jovem lê via `mentorados_turma` que já é security definer — a verificar grants da view); writes `my_role()='coordenacao'`. Grants padrão: `authenticated` select; nada pra `anon`.
8. Manter colunas texto legadas **nesta migration** (compat); remoção em migration posterior depois do código migrar (PR 4).

`database.types.ts` regenerado após aplicar no remoto (schema-contract CI exige).

## PR 2 — domínio puro + queries

- `src/lib/types.ts`: `Turma`/`Programa` `[NOVO]`; `Cronograma.turma_id`, `Dupla.turma_id`, `ProfilePapel.escopo_turma_id`. Manter `turma` texto como campo derivado de leitura (select aninhado `turma:turmas(rotulo)`) enquanto a UI não migra toda — **ou** projetar `turma` no select pra não quebrar consumidores. Decisão: projeção via embed `turmas!inner`/`!left` (a verificar nome da FK que o PostgREST expõe).
- `src/lib/queries.ts`: `getTurmas()` `[NOVO]` com `React.cache`; `getCronogramas`/`getDuplas*` passam a trazer `turma:turmas(rotulo)` embed — label continua disponível pros componentes sem mudança de contrato.
- `src/lib/ciclo.ts`: `partesTurma(rotulo)` continua funcionando sobre `turmas.rotulo` (regex `^T(\d+)\s*[·\-.]?` já tolera formato livre — `:1887`); `rotuloCronograma` troca `c.turma` por `c.turma.rotulo` quando o embed existir.
- Vitest: `partesTurma` e helpers de label seguem passando; novo teste pro match label→id na camada de projeção (função pura `turmaRotuloDe(row)`).

## PR 3 — UI: filtros por turma onde já existe a lista

- `/duplas` — `duplas-lista.tsx` já tem chips por `d.turma` (`:857-918`): trocar fonte dos chips pra lista de `turmas` (prop nova) e casar por `turma_id` — visual idêntico, valor vira id.
- `/registros` — `parseFiltros` ganha `turma` (`src/app/(app)/registros/page.tsx:102`); `getRegistros` filtra por `dupla.turma_id`. Select de turma nos filtros `[NOVO]` quando >1 turma.
- `/api/export` — coluna `turma` passa a sair de `duplas.turma_id → turmas.rotulo`; adicionar `turma_id` interno não é necessário (export é pra humano).
- `/pessoas` — agrupamento por turma é **REALIZA-39** (não duplicar aqui); 47 só garante que `getPessoas`/`getMentorados` expõem `turma_id` via vínculo (dupla ativa) pra 39 consumir.
- `NovaDuplaDialog` — label do cronograma via embed; sem mudança de UX.
- `/turmas` + `/turmas/[id]` — lista passa a ler `turmas` (entidade) com seus cronogramas embutidos; `/turmas/novo` ganha step 0: escolher turma existente ou criar `[NOVO]` turma (rotulo+ano+datas). Criar turma = `insert` coord-only via action `criarTurma` `[NOVO]` retornando `{error}`/`{ok}`.

## PR 4 — limpeza (pós-estabilização)

- Remover `duplas.turma`, `cronogramas.turma`, `profile_papeis.escopo_turma` texto; `turma_inscricoes.turma`/`resumo_links.turma` texto (se vieram da 167) — migration dedicada, depois de um ciclo de observação.
- `comunicados`/`materiais` por turma (`turma_id` nullable `[NOVO]`) — só se a ata de versionamento pedir agora; senão fica no backlog da própria issue (escopo declarado no Jira: "opcionalmente").
- Versionamento de formulários por turma: `formularios.turma_id` `[NOVO]` — decisão de ata citada no Jira; implementar como coluna nullable + filtro na `/formularios` (a verificar estrutura atual de `formularios` — `src/app/(app)/formularios/`).

## Demo / e2e

- `src/lib/demo/data.ts`: `turmas: Turma[]`/`programas` `[NOVO]` no `DemoData` (`:93-133`); T1/T2 viram entidades com `rotulo` = label atual; `profilePapeis.escopo_turma` (`:78`) ganha par `escopo_turma_id`.
- `src/lib/demo/queries.ts` — escopo por turma replica RLS.
- `scripts/seed-demo-staging.mjs` / `seed-e2e-staging.mjs`: criar `turmas` antes dos cronogramas; `TURMA_E2E` vira entidade.
- Specs existentes não devem quebrar: labels na tela permanecem iguais.

## Rollback

- Migration reversível: dropar FKs `*_turma_id`, dropar `turmas`/`programas`, recriar `mentorados_turma` por string (texto legado ainda existe no PR 1-3 — rollback seguro até o PR 4).
- Rollback de código: feature-flag não se aplica a schema; o padrão é o da casa — migration nova desfazendo, não `down` do CLI. Documentar SQL de reversão no rodapé da migration (padrão `0061:252+`).

## Ordem com outras issues

**167 → 47 → {32, 39, 73}**. 47 também destrava a turma inteira no escopo do auxiliar (32 usa `escopo_turma_id` se já existir; senão `escopo_turma` texto — ver `sdd.md` da 32).
