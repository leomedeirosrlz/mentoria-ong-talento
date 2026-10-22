# REALIZA-19 — Instrumento-piloto: "Construindo a Visão" como atividade tokenizada

- **Jira**: REALIZA-19 · Feature · High
- **Veredito**: **FEITO — fechar no Jira.** O piloto pedido ("cabe 100% nos campos atuais do forms engine, prova o fluxo link→mentorado→visível na ficha") está entregue ponta a ponta.

## Evidência (caminhos reais)

- **Form oficial**: `sistema='visao'` semeado em `supabase/migrations/0080_instrumentos_dupla.sql` — campos do guia (declaração + "em 10 anos" + passos), zero schema de coleta novo (é `formularios.campos` JSONB).
- **Emissão**: `emitir_link_instrumento` (0080, refinada 0090/0093/0096/0097/0099) — coord ou mentor DPP da dupla viva; reuso de link pendente; **sem expiração**; `dest_mentorado_id` + `dupla_id` carimbados.
- **Render público**: `/f/[token]` despacha instrumentos pro renderer próprio — `src/components/instrumentos/flow.tsx` + `visao.tsx` ("Construindo a Visão", CTA "Registrar minha visão"), rascunho local + submit via `submeterRespostaFormulario`.
- **Visível na ficha**: `src/app/(app)/duplas/[id]/instrumentos-dupla.tsx` ("Instrumentos da jornada") + `src/components/instrumento-resultado.tsx` (bloco Visão estruturado).
- **Jornada**: estação `visao` em `src/lib/jornada.ts` (janela enc. 1–2) + payload `jovem_jornada` (0096/0099) + auto-emissão por progresso (`jornada_autoemit`).
- **Painel coord**: `painel-jornada.tsx` em `/materiais` mostra a estação por dupla.

## O que resta (não é desta issue)

- Rascunho server-side multi-device → REALIZA-20.
- Devolução pra correção → REALIZA-20.
- Nada específico da Visão pendente.

## Dependências

- Depende de REALIZA-20 conceitualmente — na prática a espinha (`formulario_links`) já existia e bastou.

## Esforço realizado: já entregue · **Ação: fechar no Jira citando 0080/0096/0099 + arquivos acima.**
