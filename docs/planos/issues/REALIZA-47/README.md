# REALIZA-47 — Turma entidade plena: `programas`/`turmas` + filtros por turma

- **Jira:** [REALIZA-47](https://kelyng.atlassian.net/browse/REALIZA-47) (Tarefa, prioridade Medium; migrada do Linear REALIZA-62)
- **Tier:** A
- **Veredito da auditoria:** **ABERTO** — plano completo em `plan.md`/`sdd.md`/`design.md`/`sdr.md`/`acceptance.md`.
- **Fonte do domínio:** `docs/planos/turmas-cronogramas.md` (F3), `docs/planos/navegacao-turmas.md` (nível 2), `_issues.json` REALIZA-47.

## O que a issue pede

F3 do plano de turmas: promover `turma` de **label texto** para **entidade**:

- `turmas` e `programas` viram tabelas `[NOVO]` (hoje `duplas.turma` e `cronogramas.turma` são `text` — `0061_cronogramas.sql:30,110`);
- `duplas.turma` → `duplas.turma_id` FK; `cronogramas.turma` → `cronogramas.turma_id` FK;
- filtro por turma em `/duplas`, `/pessoas`, `/registros`, `/api/export`;
- comunicados/materiais opcionalmente por turma;
- versionamento de formulários por turma (decisão de ata, registrada na descrição do Jira).

## Ponte obrigatória: **167 primeiro, 47 depois**

REALIZA-167 ("Parametrizar turma/ciclo T2→T3") implementa o **degrau mínimo**: `resumo_links` + `turma_inscricoes` ainda sobre o label texto — "modelo completo Programa→Turma→Cronograma fica pra 47" (descrição literal da 167). O modelo alvo desta issue **é o destino da migração da 167**:

| Hoje (pós-167) | Alvo (47) |
|---|---|
| `cronogramas.turma text` | `cronogramas.turma_id → turmas.id` `[NOVO]` |
| `duplas.turma text` | `duplas.turma_id → turmas.id` `[NOVO]` |
| `profile_papeis.escopo_turma text` (`0085`) | `profile_papeis.escopo_turma_id → turmas.id` `[NOVO]` |
| `turma_inscricoes.turma text` (167) | `turma_inscricoes.turma_id → turmas.id` |
| `resumo_links.turma text` (167) | `resumo_links.turma_id → turmas.id` |
| view `mentorados_turma` casa por string (`0076`) | casa por `turma_id` |

Invariante do degrau: **o label texto permanece legível** (`turmas.rotulo`) e a migração é por match exato de label — nada se perde se uma string não casar (fica em auditoria manual, não é inventada).

## Documentos

- `plan.md` — sequência executável: migrations, backfill, código, PRs, rollback.
- `sdd.md` — schema completo `[NOVO]`, RLS, compatibilidade, pontos de leitura.
- `design.md` — superfícies afetadas (filtros, `/turmas` vira gestão da entidade).
- `sdr.md` — LGPD/RLS: escopo por turma não pode vazar entre turmas.
- `acceptance.md` — critérios executáveis.

## Dependências

- **Depois de REALIZA-167** (turma_inscricoes/resumo_links existem como texto).
- **Depois de REALIZA-15** (cronogramas) — feita.
- Alimenta: REALIZA-32 (escopo do auxiliar por turma vira FK), REALIZA-39 (pessoas por turma), REALIZA-73 (contexto `?turma=`).

## Esforço / risco

- **G** — migration com backfill + ~20 pontos de leitura + RLS + demo/e2e.
- Risco principal: quebra de match por label divergente (mitigação: constraint + auditoria) e drift entre `turma` texto e `turma_id` durante a transição (mitigação: coluna texto vira gerada/derivada ou cai de vez — ver `sdd.md`).
