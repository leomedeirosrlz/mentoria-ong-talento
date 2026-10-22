# Cluster P — concluído

Cluster: **PDM nativo (feature isolada grande)** — issues 181 (absorve 17, 141, 142).

## Produzido

| Arquivo | Conteúdo |
|---|---|
| `REALIZA-181/README.md` | Resumo Jira, veredito ABERTO, escopo, deps, esforço **G**, riscos |
| `REALIZA-181/plan.md` | 4 PRs ordenados, migration `0106`, arquivos tocados, rollback, ordem de migração CI |
| `REALIZA-181/sdd.md` | As duas decisões obrigatórias: **tabela nativa × forms engine** (nativa — forms seguem como coleta) e **`pdm_itens` recursiva única × `pdm_metas`+`pdm_submetas` separadas** (única com `parent_id` — cluster I: metas e PDM compartilham a estrutura). DDL, RLS, 7 RPCs, projeção `metas`/`pdm`→árvore por `origem_campo`, backfill, atualização do form `metas` (141), decisões §D7 |
| `REALIZA-181/design.md` | Personas/JTBD, anatomia do editor + árvore (indent leve, collapse, ↑↓ sem DnD), 4 superfícies (ficha, `/jovem/pdm` [NOVO], resumo jornada, snapshots legados), estados, reuso `ui/*`, microcopy pt-BR, a11y treeview |
| `REALIZA-181/sdr.md` | Ameaças cross-dupla/cross-PDM, LGPD menores (coord lê conteúdo — decisão registrada), RLS só-select + escrita só-RPC, procedência/auditoria, verificações REST |
| `REALIZA-181/acceptance.md` | 40 critérios dado/quando/então — RPCs, RLS, projeção/backfill, Vitest, e2e ficha+jovem+resumo, demo, regressão de respostas antigas, gates |
| `REALIZA-17/README.md` | Absorção → 181 |
| `REALIZA-141/README.md` | Absorção → 181 (ordem=`pdm_itens.ordem`, cap 10, update do form); aponta `requisitos-para-181.md` do cluster I — **todos os pontos incorporados** |
| `REALIZA-142/README.md` | Absorção → 181 (recursão=`parent_id`, `prazo_alvo`/`atingida_em`, retrospectiva); idem — decisões abertas do requisitos respondidas em sdd §D7 |

## Decisões-chave registradas (sdd §D7)

- PDM vivo = `pdm` + `pdm_itens`; respostas jsonb = snapshots históricos intocados, projetam pro documento e backfillam na 0106.
- Metas e PDM = mesmo dado (slot `meta_N` compartilhado entre os forms).
- Co-edição real: mentor + mentorado (já tem login) escrevem; coord + supervisor leem.
- Atingida entra automático no resumo; `revisao_pdm` do checklist segue rito manual.
- `duplas.pdm_url`: morta em `0098`, zero migração de URL.

## Sem BLOCKERs abertos

As duas perguntas de arquitetura exigidas estão respondidas; não resta decisão
de produto pendente pra implementar.
