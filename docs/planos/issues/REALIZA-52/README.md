# REALIZA-52 — Score determinístico + narrativa LLM em agregados (zero PII)

**Jira:** [REALIZA-52] "score de regras explicável → relatório narrativo LLM
só em agregados, zero PII → decision support". "ML em texto livre = fase
posterior gated por jurídico." Fonte: `docs/planos/relatorios-inteligencia.md`
(capacidade 3, :116; LGPD :125-129)
**Tier:** A (IA + dado de menor) — README, plan, sdd, sdr (pesado),
acceptance. Sem design.md — a superfície é 1 coluna/card na UI existente
(nota de UX no sdd §7).
**Status:** ABERTO — não existe nenhum score hoje; todo o insumo existe.

## Resumo — duas metades, dois gates

**Metade 1 — score determinístico (entrega desta issue):** `src/lib/score.ts`
[NOVO] — função pura `scoreDupla(d, eventos, snapshots?, hoje)` →
`{score: 0-100, componentes: [{nome, peso, pontos, detalhe}]}` que **reusa os
sinais do semáforo** (`saudadeDaDupla`), `PESO_AVALIACAO`
(`encerramento.ts:54`), aderência (`encontroEsperado`) e engajamento —
ponderados num só número **explicável**: o score sempre mostra o que
contribuiu (padrão "motivo visível" que o semáforo provou). Exibido como
coluna no relatório coord + detalhe por dupla. **Nenhum LLM, nenhum dado
sai do perímetro.**

**Metade 2 — narrativa LLM (só habilita quando os gates fecharem):**
`gerarNarrativaTurma(turma)` [NOVO] — transforma **agregados da turma** (nº
duplas, distribuição semáforo, aderência%, presenças%, docs pendentes,
médias) em prosa institucional pra financiador/diretoria. Payload **só
agregados — zero nomes, zero texto livre** (o sdr tem a allowlist literal).
Gated por: (a) REALIZA-178 (camada IA/provider — não existe ainda), (b)
flag `IA_NARRATIVA_ENABLED` + env do provider, (c) **decisão jurídica do
Thiago** — ver BLOCKER. Fallback determinístico: template à la
`textoResumoSemana` (ciclo.ts:1227) — a narrativa por template é entregue
**independente do LLM** (o produto não fica refém do provider).

## Escopo

- `score.ts` [NOVO] puro + `scoreTurma` (agregado de scores da turma) +
  coluna `score` no catálogo do relatório (`COLUNAS` de relatorio.ts) +
  card/popover de detalhe por dupla na ficha ou `/relatorios`.
- Narrativa: template determinístico primeiro (funciona hoje, zero custo);
  caminho LLM atrás de flag, reusa `ia_eventos` pra auditoria (canal novo
  `'relatorio'` — CHECK atual só tem `chat`/`mcp`, 0083 — alter pequeno).
- Depende de **182** (snapshots) só pra componente "tendência" — opcional
  no score (sem snapshots, o componente sai do denominador, não quebra).

## Dependências

- `saudadeDaDupla` (ciclo.ts:1245) — insumo central; o score **não
  recalcula** saúde, pondera os sinais dela.
- `PESO_AVALIACAO`, `diasAtrasoRegistro`, `encontroEsperado`, `presencas`.
- **REALIZA-178** — a camada de IA (provider, tools) — **só** pra metade 2;
  metade 1 não depende.
- **182** — tendência opcional.
- `ia_eventos`/`registrar_ia_evento` (0083) — auditoria da chamada LLM.
- BLOCKER jurídico (sdr §gate): o termo atual cobre "processamento por
  terceiro de **agregados**"? A proposta do plano (:129) é "agregados ou
  estruturados por default" — confirmar com o Thiago antes de ligar a flag.

## Esforço: M (metade 1) + S (metade 2, depois dos gates)

## Riscos

- **Score opaco vira alvo de gaming** — mitigado por `componentes` sempre
  expostos (o número nunca vem sozinho; UI mostra a decomposição).
- **Score vira "nota do mentor"** — copy: é "índice de atenção sugerido",
  não avaliação de pessoa; o componente pesa sinais, não julga.
- **LLM alucina com agregado errado** — o prompt carrega o JSON canônico;
  saída exibida como "rascunho gerado — revisar"; `ia_eventos` grava
  input/ok/latência (sem salvar o texto — ver sdr §retention).
- **Provider retention** — exigir zero-retention/enterprise no contrato
  (mesma régua do plano AI: "retenção zero"); sem isso, flag fica off.
