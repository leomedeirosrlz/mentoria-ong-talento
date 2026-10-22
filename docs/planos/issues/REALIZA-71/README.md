# REALIZA-71 — Avaliação por encontro (mentor + mentorado) agregando na 360º

- **Jira**: REALIZA-71 (migrada de REALIZA-23) · Feature · Medium
- **Veredito**: **PARCIAL — a coleta por encontro existe dos dois lados; falta a agregação explícita no fechamento do ciclo.**

## O que já existe (verificado)

- **Lado do jovem**: `avaliacoes_encontro` + `avaliacao_links` (0071) — token bearer por encontro realizado (~60d), 2-3 perguntas rápidas: `estrelas`, `sentimento`, `avancei`, `temas`, `comentario`, `pedir_apoio`, `avaliacao_visivel_mentor` (a jovem escolhe se o mentor lê), `respondido_por_profile_id`.
- **Lado do mentor**: `registros.avaliacao` (excelente/boa/regular/baixa) por encontro — existe desde o início.
- **Visibilidade**: coord e supervisor veem por escopo; mentor vê agregado quantizado pela RPC `avaliacao_media_dpp` (lotes ≥3 — privacidade); `TrajetoriaAvaliacoes` exibe a série pro papel certo.
- **Jovem**: avalia via home/estação (`jovem-avaliacoes`); a jornada conta "em dia · X de Y".

## O que falta (o delta da issue)

"agregando na 360º no fim do ciclo": hoje **nenhuma superfície de
encerramento mostra a série das micro-avaliações junto da 360**. O
`resumo-jornada.tsx` exibe a `avaliacao` dos **registros** (lado mentor)
mas ignora `avaliacoes_encontro` (lado jovem). Falta:

- **Read model de agregação**: trajetória das micro-avaliações do jovem
  (média de estrelas, série por encontro, temas recorrentes, pedidos de
  apoio, sentimento/avancei) **lado a lado** com a série do mentor
  (`registros.avaliacao`).
- **Superfícies de fim de ciclo**: `ResumoJornadaSection` (o relatório
  print-friendly — base do relatório final) e `encerramento-dupla.tsx`
  (junto do checklist da 360) exibindo esse agregado; quando a 360 oficial
  (`formularios.sistema='avaliacao_360'`, campos 0042) for respondida, o
  leitor contextualiza com a série.
- A 360 é form oficial imutável (`sistema=true`) — **não se edita o
  formulário**: a agregação é superfície adjacente, não campo novo.

## Dependências / bloqueios

- Nenhuma técnica (dados já existem). Relaciona com REALIZA-18 (overlay
  roda = outra peça do "retrato final").
- BLOCKER: mentor vê agregado quantizado (≥3) hoje — o bloco de
  encerramento mostra a série completa pro mentor ou mantém quantização?
  (A série por-encontro revela *quando* a jovem reclamou — mais sensível
  que a média. Recomendado: série completa só coord/supervisor/jovem;
  mentor vê a trajetória quantizada já existente + média do ciclo.)

## Esforço: **P**

## Riscos

- Vazar granularidade pro mentor (privacidade da jovem — mitigado pela
  regra acima).
- Resumo impresso ficar longo — bloco compacto, detalhe em ficha.
