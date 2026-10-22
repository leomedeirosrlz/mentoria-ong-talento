# REALIZA-175 — `/registros` desktop: agrupar por dupla/semana/avaliação + filtro right-sized

**Status: parcial** — a busca pedida pela issue já existe (`filtros.q`,
`role="search"` em `registros-filtros.tsx:341+`, chip "Busca: …" `:335`);
faltam **agrupamento**, **densidade em desktop** e o **modal de filtro**.

## O que existe hoje

- `src/app/(app)/registros/page.tsx:269` — `mx-auto max-w-3xl space-y-6`:
  coluna única mesmo em telas largas.
- Render em `<li>` com rail vertical (dot por precedência `apoio > tardio >
  ok` + `w-px bg-border`) — timeline por ordem cronológica (`:230-260`).
- `RegistroCard` por item; `ImportarRegistrosDialog` coord-only no
  `PageHeader`; resumo operacional com contagens clicáveis (apoio/tardios).
- `src/components/registros-filtros.tsx` — busca (`q`), chips removíveis,
  dialog `sm:max-w-lg` (`:419`) com fieldsets (Sinal/Encontro/Avaliação/
  Dificuldade/Dupla) — o conteúdo são pílulas/checks; `lg` fica largo demais
  pra esse corpo.

## Proposta em uma linha

Agrupamento comutável (`?grupo=dupla|semana|avaliacao`, default `dupla`) com
headers compactos entre grupos + a largura do container subindo pra
`max-w-5xl` (dois trilhos em `xl` quando fizer sentido) + o dialog de
filtro redimensionado pra `sm:max-w-md`.

## Decisão

Tier A, UI pura. `design.md` principal; `plan.md` cobre execução. Os dados
já chegam completos — agrupamento é **server-side na renderização**
(derivado de `itens`), zero custo de query.
