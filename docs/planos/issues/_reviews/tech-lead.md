# Review consolidada — persona tech-lead (48 planos com plan.md)

Agente f442d955, saída verbatim condensada. Vereditos: 1 REPROVADO (143),
~12 COM-AJUSTES, resto APROVADO.

## Sistêmicos (aplicar em todas as issues afetadas)

- **Migrations 0106–0110 colidem entre clusters** — número final trava na ORDEM
  DE MERGE, não no plano. Última real: `0105`. `0039` não existe.
- **Rotas `/api/jobs/*`, `/api/mcp`, `/api/ia/*` NÃO são públicas** no middleware
  (`src/lib/supabase/middleware.ts` + `src/proxy.ts`) — todo handler novo precisa
  (a) allowlist no middleware E (b) `Authorization: Bearer $CRON_SECRET` no
  handler. Afeta 168, 169, 178, 179, 182.
- **CHECKs fechados a alargar**: `ia_eventos.canal` ∈(chat,mcp) — 178 digest,
  180 importacao, 52 relatorio → **uma migration única** de canais;
  `notificacoes.tipo` — 35 `pedido_acesso`, 168 `registro_pendente`, 169
  `trilha_prazo(+_coord)`; `emails_enviados.tipo` — 51 `instrumento`, 178 digest.
- Não existe: `src/lib/ia/provider.ts` (só queries+tools), `duplas.pdm_url`
  (dropada 0098), `duplas.dupla_dpp_id` (é a proposta da 98), pg_cron.
- Verificado real: `descricao`+`roles` já existem em `IA_TOOLS` (tools.ts:86-351;
  campo é `roles`, não `papeis`); `emitir_instrumento_core` 0099;
  `sol_efetivar` 0101:211; `rematch_dupla` 0105:392; `submeter_resposta_formulario`
  última def 0080:273; `formularios_sistema_guard` é trigger 0042:82;
  `formularios_limpa_respostas` 0080:53; `MOTIVOS_REAGENDAMENTO` ciclo.ts:187;
  `AgendarEncontroDialog` props :39-61; motion `^13.4.0` instalado;
  26 HTMLs em `docs/mockups/`.

## REPROVADO

- **143** — BLOCKER variante A×B sem default + 2 "a verificar" sem fallback.
  Correção pedida: registrar default B (grade 2-col, menos arriscado pro SVG) e
  tratar A como follow-up.

## COM-AJUSTES — o ajuste exato

- **138** — checar se os 26 HTML são git-tracked antes do `mv`; testar CSP do iframe no preview real.
- **157** — confirmar se prop `trigger` é obrigatório nos 5 dialogs antes do refactor (replicar padrão `agendar-encontro-dialog.tsx:238-247`).
- **168** — registrar `/api/jobs/*` público + widen `notificacoes.tipo` (`registro_pendente`, copiar verbatim de 0103); `vercel.json` compartilhado com 169/182 — quem mergeia primeiro cria.
- **169** — mesmo ajuste middleware+Bearer; widen `notificacoes.tipo` (`trilha_prazo`/`trilha_prazo_coord`); decidir semântica de marco pulado + href.
- **170** — travar ordem 167→170→183; `0106_resumo_acessos` da 183 é concorrente, não "já aplicada"; validar `char_length(token)>=20`+single-use na revisão.
- **174** — verificação runtime das 4 personas demo vira gate do PR.
- **175** — shape `Registro`+campos data/avaliação "a verificar" → resolver no passo 0, registrar no sdd.
- **176** — dados do `ResumoTurmaCard` + seletores e2e "por confirmar" → checklist do PR.
- **177** — varredura ~51 arquivos: exigir inventário numerado + a11y audit (foco, aria, overflow) como artefato do PR.
- **178** — `src/lib/ia/provider.ts` é [NOVO] (marcar); rota cron: allowlist+Bearer; canal `digest`/`emails_enviados.tipo` convergir na migration única.
- **179** — corrigir claims: `descricao` já existe; campo é `roles` (tool nova declara `roles: TODOS_PAPEIS`); especificar exposição `/api/mcp`+`/api/jobs` no middleware + auth no handler.
- **180** — dep real na 179 (provider/chamarModelo/checarLimiteIa são [NOVO]) — registrar ordem 179→180 além da 178.
- **182** — rota cron allowlist+Bearer; PII `sinais[].texto`/`detalhe` "a verificar" → resolver ANTES de persistir snapshot (LGPD).
- **183** — remover fallback de salt público `"realiza-resumo-acesso-v1"` (hash de IP vira pseudônimo previsível — gate o log na presença da env); corrigir comentário sobre `void` vs `.then()` (o insert interno já é awaited).
- **32** — BLOCKER turma×designadas é pré-passo sequenciado; registrar resposta no sdd antes da etapa 3; policies saem de `pg_policies` (regra nunca-DDL-de-memória).
- **35** — CHECK `notificacoes.tipo` alarga `pedido_acesso` na mesma migration; DNS/Cloudflare = dependência externa do Thiago.
- **52** — canal `'relatorio'` entra na migration compartilhada de canais (não `0110` solto).

