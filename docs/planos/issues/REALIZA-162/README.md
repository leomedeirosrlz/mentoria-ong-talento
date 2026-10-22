# REALIZA-162 — Jornada do jovem: densidade desktop, estação ativa no topo, acervo em grid

**Status do código: entregue (aparentemente completo).** Evidência + o que
falta verificar antes de fechar no Jira.

## Evidência no código — `src/app/(jovem)/jovem/materiais/page.tsx`

Os três pedidos da issue estão implementados e citam a própria issue em
comentários:

1. **Estação ativa no topo** — `:293-298` (comentário REALIZA-162) +
   `:429-454`: estações `a_fazer` saíram da trilha e viraram o bloco
   "A fazer agora" logo abaixo do hero (`EstacaoAberta`, `:748`). Decisão
   registrada: a trilha não repete o marcador das abertas.
2. **Trilha compacta** — `:456-458`, `:529-550` (`SegmentoLinha`),
   `:552-576` (`NoEstacao`): rail vertical único à esquerda (`left-5`,
   lime sólido no percorrido, tracejado no futuro), nó `size-7` — "o zigzag
   do desktop saiu na densidade REALIZA-162" (`:532`).
3. **Acervo em grid** — `:1036-1100` (`MateriaisLista`, comentário
   REALIZA-160/162) e `:1091`: `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`
   com `MaterialCard` (`:959-980`) — thumbnail + título + tipo + "em breve"
   para material sem `path`/`url`.

Estrutura entregue: hero slim (`Card` com progresso X/Y + "Próxima parada")
→ sub-nav sticky "Jornada/Acervo" (`:400-417`) → "A fazer agora" → trilha
(feitas como recibos `EstacaoFeita` :774, trancadas em `<details>`
`TrancadasItem` :832, `FimItem` bandeira do enc. 16 :890) → Acervo grid.

## Verificações — fechadas (e2e + leitura)

- **E2E demo** — `tests/e2e/demo/jovem-jornada.spec.ts` ganhou 3 specs
  (rodados contra `pnpm dev` local, verdes): "ordem da página e trilha
  sem repetição" (bounding-box hero → nav → `#jornada` → `#acervo`;
  "A fazer agora" ausente quando nada abre; `ol` da trilha sem pill
  "A fazer" nem link `/f/`), "acervo em grade" (computed
  `grid-template-columns`: 1 trilho em 390px, 2 em 900px, 3 em 1366px;
  cards lado a lado no desktop, empilhados no celular; "em breve" fora da
  grade) e "prefers-reduced-motion" (duration+delay ~0 no `.animate-enter`).
  O recorte "a_fazer acima da trilha sem repetir" foi coberto no spec app
  (`tests/e2e/app/jovem.spec.ts`, teste do link pendente — único ambiente
  com estação aberta de verdade: heading "A fazer agora" + artigo visão no
  bloco de ação, título ausente do `ol`, bloco antes da trilha no eixo Y).
- **`BibliotecaJovem` fallback** (`:1213-1231`) — verificado: renderiza o
  mesmo `MateriaisLista` (`:1228`), que já é a grade `sm:grid-cols-2
  xl:grid-cols-3` (`:1091`). Sem resíduo — não era coluna única.
- **`lg` (~900px)** — por spec (acceptance: 640-1279px = 2 colunas): card
  ~430px por coluna, confortável. O assert em 900px do spec de grade
  deixa a régua fixada.

## O que falta

- Marcar **Done** no Jira.
