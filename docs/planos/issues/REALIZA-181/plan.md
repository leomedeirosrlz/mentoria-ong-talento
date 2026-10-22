# Plano — REALIZA-181 PDM nativo

Execução em 4 PRs, cada um verde sozinho. Decisões no sdd.md; SQL completo na
migration `0106` (próximo número — última aplicada é `0105_review_fixes.sql`).

## PR 1 — Modelo + RPCs + projeção + backfill (fundação)

**Migration `supabase/migrations/0106_pdm_nativo.sql`** — padrão 010x:
header-comment, `begin;…commit;`, idempotente, `security definer set
search_path = public`, grants explícitos.

1. `create table pdm` + `pdm_itens` + índices (DDL completo em sdd §D3);
   trigger `pdm_itens_cap` (≤10 raízes / ≤20 não-raízes);
   `pdm_itens_touch` updated_at.
2. RLS: `enable row level security` nas duas + policies `*_select` (escopo de
   `instrumentos_da_dupla`, `0080`): coord | `d.mentor_id=my_profile_id()` |
   `d.supervisor_id=my_profile_id()` | `d.mentorado_id=my_mentorado_id()`.
   `grant select` a `authenticated`; **zero** grant de escrita nas tabelas.
3. RPCs `pdm_da_dupla`, `pdm_salvar_visao`, `pdm_salvar_item`,
   `pdm_status_item`, `pdm_remover_item`, `pdm_reordenar` — gate: trilha ≠
   `especialista` ∧ `status in ('ativa','pausada')` ∧ (mentor da dupla ∨
   mentorado da dupla). `grant execute … to authenticated`; `pdm_da_dupla`
   permite o papel supervisor/coord no select.
4. `pdm_projeta_resposta` interna (`revoke all … from public, anon,
   authenticated`) + `create or replace submeter_resposta_formulario`
   (versão vigente `0080:273` — preserva o gate de identidade do `0070` e o
   wiring 360 restaurado em `0080:337-342`) acrescentando o branch
   `f_sistema in ('metas','pdm')` (regras em sdd §D5 — upsert por slot
   `origem_campo`, `meta_principal` legado → ordem 0, `submetas_N` → filhos
   por linha, ausente→`descartada`).
5. Backfill na migration: `for` dupla com resposta `metas`/`pdm` → projeta a
   mais recente de cada sistema (`order by respondido_em desc limit 1`).
6. Update do form `sistema='metas'` (141): `alter table public.formularios
   disable trigger formularios_sistema_guard;` → novo `campos` sem
   `meta_principal`/`rev_*`, `s_revisao.descricao` com a orientação,
   `versao = versao + 1` → `enable trigger`. (Guard é incondicional no
   UPDATE — `0042:64-73`; escape documentado em `0043:13`.)

**Rollback do PR 1:** `drop table pdm_itens, pdm cascade` + `create or
replace` da `submeter_resposta_formulario` de volta ao corpo vigente —
copiar verbatim de `0080:273-369` (é a última a definir a função; confirmar
com `pg_get_functiondef` antes de escrever o rollback, pode ter havido
replace posterior). Respostas jsonb nunca são tocadas — rollback não perde
dado.

**Validação PR 1 (staging):** validador REST no padrão `scripts/_valida_*.mjs`
— calls por papel (mentor da dupla, mentor de outra, jovem, supervisor,
coord, anon) × (select, RPCs de escrita) + asserts de cap/ciclo/ordem.

## PR 2 — Lib + queries + actions + editor na ficha

- `src/lib/pdm.ts` `[NOVO]` — tipos + `montaArvore(flat)`, `progresso`,
  `resumoPdm`, `STATUS_LABEL`, `CAPS` — puro, Vitest.
- `src/lib/queries-pdm.ts` `[NOVO]` — `getPdmDaDupla(duplaId)` cache'd,
  `demoRole()`→fixture; `getPdmResumo(duplaId)` (agregado pro resumo).
- `src/lib/actions-pdm.ts` `[NOVO]` — actions `{error}|{ok}` chamando as
  RPCs + `revalidatePath`; zod pra título obrigatório/prazo.
