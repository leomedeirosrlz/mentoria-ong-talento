# REALIZA-63 — Encerramento do ciclo (checklist + resumo da jornada + trilha especialista)

[Jira REALIZA-63](https://realizavc.atlassian.net/browse/REALIZA-63)

**Status: FEITO** — evidência auditada; não replanejar.

## Escopo da auditoria

Encerramento do rito da dupla com checklist oficial, autoavaliação do mentor
vinculada, resumo print-friendly da jornada e encerramento automático do ciclo.

## Evidências (código/migrations reais)

- `supabase/migrations/0037_encerramentos.sql` — tabela `encerramentos` com
  checklist do rito em JSONB, status `concluida` × `encerrada`, RPC de
  encerramento antecipado da trilha especialista (`encerrar_trilha_especialista`)
  e devolutiva notificando o mentor DPP (`devolutiva_pdm`).
- `supabase/migrations/0102_encerramento_automatico.sql` — fechamento
  automático de ciclo.
- `src/app/(app)/duplas/[id]/` — `EncerramentoDupla` (UI do rito com checklist)
  e `resumo-jornada.tsx` (resumo da jornada print-friendly na ficha da dupla).
- `AGENTS.md` (estado do projeto) confirma: "autoavaliação do mentor via RPC,
  resposta 360º auto-marca o checklist do encerramento" (migration `0042`
  formulários sistema: `avaliacao_360` responde por `formulario_respostas`
  marcando o checklist).

## Notas

- Nada a implementar. Backlog item "Trilha especialista — restos" já marcado
  como executado (`0037` encerramento antecipado + prazo 3 meses + devolutiva).
