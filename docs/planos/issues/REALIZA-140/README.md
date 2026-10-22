# REALIZA-140 — Materiais: "Minha jornada" — estações narrativas com data real + citação do jovem

- **Jira**: REALIZA-140 · Tarefa · Medium
- **Veredito**: **FEITO — fechar no Jira.** A v3 narrativa ("Minha jornada") está entregue ponta a ponta, incluindo o painel da coordenação.

## Evidência

- **7 estações canônicas** derivadas do guia: `src/lib/jornada.ts` —
  `roda_inicial → visao → metas → pdm → avaliacao_encontro → roda_formal → avaliacao_360`, com janelas por encontro/fase, `estacoesJornada`, `estados feito/a_fazer/trancada`, `encCorrenteDe`, `resumoJornada`.
- **Datas reais por turma**: RPC `jovem_jornada` (0096/0099) carrega o cronograma da turma dela — T1 e T2 veem janelas diferentes; fallback pra biblioteca plana se a RPC falha (página nunca quebra).
- **Hub "Minha jornada"**: `src/app/(jovem)/jovem/materiais/page.tsx` — hero com progresso e "próxima parada", trilha vertical com nós/recibos, futuras dentro de `<details>`, bandeira do enc. 16, âncora/sub-nav Jornada×Acervo, "A fazer agora" separado do histórico (densidade REALIZA-162).
- **Recibo com a voz dela**: `ReverRespostaDialog`/`jornada-rever.tsx` mostra a resposta estruturada ("você escreveu…") por estação feita.
- **"Em andamento" honesto**: `JornadaRascunho` lê `localStorage` e diz "rascunho salvo neste aparelho" — upgrade pra server-side vem da REALIZA-20.
- **Links sem expiração**: `emitir_link_instrumento` nasce com `expira_em` nulo; jovem nunca emite — copy "seu mentor envia quando chegar a hora" / auto-emissão `jornada_autoemit` (0099).
- **Painel coord**: `painel-jornada.tsx` em `/materiais` — matriz instrumento×dupla via `painel_instrumentos_jornada` (0096), ação lembrar respeitando cap 48h.
- **Acervo** intacto abaixo, com liberação progressiva (REALIZA-152).

## Restos

- Rascunho server-side e "em andamento" global → REALIZA-20.
- Overlay antes/depois da roda → REALIZA-18.

## Ação: fechar no Jira citando `src/lib/jornada.ts` + `0096/0099` + a página.
