---
description: Cria a spec de uma mudança (o quê/por quê) em specs/NNN-slug/spec.md
---

Você vai especificar uma mudança neste repo.

1. Leia `.specify/memory/constitution.md`, `.specify/templates/spec-template.md`, `specs/README.md` e a linha correspondente em `BACKLOG.md`.
2. Leia o código que a mudança toca **para não inventar** comportamento existente: `src/lib/ciclo.ts`, `src/lib/escritas.ts`, `docs/convencoes/architecture.md` e a migration mais recente que define o mesmo recurso (a última aplicada vence).
3. Escolha o próximo número livre em `specs/` e crie `specs/NNN-<slug>/spec.md` a partir do template. Preencha **só** o quê/por quê: sem stack, sem DDL, sem caminho de implementação.
4. Regras de conteúdo:
   - histórias independentes, P1 = menor recorte que já entrega valor, cada uma com teste independente;
   - cenários em Dado/Quando/Então, incluindo o caso negado (papel sem permissão) e o dado legado;
   - NFR obrigatórios: RLS, auth/rota pública, LGPD/menor, demo, a11y;
   - dúvida real vira `[NEEDS CLARIFICATION: pergunta]` — não invente requisito.
5. Atualize `specs/README.md` (índice: número, slug, status `Draft`, origem).
6. Não escreva plano, tasks nem código nesta etapa. Não edite `BACKLOG.md` além de citar a origem.

Responda com: caminho da spec, as 3 decisões que você precisou assumir e a lista de `NEEDS CLARIFICATION`.
