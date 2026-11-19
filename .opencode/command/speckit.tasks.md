---
description: Quebra o plano em tasks executáveis em specs/NNN-slug/tasks.md
---

Leia a spec ativa, o `plan.md` e `.specify/templates/tasks-template.md`.

Gere `tasks.md` com o formato exigido: `- [ ] TNNN [P?] [US?] Descrição — path — verificação`.

Regras:

- Fase 0 (migration + tipos) bloqueia tudo; Fase 1 (RLS/RPC/queries) antes das histórias.
- Cada história da spec vira uma fase própria, na ordem de prioridade (P1 primeiro).
- Toda task cita um caminho real do repo e como verificar (comando, teste ou inspeção).
- `[P]` só quando os arquivos são diferentes e não há dependência.
- Inclua explicitamente: caso de papel negado, paridade demo, copy pt-BR/a11y e atualização do inventário LGPD quando houver dado novo.
- Nenhuma task genérica ("implementar backend"). Se não souber o path, investigue antes.
- Não estime em horas; ordem e dependência bastam.

Ao final, rode `/speckit.analyze` antes de implementar qualquer coisa.
