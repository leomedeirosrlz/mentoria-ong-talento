# REALIZA-125 — Endpoint MCP (`/api/mcp`)

**Absorvida pela [REALIZA-179](../REALIZA-179/README.md)** — não implementar por aqui.

O escopo original (servidor MCP stateless Streamable HTTP expondo o mesmo
`IA_TOOLS`, auth por identidade real do usuário — OAuth Supabase ou PAT
revogável criada no `/perfil` com `ultimo_uso_em` — gate `coordenacao`
no handshake, read-only inicial, canal `mcp` no `ia_eventos`) está no
plano da 179:

- Route handler + `mcp-handler` + `tools/list`/`tools/call` →
  `REALIZA-179/plan.md` PR 4 e `sdd.md` §4.
- `ia_tokens` + emissão/revogação no `/perfil` → PR 4 + design §2.
- A decisão de identidade (JWT OAuth vs. PAT→sessão mintada, sem duplicar
  RLS) está registrada em `REALIZA-179/sdd.md` §4 e nas decisões §10.

`ia_eventos.canal='mcp'` já é suportado pelo CHECK da 0083 — nenhuma
migration extra pro canal.
