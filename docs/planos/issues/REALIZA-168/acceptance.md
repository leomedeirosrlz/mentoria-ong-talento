# REALIZA-168 — critérios de aceite

## Lembrete automático (job + RPC)

1. Encontro `realizado` há 3 dias, sem `registros`, dupla ativa → run da RPC
   cria 1 notificação `registro_pendente` pro `mentor_id` com href
   `/duplas/<d>#registrar-<e>` + row `registro_lembretes(e,'d2')`.
2. Re-run no dia seguinte → zero novas rows (dedup). Em `D+7` → 1 row `d7`
   + segunda notificação. Em `D+8` → nada mais (marcos esgotados — o
   semáforo segue cobrindo pra coord).
3. Encontro `realizado` há 20 dias sem registro e sem ledger → só `d7`
   dispara (ou `d2`+`d7` juntos — conforme janela `<=`; documentado) —
   nunca mais que uma por marco.
4. Encontros `agendado`/`nao_aconteceu`/`cancelado`, dupla
   `pausada`/`encerrada`, encontro **com** registro, `realizado` >30 dias
   atrás → todos zero.
5. Trilha `especialista` com encontro realizado s/ registro → ping igual
   (ou `dpp`-only se a decisão do PR for filtrar — o critério valida a
   decisão tomada).
6. Destino é só o mentor: nem jovem nem coord recebem ping dessa RPC.
7. `href` com `#` passa no CHECK (`^/[^/\\]`) e o click no sino abre a
   ficha com o form inline expandido (deep-link `#registrar-*` existente).

## Import / reconciliação

8. `importar_registros(jsonb)` **sem** `p_somente_ausentes` → comportamento
   idêntico ao atual (update mapeado em registro existente).
9. Com `p_somente_ausentes=true`: encontro com registro nativo → `skip` no
   relatório, registro intocado (incluindo `precisa_apoio` — nunca tocado
   em nenhum modo, 0082).
10. Resposta sem dupla/encontro casável → `{i, erro}` no relatório jsonb —
    a coord resolve manualmente (sem row fantasma).

## Canal / adoção

11. Mentor logado abre o ping → ficha da dupla com `RegistroForm` aberto no
    encontro certo (âncora); submeter grava `registros` normal via
    `salvarRegistro` (mesmos guards — não é caminho novo de escrita).
12. `EMAIL_ENVIO_LIBERADO` continua false — nenhum e-mail sai; tudo é sino.

## RLS / grants

13. `processar_lembretes_registro` via REST por authenticated/anon → negado.
    `registro_lembretes` select: coord vê, mentor `[]`.
14. Job HTTP: 401 sem bearer, 503 sem `CRON_SECRET` (padrão dos jobs).

## Operacional (runbook)

15. Último import com `p_somente_ausentes=true` não altera nenhum registro
    nativo (count `skip` bate com os existentes).
16. Google Form "não aceitando respostas" após cutover; CSV final arquivado;
    respostas tardias capturadas no import final.

## Gates

17. `tsc`/`eslint`/`vitest` limpos; types regen; schema-contract verde
    (migration em prod antes do merge).
18. Primeira execução do cron nos logs Vercel com contadores jsonb.
