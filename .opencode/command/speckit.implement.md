---
description: Executa as tasks da spec ativa, fase por fase, com verificação
---

Implemente a spec ativa seguindo `tasks.md` na ordem das fases. Não pule a Fase 0.

Antes de cada fase:

1. Releia a task, o path citado e o invariante da constituição envolvido.
2. Confira o que já existe antes de criar: `src/lib/escritas.ts`, `ciclo.ts`, `queries*.ts`, `actions*.ts`, `src/lib/demo/`.

Depois de cada fase, rode e cole a saída:

```bash
pnpm exec next typegen && npx tsc --noEmit
npx eslint src/
pnpm test
```

Regras duras:

- Migration: só arquivo novo, número livre; nunca edite/apague uma existente; SQL vai verbatim para o remoto.
- Server action retorna `{ ok }`/`{ error }`, nunca lança; mensagem em pt-BR.
- Rota pública nova entra em `isPublic` com e2e do token inválido.
- UI: Tailwind no JSX, componentes do kit, sem travessão na copy.
- Nada de placeholder, `TODO` visível ou botão morto.
- Não commite `.env*`, `.devin/`, `HANDOFF.md`, artefatos de agente ou tipos gerados à mão.

Marque a task como concluída **só** depois da verificação. Se um teste falhar por regra de domínio, corrija o código — não o teste — e diga qual invariante estava em jogo.
