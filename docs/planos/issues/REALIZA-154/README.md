# REALIZA-154 — Ficha da dupla: esconder "Combinados" quando vazio

**Status do código: entregue.** Evidência + resíduo opcional de limpeza.

## Evidência no código

- `src/app/(app)/duplas/[id]/page.tsx:1004-1049` — a seção "Combinados" só
  renderiza com `(dupla.encaminhamentos?.length ?? 0) > 0`. Dupla sem
  encaminhamentos não mostra a seção vazia.

## Resíduo opcional (micro-débito, não bloqueia o fechamento)

- `src/components/encaminhamentos-list.tsx:61-70` — o `EstadoVazio` interno
  ("Nenhum combinado por aqui ainda…") ficou inalcançável a partir da ficha,
  porque o pai já gateia por `length > 0` e o componente só é usado ali
  (grep confirma uso único). Se outro consumidor aparecer, o estado continua
  correto — a limpeza é opcional.

## O que falta

- Marcar **Done** no Jira. Opcional: teste unitário/assert e2e cobrindo que
  `section` "Combinados" está ausente numa dupla sem encaminhamentos (o
  dataset demo tem duplas nos dois estados).
