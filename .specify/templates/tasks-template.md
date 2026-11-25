# Tasks — <nome>

**Spec:** `specs/NNN-<slug>/spec.md` · **Plano:** `specs/NNN-<slug>/plan.md`
**Formato:** `- [ ] TNNN [P?] [US?] Descrição — path — verificação`
**[P]** = arquivos diferentes, sem dependência de task aberta. Toda task cita caminho real e como verificar.

## Fase 0 — Contrato (bloqueia todo o resto)

- [ ] T001 Migration `NNNN_<slug>.sql` — `supabase/migrations/NNNN_<slug>.sql` — revisão humana (A2/A5/A9)
- [ ] T002 Regenerar tipos — `src/lib/database.types.ts` — `pnpm schema:check`

## Fase 1 — Fundação (schema, RLS, RPC)

- [ ] T003 Policies/grants — mesma migration — teste por papel (permitido + negado)
- [ ] T004 RPC `<nome>` + grants — mesma migration — caso `anon` negado
- [ ] T005 Leitura — `src/lib/queries*.ts` — `npx tsc --noEmit`

## Fase 2 — US1 (P1) 🎯

- [ ] T006 [US1] UI — `src/app/(app)/<rota>/page.tsx` — manual + e2e
- [ ] T007 [US1] Action — `src/lib/actions*.ts` — retorna `{ ok }`/`{ error }`
- [ ] T008 [US1] Teste de domínio — `tests/<slug>.test.ts` — `pnpm test`
- [ ] T009 [US1] E2E app (permitido + negado) — `tests/e2e/app/<slug>.spec.ts`

## Fase 3 — US2 (P2)

- [ ] T010 [US2] ...

## Fase 4 — Polimento e paridade

- [ ] T011 [P] Demo: dataset/query/`DEMO_MSG` — `src/lib/demo/*` — spec demo
- [ ] T012 [P] Copy pt-BR e a11y — `src/components/*`
- [ ] T013 [P] Docs: `specs/README.md` + inventário LGPD (se dado novo)
- [ ] T014 Rodar o DoD completo e colar a saída no PR

## Convergência

Append-only: tasks criadas por `/speckit-converge`, cada uma com o gap que a originou.

## Dependências

Fase 0 → 1 → 2/3 (histórias independentes) → 4. Nenhuma US2 antes de US1 verde.
