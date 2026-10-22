# REALIZA-169 — plano de implementação

Descrição essencial: lembretes automáticos do prazo de 3 meses da trilha de
especialista (15d, 7d, vencida) — fire-once por `(dupla_id, marco, destino)`
via ledger `trilha_lembretes` [NOVO] + RPC `processar_lembretes_trilha` +
route handler `/api/jobs/lembretes-trilha` + Vercel Cron (mesma infra da 182).
Sem encerramento automático — o ping leva ao rito humano.

## Passo 0 — referências

- `src/lib/encerramento.ts:237` — `prazoTrilhaEspecialista` (regra do `fim`).
- `supabase/migrations/0094_lembrete.sql` — molde de RPC definer:
  `has_papel`, advisory lock `pg_advisory_xact_lock(hashtextextended(...))`,
  insert `interacoes`+`notificacoes`, `revoke/grant`.
- `supabase/migrations/0103_avaliacao_terceiros.sql` — lista viva do CHECK
  `notificacoes_tipo_check` (acrescentar `trilha_prazo`,
  `trilha_prazo_coord`).
- `0019_notificacoes_hardening.sql` — href regex `^/[^/\\]`, guard de update,
  policy de insert (a RPC definer escreve acima dela — confirmar com teste).
- `src/lib/actions-encerramento.ts:285` — `encerrar_trilha_especialista`
  (destino humano que o lembrete aponta).
- `src/components/trilha-prazo-badge.tsx` — textos do badge pra harmonizar o
  copy do ping.
- 182 (`docs/planos/issues/REALIZA-182`) — infra de job (CRON_SECRET,
  vercel.json). Quem mergeia primeiro cria; o segundo reusa.

## Passo 1 — migration `0108_trilha_lembretes.sql` (número indicativo)

1. `create table public.trilha_lembretes` (DDL sdd §1) + RLS select coord-only;
   `revoke all from public, anon`; `grant select to authenticated`.
2. CHECK `notificacoes_tipo_check` — drop/add com os 2 tipos novos (copiar a
   lista de 0103 + acrescentar; incluir bloco rollback no rodapé como 0103).
3. `create or replace function public.processar_lembretes_trilha(p_hoje date
   default null) returns jsonb` — sdd §3 (varredura + advisory lock +
   `on conflict do nothing` no ledger + insert notificacao com o id gravado
   em `notificacao_id`). Retorna `{ok, avaliadas, lembretes:[{marco, destino,
   n}]}`.
4. `revoke all on function ... from public, anon, authenticated` — só
   service role executa (o handler).

## Passo 2 — handler

`src/app/api/jobs/lembretes-trilha/route.ts` [NOVO] — cópia estrutural do
handler da 182: `dynamic`, bearer `CRON_SECRET` → `admin.rpc(...)`, retorna o
jsonb da RPC. Se a 182 já criou `src/lib/jobs.ts`, colocar o helper de auth
(`assertCron(req)`) lá e reusar; senão criar aqui e a 182 reusa.

## Passo 3 — `vercel.json`

`{"path":"/api/jobs/lembretes-trilha","schedule":"0 7 * * *"}` (04:00 BRT).
Se a 182 ainda não mergeou o arquivo, este PR cria `vercel.json` com ambas as
entradas previstas (a da 182 é inofensiva sem a rota — 401; ou manter só a
desta e a 182 adiciona a dela — decidir no PR conforme ordem real).

## Passo 4 — sino/UI

- Os tipos novos entram automaticamente no sino (o componente mapeia por
  `tipo`? — verificar `src/components/` sino/notifications: se houver ícone
  por tipo, adicionar `trilha_prazo*` ao mapa; se render for genérico, nada).
- Verificar `href` `/duplas/<id>` resolve pro papel especialista — a ficha da
  dupla é acessível ao mentor esp? Se a trilha esp tiver rota própria (ex.:
  ficha dentro de `/especialista`), apontar pra lá — **confirmar no PR o
  href real da ficha da dupla especialista**.

## Passo 5 — testes

- Vitest não cobre RPC — a cobertura principal é o validador REST + e2e
  manual em staging:
  - `processar_lembretes_trilha('2026-10-01')` com dupla iniciada em
    `2026-07-16` (15d) → 1 notificação esp + 1 ledger.
  - Rechamada mesma data → 0 novos (dedup).
  - `p_hoje` avançando pra 7d → 2º marco; pra vencida → esp + coord.
  - Trilha `status='pausada'/'encerrada'` → 0.
  - `iniciada_em=null` → 0.
  - Vencida há 60d com ledger vazio → só `vencida` (sem flood de marcos
    passados — conforme decisão §3a: os marcos `<=` disparam todos; revisar
    copy no PR: dupla vencida há 60d recebendo "faltam 15 dias" é incoerente
    → **condição final: marco dispara se `dias <= limite(marco)` E o marco
    seguinte ainda não foi enviado** — ou simples: só envia o marco mais
    avançado devido. Registrar decisão final no PR.)
- Unit puro (opcional): `marcoPrazoEsp(diasRestantes)` extraído pra
  `src/lib/trilha-prazo.ts` [NOVO] espelhando o SQL — só se a regra ficar
  não-trivial (com a decisão do ponto anterior fica — recomendar extrair).

## Passo 6 — gates + rollout

1. Migration → staging → `_valida_0108_rest.mjs` [NOVO]: RPC não-executável
   por authenticated/anon via REST (`revoke`), service_role executa, notifs
   aparecem pro destinatário certo.
2. `CRON_SECRET` já existe se 182 subiu; senão criar (Vercel prod+preview).
3. Migration em prod antes do merge (schema-contract).
4. Verificar 1ª execução nos logs Vercel (retorno jsonb com contadores).

## Rollback

Remover o cron do `vercel.json` para o disparo. Tabelas/tipos ficam inertes
(a RPC deixa de ser chamada). `drop` se necessário — sem consumidores.

## Questões em aberto

- Semântica de marco pulado (§5 acima) — fechar no PR, a variação é 10 linhas
  de CASE.
- href da ficha da dupla esp (`/duplas/<id>` vs superfície própria).
- E-mail como canal? Fora de escopo v1 (sino apenas); `EMAIL_ENVIO_LIBERADO`
  gatearia de qualquer forma.
