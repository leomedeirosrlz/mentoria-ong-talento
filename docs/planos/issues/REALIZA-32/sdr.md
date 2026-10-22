# REALIZA-32 — sdr.md (segurança / LGPD)

## Modelo de ameaça

- **Alargamento indevido**: auxiliar designado à T1 passa a ler mentorados (menores) da T1 — esperado; o risco é vazar T2 por policy mal-escrita. Mitigação: teste RLS negativo explícito (acceptance) + predicado único via `minhas_turmas_supervisionadas()` (uma fonte de verdade, não N policies divergentes).
- **Escopo por texto**: `escopo_turma` é string livre — typo na designação vira "ver nada" (falha fechada) ou, pior, label colidindo ("T1" vs "T1 · 2026/2027") vira "ver outra turma". Mitigação: select de turma na UI de designação (nunca digitação livre) + validação da action (`turma` precisa existir em `cronogramas.turma`/`turmas.rotulo`).
- **Recursão RLS**: helper é `security definer` lendo `profile_papeis` — tabela com RLS própria. `security definer` + `stable` evita recursão e deixa o planner cachear; grant só `authenticated`.
- **`supervisor_id` ≠ escopo**: manter semântica "responsável pela supervisão" — não remover a coluna nem as policies de write, senão sessões de supervisão perdem o autor/responsável.

## LGPD / menores

- Auxiliar passa a ler **todos os jovens da turma** (Opção A) — é o escopo legítimo do papel operacional (decisão registrada no Jira). Minimização: policies de `profiles`/`mentorados` devem projetar o conjunto de colunas já visível ao supervisor hoje (`PROFILE_COLS_PUBLICAS` em `queries.ts:346` e equivalentes de mentorado) — **não** adicionar `dados_civis`/`*_pessoal` ao escopo do auxiliar (permanecem coord-only — `AGENTS.md` + migrations 0034/0038).
- Auditabilidade: designação via `profile_papeis` já registra quem concedeu (RLS coord-only) — a verificar se há coluna `created_by`/log; se não houver, `[NOVO]` `profile_papeis.created_by` na mesma migration.
- Retenção: sem mudança — escopo cessa quando a linha `profile_papeis` é removida/alterada pela coordenação.
