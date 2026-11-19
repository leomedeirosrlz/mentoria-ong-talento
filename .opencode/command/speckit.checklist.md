---
description: Cria checklist de qualidade dos requisitos (só em área de risco)
---

Use `.specify/templates/checklist-template.md` e gere `specs/NNN-<slug>/checklists/<tipo>.md`.

Só rode para áreas de risco: RLS/schema, rota pública/auth, LGPD/menor, migration, integração externa. Para copy ou ajuste visual, não crie checklist.

Regras:

- O checklist revisa **requisitos**, não implementação: nada de "o botão está azul".
- IDs `CHK001…` globais, uma linha por critério, imperativo e verificável.
- Adapte as categorias ao risco real da feature; não copie as 18 linhas cegamente.
- `[x]` é do revisor humano. O agente não marca sozinho.
- Itens em aberto viram nota com o dono (produto, jurídico, Thiago).

Ao final, diga quais itens exigem decisão humana antes do `/speckit.tasks`.
