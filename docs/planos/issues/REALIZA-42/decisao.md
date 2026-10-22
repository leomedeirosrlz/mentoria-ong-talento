# REALIZA-42 — decisao.md

## Decisão registrada

A camada de IA do Realiza.VC entra em **progressão faseada**, na ordem:

1. **Regras determinísticas explicáveis** — já entregue: semáforo
   `saudadeDaDupla` (`src/lib/ciclo.ts`), `resumoSemana`/
   `textoResumoSemana`, match determinístico de importação
   (`src/lib/importar-registros.ts`), `resumo_jornada` em encerramentos.
2. **Narrativa LLM sobre agregados sem PII, gated** — REALIZA-178:
   `AgregadosCiclo` tipado (só números/distribuições), flag
   `IA_NARRATIVA_OK`, provider com retenção zero.
3. **Apoio à decisão via tools tipadas** — REALIZA-179: `IA_TOOLS` com
   Zod + allowlist de papel + client da sessão (RLS = bound real) +
   `ia_eventos`; chat e MCP como dois transportes do mesmo registry.
4. **Sugestão com confiança e revisão humana** — REALIZA-180: visão e
   match semântico produzem sugestões; escrita só via RPC existente,
   sempre com humano no loop.
5. **NLP sobre texto livre de menores** — **adiada**: exige parecer
   jurídico/DPO antes de qualquer envio de `reflexao`, `feito`, currículo
   ou `dados_civis` a terceiro.

Regras invioláveis em todas as fases (reafirmadas):

- O modelo **nunca** gera SQL nem escreve direto em tabela — tools são a
  única fronteira; escritas delegam às actions/RPCs do domínio.
- A autorização real é RLS/papel, não o prompt — tool chamada fora do
  papel vira `ia_eventos` com `papel_negado` e resposta de erro.
- Toda chamada é auditada em `ia_eventos` (metadados, não conteúdo).
- Transcript não persiste por default (memória do client).
- Provider só com DPA + retenção zero contratual — gate de lançamento,
  não detalhe.

## Opções consideradas e descartadas

| Opção | Por que não |
|---|---|
| LLM genérico com acesso amplo (tool de query livre) | SQL livre + PII — incompatível com LGPD/menores e com a auditoria |
| IA primeiro, regras depois | Sem baseline determinístico explicável não há como validar nem confiar |
| Narrativa sobre linhas/dados brutos | Vaza PII pro provider; agregados bastam pra prosa executiva |
| Cronograma inverso (chat antes dos relatórios) | Relatórios entregam valor sem LLM; chat sem tools vira demo |

## Pendências que sobrevivem à decisão

- **BLOCKER ativo**: confirmação de DPA + retenção zero do provider
  (candidato: opencode API, per `docs/planos/ia-chatbot-mcp.md`) — até
  lá, tudo que chama modelo fica desligado por flag.
- Parecer jurídico pra fase 5 (NLP em texto livre de menores) — não está
  em nenhuma issue atual; registrar quando a fila chegar.
- `a verificar` herdados das issues filhas: OAuth server do Supabase pro
  MCP (179), suporte a visão do provider (180), habilitação do envio de
  e-mail real em prod (178).

## Pergunta pro Thiago

Nenhuma pendente **de decisão** — o provider é confirmação contratual,
não escolha de arquitetura. Se a resposta do DPA vier negativa, a decisão
fallback já está escrita: permanecer nas fases 1–3 parcial (narrativa
desligada) até operador adequado existir.

**Recomendação: fechar a issue como decidida.** A implementação vive em
178/179/180.
