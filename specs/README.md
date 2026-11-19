# Specs — índice e regra de uso

`specs/` guarda a **intenção de mudanças**, não o inventário do sistema. A fila fica no `BACKLOG.md`; o estado atual do domínio, em `docs/convencoes/architecture.md`; a proteção ativa, em `docs/regression-map.md`.

## Quando a spec é obrigatória

| Mudança | Spec? | Fluxo |
|---|---|---|
| Schema, migration, RLS, RPC, auth, rota pública, integração externa | **Sim** | completo (`specify → clarify → plan → checklist → tasks → analyze → implement → converge`) |
| Feature de produto em mais de uma superfície ou mais de um dia | **Sim** | completo; checklist só se risco |
| Bug localizado, copy, ajuste visual de um componente | Não | fix + teste de regressão se tocar domínio |
| Refactor sem mudança de comportamento | Não | PR com antes/depois e testes verdes |

Bug que revelou regra de domínio errada **vira spec** — não vale só patch.

## Nome, estado e retenção

- Pasta `NNN-<slug>`: 3 dígitos sequenciais, kebab-case. **Próximo número livre: 006** (002–005 reservados às frentes ws* de nov/2026 — conferir worktrees irmãs antes de numerar spec nova).
- Estado no `spec.md`: `Draft` → `Clarified` → `Approved` → `Delivered` | `Dropped`.
- Spec `Delivered` **não é editada**. Mudança de rumo = próxima spec, citando a anterior. `Dropped` registra o motivo em uma linha.
- O roteiro dos passos está em `.specify/README.md`; os templates, em `.specify/templates/`.

## Índice

| # | Slug | Tipo | Status | Origem |
|---|---|---|---|---|
| 001 | `proxy-e-rotas-publicas` | as-built | Delivered | regressão (18/nov/2026) |
| 005 | `ops-nov` | mudança | Clarified | Jira REALIZA-37/98 (ws7, 18/nov/2026) — US1 implementada; US2 spec-only |

## Fronteiras já mapeadas, ainda sem spec

Fronteiras candidatas para o próximo trabalho (mapear antes de codar, uma pasta cada): `auth-e-handoff`, `papeis-e-rls`, `duplas-e-semaforo`, `cronogramas-e-agenda`, `pareamento-e-remanejo`, `trilha-especialista`, `jornada-e-instrumentos`, `formularios-e-avaliacoes`, `documentos-e-assinaturas`, `relatorios-e-resumo-publico`, `ia-liza-e-mcp`, `adocao-e-telemetria`, `pessoas-onboarding-importacao`, `jobs-e-cron`. O ponto de partida de cada uma é a seção correspondente de `docs/convencoes/architecture.md` e as linhas de `docs/regression-map.md`.
