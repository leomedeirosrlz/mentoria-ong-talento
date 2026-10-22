# REALIZA-73 — Hub de turmas na home coord + contexto de turma (`?turma=` + cookie)

- **Jira:** [REALIZA-73](https://kelyng.atlassian.net/browse/REALIZA-73) (Tarefa, prioridade High; migrada do Linear REALIZA-12)
- **Tier:** A
- **Veredito da auditoria:** **PARCIAL / ABERTO** — a parte "gestão de turmas" já existe; este plano cobre **só o que falta** (hub na home + contexto persistente).
- **Depende de:** REALIZA-167 (degrau mínimo de parametrização — o contexto opera sobre o label/entidade que a 167 estabiliza; com a 47 depois, o contexto passa a `turma_id` sem mudar UX).
- **Fonte:** `docs/planos/navegacao-turmas.md`.

## O que JÁ existe (não replanejar)

- `/turmas` + `/turmas/novo` + `/turmas/[id]` — gestão completa de cronogramas (`src/app/(app)/turmas/`, `cronograma-builder.tsx`, `cronograma-editor.tsx`) — REALIZA-46/103, feitas.
- Home da coordenação já renderiza resumo **por cronograma ativo** (`src/components/dashboard-coordenacao.tsx`, alimentado em `src/app/(app)/(home)/page.tsx:76-84` com `turmas={[...new Set(cronogramas.map(c=>c.turma))]}`) — mas é informacional, não um seletor de contexto.
- `/duplas` já tem chips de turma locais (`duplas-lista.tsx:1087-1118`); agenda já tem cronograma vigente (`agenda/page.tsx:74-82`).

## O que falta (escopo desta issue)

1. **Hub de turmas na home** — cards/entrada por turma na home da coordenação quando >1 contexto (cada card = turma com seu estado operacional; clicar fixa o contexto).
2. **Contexto de turma** — `?turma=` na URL + cookie `turma_foco`:
   - precedência: `?turma=` (explícito) > cookie > "Todas" (default);
   - `?turma=` persiste no cookie `turma_foco` (cookie precedente ao `demo_role` na ordem de leitura, como o Jira diz — demo continua funcionando);
   - views operacionais respeitam o contexto: `/` (home), `/agenda`, `/duplas`, `/registros`, `/pessoas` (via 39), `/relatorios`/export.
3. **Seletor de contexto** `[NOVO]` — componente no topo (coord) com "Todas" + turmas; escreve cookie + `?turma=` via `router.replace`/`Link`.

## Não-escopo

- Não recriar `/turmas`; não implementar `/pessoas` por turma aqui (39); não mexer no escopo RLS do auxiliar (32). `/resumo/[slug]` público segue por slug (167).

## Documentos

`plan.md`, `design.md`, `sdr.md`, `acceptance.md`.

## Esforço / risco

- **M** — a parte difícil é a propagação consistente do contexto (cada página tem sua fonte de "turma"). Risco: contexto "grudado" confundindo a coordenação ("cadê a T1?") — mitigado pelo seletor sempre visível + "Todas" óbvio.