- `src/components/pdm-dupla.tsx` `[NOVO]` (client) — seção "Plano de
  desenvolvimento": visão, árvore, progresso, editor (adicionar
  meta/submeta inline, editar campos, ↑↓ reordenar, checkbox atingida→data,
  descartar/apagar com confirmação). Modo `podeEditar=false` = leitura.
- `src/components/pdm-arvore.tsx` `[NOVO]` — render recursivo com collapse
  (ver design.md — indent leve, badge de nível ≥4).
- `src/app/(app)/duplas/[id]/page.tsx` — `getPdmDaDupla` no Promise.all +
  `<PdmDupla>` na seção (mentor edita; coord/supervisor veem `podeEditar=false`).
- `src/lib/database.types.ts` — regen (`supabase gen types`).
- `tests/pdm.test.ts` `[NOVO]` — montaArvore (órfão, ordem, profundidade),
  progresso, caps, parse de linhas `submetas_N` (espelha a regra SQL).

## PR 3 — Portal do jovem + retrospectiva/resumo

- `src/app/(jovem)/jovem/pdm/page.tsx` `[NOVO]` + `loading.tsx` — jovem
  edita o próprio PDM (mesma RPC; `podeEditar` sempre). Sem dupla DPP/PDM
  vazio → empty state "seu plano nasce das rodadas — responde o link que a
  dupla te mandou" + atalho pra Minha jornada.
- `src/app/(jovem)/jovem/materiais/page.tsx` — estação `pdm` respondida →
  CTA "Abrir meu PDM" (`/jovem/pdm`); pendente mantém CTA do link.
- `src/lib/encerramento.ts` — `ResumoJornada` + `metasAtingidas`,
  `metasTotal`, `metasAtingidasLista[{titulo,atingida_em}]` (cap 5+"+N");
  `DuplaParaResumo.pdm?`; `dadosResumoJornada`/`textoResumoJornada` + linha.
- `src/components/resumo-jornada.tsx` — 5º card "PDM" X de Y + lista
  atingidas c/ datas; entra no print.
- `src/lib/actions-encerramento.ts:140-161` — passa `getPdmResumo(duplaId)`
  ao resumo gravado no snapshot `encerramentos.resumo_jornada`.
- `src/app/(app)/duplas/[id]/page.tsx` — `ResumoJornadaSection` já recebe
  `resumo` — inclui o agregado na mesma chamada.

## PR 4 — Demo + polimento + e2e

- `src/lib/demo/pdm-data.ts` `[NOVO]` — dataset: 2 duplas com PDM plausível
  (metas SMART pt-BR, submetas aninhadas, mix atingida/ativa/descartada,
  `atingida_em` coerente com a linha do tempo do dataset evergreen);
  `demoPdmDaDupla`/`demoPdmResumo` espelhando a RPC por papel.
- `src/lib/demo/forms-data.ts` — liga `demoPdmDaDupla` no mirror.
- e2e `tests/e2e/app/pdm.spec.ts` `[NOVO]` + `tests/e2e/demo/` — ver
  acceptance.md (ficha, jovem, escopo, caps, resumo).
- Sweep visual ficha/jovem (mockup→implementação conforme design.md).

## Ordem de migração (CI)

`supabase db push` no **staging antes/junto do push da branch**, em **prod
antes do merge** — `schema-contract` (`scripts/check-schema-contract.mjs`)
compara `database.types.ts` com o PostgREST remoto e quebra se a coluna não
existir. Backfill roda na mesma migration; reexecução é no-op.

## Arquivos tocados (resumo)

| Novo | Editado |
|---|---|
| `supabase/migrations/0106_pdm_nativo.sql` | `src/lib/database.types.ts` (regen) |
| `src/lib/pdm.ts`, `queries-pdm.ts`, `actions-pdm.ts` | `src/app/(app)/duplas/[id]/page.tsx` |
| `src/components/pdm-dupla.tsx`, `pdm-arvore.tsx` | `src/lib/encerramento.ts`, `src/components/resumo-jornada.tsx` |
| `src/app/(jovem)/jovem/pdm/page.tsx` + `loading.tsx` | `src/lib/actions-encerramento.ts` |
| `src/lib/demo/pdm-data.ts` | `src/app/(jovem)/jovem/materiais/page.tsx`, `src/lib/demo/forms-data.ts` |
| `tests/pdm.test.ts`, `tests/e2e/app/pdm.spec.ts` | — |
