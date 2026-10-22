# REALIZA-152 — Materiais de acompanhamento dinâmicos no Acervo da jovem

- **Jira**: REALIZA-152 · Tarefa · Medium
- **Veredito**: **FEITO — fechar no Jira.** O Acervo já libera materiais por cronograma+jornada, e os instrumentos oficiais chegam por auto-emissão — nenhum "gerar link" manual.

## Evidência

- **Gate por posição da jornada**: `materialLiberadoParaJovem` +
  `encCorrenteDe` em `src/lib/jornada.ts` — material com `encontro_num`
  libera quando a dupla alcança o encontro (maior realizado +1); abaixo,
  item mostra "libera no encontro N" com data oficial da turma
  (`dataPorNumero` em `/jovem/materiais/page.tsx`).
- **Duas fontes pedidas**: (1) cronograma oficial — `jovem_jornada` traz
  o cronograma da turma e o gate usa a posição real; (2) registros do
  mentor — a posição deriva de encontros **realizados**, então material
  N+1 só libera depois que o mentor registra o encontro N. Cobertura das
  duas vias com a mesma âncora.
- **Instrumentos sem passo manual**: `jornada_autoemit` (0099) emite os 4
  sistemas automaticamente quando a jornada alcança (visão/roda desde o
  início, metas do enc. 2, roda formal do enc. 12) — critério "nenhum
  passo manual pro material oficial".
- **Gate dupla fechada**: `emitir_link_instrumento` barra `status` fora
  de ativa/pausada (0097) — encerrada não emite, só leitura.
- **Estados**: disponível/bloqueado com hint/respondido — implementados
  na trilha e no acervo.

## Restos

- Nada funcional desta issue. (O gate é por encontro alcançado —
  cobertura por data vs. por registro já está implícita na régua de
  encontros realizados + cronograma oficial; ambas as vias existem.)

## Ação: fechar no Jira citando `src/lib/jornada.ts` +
`src/app/(jovem)/jovem/materiais/page.tsx` + `0096/0097/0099`.
