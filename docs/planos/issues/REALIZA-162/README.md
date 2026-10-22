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

## O que falta verificar

- **E2E demo** cobrindo a ordem: "A fazer agora" acima da trilha; grid do
  acervo em `xl` (verificar se `tests/e2e/demo/jovem-jornada.spec.ts` já
  cobre — grep sugeriu cobertura parcial, `a verificar` linhas exatas).
- **`BibliotecaJovem` fallback** (`:1200-1231` — quando RPC/jornada falha):
  confirma se o fallback também usa grid ou segue coluna única (a verificar;
  se ainda for coluna, é o único resíduo da issue).
- Performance/visual em telas `md` (entre 640-1280px): `sm:grid-cols-2` +
  `xl:grid-cols-3` — validar que `lg` (~900px) não fica apertado.

## O que falta

- Marcar **Done** no Jira após as 3 verificações acima.
