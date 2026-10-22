# Cluster D — concluído (decisões pendentes, tier C)

Produzido em `docs/planos/issues/` — cada pasta tem `README.md` (card de
índice: resumo Jira, veredito, escopo, deps, esforço, riscos) + `decisao.md`
(contexto, opções com prós/contras, recomendação, pergunta exata pro Thiago).

| Issue | Pasta | Recomendação em 1 linha | Pergunta-chave |
|---|---|---|---|
| REALIZA-33 | `REALIZA-33/` | Escopo B: inventário (draft completo já no decisao.md — 30+ linhas por tabela) + revisão jurídica do texto `autorizacao-responsavel` (hoje é RASCUNHO sem fonte oficial — `src/lib/documentos/texto.ts:100`) + política de retenção escrita; anonimização automática fica pro 1º encerramento de ciclo | Confirmar escopo B × C + arestas (`mentorados.notas` coord-only? remover `comprovante_bancario`? quem revisa o termo) |
| REALIZA-53 | `REALIZA-53/` | Criar Shared Drive `Realiza.vc` no Workspace nonprofit como acervo canônico (Thiago+Léo gestores) + migração via checklist com donos — pré-requisito da 65 | Confirmar criação do Shared Drive + adoção como canônico |
| REALIZA-65 | `REALIZA-65/` | Gatilho: integrar quando storage ≥ ~70% do 1 GB free, ou quando a 55 entrar em dev, ou na virada de ciclo — com classificação quente×frio já assinada; até lá uploads seguem no Supabase | Confirmar gatilho + regra quente×frio |
| REALIZA-67 | `REALIZA-67/` | Devolução entra no MVP no sabor "reabrir pra ajuste" (link reabre com rascunho intacto; aviso no WhatsApp do mentor); comentário e PDF anotado ficam pra fase 2 | Confirmar o sabor da devolução no MVP |

## Notas transversais

- **53 → 65 encadeadas:** o offload (65) precisa do Shared Drive (53) —
  recomendado executar a 53 imediatamente (PP operacional, sem código).
- **33 já entrega 60%:** o inventário draft por tabela está completo no
  `decisao.md` — virar doc definitivo é só revisão.
- **67 converge com a 20 (cluster I):** o plano da 20 já desenha devolução
  (`devolvida`+`devolvido_motivo`) e tem um BLOCKER com a mesma pergunta —
  a 67 responde o mesmo "reabre a mesma resposta" pro editor de PDF; se a
  55 herdar o chassis `formulario_links` evoluído, reusa a mesma RPC/ciclo.
- **67 não bloqueia:** a decisão só vira código com a 20/55, mas congela o
  ciclo de estados do schema `atividades` desde já.
- Achados de recon que valem repassar: autorização do responsável é
  rascunho sem fonte oficial; Roda da Vida coleta saúde/espiritualidade
  (Art. 11) sem base explícita no termo; `terceiros_contatos` guarda dados
  de não-titulares sem consentimento; `avatares` é bucket público com foto
  de menor (decisão consciente, mas merece constar na política).

Fontes usadas: `_contexto-agentes.md`, `_manifest.md`, `_issues.json`,
`_recon/schema-mapa.md`, `_recon/ops-mapa.md`, `_recon/issues-status.md`,
`docs/planos/_contexto.md`, `docs/planos/forms-google-mapeamento.md`,
`docs/planos/editor-pdf.md`, `docs/planos/README.md`,
`docs/analise-transcricao-mentor.md` + verificação direta em
`supabase/migrations/` (0001–0105), `src/lib/documentos/texto.ts`,
`src/app/privacidade/page.tsx`, `src/lib/demo/pdf.ts`,
`~/.config/devin/mcp_config.json`.
