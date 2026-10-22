# REALIZA-153 — aceite (verificação do entregue)

- Dado o demo `coordenacao` na ficha da dupla-risco `de000000-0000-4000-8000-000000001539`,
  quando a página carrega, então o card "Sugerir remanejamento" aparece **recolhido**
  (`aria-expanded="false"`) e o motivo do semáforo visível no trigger.
- Dado o card recolhido, quando clico no trigger, então os pools de candidatos
  expandem (livres primeiro, cheios marcados, fila "Aguardando par").
- Dado o card expandido, quando clico de novo, então recolhe sem reload.
- Dado uma dupla **sem** sinal de risco, quando abro a ficha, então a seção
  inteira não renderiza (o card só existe quando há sugestão).
- E2E existente que já prova: `tests/e2e/demo/remanejo-capacidade.spec.ts`
  (3 specs — visibilidade recolhida, expansão, abertura do dialog de remanejo).
