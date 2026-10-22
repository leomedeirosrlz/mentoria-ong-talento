# REALIZA-169 — critérios de aceite

## Marco/disparo (validador REST + SQL direto em staging)

1. Dupla `trilha='especialista'`, `status='ativa'`, `iniciada_em = hoje-76d`
   (≈14d restantes): `processar_lembretes_trilha()` → notificação
   `trilha_prazo` pro `mentor_id` da dupla + row `trilha_lembretes(dupla,15d,
   especialista)`. Coord **não** recebe nada nesse marco.
2. Rechamada imediata (mesma ou outra data na janela): **zero** novas rows/
   notificações — dedup por constraint.
3. `iniciada_em` que dê `diasRestantes=5`: marco `7d` dispara (e `15d` também
   se nunca enviado — conforme decisão §3a do sdd: marcos em atraso dentro da
   janela `<=` disparam juntos).
4. `diasRestantes=-1` (ontem venceu): `vencida` dispara **duas** rows —
   `especialista` + `coordenacao`; notificações `trilha_prazo` e
   `trilha_prazo_coord` respectivamente. Coord recebe com escopo:
   `profile_papeis.escopo_turma` null ou = turma da dupla; coord escopada a
   **outra** turma não recebe.
5. Dupla vencida há 90d com ledger vazio: comportamento conforme a decisão
   final do PR (só `vencida`, sem marcos incoerentes) — o teste valida que
   **não** sai "faltam 15 dias" pra trilha vencida.
6. `status='pausada'`, `'concluida'`, `'encerrada'`, `iniciada_em=null`,
   `trilha='dpp'` → todos zero.

## Concorrência / idempotência

7. Dois calls paralelos da RPC (ou handler 2× no dia): no máximo 1 row por
   `(dupla,marco,destino)` e 1 notificação por destinatário — o advisory lock
   serializa; `on conflict` absorve.

## Conteúdo

8. Título/corpo respeitam os CHECKs (`titulo` 1–200, `corpo` ≤1000); `href`
   casa `^/[^/\\]` e resolve pra ficha da dupla acessível ao destinatário.
9. `created_by` null renderiza no sino sem quebrar (verificação manual).

## RLS / grants

10. `authenticated`/`anon` chamando `processar_lembretes_trilha` via REST →
    permissão negada. `GET` em `trilha_lembretes` como mentor → `[]`; como
    coord → rows.
11. Job sem bearer → 401; sem `CRON_SECRET` → 503.

## Regressão

12. O cap 48h de `enviar_lembrete` segue independente: um nudge manual logo
    após um lembrete de prazo funciona (e vice-versa) — capilares separados.
13. `encerrar_trilha_especialista` continua funcionando e **não** é chamado
    por nada automático — grep no handler/RPC: nenhuma referência.
14. Os novos tipos aparecem no sino (ícone/label mapeados se o componente
    switch-ear por tipo — verificar).

## Gates

15. `tsc`/`eslint`/`vitest` limpos; `database.types.ts` regen; schema-contract
    verde com migration em prod antes do merge.
16. Primeira execução do cron verificada nos logs Vercel (jsonb com
    contadores >0 quando houver trilhas na janela em staging).
