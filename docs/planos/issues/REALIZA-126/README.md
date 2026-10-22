# REALIZA-126 — Tools de escrita com confirmação

**Absorvida pela [REALIZA-179](../REALIZA-179/README.md)** — não implementar por aqui.

O escopo original (tools de escrita `registrar_interacao`,
`marcar_situacao_mentorado`, `emitir_link_instrumento`,
`agendar_encontro` — com o guard real "a dupla agenda" — e
`editar_campo_pessoa` na allowlist; confirmação por card no chat /
approve no cliente MCP; nunca write silencioso) está coberto na 179:

- Lista de tools + delegação aos cores do domínio → `REALIZA-179/plan.md`
  PR 5 e `sdd.md` §6 (`src/lib/escritas.ts` [NOVO] extrai os cores de
  `actions.ts` pra action e tool compartilharem a regra).
- Contrato `requer_confirmacao`/`confirmado` + par auditável em
  `ia_eventos` → `REALIZA-179/sdd.md` §7.
- Rollout por flag `IA_ESCRITAS_OK` / `IA_MCP_ESCRITAS` → plan PR 5 +
  sdr §2.4.
