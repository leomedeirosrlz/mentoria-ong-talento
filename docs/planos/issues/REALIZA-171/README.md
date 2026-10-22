# REALIZA-171 — Rematch em trilha esp não gera `devolutiva_pdm`

**Status: SEM PLANO** — identificado na fase de review como pasta ausente.
Issue real e pequena; spec mínima aqui pra não perder o contexto.

## O buraco

`rematch_dupla` (0105:392+) encerra a dupla esp atual e cria a sucessora, e já
emite a avaliação final do especialista (§13). Mas **não coleta/grava
`duplas.devolutiva_pdm`** — o campo que o rito de encerramento esp exige
(`encerrar_trilha_especialista` coleta; o rematch pula essa etapa).

O CHECK de 0037 exige `trilha='especialista' OR (encerrada_em, motivo,
devolutiva all null)` — encerrar via rematch sem devolutiva viola o rito.

## Direção (a detalhar no plan)

Estender `rematch_dupla` (ou action que a chama) pra coletar `devolutiva_pdm`
do especialista que sai — "mesma lógica do `encerrar_trilha_especialista`"
(Jira). Coordenar com **REALIZA-98** que também reescreve `rematch_dupla`
(dupla_dpp_id na herdeira): uma única versão do corpo carrega os dois deltas.

- `devolutiva_pdm` = texto do especialista sobre o jovem → visibilidade das
  devolutivas: autor + coord + jovem (inventário REALIZA-33, decisao.md:55).
- Rewrite definer verbatim via `pg_get_functiondef` (molde 98/0105).

## Reviews

reviews/{seguranca,dba}.md — REPROVADO por ausência de plano (este README é o
compromisso de spec; review full quando o plan existir).
