# Tasks — Instrumentos, modais e Roda da Vida

**Spec:** `specs/010-instrumentos-visual/spec.md` · **Plano:** `plan.md` · **Status:** Draft

## Fase 1 — Gramática e modais

- [ ] T001 `src/components/forms/pergunta.tsx`: remover disco amarelo; número no verde da marca; `PERGUNTA_TEXTO` em foreground; ajustar `compacto`.
  - Verificação: unit/render + print do form da roda.
- [ ] T002 `src/components/instrumentos/roda-vida.tsx`: alinhar título/`AreaSlider` à gramática; não alterar ARIA de slider.
  - Verificação: teclado (setas/Home/End) e print.
- [ ] T003 `src/components/ui/dialog.tsx` + `jovem-avaliacoes.tsx` + `avaliacao-encontro-form.tsx`: tamanho maior no desktop para form/leitura; confirmação curta continua compacta.
  - Verificação: medir dialog em 1440×900; 390 sem overflow.
- [ ] T004 `src/components/jornada-rever.tsx` e `instrumentos-dupla.tsx`: revisar largura/leitura do resultado.
  - Verificação: print de Roda/Visão/PDM.

## Fase 2 — Roda vazia e preview

- [ ] T005 `src/app/(app)/materiais/instrumentos/[chave]/page.tsx`: renderizar `RodaSvg` vazio quando não há resposta, com estado explícito.
  - Verificação: mentor sem resposta vê a roda; contraste/legenda.
- [ ] T006 `ResumoResposta`: aumentar altura da roda; manter comparação inicial/formal.
  - Verificação: print desktop e mobile.
- [ ] T007 `src/components/instrumentos/flow.tsx` + página: sinopse curta por instrumento e CTA “Ler o guia completo”.
  - Verificação: altura da página cai; guia continua acessível.

## Fase 3 — Cards e navegação

- [ ] T008 `src/app/(jovem)/jovem/materiais/page.tsx`: mover anel de hover/focus para o shell, incluindo “Ler o guia”.
  - Verificação: hover no corpo e no rodapé; foco por teclado.
- [ ] T009 `src/components/jovem-shell.tsx` + título/subnav: “Jornada” → “Materiais” com vocabulário coerente.
  - Verificação: sidebar, menu mobile, título e subnav.

## Fase 4 — Gates e evidências

- [ ] T010 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T011 `npx eslint src/`
- [ ] T012 `pnpm test`
- [ ] T013 `pnpm build`
- [ ] T014 `pnpm test:e2e:demo -- tests/e2e/demo/instrumentos.spec.ts` (ou spec afetado)
- [ ] T015 prints antes/depois em `/tmp/opencode/review/010/` e comentário no Jira REALIZA-511.
