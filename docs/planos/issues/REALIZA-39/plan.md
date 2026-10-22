# REALIZA-39 — plan.md (executável sem reler o Jira)

## Premissas verificadas

- `/pessoas` não lê `searchParams` hoje (`src/app/(app)/pessoas/page.tsx` — sem param de filtro).
- `PessoasListas` é client component com estado local (`busca`, `semDupla`, `verFora`, `ordem`) — `pessoas-listas.tsx:337-418`.
- Chips usam `filterChipCls(ativado)` — padrão já consolidado.
- Dupla ativa dá turma: `getDuplasResumo(Todas)` traz `id,mentor_id,mentorado_id,supervisor_id,trilha` (`src/lib/types.ts:515-521`) — **`turma` não está em `DuplaResumo`** → ampliar select ou derivar via `duplas` completas já carregadas na página (a página usa `getDuplas`? — a verificar: `:29-49` carrega duplas; usar essas).

## Derivação de turma por pessoa (regra proposta — `turmasDe()` pura `[NOVO]` em `src/lib/ciclo.ts` ou `src/lib/pessoas-turma.ts`)

Por pessoa, turmas = união de:

1. `dupla ativa|pausada` onde é mentor ou mentorado → `dupla.turma` (ou `cronograma.turma` via `cronograma_id` — preferir `duplas.turma`, que é o label congelado do pareamento);
2. `profile_papeis.escopo_turma` (staff escopado — ex.: auxiliar da T2);
3. `turma_inscricoes` (167) — quando existir, vira fonte primária e as 2 acima viram fallback de exibição.

**"Sem turma"**: pessoa sem nenhuma das 3 — mentores livres recém-cadastrados, equipe global (coord), mentorados nunca pareados (fila de espera).

**Multi-turma**: mentor com duplas em T1 e T2 pertence às duas — aparece em ambos os recortes (chip é filtro, não partição; contagens somam >total — documentar no tooltip/label "pessoas podem aparecer em mais de uma turma" ou aceitar — decidir no design; recomendado: filtro simples, sem pretensão de partição).

## Passos

1. `src/lib/pessoas-turma.ts` `[NOVO]` — `turmasDePessoas(pessoas, mentorados, duplas, papeis, inscricoes?) → Map<id, Set<string>>` puro + `Vitest` (multi-turma, sem-turma, especialista sem turma).
2. `src/app/(app)/pessoas/page.tsx` — passa `duplas` (já carrega) + `profilePapeis`/`inscricoes` se necessário (a verificar se `getPessoas` já traz `papeis` — types.ts:95 `papeis?: AppRole[]` sim, mas `escopo_turma` não → estender select ou query `getProfilePapeis` `[NOVO]` se ainda não existir).
3. `src/components/pessoas-listas.tsx` — linha de chips de turma no bloco de filtros coord (`:355-417`), mesma gramática dos chips existentes: um chip por turma + "Sem turma"; selecionar filtra `pessoasExibidas` e `mentoradosExibidos`; contador no chip = pessoas da turma.
   - Opcional (decidir): `PillTurma` pequeno na `PessoaRow`/`MentoradoRow` quando nenhum chip ativo (contexto passivo) — avaliar ruído; recomendado só na busca global.
4. Comportamento com `?turma=` — quando a 73 existir, `/pessoas?turma=T2` pré-seleciona o chip. **Não implementar o param aqui** (é da 73); só deixar o estado inicial injetável (prop `turmaInicial?`).

## Ordem / PRs

1. Lib pura + testes.
2. Página + chips (PR único pequeno).
3. Se 167 já migrou: trocar fonte pra `turma_inscricoes` (PR separado, trivial — a função `turmasDe` já isola).

## Demo / e2e

- Demo: chips T1/T2 aparecem pra persona coordenação; supervisor escopado (32) vê só sua turma se a 32 já tiver RLS — senão vê todos com chips.
- e2e demo: `/demo` coord → `/pessoas` → chip "T2" filtra; "Sem turma" mostra fila/livres.

## Rollback

- Remover os chips (props opcionais) — zero resíduo de dados.

## Riscos

- Contagens quebrando expectativa (multi-turma) — documentado no chip.
- `escopo_turma` texto divergente — mesmo match exato da 47 (label é dado real; string errada simplesmente não casa).
