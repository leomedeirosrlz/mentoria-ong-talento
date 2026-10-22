# REALIZA-153 — Ficha da dupla: sugestão de remanejo recolhível

**Status do código: entregue.** Este documento registra a evidência e o que falta verificar — não replaneja.

## Evidência no código

- `src/components/remanejo-sugerido.tsx:74-91` — o card de sugestão é um
  `Collapsible.Root` (`@base-ui/react/collapsible`) **recolhido por padrão**.
  O comentário no arquivo cita explicitamente a REALIZA-153.
- O trigger carrega o motivo do semáforo como *scent*:
  `"Sugerir remanejamento · {motivo}"`, com `aria-expanded` controlado pelo
  Collapsible.
- Coberto por e2e: `tests/e2e/demo/remanejo-capacidade.spec.ts:26-31`
  assegura `aria-expanded="false"` no carregamento e `:74-75` expande antes
  de clicar no candidato.

## O que falta

- Nada funcional. Resta marcar a issue como **Done** no Jira.
- Verificação manual pontual (a verificar): estado de foco visível e leitura
  por leitor de tela do trigger colapsado/expanded na ficha real — os specs
  cobrem demo/coordenação, não `prefers-reduced-motion` nem SR.
