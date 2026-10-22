# REALIZA-51 — Plano de implementação

## Contexto embutido

"Distribuir atividade" = emitir o link tokenizado do instrumento pra N
duplas de uma vez e entregar por e-mail (Resend já existe) — hoje a emissão
é uma-dupla-por-vez na ficha e o WhatsApp é manual por link. A RPC núcleo
(`emitir_instrumento_core`, 0099) já isola a regra: reuse de pendente,
gate de dupla viva, dest_mentorado_id carimbado.

## Passos

### 1. Migration `010x_envio_instrumento_lote.sql` [NOVO]

```sql
-- header padrão; idempotente.

-- a) tipo de e-mail novo no log
alter table public.emails_enviados drop constraint emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura',
                           'apoio_jovem','chamado','instrumento']));

-- b) RPC definer coord-only: emite o instrumento pra uma lista de duplas
--    numa transação só, reusando emitir_instrumento_core (0099). Devolve
--    relatório [{dupla_id, token|erro}] pra UI+envio.
create or replace function public.emitir_instrumento_lote(
  p_sistema text, p_dupla_ids uuid[]
) returns jsonb language plpgsql security definer
set search_path = public as $$
  -- guard: my_role()='coordenacao' (mentor emite 1×, na ficha)
  -- loop: emitir_instrumento_core(dupla, sistema, my_profile_id(), 'lote')
  --   exception per-dupla → acumula erro, continua (relatório por linha)
$$;
grant execute on function public.emitir_instrumento_lote(uuid, uuid[])
  to authenticated; -- definer + guard interno de papel
```

(`emitir_instrumento_core` já recebe `p_origem` — verificar assinatura em
0099:37; o `'lote'` entra como origem pra auditoria — **a verificar** se o
parâmetro é enum/text livre.)

### 2. Envio de e-mail

- `src/lib/email-templates.ts` [NOVO template]:
  `emailInstrumento(nome, instrumentoLabel, url)` — assunto
  "Sua jornada: {instrumento} chegou 🌱" (ajustar tom), corpo com botão
  pro link `/f/{token}` + "não precisa de senha" + "responda no seu tempo".
- `src/lib/actions-email.ts` ou `actions-formularios.ts` — action
  `enviarInstrumentoLote(sistema, duplaIds)` [NOVO]:
  1. guard coord; chama RPC (1) → `{links:[{dupla_id, token, mentorado:{email,nome}, mentor:{email}}]}` — estender a RPC pra devolver os e-mails (**a verificar** colunas: `mentorados.email` existe; `profiles.email` existe).
  2. Para cada link: destinatário = `mentorados.email`; fallback `profiles.email` do mentor (com nota "repasse pra {jovem}") — conforme BLOCKER.
  3. `enviarEmail` (de `email.ts`) por destinatário, respeitando
     `EMAIL_ENVIO_LIBERADO` (kill switch — hoje false: gera log "simulado"
     como os outros tipos? **a verificar** comportamento do flag nos outros
     fluxos: `email.ts:81` — `!critico` pula envio; decidir se lote conta
     como crítico=falso → não envia até Thiago liberar, o que é o default
     seguro).
  4. Log `emails_enviados` tipo `'instrumento'` por destinatário
     (`ref_id` = link id) — padrão `actions-email.ts:116`.
- Sem queue/cron: envio síncrono no request (lotes ~dezenas — Resend
  aguenta; relatório mostra falhas por linha). Se volume crescer → futuro
  work de fila (não há infra hoje; documentar).

### 3. UI do lote

- Superfície: `/materiais` coord — `painel-jornada.tsx` já lista
  instrumento×dupla com estado; adicionar coluna checkbox + ação
  "Enviar {instrumento} em lote" (só coord; mentor não vê o painel).
  Alternativa: `/formularios/[id]` (ficha do instrumento) com seletor de
  duplas/turma — decidir na implementação; **painel é mais contextual**.
- Dialog de confirmação: instrumento + N duplas + quem recebe (jovem com
  e-mail ✓ / sem e-mail → mentor) + preview do texto; confirma → relatório
  "enviados/pulados/falharam".
- WhatsApp permanece **manual por link** (wa.me é deep link — sem API
  Business não há batch); o resultado do lote pode oferecer botões
  `waLink` por linha pro coord mandar manualmente — já é o padrão.

### 4. Demo

- `src/lib/demo/`: action devolve relatório fake (sem envio, DEMO_MSG) +
  painel já cobre; fixture `emails_enviados` tipo 'instrumento' se a demo
  mostrar log.

## Ordem de PRs

- PR1: migration (tipo e-mail + RPC lote) — aplicar staging+prod antes do
  merge (schema-contract).
- PR2: template+action+envio.
- PR3: UI lote no painel.

## Rollback

- RPC/action novas: drop function; tipo 'instrumento' fica no check sem
  uso (não quebra inserts antigos).
- Kill switch já é o safety: com `EMAIL_ENVIO_LIBERADO=false` nada sai de
  verdade — ligar só quando Thiago confirmar entregabilidade.
