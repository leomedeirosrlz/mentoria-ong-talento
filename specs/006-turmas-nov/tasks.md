# Tasks — Importar cronograma de turma (REALIZA-34)

- [x] Auditoria 47/34 → `docs/audits/turmas-2026-11.md`
- [x] deps: `pdfjs-dist`, `mammoth`, `xlsx@0.18.5`
- [x] `importar-cronograma/extrair.ts` (pdf/xlsx/docx/csv/txt, limites, erros pt-BR)
- [x] `importar-cronograma/normalizar.ts` → `EventoRascunho[]` + avisos + confiança
- [x] `importar-cronograma/ia.ts` — toolChoice `entregar_cronograma` via `chamarModelo`
- [x] `actions-importar-cronograma.ts` — `importarCronogramaRascunho` + `importarCronogramaComIa`
- [x] `nova-turma-flow.tsx` + prop `importado` no builder (card de import dentro do flow)
- [x] `normalizar.test.ts` (Vitest, 15 testes — datas, tabela, texto, layout fraco)
- [x] e2e `turmas-importar.spec.ts` — verde no stack local (porta 3205)
- [x] DoD: typegen+tsc ✓, eslint 0 erros ✓, vitest 2350 ✓, guard 10/10 ✓
