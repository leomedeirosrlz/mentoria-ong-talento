# REALIZA-52 — security & data review (IA + dado de menor)

## A fronteira que esta issue desenha

**Metade 1 (score)** roda 100% no servidor, sobre dados que a coord já vê —
sem nenhum dado novo e nenhum destino externo. **O risco inteiro mora na
metade 2** (narrativa LLM): é a primeira feature do repo que envia dado
(ainda que agregado) a um provider externo de IA.

## Gate jurídico (BLOCKER — assinar antes de ligar)

> **Pergunta exata pro Thiago:** o termo `autorizacao-responsavel` +
> `termo-mentorando` atuais cobrem "processamento automatizado por
> prestador externo de IA de **agregados sem dados pessoais** sobre a turma"?
> A regra proposta do plano (relatorios-inteligencia.md:129) — "agregados ou
> dados estruturados por default; texto livre só com flag legal explícita" —
> precisa de confirmação. Até lá, `IA_NARRATIVA_ENABLED` fica off em todos
> os ambientes. Texto livre de/sobre menor para provider externo **não
> entra nesta issue em nenhum cenário** — é decisão separada e futura.

## Allowlist do payload (literal — o teste assera key-por-key)

```ts
{
  turma_label: string,            // "T2 · 2026/2027" (label, não lista)
  periodo: string,                // "out/2026" — sem data de pessoa
  duplas: { ativas: number, pausadas: number, encerradas: number },
  semaforo: { ok: number, atencao: number, risco: number },
  aderencia_pct: number | null,
  avaliacao_media_0a4: number | null,
  presencas_formacao_pct: number | null,
  documentos: { pendentes: number, assinados: number, expirados: number },
  score: { medio: number, mediana: number },
  atencao: { registros_pendentes: number, apoios_abertos: number }
}
```

**Fora, sempre:** nomes, apelidos, ids (uuid), emails, telefones, datas de
pessoas, `motivo_reagendamento` (texto do mentor), notas de apoio,
`motivacao`/`dados_civis`/`form_bruto`, respostas de formulário,
**qualquer `text`/`observacao`/`reflexoes`**, endereços. O schema zod do
`montarPayloadTurma` falha o build do payload se uma key nova aparecer
(`.strict()`).

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| PII vaza no payload por refactor futuro | `montarPayloadTurma` com zod `.strict()` + teste Vitest: construir com dados que contêm PII e asserir que a saída não os carrega; review obrigatória do diff (payload é a fronteira — sdr é o doc que o revisor lê). |
| Provider retém o input | Contrato zero-retention/enterprise exigido (régua do plano AI); sem isso, flag off. `callModel` é injetável — nada liga sem decisão. |
| Output do LLM vira verdade | Exibido como "rascunho gerado por IA — revisar"; nunca é salvo, exportado ou enviado automaticamente; humano copia se quiser. |
| Texto do rascunho contém alucinação numérica | O prompt carrega o JSON canônico; a saída é revista por humano; o template (não-LLM) segue disponível lado a lado — a coord compara. |
| Auditoria quebra | `registrar_ia_evento` grava `canal='relatorio'`, `tool`, `args={turma,periodo}` (só metadado, não o payload — mesmo princípio do 0083: "a ação fica"), `ok`, `duracao_ms`. Output **não** é logado (sem transcript — LGPD). |
| Flag ligada por engano em preview | `IA_NARRATIVA_ENABLED` sem valor → off; a env não vai pro `.env.example` (documentar no AGENTS quando ligar — segredo de config, não de código). |
| `ia_eventos.canal` CHECK barra 'relatorio' | Migration 0110 alarga o CHECK — sem ela a RPC rejeita (falha fechada, não silenciosa: a chamada cai no catch e loga `erro`). |
| Score expõe "quem é ruim" pra público | `score` **não** entra em `COLUNAS_PUBLICAS`/`relatorio_links` — coluna interna coord-only; assert no teste do catálogo (plan passo 2). |
| Score como instrumento punitivo | UX: nome "índice de atenção" + decomposição sempre visível — o número nunca aparece sem os `componentes`; copy "o que puxa pra baixo" não "nota". |

## Retenção / residência

- Input ao provider: trafega TLS, não persiste em nenhum lado nosso (o
  `ia_eventos` guarda metadado da ação, não o payload); no provider,
  depende do contrato zero-retention (gate).
- Output: render-only, nunca persistido; copiado é decisão humana.
- Score: derivado por request, sem tabela (histórico de insumo = snapshots
  da 182; score histórico é follow-up fora de escopo).

## Checklist LGPD

- Agregado-only por construção (schema strict) — Art. 11 fora da fronteira
- Zero PII, zero texto livre, zero ids no payload — invariante testado
- Provider com retenção-zero exigido (contrato antes da flag)
- Auditoria de cada chamada (`ia_eventos`) — quem, quando, ok/latência
- Rascunho não-persistido + revisão humana obrigatória
- Flag off por default; jurídico documentado como pré-condição
- Score não vaza pra superfície pública (catálogo público imune)
