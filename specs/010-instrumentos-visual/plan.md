# Plano — Instrumentos, modais e Roda da Vida

**Spec:** `specs/010-instrumentos-visual/spec.md` · **Status:** Draft

## Resumo técnico

- Reaproveitar o kit `DialogContent` com tamanhos explícitos para formulário/leitura; não criar um segundo modal.
- Ajustar a gramática compartilhada `NumeroPergunta`/`RotuloPergunta` e o `AreaSlider`; a roda vazia usa `RodaSvg` com notas nulas.
- Mover o anel de hover para o container do card de instrumento e resumir a sinopse na página por instrumento, sem tocar no corpus do guia.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- UI: Tailwind no JSX, kit em `src/components/ui`, tokens semânticos; sem `dark:`.
- Testes: Vitest de domínio + Playwright demo/app; sem staging.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Cada US entrega UI completa e polida, sem placeholder | prints + testes |
| A2 RLS | Nenhuma leitura/escrita nova | sem migration |
| A3 escritas/domínio | Nenhuma action nova | sem alteração de RPC |
| A4 rota pública | Nenhuma rota nova | `/f` e `/materiais` existentes |
| A5 LGPD | Nenhum dado novo | — |
| A6 UI | kit + tokens + foco/teclado | `docs/convencoes/conventions-ui.md` |
| A7 demo | Estados aparecem no dataset demo | `src/lib/demo/data.ts` |
| A8 gates | tsc/eslint/vitest/build + demo e2e | DoD |
| A9 migrations | Nenhuma | — |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
src/components/ui/dialog.tsx                         # tamanhos/ respiro desktop
src/components/jovem-avaliacoes.tsx                  # form/leitura
src/components/avaliacao-encontro-form.tsx           # cartões do form
src/components/forms/pergunta.tsx                    # número + gramática
src/components/instrumentos/roda-vida.tsx            # título/area slider
src/components/instrumentos/roda-svg.tsx             # moldura vazia/tamanho
src/components/instrumentos/flow.tsx                 # título/descrição
src/app/(app)/materiais/instrumentos/[chave]/page.tsx # preview + sinopse
src/app/(app)/materiais/instrumentos-programa.tsx     # descrição da régua
src/app/(jovem)/jovem/materiais/page.tsx             # hover/sinopse/nav
src/components/jovem-shell.tsx                       # rótulo Materiais
src/components/jornada-rever.tsx                     # modal de leitura
tests/e2e/demo/instrumentos.spec.ts                  # regressão visual/fluxo
```

## Dados e migrations

Nenhuma migration. Não alterar `database.types.ts`.

## Autorização (matriz)

Nenhuma operação nova; as matrizes existentes continuam valendo. A roda vazia só aparece para quem já pode ver o instrumento na ficha.

## Superfícies e rotas

- Sem rota nova.
- `/materiais/instrumentos/[chave]` continua protegida pela régua de papéis.
- `/jovem/materiais` mantém a rota e o deep-link.

## Paridade demo

- A Roda vazia usa o mesmo dataset demo; conferir a persona mentor.
- Nenhuma mutação nova.

## Testes

- **Unit:** `extraiRodaDaVida({})`/campos sem resposta; gramática de pergunta.
- **E2E demo:** roda vazia no preview, ausência de bolinha, hover/focus do card, nav “Materiais”.
- **E2E app:** abrir avaliação no desktop e medir largura; abrir roda vazia como mentor.
- **Visual:** prints 1440/390 antes/depois.

## Observabilidade e erro

- Sem evento novo. Estado vazio da roda é copy, não erro.
- Falha de carregamento do guia mantém a página e não derruba o preview.

## Rollout

1. implementar em worktree; 2. rodar gates; 3. prints; 4. review; 5. aprovação manual; 6. staging só com autorização.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| | | |
