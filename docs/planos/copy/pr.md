## Summary

Rodada de copy nas superfícies diárias (jovem + mentor), fechando a voz
"você", frase curta, imperativo e "pra" da casa — referência
`/tmp/opencode/copy-referencia.txt`, relatório completo em
`docs/planos/copy/auditoria-1125.md`.

- **Plano de recuperação renomeado**: "plano combinado" → **"Pra ficar em
  dia"** em pill, card, textos da semana e vocabulário da Liza
  (`prompts.ts`/`tools.ts`). "Combinado" passa a ser só o item de tarefa —
  a regra está registrada no prompt e no BACKLOG.
- **Resíduos de voz manual**: travessões em texto exibido, frases
  enroladas, "Agradecemos pelo ciclo!" (tom de comunicado), sub-headers
  que descreviam a página em vez de orientar o passo.
- **"Em lima" → "Em verde"** na legenda da grade de disponibilidade —
  "lima" é o nome do token, não a palavra que a pessoa fala.
- **Papel restaurado**: `vinculoDeContato` do supervisor volta a "Auxiliar
  executivo da sua dupla" (como `papelLabel` e a home).
- **Densidade já decidida** (estrutura, não copy — listada na auditoria):
  recesso respondido colapsa com "Editar", "Não serve pra mim" ghost,
  legenda da barra e vínculo só em sm+, status do encontro dentro do texto
  no mobile, sugestão "às HH" (sem o fim redundante).
- **Acervo**: "Formação EaD" com descrição neutra até virar `curso` —
  virou item de BACKLOG.

## Gates (local)

- `next typegen && tsc --noEmit` — limpo
- `eslint src/` — 0 erros, 112 warnings (baseline `no-restricted-syntax`
  Button)
- `pnpm test` — 3296 passed, 1 skipped
- `pnpm guard` — 11/11
- e2e local (`docs/convencoes/ci-e2e.md`): **65 passed** nos specs das
  superfícies tocadas (demo: `sua-semana`, `jovem-combinado`,
  `jovem-especialistas`, `plano-em-dia`; app: `jovem-agenda`,
  `agenda-views`, `plano-em-dia`, `plano-roteiros`, `plano-acordo`,
  `combinados-encontro`).

## Test plan

- [x] `pnpm test` verde (asserts de copy atualizados só onde o texto mudou
  de propósito: pill "Pra ficar em dia", vínculo "passo do combinado com")
- [x] e2e local nos specs das superfícies tocadas
- [ ] Revisar `docs/planos/copy/auditoria-1125.md` (tabela antes→depois,
  estrutura deliberada, pendências)

## Fora de escopo

Migrations, `database.types.ts`, testes de comportamento, `docs/rag/*`,
push/merge/deploy. "Formação EaD" virar `curso` ficou no BACKLOG (mexe em
tipo/audiência/CTA nas duas vitrines, não é copy).
