# REALIZA-102 — Importar pareamento em lote: CSV mentor×mentorado → duplas

**Jira:** REALIZA-102 · **Tier:** A (veredito FEITO — README de evidência) · **Status:** entregue, fechar no Jira

## Veredito

**FEITO.** O tipo "Pareamento (duplas)" existe no importador CSV com prévia
obrigatória antes de aplicar — nunca cria pessoa nova, só pareia quem já
existe.

## Evidências

- **Núcleo puro:** `src/lib/importar-duplas.ts` (header cita REALIZA-102) —
  parser `LinhaPar` (mentor, mentorado, supervisor, turma, trilha, demanda,
  iniciada_em), `DiretorioPar` montado uma vez (profiles+contatos,
  mentorados, duplas, cronogramas, capacidades, eventos) e a MESMA
  resolução alimenta `previewDuplas` e `importDuplas`.
- **Resolução de identidade:** e-mail exato normalizado quando a célula tem
  "@"; senão nome — exato sem acento/case contra `nome` e `nome_social`,
  fallback "nome contido"; apelido fora do nome não resolve e 2+ candidatos
  = falha por linha (`importar-duplas.ts:9-19`, `normNome` de
  `src/lib/importar.ts` portado pra `src/lib`).
- **Papéis efetivos (0085):** mentor vale por `profile_papeis` (secundário
  conta); coluna `trilha` desempata híbrido; supervisor aceita
  `podeSupervisionar` (coord inclusa — `importar-duplas.ts:445`).
- **Server actions:** `previewDuplas` (`actions.ts:2307`) e `importDuplas`
  (`actions.ts:2340`) — idempotente: par existente pula (pulo, não erro);
  relatório por linha com não-resolvidos.
- **UI:** tipo `duplas` no `importar-csv-dialog.tsx:31-56` — wizard com
  prévia resolvidos/não-resolvidos ANTES de aplicar; em `/demo` a prévia
  funciona e o apply retorna `DEMO_MSG`.
- **Testes:** `tests/importar-duplas.test.ts` — resolução com
  acentos/apelidos (casos reais citados na issue); e2e `operacional.spec.ts`
  (import CSV de pareamento).
- **Sem migration:** confirmado.

## Restos conhecidos

Nenhum. O caminho NL+visão de importação genérica é da REALIZA-180 (outro
cluster) — o pareamento estruturado por CSV está completo.

## Esforço

N/A — encerrar.
