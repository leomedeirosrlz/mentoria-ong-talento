# Tasks — ops & infra, rodada nov/2026

**Spec:** `specs/005-ops-nov/spec.md` · **Plano:** `specs/005-ops-nov/plan.md`

## US1 — ViaCEP no cadastro (REALIZA-37) — nesta PR

- [x] T001 [US1] Parser puro + `cepNormalizado` — `src/lib/viacep.ts` — `tests/viacep.test.ts`
- [x] T002 [US1] Server action `buscarCep` (timeout 5s, revalidate 24h, fixture demo, union de retorno) — `src/lib/actions-endereco.ts` — chamada a partir do form
- [x] T003 [US1] Bloco de endereço controlado + autofill + estados aria-live — `src/components/assinatura-form.tsx` — `npx tsc --noEmit` + e2e demo
- [x] T004 [US1] Vitest do parser (ok/erro:true/campos vazios/malformado; cepNormalizado) — `tests/viacep.test.ts` — `pnpm test`
- [x] T005 [US1] e2e demo: autofill em `/assinar/<token>` + edição vence — `tests/e2e/demo/viacep.spec.ts`
- [x] T006 [US1] Operador ViaCEP na tabela de subprocessadores — `docs/lgpd/base-legal.md` §4

## Fix auditada — REALIZA-54 (item PDM fantasma em trilha esp)

- [x] T007 `ArquivosDupla` recebe `pdm` só em trilha DPP — `src/app/(app)/duplas/[id]/page.tsx` — `npx tsc --noEmit`

## US2 — `duplas.dupla_dpp_id` (REALIZA-98) — spec-only, implementação adiada

Aguarda janela própria (db push em staging + e2e-app); SQL e deltas no `plan.md`.

- [ ] T101 Migration `dupla_dpp_id` + CHECK + índice parcial + backfill — `supabase/migrations/NNNN_*.sql` — `pnpm schema:check` + REST staging
- [ ] T102 `sol_efetivar` (0101) e `aceitar_solicitacao` (0097): `create or replace` do corpo vivo + `dupla_dpp_id` no insert — conferir `pg_get_functiondef` antes
- [ ] T103 `rematch_dupla` (0205): herdeira copia `antiga.dupla_dpp_id`
- [ ] T104 `createDupla` esp: lookup `select("id, turma")` + `dupla_dpp_id` no insert — `src/lib/actions.ts`
- [ ] T105 `actions-encerramento.ts`: preferir `dupla.dupla_dpp_id` com fallback pra solicitação
- [ ] T106 Regen `database.types.ts` + `Dupla.dupla_dpp_id` em `types.ts` + fixture demo
- [ ] T107 e2e app: aceite grava mãe; rematch esp preserva mãe — `tests/e2e/app/solicitacao-esp.spec.ts`

## Fechamento desta PR

- [x] T201 `specs/README.md` — índice + próximo número livre
- [x] T202 Auditoria do ws7 — `docs/audits/ops-2026-11.md`
- [ ] T203 DoD completo, saída colada no PR
