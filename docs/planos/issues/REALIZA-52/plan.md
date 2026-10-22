# REALIZA-52 — plano de implementação

Descrição essencial: metade 1 = `src/lib/score.ts` puro com
`scoreDupla`/`scoreTurma` (componentes explicáveis sobre os sinais de
`saudadeDaDupla` + aderência + avaliações + engajamento) exposto como coluna
no relatório coord — zero LLM. Metade 2 = narrativa da turma: template
determinístico (`narrativa.ts`) agora; caminho LLM atrás de flag+provider+
decisão jurídica, payload só-agregados, auditoria `ia_eventos` (canal novo
`relatorio`).

## Passo 0 — referências

- `src/lib/ciclo.ts`: `saudadeDaDupla` (:1245 — insumo), `encontroEsperado`
  (:948), `diasAtrasoRegistro` (:2005), `textoResumoSemana` (:1227 — tom da
  prosa do template).
- `src/lib/encerramento.ts:54` — `PESO_AVALIACAO` (+`mediaAvaliacao` :141).
- `src/lib/relatorio.ts` — `COLUNAS`/`catalogoDe` (onde `score` entra),
  `COLUNAS_PUBLICAS` (onde **não** entra).
- `src/lib/ia/tools.ts` + `queries.ts` — registry/padrão da camada IA;
  `supabase/migrations/0083_ia_eventos.sql` — RPC de auditoria + CHECK
  `canal in ('chat','mcp')`.
- `docs/planos/relatorios-inteligencia.md` (:116 score/risco, :125-129
  LGPD/gate, :114 digest).
- `docs/planos/issues/REALIZA-182/` — snapshots (componente tendência).

## Passo 1 — `src/lib/score.ts` [NOVO]

Implementar `ScoreComponente`/`ScoreDupla`/`scoreDupla`/`scoreTurma` (sdd
§1). Testes `tests/score.test.ts` [NOVO]:

- dupla perfeita → 100±; com `sinais` risco → cai ~25/sinal;
- sem avaliações → componente sai e pesos renormalizam (score não morre);
- pausada/concluída → `score=null`;
- com/sem snapshots → tendência entra/sai determinística;
- `hoje` fake → determinismo total (mesma entrada, mesmo score — **o**
  invariante).

## Passo 2 — superfície

- `relatorio.ts`: `COLUNAS`/`catalogoDe` + `score` (render `ScoreBadge`
  [NOVO] = número + `Tooltip` com `componentes` — "87 · aderência −8
  (2 atrasos)"). O `__status`/`__papel` pattern da linha acomoda metadado.
- `/relatorios` page: computa scores junto do dataset (mesma carga do
  semáforo — `saudadeDaDupla` já roda ali se a 56 estiver; senão compute
  aqui).
- Confirma que `COLUNAS_PUBLICAS`/`COLUNAS_CONTATO` e a allowlist da 170
  **não** incluem `score` (assert no teste do catálogo).

## Passo 3 — narrativa template

- `src/lib/narrativa.ts` [NOVO]: `narrativaTurma(stats)` → texto pt-BR
  (molde `textoResumoSemana`): intro (período+turma), saúde (distribuição),
  operação (aderência/presenças/docs), fecho. Função pura, testável.
- UI: card/botão "Gerar resumo do período" no `/relatorios` (se 56 já tem o
  card do digest, encaixa nele; senão, bloco standalone) — server action
  `gerarResumoPeriodo` coord-only que retorna `{texto}` ou `{error}`.

## Passo 4 — caminho LLM (gated, pode sair no mesmo PR ou depois)

- Migration `0110` — CHECK `canal + 'relatorio'` (sdd §5).
- `src/lib/ia/narrativa.ts` [NOVO]:
  `montarPayloadTurma(stats)` → o objeto do sdr §allowlist (teste: nenhuma
  key fora da lista — assert literal);
  `gerarNarrativaLlm(stats, callModel)` → gated:
  `IA_NARRATIVA_ENABLED` + provider env + `callModel` injetado (a 178 define
  o provider real; enquanto isso a função aceita um stub — mas **não
  implementa** o client do provider, é a 178 que entrega).
- `registrar_ia_evento` com `canal='relatorio'`, `tool='narrativa_turma'`,
  `args={turma_label, periodo}` (nada de payload agregado no log — ele já
  é mínimo, mas o log guarda a AÇÃO, não o conteúdo — regra 0083).
- UI: no resultado do resumo, se LLM ativo → badge "rascunho gerado por IA";
  se caiu no template → badge "resumo automático" (sem prometer IA).

## Passo 5 — gates + rollout

1. `vitest` (score/narrativa), `tsc`, `eslint` verdes.
2. Migration 0110 → staging → prod antes do merge (schema-contract; o
   CHECK novo não afeta nada até a flag ligar).
3. Metade 1 + template: merge normal, funciona em prod sem nenhuma env.
4. Caminho LLM: merge **com a flag off**; ligar `IA_NARRATIVA_ENABLED` só
   após (a) 178 definir provider, (b) Thiago fechar a decisão jurídica do
   sdr §gate. Documentar em AGENTS/envs que a env existe.
5. Validador REST: `ia_eventos` CHECK aceita `'relatorio'` após a migration
   (insert via RPC autenticada com canal novo → ok).

## Rollback

- Score: revert de código (coluna some — não há persistência).
- Narrativa LLM: flag off (ou já estava); CHECK `'relatorio'` é inofensivo.
- Template: permanece (não depende de nada).

## Questões em aberto

- **BLOCKER (Thiago/jurídico):** o `autorizacao-responsavel`/termos atuais
  cobrem envio de **agregados sem PII** a um provider de IA externo? A
  proposta do plano (:129) diz que agregado/estruturado vai por default —
  precisa da assinatura do Thiago antes de ligar `IA_NARRATIVA_ENABLED`.
  Texto livre de/sobre menor fica fora de qualquer versão desta issue.
- Provider: definido pela 178 (a função recebe `callModel` injetável —
  não acoplar aqui).
- Pesos do score: v1 no sdd §1 — recalibrar com a coord depois de 2
  semanas de uso real (mudança = constante + teste, não refactor).
