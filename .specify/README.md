# Spec-Driven Development — como funciona neste repo

Este diretório segue o fluxo do [GitHub Spec Kit](https://github.com/github/spec-kit) (comandos `/speckit.*`), adaptado ao Realiza.vc. Os artefatos são versionados aqui — não são gerados por CLI, então não há `scripts/bash` nem `feature.json` para sincronizar.

## Onde cada coisa mora

| Arquivo | Papel | Quem mantém |
|---|---|---|
| `.specify/memory/constitution.md` | princípios duráveis + precedência | humano (emenda) |
| `.specify/templates/*.md` | forma canônica de spec, plano, tasks e checklist | humano |
| `specs/NNN-<slug>/spec.md` | **o quê** e **por quê** de uma mudança | agente escreve, humano aprova |
| `specs/NNN-<slug>/plan.md` | **como** técnico + Constitution Check | agente |
| `specs/NNN-<slug>/tasks.md` | execução faseada, com path e verificação | agente |
| `specs/NNN-<slug>/research.md` | decisão técnica comparada (opcional) | agente |
| `specs/NNN-<slug>/data-model.md` | schema novo (opcional) | agente |
| `specs/NNN-<slug>/contracts/` | RPC/rota nova (opcional) | agente |
| `specs/NNN-<slug>/checklists/` | revisão de requisitos, só em área de risco | revisor humano |
| `AGENTS.md` | contrato operacional do agente | humano |
| `docs/convencoes/*` | implementação por superfície | humano |
| `BACKLOG.md` | fila (o quê/quando) | humano |
| `docs/planos/` | histórico de decisão — **congelado** | ninguém edita |

## Quando a spec é obrigatória

| Mudança | Spec? | Fluxo |
|---|---|---|
| Schema, migration, RLS, RPC, auth, rota pública, integração externa | **Sim** | completo |
| Feature em mais de uma superfície ou mais de um dia | **Sim** | completo; checklist só se risco |
| Bug localizado, copy, ajuste de um componente | Não | fix + teste de regressão se for domínio |
| Refactor sem mudança de comportamento | Não | PR com antes/depois e testes verdes |

Bug que revelou regra de domínio errada **vira spec** — a correção não pode ser só um patch.

## Fluxo

| # | Ação | Comando | Artefato | Antes de seguir |
|---|---|---|---|---|
| 0 | Escolher a mudança | — | linha no `BACKLOG.md` (ou issue) | passou na tabela acima |
| 1 | Especificar | `/speckit.specify <o quê/por quê>` | `specs/NNN-<slug>/spec.md` | histórias P1 com cenários Dado/Quando/Então |
| 2 | Clarificar | `/speckit.clarify <foco>` | `spec.md` atualizado | zero `NEEDS CLARIFICATION` |
| 3 | Planejar | `/speckit.plan <restrições>` | `plan.md` (+ opcionais) | Constitution Check A1–A10 sem violação |
| 4 | Checklist (só risco) | `/speckit.checklist <foco>` | `checklists/<tipo>.md` | revisor humano marcou |
| 5 | Quebrar tarefas | `/speckit.tasks` | `tasks.md` | toda task tem path e verificação |
| 6 | Analisar | `/speckit.analyze` | relatório (não grava) | zero conflito spec × plano × tasks |
| 7 | Implementar | `/speckit.implement <fase>` | código + testes | rodar o DoD a cada fase |
| 8 | Convergir | `/speckit.converge` | `tasks.md` append-only | nenhum gap aberto |
| 9 | PR | — | PR | checks verdes; `[deploy]` só com autorização |

Os comandos vivem em `.opencode/command/speckit.*.md` e são instruções de prompt — se você usa outro harness, leia o arquivo e siga o mesmo roteiro.

## DoD (rodar e colar a saída no PR)

```bash
pnpm exec next typegen
npx tsc --noEmit
npx eslint src/
pnpm test
pnpm schema:check        # precisa do ambiente alvo configurado
```

Tocou rota ou fluxo? e2e conforme `docs/convencoes/ci-e2e.md`. O check obrigatório do PR é `e2e-app / e2e`.

## Nome, estado e retenção

- Pasta `NNN-<slug>`: 3 dígitos, sequencial, kebab-case. O índice fica em `specs/README.md`.
- Estado no `spec.md`: `Draft` → `Clarified` → `Approved` → `Delivered` | `Dropped`.
- Spec `Delivered` **não é editada**. Mudança de rumo = próxima spec, citando a anterior.
- Spec `Dropped` registra o motivo em uma linha; não é apagada no mesmo trimestre.
- Spec não substitui `docs/convencoes/architecture.md`: referencie, não copie.

## Emenda da constituição

PR só de constituição, com justificativa e atualização dos templates afetados. Artigo que virou letra morta ou não é verificável sai na revisão trimestral. Nada de número volátil (contagem de teste, número de migration, ref de projeto) no texto.
