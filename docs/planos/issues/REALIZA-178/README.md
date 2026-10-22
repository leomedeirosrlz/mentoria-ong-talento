# REALIZA-178 — Relatórios + inteligência por fases

**Jira:** [REALIZA-178](https://kelyng.atlassian.net/browse/REALIZA-178) ·
Doc-fonte: `docs/planos/relatorios-inteligencia.md` · Tier A (doc set completo)

## Resumo

Prestação de contas da coordenação em 3 ondas: **(0)** novos `?tipo=` no
`/api/export` (CSV); **(1)** hub `/relatorios` com seções operacionais +
digest semanal por e-mail agendado por Vercel cron; **(2)** primeira
chamada LLM do produto — narrativa do ciclo **só sobre agregados, zero
PII**, gated por flag + provider com retenção zero.

## Veredito de status

**PARCIAL.** Existe: `/api/export` com 4 tipos (`ciclo`, `pessoas`,
`assinaturas`, `respostas`) — `src/app/api/export/route.ts:136-178`; página
`/relatorios` com `RelatorioBuilder`/`RelatorioCanvas` (grade configurável
pessoas/duplas com edição inline) — `src/app/(app)/relatorios/page.tsx` +
`src/lib/relatorio.ts`; resumo público `/resumo/[slug]` por slug fixo.
Semáforo, `resumoSemana`/`textoResumoSemana` e `resumo_jornada` já produzem
os números e a prosa determinística. **Não existe:** tipos novos de export,
seções/dashboards no hub, cron/agendamento, snapshots (dep 182), nenhuma
chamada LLM no código.

## Escopo

1. **Novos `tipo=` no `/api/export`** (cada um = query + função `csvX` pura
   + paridade demo): `aderencia`, `presencas`, `supervisoes`, `interacoes`,
   `solicitacoes`, `encerramento`, `forms-taxa`, `assinaturas-pendentes`.
   Todos aceitam `?turma=`/`?cronograma=` (filtro já existe,
   `route.ts:183-191`).
2. **Hub `/relatorios`** — a página vira hub: builder atual vira a seção
   "Grade livre"; novas seções com preview (máx. ~8 linhas) + botão "Baixar
   CSV" apontando pro `tipo=` correspondente. Seções: Saúde do ciclo
   (semáforo + tendência via snapshots), Aderência, Pendências, Operação,
   Encerramento. UI detalhada dos dashboards é a REALIZA-56 — aqui entra a
   espinha (navegação de seções, previews, filtros turma/cronograma).
3. **Digest semanal** — Vercel cron (`vercel.json` [NOVO]) →
   `/api/jobs/digest-semanal` com `Authorization: Bearer $CRON_SECRET`:
   monta o digest com `textoResumoSemana` enriquecido (risco+motivo,
   pendências, presença), envia via `enviarEmailsIndividuais` e loga em
   `emails_enviados`. Kill-switch já existente `EMAIL_ENVIO_LIBERADO`
   (`src/lib/email.ts:60`) vale também pro digest. Snapshots **não**
   entram aqui — o job diário `/api/jobs/saude-snapshots` da 182 já cobre
   (seguindo a convenção `/api/jobs/` + bearer dela).
4. **Narrativa LLM (fase 2)** — "Gerar narrativa do ciclo" na seção Saúde:
   envia **somente agregados** (contagens, percentuais, distribuições) ao
   provider (`src/lib/ia/provider.ts` [NOVO] da 179, compartilhado). Gated por
   `IA_NARRATIVA_OK=1` + provider configurado; botão some se não
   configurado. Cada geração grava `ia_eventos` (canal `narrativa` [NOVO —
   CHECK estendido]).

## Dependências / bloqueios

- **REALIZA-182** (`dupla_saude_snapshots`): dep só pra seção "tendência
  do semáforo" — a escrita é o job diário `/api/jobs/saude-snapshots`
  dela. Se 178 aterrissar antes, a seção mostra só o semáforo atual —
  débito anotado, não bloqueia.
- **REALIZA-179**: `src/lib/ia/provider.ts` [NOVO] é entregue lá. A narrativa LLM
  (item 4) depende; os itens 1–3 não dependem.
- **BLOCKER (item 4):** confirmar provider com DPA + retenção zero
  contratual antes de ligar `IA_NARRATIVA_OK` — mesmo para agregados sem
  PII, é a primeira transferência a terceiro do sistema.
- Decisão 10 do `_contexto.md` ("relatório = página exportável, não digest
  por e-mail") está superada pela doc-fonte da issue (digest é fase 1 do
  roadmap dela). Convivem: o e-mail carrega o resumo + link pro hub.

## Esforço

| Item | Estimativa | Risco |
|---|---|---|
| 1. Export tipos (8×) | P cada · M no total | Baixo — padrão consolidado |
| 2. Hub seções | M | Médio — preview × performance trivial (~500 encontros) |
| 3. Digest + cron | M | Médio — primeira infra agendada do repo |
| 4. Narrativa LLM | P | Médio — depende do blocker de provider |

Total: **M–G**. Quebrável em 3–4 PRs (exports → hub → digest → narrativa).

## Riscos

- Envio semanal com nomes de menores na caixa de entrada — o digest usa
  **primeiro nome** no corpo e link autenticado pro detalhe (ver sdr.md).
- `vercel.json` novo precisa coexistir com o Ignored Build Step
  configurado no projeto Vercel (não versionado) — verificar no dashboard.
- Snapshot é dado derivado gravado — aceito como cache auditável (mesmo
  padrão de `encerramentos.resumo_jornada`, 0037).
