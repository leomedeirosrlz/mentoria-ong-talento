<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contrato do agente — Realiza.vc

Leia nesta ordem, só o que a tarefa toca:

1. `.specify/memory/constitution.md` — princípios e gates (sempre).
2. `docs/convencoes/architecture.md` — dados, auth e fronteira de código.
3. `docs/convencoes/conventions-ui.md` — qualquer UI.
4. `docs/convencoes/ci-e2e.md` — antes de push, merge ou deploy.
5. `docs/regression-map.md` — invariante ↔ teste que o protege.
6. `specs/<NNN>-<slug>/` se a tarefa tem spec; `BACKLOG.md` é a fila.

## Regras duras

- **Migrations são alçada do lead/orquestrador.** Agentes (Devin, Claude, subagents) não criam, editam nem aplicam arquivo em `supabase/migrations/`, não rodam `supabase db push/migration up`, `psql` de schema ou escrita no ledger. Só sugerem SQL em comentário/spec/relatório. O lead revisa, numera, escreve e aplica. Exceções já produzidas nesta rodada ficam em `docs/convencoes/agents-migrations.md` e passam por revisão antes de integrar.
- SLC: entregue a fatia vertical completa e polida. Sem placeholder, stub ou "depois".
- Sem workaround para infra quebrada: faça o passo correto ou pare e pergunte.
- Autorização é RLS no banco (`my_role()`/`my_profile_id()`); nunca só na tela ou na action.
- Server action retorna `{ ok }` ou `{ error }`, nunca lança; mensagem em pt-BR.
- Migration: arquivo **novo**, próximo número livre (lacunas são intencionais); nunca edite ou apague uma existente — o remoto já rodou. SQL vai **verbatim** para o banco. Staging recebe na hora do push; **produção só na janela do release** (`staging → main`), nunca no meio do backlog.
- Antes de SQL: confira o schema real (`information_schema`, `pg_policies`, `pg_enum`).
- Rota pública nova entra em `isPublic` (`src/lib/supabase/middleware.ts`) + e2e do token inválido.
- Nunca re-seede produção. Antes de qualquer write, confira o ref do `.env.local` (o de dev aponta para **staging**, não para prod).
- UI: Tailwind no JSX, kit de `src/components/ui`, Phosphor `dist/ssr` em server component, copy pt-BR sem travessão.
- Não invente número, contagem ou caminho: verifique com `ls`/`grep`/`git log`.
- Não commite `.env*`, `.devin/`, `HANDOFF.md` nem artefatos de agente (o `.gitignore` já lista).
- Commit conventional; `[deploy]` e `[e2e-preview]` só com autorização do Thiago.

## Quando abre spec

Schema/RLS, auth, rota pública, integração externa ou mudança em mais de uma superfície: rode o fluxo `/speckit-specify → clarify → plan → tasks → analyze → implement` em `specs/<NNN>-<slug>/` (comandos em `.opencode/command/`, roteiro em `.specify/README.md`). Bug localizado ou copy: sem spec; fix de domínio ganha teste de regressão.

## Definição de pronto (rode e cole a saída no PR)

```bash
pnpm exec next typegen && npx tsc --noEmit
npx eslint src/
pnpm test
pnpm guard   # 10 regras: ledger de migrations, segredos, links, marcadores, workflows
# tocou rota/fluxo? e2e local conforme docs/convencoes/ci-e2e.md
# PR mergeia com o check "e2e-app / e2e" verde
```

## Não faça

- Não rode build/e2e contra produção nem contra o Supabase de prod (`yhjzmxleotahijinjepl`).
- Não aplique DDL de memória nem redigite SQL no MCP: passe o arquivo verbatim.
- Não edite migration aplicada, `src/lib/database.types.ts` (gerado) nem `.specify/templates/*`.
- Não crie segunda constituição, segunda arquitetura ou segunda convenção de UI.
- Doc que contradiz o código: o código vence e a doc é corrigida na mesma PR.
