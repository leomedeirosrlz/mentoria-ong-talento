# REALIZA-141 — Metas: reordenação = prioridade (meta_ordem)

- **Jira:** `REALIZA-141` (absorvida por **REALIZA-181**; cluster I → P)
- **Requisitos extraídos pelo cluster I:** [`requisitos-para-181.md`](./requisitos-para-181.md) — a lista do que 181 precisa incorporar (ordem=prioridade, remover `meta_principal`/`rev_*`, cap ~10 metas, legado JSONB ilegível).
- **Status:** planejada dentro de `docs/planos/issues/REALIZA-181/` — a persistência de ordem vira `pdm_itens.ordem` (posição entre irmãos = prioridade, sdd §D3); remoção de `meta_principal`/`rev_*` do form `metas` na migration 0106 (sdd §D5 "Forms oficiais atualizados"); cap de 10 metas no trigger/RPC; UI ↑↓ + "a primeira é a mais importante" (design.md).
- Aceites originais cobertos em `REALIZA-181/acceptance.md` §C.16, §E.29, §G.38.
