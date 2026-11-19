---
description: Resolve as ambiguidades da spec ativa antes do plano
---

Leia `.specify/memory/constitution.md`, a spec ativa (a de status `Clarified` ainda não; a mais recente em `Draft` ou a indicada pelo usuário) e o código relevante.

Regras:

- Cada `[NEEDS CLARIFICATION]` vira uma pergunta objetiva, com no máximo 3 opções e uma recomendação justificada pelo código/guia.
- Resolva pelo que já está decidido em `docs/convencoes/*`, `docs/lgpd/*`, migrations vigentes e `docs/fontes/`. Só pergunte ao humano o que for decisão de produto.
- Toda resposta aceita é escrita na spec (requisito ou premissa) e o marcador é removido.
- O que não puder ser resolvido vira "Fora de escopo" com uma linha de motivo — nunca fica pendurado.
- Não altere histórias já aceitas sem apontar a mudança.

Ao final: confirme que a spec não tem `NEEDS CLARIFICATION`, mude o status para `Clarified` e liste as decisões tomadas.
