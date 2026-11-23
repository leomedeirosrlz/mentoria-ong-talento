# Tasks — Conquistas, nova rodada e preview de especialista

## Fase 1 — Domínio e testes

- [ ] T001 `src/lib/conquistas.ts`: expor/consumir o próximo marco não ganho sem repetir conquistas.
- [ ] T002 `src/lib/jornada.ts`: marcar reemissão real; atualizar `jornada.test.ts` (inclui o caso da Roda inicial).
- [ ] T003 Vitest para 0/1/todos marcos e primeira emissão × reemissão.

## Fase 2 — Faixa e copy

- [ ] T004 `marcos-a-caminho.tsx`: renomear para “Próximo marco” e mostrar só o próximo não ganho; estado de conclusão.
- [ ] T005 `materiais/page.tsx`: próxima parada/card não repetem “nova rodada” sem reemissão.
- [ ] T006 revisar o CTA “Responder a nova rodada” e a confirmação explícita.

## Fase 3 — Preview de especialista

- [ ] T007 `jovem-sugestao-card.tsx`: preview com foto, profissão/área e experiência.
- [ ] T008 `jovem-especialistas.tsx`/página: mesma exposição no card e no dialog.
- [ ] T009 garantir que documentos/contato não entram no preview.

## Fase 4 — Gates e evidências

- [ ] T010 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T011 `npx eslint src/`
- [ ] T012 `pnpm test`
- [ ] T013 `pnpm build`
- [ ] T014 e2e demo dos estados e app da sugestão.
- [ ] T015 prints e comentário no Jira REALIZA-515.
