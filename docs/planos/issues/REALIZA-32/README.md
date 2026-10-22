# REALIZA-32 — Auxiliar por turma: escopo de leitura/escrita (RLS por turma)

- **Jira:** [REALIZA-32](https://kelyng.atlassian.net/browse/REALIZA-32) (Tarefa, prioridade High; migrada do Linear REALIZA-55)
- **Tier:** A
- **Veredito da auditoria:** **ABERTO** — plano completo nesta pasta.

## O que a issue pede

Decisão já tomada (Thiago, 03/out/2026, verbatim do Jira):

> coordenação é **global**; **supervisor/auxiliar é por turma**.

Hoje o escopo do auxiliar é **por dupla**: `duplas.supervisor_id` ancora cada dupla a um supervisor (`0001_init.sql:173-178` — policies `duplas_supervisor_*`; `src/lib/queries.ts:415` `.or('mentor_id.eq.,supervisor_id.eq.')`). O modelo novo: auxiliar **designado à turma** enxerga as duplas da turma — via `turma_membros`/`turmas.auxiliar_id` ou `profile_papeis.escopo_turma` (as opções e a recomendação estão no `sdd.md`).

## Sub-pergunta em aberto (bloqueio registrado)

> **BLOCKER:** auxiliar vê TODAS as duplas da turma ou só as designadas pela coordenação?

Documentada como decisão pendente com os dois cenários desenhados em `sdd.md` — a implementação espera resposta, mas o schema-base (designação auxiliar↔turma) é comum aos dois caminhos.

## Estado atual (evidências)

- `duplas.supervisor_id` — vínculo por dupla; RLS `duplas` lê `supervisor_id = my_profile_id()` (`0001_init.sql:173`); update idem (`:177-178`).
- `encontros`/`registros`/`encaminhamentos` — policies embutem a dupla supervisionada pelo mesmo `supervisor_id` (`0001_init.sql:187,213,240`).
- `profile_papeis.escopo_turma text` (`0085_profile_papeis.sql`) — já existe papel com escopo por label de turma; é o encaixe natural da designação, mas hoje **não alimenta RLS de leitura de duplas** (a verificar policies que já leem `escopo_turma` — recon indica uso pontual).
- `getSupervisaoAlvos` (`src/lib/queries-supervisao.ts:58-107`) — alvos do dialog de supervisão = duplas onde `supervisor_id = me.id`.
- `podeSupervisionar` (`src/lib/ciclo.ts`) — gate de papel para superfícies de supervisão.
- `duplas-lista.tsx:1289+` — a visão "auxiliar executivo" já **agrupa supervisionadas por turma** na UI; o escopo de dados é que ainda é por dupla.

## Dependências

- Recomendado depois de **REALIZA-167** (turma_inscricoes dá o pertencimento) e alinha com **REALIZA-47** (escopo por `turma_id` quando a entidade existir — o sdd cobre as duas ordens).
- Relacionada: THI-16 (rename supervisor→auxiliar executivo — já refletido na UI; o `role` do banco segue `supervisor`).

## Documentos

- `plan.md` — migrations, policies, código, demo/e2e, rollback.
- `sdd.md` — modelagem da designação + RLS completa + o BLOCKER.
- `design.md` — superfícies do auxiliar e da coordenação.
- `sdr.md` — escopo, menores, auditoria.
- `acceptance.md` — critérios RLS/e2e.

## Esforço / risco

- **M-G** conforme o desfecho do BLOCKER (turma inteira = mais simples; por dupla designada = mais uma tabela).
- Risco principal: **alargar leitura do auxiliar** sem querer (menores de outras turmas) — mitigado por policies explícitas + testes RLS em acceptance.