## APROVADO limpo

15, 16, 18, 20, 21, 22, 26, 34, 36, 37, 39, 47, 49, 51, 54, 56, 61-64 (vereditos
produto), 66, 68-71, 73, 96-103, 159, 166, 167, 172, 173, 181 + FEITOs.

## Notas por issue (pontos técnicos conferidos)

- **21/26** — DDL/RLS verbatim do padrão `encontro_notas`; trigger cobre RPC do jovem+PATCH+SQL; `desmarcar_encontro` DELETE previsto; `motivo_reagendamento` guarda LABEL (lookup por value cai no fallback — previsto).
- **36** — modelo de anexos espelha padrão (bucket privado + service-only + signed 300s); `visible_if` avaliado server-side; confirmar editor canônico de `disponibilidade`.
- **47** — backfill label→id com auditoria de órfãos não-fatal; nome FK pro embed PostgREST a verificar com types regenerados; ordem 167→47→{32,39,73}.
- **49** — `RelatorioCanvas` existe e é genérico; zero migration; query do `RespostasSection` a verificar.
- **51** — CHECK `emails_enviados.tipo` alargado; assinatura real de `emitir_instrumento_core` (0099:37, `p_origem` enum×text) conferir; colunas `email` de profiles/mentorados a verificar.
- **54** — `pdm_url` dropada respeitada; union prepara troca pela 181; confirmar se `InstrumentoResultado` aceita `open` controlado.
- **56** — compute puro + dataset agregado; só consulta snapshots quando a tabela existir (schema-contract) — regra explícita.
- **62** — sweep `rg` mandatório; distinção data-de-evento × prazo; admite no-op honesto.
- **66** — compressão no onChange, nunca bloqueia; `image/webp` já allowlisted; `saneiaNome` deve gerar `.webp`.
- **68** — sensíveis via `*_pessoal`; `atividade_outro` passa por `celula()` anti-fórmula.
- **69/70** — CHECK exclusivo `num_nonnulls<=1` em promovido_*; `formularios_sistema_guard` é trigger (disable/enable via 0043); caps 500/link, 50/dia validar em staging.
- **71** — série crua só coord/sup/jovem; mentor quantizado — respeito ao BLOCKER.
- **98** — CHECK impede self-ref+limita trilha esp; `on delete set null`; backfill `limit 1`; conferir `pg_get_functiondef` de `aceitar_solicitacao` antes do delta.
- **159** — grants/revoke no padrão `rematch_dupla`; guards `concluido`+sem dupla viva; conferir enum `mentor_tipo` real.
- **166** — fila global `e2e-staging` com e2e-preview; `::error::` sem skip; required check manual = dependência externa.
- **167** — grep-zero de `RESUMO_SLUG_T2` como critério; seed FILA_T2 ids verificar formato uuid.
- **172** — cada item com "verificar antes de codar" — disciplina mantida no PR.
- **173** — `maxEncontros("dpp")` existe; demo-parity exigida.
- **181** — RLS no padrão `instrumentos_da_dupla`; `pg_get_functiondef` do rollback previsto (0080:273 é última def); backfill idempotente; `disable/enable trigger` documentado.
