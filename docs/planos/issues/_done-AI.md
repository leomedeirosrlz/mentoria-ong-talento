# Cluster AI — planejamento concluído

Docs produzidas em `docs/planos/issues/REALIZA-NNN/`. Tier A = README +
plan + sdd + design + sdr + acceptance.

> Escopo deste batch: **178, 179, 180, 42, 124, 125, 126**. As pastas
> `REALIZA-52`, `REALIZA-56` e `REALIZA-182` pertencem ao cluster R
> (produzidas em paralelo) — referenciadas aqui como dependências, não
> como entregas deste agente.

## REALIZA-178 — Relatórios + inteligência por fases (Tier A)

Exports novos (`aderencia`, `presencas`, `supervisoes`, `interacoes`,
`solicitacoes`, `encerramento`, `forms-taxa`, `assinaturas-pendentes`),
hub `/relatorios` por seções, digest semanal (Vercel cron +
`/api/jobs/digest-semanal` + `emails_enviados.tipo='digest'` [mig. 0107]),
narrativa LLM só sobre agregados (flag `IA_NARRATIVA_OK`, canal
`narrativa` [mig. 0108]). Dep: 182 (snapshots), 179 (`ia/provider.ts`).

## REALIZA-179 — Chatbot + MCP + RAG (Tier A)

`src/lib/ia/provider.ts` (OpenAI-compatible, envs `IA_*`), `POST
/api/ia/chat`, página `/assistente` (transcript em memória), RAG
`guia_consulta` via `ia_chunks`+FTS `portuguese` [mig. 0109] (pgvector =
upgrade documentado), `/api/mcp` com `mcp-handler` + auth Bearer (JWT
OAuth ou PAT `rlz_` de `ia_tokens` [mig. 0110] → sessão mintada — RLS
sempre o bound), 2 tools novas de leitura (`guia_consulta`,
`pendencias_docs`) + 5 de escrita com confirmação (`escritas.ts` extrai
os cores das actions). Absorve 124/125/126.

## REALIZA-180 — Importação inteligente (Tier A)

Anel: visão (PDF/img → `LinhaRegCsv` via provider) → determinístico
(`importar-registros.ts` intocado) → semântico (só em `manual`/`revisar`,
nunca `auto`) → revisão humana NL (`interpretarRevisao` → `AcaoRevisao`
tipada; `criar_dupla` delega ao `NovaDuplaDialog`). Escrita só via RPC
`importar_registros`; audit `ia_eventos` canal `importacao` (mig. 0108
compartilhada). Flag `IA_IMPORTACAO_OK`. BLOCKER: documento inteiro vai
ao provider — DPA/zero-retention exigido.

## REALIZA-42 — Decisão (Tier C)

`decisao.md` registra a progressão 1→5 respondida por 178/179/180, fase
5 adiada (parecer jurídico), regras invioláveis, e recomenda fechar a
issue. Sem pergunta em aberto (provider é confirmação contratual).

## READMEs de absorção

`REALIZA-124`, `REALIZA-125`, `REALIZA-126` → apontam pra 179.

## Migrations novas especificadas (não implementadas)

Números **indicativos** — a 182 (cluster R) também reserva `0106` pra
`dupla_saude_snapshots`; confirmar a sequência real no `db push`.

| Mig | Dona | O quê |
|---|---|---|
| 0107 | 178 | `emails_enviados.tipo` += `digest` |
| 0108 | 178/180 | `ia_eventos.canal` += `narrativa`,`importacao` (superset convergente) |
| 0109 | 179 | `ia_chunks` + tsv + `match_ia_chunks` |
| 0110 | 179 | `ia_tokens` + RPCs emitir/revogar |

## BLOCKERS compartilhados

- Provider com DPA + retenção zero (gate de 178-narrativa, 179-chat,
  180-tudo). Candidato: opencode API (doc-fonte).
- REALIZA-182 (`dupla_saude_snapshots`) alimenta o tick semanal da 178 —
  se atrasar, tick sai sem o passo snapshot.
- `a verificar`: OAuth server Supabase p/ MCP · visão no provider ·
  localização canônica dos PDFs dos guias · Ignored Build Step ×
  `vercel.json`.
