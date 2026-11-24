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

- Pasta `NNN-<slug>`: 3 dígitos sequenciais, kebab-case. **Próximo número livre: 026**
- Estado no `spec.md`: `Draft` → `Clarified` → `Approved` → `Delivered` | `Dropped`.
- Spec `Delivered` **não é editada**. Mudança de rumo = próxima spec, citando a anterior. `Dropped` registra o motivo em uma linha.
- O roteiro dos passos está em `.specify/README.md`; os templates, em `.specify/templates/`.

## Índice

| # | Slug | Tipo | Status | Origem |
|---|---|---|---|---|
| 001 | `proxy-e-rotas-publicas` | as-built | Delivered | regressão (18/nov/2026) |
| 003 | `relatorios-nov` | feature | Delivered | REALIZA-389/407 (ws5, 19/nov/2026) |
| 004 | `materiais-nativos` | as-built | Delivered | auditoria ws6 (19/nov/2026) |
| 005 | `ops-nov` | mudança | Clarified | Jira REALIZA-37/98 (ws7, 18/nov/2026) — US1 implementada; US2 spec-only |
| 006 | `turmas-nov` | feature | Approved | REALIZA-34 (18/nov/2026) |
| 007 | `ux-visual-nov` | mudança | Draft | brief ws10 (19/nov/2026) — auditoria de 14 itens de UX/visual/copy |
| 008 | `telemetria-nov` | feature | Clarified | brief ws11 (19/nov/2026) — spec-only, aguardando implementação |
| 009 | `ia-produto-nov` | feature | Draft | brief ws12 (19/nov/2026) — 7 histórias spec-only |
| 010 | `instrumentos-visual` | mudança | Clarified | REALIZA-511 (23/nov/2026) — modais, roda, gramática, hover, nav |
| 011 | `pdm-cascata` | mudança | Clarified | REALIZA-512 (23/nov/2026) — PDM aninhado + seletor |
| 012 | `conquistas-especialista` | mudança | Clarified | REALIZA-515 (23/nov/2026) — próximo marco, nova rodada, preview |
| 013 | `ficar-em-dia` | feature | Clarified | REALIZA-513 (23/nov/2026) — 1/dia até o encerramento; parcialmente substituída pela 017 (ritmo livre, aceite único) |
| 014 | `liza-evals` | mudança | Clarified | REALIZA-514 (23/nov/2026) — evals das tools novas |
| 015 | `e2e-especialista-uiux` | revisão | Clarified | REALIZA-510 (23/nov/2026) — roteiro e2e UI/UX |
| 016 | `badges` | feature | Clarified | REALIZA-516 (23/nov/2026) — badges isométricas/níveis |
| 017 | `plano-autonomia` | mudança | Clarified | REALIZA-518 (23/nov/2026) — ritmo pills, grade cruzada, recesso, 4 papéis, 1 aceite |
| 018 | `fusao-registro` | mudança | Clarified | REALIZA-519 (23/nov/2026) — fusão no plano, registro 1×N, avaliação única |
| 019 | `sua-semana` | feature | Clarified | REALIZA-520 (23/nov/2026) — card "Sua semana" nas homes |
| 020 | `docs-do-plano` | feature | Clarified | REALIZA-521 (23/nov/2026) — doc do combinado + roteiros lazy |
| 021 | `materiais-liza` | feature | Clarified | REALIZA-522 (23/nov/2026) — materiais estruturados via Liza (backlog) |
| 025 | `plano-recesso-fusao-copy` | mudança | Clarified | REALIZA-525 (24/nov/2026) — recesso inequívoco, fusão verde/neutra, checkbox do kit, copy "valer", card-faixa, disclosures |

## Fronteiras já mapeadas, ainda sem spec

Fronteiras candidatas para o próximo trabalho (mapear antes de codar, uma pasta cada): `auth-e-handoff`, `papeis-e-rls`, `duplas-e-semaforo`, `cronogramas-e-agenda`, `pareamento-e-remanejo`, `trilha-especialista`, `jornada-e-instrumentos`, `formularios-e-avaliacoes`, `documentos-e-assinaturas`, `relatorios-e-resumo-publico`, `ia-liza-e-mcp`, `adocao-e-telemetria`, `pessoas-onboarding-importacao`, `jobs-e-cron`. O ponto de partida de cada uma é a seção correspondente de `docs/convencoes/architecture.md` e as linhas de `docs/regression-map.md`.
