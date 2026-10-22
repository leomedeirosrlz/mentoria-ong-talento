# REALIZA-49 — sdd.md (leve)

## Sem schema/RPC novo

A grade é uma **serialização client-side** de dados que já vêm pra ficha
(`formulario_respostas.respostas` jsonb + `formulario_links` join).

## Decisões

| Questão | Decisão |
|---|---|
| Componente | Reusar `RelatorioCanvas` (colunas/resize/TSV/animações). Se o miolo estiver acoplado a relatório-de-pessoas, extrair pra `ui/` — decisão no PR |
| Onde vive a derivação | `src/lib/forms/respostas-grade.ts` — puro, testável; UI só traduz `CelulaGrade` |
| Órfãs (campo removido) | Coluna no fim, rótulo `· removido` — paridade com CSV |
| Estado grade↔resumo | `?view=` na URL — deep-link, sem storage |
| Ordenação/filtro server-side | **Fora de escopo** — fetch atual já traz o form inteiro; se forms grandes doerem, a próxima issue adiciona `?ordem=`/`?filtro=` com paginação PostgREST |

## Query

`a verificar` em `src/lib/queries.ts`: nome da leitura que alimenta
`RespostasSection`. Requisitos: `respondido_em`, `respostas` jsonb,
`link{dest_profile_id→profiles.nome, dest_mentorado_id→mentorados.nome,
contexto, generico}`. `React.cache`. Se faltar campo → estender a mesma
query (uma leitura só, nada de N+1 por linha).

## Invariantes

1. Paridade grade ↔ cards: mesma resposta, mesmo valor — a grade nunca
   inventa agregação.
2. `secao` nunca vira coluna; `visible_if` oculto mostra o valor (a
   resposta existe — ocultação é UX do respondente).
3. Coord-only: a rota + a query já impõem; nenhum dado novo alcança
   outro papel.

## Performance

- Serialização O(respostas×campos) — típico ≤30×30 = 900 células, trivial.
- `useMemo` nos dois lados; `RelatorioCanvas` já lida com colunas
  animadas.
