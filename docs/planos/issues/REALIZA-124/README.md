# REALIZA-124 — Assistente IA no app

**Absorvida pela [REALIZA-179](../REALIZA-179/README.md)** — não implementar por aqui.

O escopo original desta issue (chat no app pra todos os papéis, tools
tipadas de leitura sobre o registry `src/lib/ia/tools.ts`, `guia_consulta`
com RAG sobre os guias oficiais, tutoriais/deep-links, e escritas com
confirmação na fase 3) está coberto integralmente no plano da 179:

- `/assistente` + `/api/ia/chat` → `REALIZA-179/plan.md` PRs 1–2.
- `guia_consulta` + `ia_chunks` + ingestão dos guias → PR 3.
- `pendencias_docs` e demais tools de leitura → PRs 3/5 (registry).
- Card de confirmação pra escritas → `REALIZA-179/sdd.md` §7.

A fase 0 citada na descrição (`IA_TOOLS`, `ia_eventos`, queries
minimizadas) já existe e é a base. Nada aqui diverge da 179 — a absorção
evita duplicar o planejamento.
