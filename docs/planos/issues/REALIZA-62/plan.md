# REALIZA-62 — Plano de implementação

Padronização preventiva: a string `a partir de —` já não existe; o trabalho
é travar o padrão pra que nenhuma superfície nova recrie um placeholder de
prazo vazio que leia como bug.

## Passo 0 — sweep final (confirmar antes de codar)

`rg` no `src/` pra garantir que o mapa do README está completo:
- `rg "prazo"` — cada ocorrência em `.tsx` é uma superfície candidata.
- `rg "a partir de"` — confirmar que só sobra o nudge (válido).
- `rg "a definir"` — mapear todos os usos dos formatadores; separar
  **data de evento** (encontro — `"a definir"` é correto, o evento ainda não
  tem data e vai ter) de **prazo** (encaminhamento — sem prazo é estado
  legítimo, não "em breve").

Se o sweep achar uma superfície que **renderiza** `a definir`/`—` num campo de
prazo → corrigir pra omitir a linha (regra 1) ou `"sem prazo definido"` (regra 2).

## Passo 1 — a regra, escrita

Adicionar ao cabeçalho de `src/lib/ciclo.ts` (junto dos formatadores) ou —
melhor — onde já mora a convenção de copy de domínio:

```ts
// Prazo nulo: omitir a linha quando a data não é o ponto; quando o prazo é
// a informação, "sem prazo definido" — nunca "a partir de a definir" nem
// dash vazio (REALIZA-62). "a definir" é fallback de data de evento, não
// de prazo.
```

Sem helper novo: cada superfície já usa `t.prazo && …` ou decide — a regra
documentada + o padrão de omitir resolve. Se durante o passo 0 surgir um
caso de "prazo é o ponto", **aí sim** criar `prazoOu`/`formatPrazo`
(`ciclo.ts`, puro, com teste) — não criar abstração antes de precisar.

## Passo 2 — assert na review de código

Não há teste unitário útil pra "não renderizar X" (é convenção visual). A
proteção é:
- a regra escrita no código (passo 1);
- checklist de review: qualquer `.tsx` novo com campo `prazo` → verificar a
  regra.

## Passo 3 — gates

- `npx tsc --noEmit` + `npx eslint src/` limpos.
- `pnpm test` verde (sem teste novo obrigatório — a menos que `formatPrazo`
  seja criado, aí teste puro dos 3 casos: null/válido/inválido).
- e2e: nenhum spec novo — as specs existentes de encaminhamentos/agenda já
  cobrem as superfícies; se o passo 0 corrigir uma superfície real, o spec
  existente valida que não quebrou.

## Rollback

N/A — documentação de convenção + possivelmente nenhuma mudança de runtime.

## Questões em aberto

- Se o passo 0 revelar que **todas** as superfícies já estão corretas (o
  cenário mais provável), a issue fecha como "auditoria + convenção escrita"
  sem nenhuma linha de runtime mudada — e o `_done-A.md` marca isso.
