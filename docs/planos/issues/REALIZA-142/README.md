# REALIZA-142 — Submetas recursivas, prazos, atingimento e retrospectiva

- **Jira:** `REALIZA-142` (absorvida por **REALIZA-181**; cluster I → P)
- **Requisitos extraídos pelo cluster I:** [`requisitos-para-181.md`](./requisitos-para-181.md) — recursão por `parent_id` (mesma estrutura Metas/PDM), `prazo_alvo`+`atingida_em`, ~20 submetas por ficha, retrospectiva, UI delicada da árvore.
- **Status:** planejada dentro de `docs/planos/issues/REALIZA-181/` — a recursão "submeta com submeta" vira `pdm_itens.parent_id` sem limite de profundidade (sdd §D2); `prazo_alvo` + `atingida_em` por item (sdd §D3); ~20 submetas no cap compartilhado; retrospectiva no Resumo da jornada (sdd §D6/D7). As decisões abertas anotadas no requisitos (atingida automática × revisita; profundidade visual) foram respondidas em sdd §D7.
- Aceites originais cobertos em `REALIZA-181/acceptance.md` §A.4–5, §C.19, §E.30–32.
