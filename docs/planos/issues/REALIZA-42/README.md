# REALIZA-42 — Decisão: camada de IA

**Jira:** [REALIZA-42](https://kelyng.atlassian.net/browse/REALIZA-42) ·
Tier C (README + decisao.md)

## Resumo

Issue de decisão: "como a camada de IA entra no produto?" A resposta já
está implementada em direção e detalhada em execução:

- A **progressão faseada** do `docs/planos/relatorios-inteligencia.md`
  (regras determinísticas → narrativa em agregados → apoio à decisão →
  recomendação → NLP em texto livre só com parecer jurídico) é a arquitetura
  escolhida — não um LLM genérico ligado na base.
- As issues de execução materializam isso:
  - **REALIZA-178** — fases 1–2: relatórios determinísticos + primeira
    chamada LLM **só sobre agregados sem PII**, gated por flag e provider
    com retenção zero.
  - **REALIZA-179** — fase 3: assistente/MCP sobre `IA_TOOLS` tipadas —
    o modelo nunca gera SQL nem escreve direto; RLS é o bound; escrita
    só com confirmação humana.
  - **REALIZA-180** — fase 4 no domínio de importação: IA sugere, humano
    aprova, RPC existente escreve.
- A **fase 0 já está no código** (`src/lib/ia/tools.ts` +
  `0083_ia_eventos.sql`) — a decisão não é teórica, é confirmação do
  caminho já pavimentado.

## Recomendação

**Fechar como respondida** — ver `decisao.md` para o registro formal,
opções descartadas e pendências que sobrevivem à decisão (parecer
jurídico pra fase 5; confirmação de DPA/zero-retention do provider como
gate de qualquer chamada real).
