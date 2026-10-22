# REALIZA-71 — SDR

## Sensibilidade

`avaliacoes_encontro` é a **voz da jovem sobre o mentor e o programa** —
dado delicado de menor: se o mentor vê granularidade, a jovem deixa de
falar livre. O modelo atual protege com (a) `avaliacao_visivel_mentor`
(ela escolhe) e (b) `avaliacao_media_dpp` quantizada em lotes ≥3.

## Ameaças

1. **Granularidade vazada no fechamento** — o bloco novo pode expor por
   engano a série crua ao mentor. Mitigação: a query do mentor não
   seleciona `avaliacoes_encontro` cru — o papel resolve no fetch, não
   no render; teste cobre.
2. **`pedir_apoio` visível a quem não resolve** — sinal de cuidado: só
   coord/supervisor/equipe devem ver contagem; mentor não (BLOCKER).
3. **Print circulando** — o resumo é print-friendly: incluir a série no
   relatório final aumenta circulação de dado sensível. Mitigação:
   agregado no print é só média+n (linha compacta); comentários/temas
   brutos ficam na tela, fora do print (CSS print esconde o detalhe se
   necessário — classe print:hidden no sub-bloco).

## RLS / escopo

Sem policy nova: leitura usa as policies existentes de
`avaliacoes_encontro` (coord/supervisor escopo, mentor via RPC
quantizada, jovem a própria). A query do resumo já roda autenticada por
papel.

## Auditoria / retenção

Leitura — sem trilha nova; retenção segue `avaliacoes_encontro`.
