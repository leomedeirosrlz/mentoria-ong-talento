# Tasks — Badges isométricas e níveis de jornada

## Fase 1 — Domínio

- [ ] T001 `src/lib/conquistas.ts`: derivar nível por tempo/participação da trilha.
- [ ] T002 testes Vitest para 1 semana/1 mês/3 meses/completo e trilha especialista.
- [ ] T003 garantir que badge futura sem critério não inventa data.

## Fase 2 — Ilustração

- [ ] T004 criar SVGs isométricos locais (mínimo 4 níveis + conquistas-chave).
- [ ] T005 animação CSS/WAAPI curta, opcional e reduced-motion.
- [ ] T006 fallback para o emblema atual quando o asset faltar.

## Fase 3 — Estante

- [ ] T007 `ConquistasCard`: estante earned-only + área de futuras apagadas.
- [ ] T008 detalhe da badge com critério/data/estado.
- [ ] T009 demo com as quatro faixas de nível.

## Fase 4 — Gates e aprovação visual

- [ ] T010 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T011 `npx eslint src/`
- [ ] T012 `pnpm test`
- [ ] T013 `pnpm build`
- [ ] T014 e2e demo + prints 1440/390.
- [ ] T015 revisão visual com Claude/Thiago; comentário no Jira REALIZA-516.
