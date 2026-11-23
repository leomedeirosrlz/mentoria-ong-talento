# Tasks — Ficar em dia até o encerramento

## Fase 1 — Recon de dados e testes puros

- [ ] T001 conferir schema real de plano/aceite/versão (`information_schema`, migrations 0170/0219); decidir se há migration.
- [ ] T002 `plano-em-dia.ts`: ritmo até 7/semana; deadline do encerramento; cobertura de passos futuros.
- [ ] T003 testes Vitest com relógio fixo: 10 atrasos, em dia, impossível, recesso, gap, travado.
- [ ] T004 validar o caso “10 atrasos em 23/11, projeção em 02/01” contra o calendário real.

## Fase 2 — Card e proposta

- [ ] T005 `plano-acordos.tsx`: card visual no padrão da ficha, com estado, custo, janela e passos.
- [ ] T006 garantir “em dia” sem CTA artificial; “impossível” vira conversa com a coordenação.
- [ ] T007 ação de propor visível para coordenação/supervisor/mentor da dupla; jovem não propõe.

## Fase 3 — Aceite e banner

- [ ] T008 RPC/action de aceite bilateral; um lado pendente, outro ativa.
- [ ] T009 banner nas duas homes com próximo passo/progresso, sem duplicar ficha.
- [ ] T010 e2e app proposta → aceite → banner; papel negado.

## Fase 4 — Gates e evidências

- [ ] T011 `pnpm exec next typegen && npx tsc --noEmit`
- [ ] T012 `npx eslint src/`
- [ ] T013 `pnpm test`
- [ ] T014 `pnpm build`
- [ ] T015 e2e demo/app; prints e comentário no Jira REALIZA-513.
