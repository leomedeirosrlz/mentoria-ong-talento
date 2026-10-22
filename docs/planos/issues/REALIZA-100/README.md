# REALIZA-100 — Remanejamento atômico de dupla: encerrar + nova + nota + linhagem

**Jira:** REALIZA-100 · **Tier:** B (veredito FEITO — README de evidência) · **Status:** entregue, fechar no Jira

## Veredito

**FEITO.** O fluxo de 3 passos manuais virou a RPC atômica `rematch_dupla` +
`RemanejarDuplaDialog` na ficha da dupla. A linhagem pedida na issue
("originada de" / "substituída por") existe via `duplas.remanejada_de`.

## Evidências

- **RPC atômica:** `rematch_dupla(p_dupla_id, p_lado, p_novo_id, p_motivo,
  p_registrar_nota)` security definer, coord-only — criada em
  `supabase/migrations/0064_rematch_dupla.sql`, versão final em
  `0105_review_fixes.sql:392`. Encerra a antiga (com carimbo/motivo; trilha
  esp carimba `encerrada_em`), cria a herdeira copiando
  `turma/cronograma_id/supervisor_id/demanda/trilha` com `remanejada_de`
  (`0105:487-497`), valida vaga do novo membro por trilha e papel compatível
  (`has_papel` escopado na turma pra DPP, global pra esp — 0091/0101),
  grava nota opcional em `pessoa_notas`, e na trilha especialista **emite a
  avaliação §13 pro especialista que sai** via `emitir_avaliacao_esp`
  (`0105:484`).
- **Linhagem (0063):** `duplas.remanejada_de uuid → duplas(id)` + índice
  parcial — `supabase/migrations/0063_dupla_remanejada_de.sql`. A ficha
  mostra os dois lados: `getDuplaVinculo` ("originada de") e
  `getDuplaSucessora` ("substituída por") — `src/lib/queries.ts:450-484`.
- **UI:** botão "Remanejar" na ficha (coord) —
  `src/components/remanejar-dupla-dialog.tsx` (dialog `sm:max-w-md`: lado,
  novo membro do pool livre com `porMentor` de capacidade, motivo,
  checkbox de nota); montada em `duplas/[id]/page.tsx:895`. Ação
  `remanejarDupla` wrapper — `src/lib/actions.ts:1860`.
- **Histórico preservado:** encontros/registros ficam na dupla encerrada;
  a herdeira nasce limpa — por construção da RPC.
- **Testes:** `tests/remanejo.test.ts` (núcleo puro `src/lib/remanejo.ts`)
  + spec e2e `operacional.spec.ts` (remanejo+sucessora, remanejo por risco).

## Restos conhecidos

- REALIZA-171 (aberta): rematch em trilha esp não coleta `devolutiva_pdm`
  pro mentor que sai — a avaliação §13 cobre parte disso (0105).
- REALIZA-98 (aberta): herdeira esp não carrega `dupla_dpp_id` — a coluna
  nem existe ainda; quando entrar, o carry-over do rematch é um dos pontos.

## Esforço

N/A — encerrar.
