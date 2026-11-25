# QA visual — rodada 25/11 (pós-staging)

> Segunda passada sobre o staging `2bb20283` com prints reais (mobile 390×844
> e desktop 1440×900) e medição no DOM. O objetivo era achar o que o cliente
> já tinha pedido e não estava entregue. Onde o print não permitia concluir,
> está marcado **não verificável** em vez de virar opinião.

## Achados confirmados e correção aplicada

| # | Achado | Evidência | Correção |
|---|---|---|---|
| 1 | `/jovem/especialistas` com scroll horizontal no mobile | `scrollWidth 421px` vs 390; track do `grid` esticando até o `min-content` (405px) do card de sugestão | `grid-cols-1` na página (clampa em `minmax(0,1fr)`) |
| 2 | Nome destruído no card de Pessoas no mobile | `Caio Henrique Oliveira` com 127px e precisando de 163px; `Auxiliar executivo da sua dupla` 127 vs 228 | selo "Sua rede" duplicado removido do card (o vínculo já está na linha de meta) + meta com `line-clamp-2` |
| 3 | "Registrar encontro" do jovem abria modal só informativo | modal com "Entendi" e a frase "quem registra é seu mentor" | botão só renderiza quando há passo elegível (header, card e "Precisa de você") |
| 4 | Combinado sem nome dos encontros | `plano-acordos` imprimia só `${numero}º encontro`, ignorando o título que já existia no guia | `titulo` viaja no escopo (JSONB, sem DDL) e a linha mostra "5º encontro · Primeiros resultados"; planos antigos caem no número |
| 5 | Card do combinado com 2–3 botões competindo | "Confirmar" + "Outra data" inline; "Não serve pra mim" logo abaixo | "Outra data" desceu para o `⋯` (`AcoesMenu`), CTA principal sozinho |
| 6 | "Sua rede" em colega de turma | Dandara ("Colega da turma") com selo verde "Sua rede" | selo removido; vínculo do card passa a ser a única fonte |
| 7 | Rodapé do modal de Filtros deixava conteúdo à mostra | faixa de 16px do `p-4` da sheet sob o "Aplicar" | `pb-0` na sheet; respiro mora no rodapé sticky |
| 8 | ⋯ dos cards da agenda solto no meio | fileira própria com `ps-12` no mobile | topo à direita, mesmo padrão do card de dupla (`dupla-linha`); reusa `AcoesMenu` |
| 9 | Erro pós-deploy prendia a pessoa no "recarregar" | cookie de auth velho → boundary sem saída | `CartaoErro` compartilhado com "Sair e entrar de novo" (`recuperarSessao` limpa `sb-*`/demo e vai pro login) |
| 10 | "Sem data ainda" acima de uma data concreta | card do próximo passo | copy trocada por "Sugestão pra destravar o próximo passo" |
| 11 | Histórico do jovem sem o nome da especialista | `espPorDupla` só mapeava trilhas `ativas` | mapa cobre todas as trilhas de especialista; "Sessão 5 com Sofia" |

## Falsos positivos (não mexer)

- Painel da Liza "aberto por padrão" no perfil: era estado herdado do roteiro
  de captura; no load limpo ela começa fechada e o balão fica opaco após o
  fade.
- Nav inferior/FAB no meio do print: artefato de `fullPage` com `position:
  fixed`.
- "Pills de categoria" nos cards de Pessoas: são as áreas da pessoa, não os
  filtros (que saíram para o modal na 525). Fica como decisão de produto
  esconder também os chips.

## Pendências conhecidas

- e2e de app contra staging: `220 passed / 7 failed`, sendo 5 por senha da
  fixture `e2e-mentor-reserva` (precisa `pnpm seed:e2e`) e 3 `ERR_ABORTED` em
  `/resumo/[slug]` (a rota responde 200 via curl — investigar o gate).
- `FR-009` (telemetria `biblioteca_view`) segue opcional.
