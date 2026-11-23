# Tasks — PDM cascateado e seletor de mentorado

## Fase 1 — Domínio e testes puros

- [ ] T001 `src/lib/forms/instrumentos.ts`: resolver `submetas_N` pelo grupo meta N, com fallback órfão.
- [ ] T002 `src/lib/pdm.ts`/teste: validar limite de metas e submetas; documentar se precisa migration.
- [ ] T003 testes Vitest para submeta sob meta, capítulo legado e meta extra.

## Fase 2 — UI do PDM

- [ ] T004 `pdm.tsx`: renderizar `SubmetasEditor` dentro de `FichasPdm`; esconder duplicata no capítulo “Mapa de submetas”.
- [ ] T005 `metas.tsx`/`pdm.tsx`: “Nova meta” com limite, foco e rascunho.
- [ ] T006 `SubmetasEditor`: foco/desfazer e limite sem perder acessibilidade.

## Fase 3 — Seletor de mentorado

- [ ] T007 `instrumentos-programa.tsx`: nomes como controle; pills ≤3, dropdown >3.
- [ ] T008 `[chave]/page.tsx`: manter seletor e `?dupla=` na troca de instrumento.
- [ ] T009 remover “Na ficha” como única escolha; deixar “Ficha” como ação secundária quando fizer sentido.

## Fase 4 — Gates e evidências

- [ ] T010 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T011 `npx eslint src/`
- [ ] T012 `pnpm test`
- [ ] T013 `pnpm build`
- [ ] T014 e2e demo do PDM/seletor + app do mentor.
- [ ] T015 prints e comentário no Jira REALIZA-512.
