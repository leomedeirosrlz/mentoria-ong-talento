-- 0122 — registro_lembretes (REALIZA-214): lembrete automático de registro
-- pendente, disparado pelo tick diário (/api/jobs/tick → RPC
-- processar_lembretes_registro). O semáforo sempre sinalizou "realizado
-- sem registro" — mas só pra quem abre a tela; o mentor desatento não via
-- nada. Agora o encontro que passou e ficou sem registro pinga o mentor.
-- NENHUM status muda: o ping leva ao rito humano (a aba de registro da
-- ficha, #registrar-<encontro>).
--
-- Marcos (fire-once por (encontro, marco) — o ledger é a dedup):
--   24h   data_hora <= agora - 24h   → mentor (duplas.mentor_id)
--   72h   data_hora <= agora - 72h   → mentor
-- Janela de varredura: data_hora entre agora-14d e agora-24h — o piso de
-- 14d evita inundar o mentor com o histórico de pendências no primeiro
-- run. Marcos devidos e ainda não enviados disparam juntos na mesma run
-- (job parado um fim de semana: saem 24h e 72h juntos — mesmo desenho da
-- 0108).
--
-- Cap de nudge: se a coordenação já cutucou a dupla (interacoes tipo
-- 'nudge' nas últimas 48h) os marcos do encontro são PULADOS e NÃO vão
-- pro ledger — o automático não empilha em cima do humano e o próximo
-- tick reavalia. O cap é por dupla, não por encontro: o nudge manual
-- cobre a pendência como um todo — mesma régua do cap de 48h do Lembrar
-- na interface.
--
-- Ledger próprio e não dedup em `notificacoes` — mesmo desenho da 0108:
-- a tabela de pings não tem chave de dedup (mesmo encontro, 2 marcos,
-- mesmo href colidiriam). Uma row = "este marco deste encontro foi
-- processado" — auditável e idempotente por constraint. `on delete
-- cascade` com o encontro: encontro removido leva o histórico junto;
-- encontro desfeito e refeito é outro id → lembretes novos (correto — é
-- outro encontro).

begin;

create table public.registro_lembretes (
  id uuid primary key default gen_random_uuid(),
  encontro_id uuid not null references public.encontros (id) on delete cascade,
  marco text not null check (marco in ('24h','72h')),
  notificacao_id uuid references public.notificacoes (id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (encontro_id, marco)
);
comment on table public.registro_lembretes is
  'Ledger dos lembretes de registro pendente (REALIZA-214). '
  'unique(encontro_id,marco) = dedup fire-once; escrita só via RPC '
  'processar_lembretes_registro (tick diário); select coord-only.';
create index registro_lembretes_notificacao_idx
  on public.registro_lembretes (notificacao_id);

alter table public.registro_lembretes enable row level security;

-- grants explícitos (o checklist de toda tabela nova): anon nada;
-- authenticated lê via policy, escreve nunca — a única escritora é a RPC
-- definer abaixo, chamada com service role pelo tick
revoke all on public.registro_lembretes from public, anon;
revoke insert, update, delete on public.registro_lembretes from authenticated;
grant select on public.registro_lembretes to authenticated;

-- auditoria é da coordenação: o mentor já recebe o ping em si (o ledger
-- pra ele é redundante); supervisor vê a ficha, não o ledger
drop policy if exists registro_lembretes_select on public.registro_lembretes;
create policy registro_lembretes_select on public.registro_lembretes
  for select to authenticated
  using (public.my_role() = 'coordenacao');

-- Varredura diária dos encontros passados sem registro. Definer + revoke
-- total: só o service role executa (o handler do tick) — o PostgREST dos
-- papéis não a vê. p_agora injetável pra teste/backfill; o handler passa
-- o instante real pra hoje e meio-dia BRT pros dias do range. Ledger +
-- notificação na mesma transação, advisory lock por encontro serializa
-- runs concorrentes (o on conflict absorve o resto — molde da 0108).
-- Erro não é engolido: sobe pro handler e o tick responde 500 (retry é
-- inócuo — o que já saiu fica marcado no ledger).
create or replace function public.processar_lembretes_registro(
  p_agora timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamptz := coalesce(p_agora, now());
  v_e record;
  v_marco text;
  v_devido boolean;
  v_ledger uuid;
  v_notif uuid;
  v_avaliados int := 0;
  v_enviados int := 0;
  v_por_marco jsonb := '{}'::jsonb;
  v_lembretes jsonb;
begin
  for v_e in
    select e.id, e.dupla_id, e.numero, e.data_hora, d.mentor_id,
           to_char(e.data_hora at time zone 'America/Sao_Paulo', 'DD/MM') as data_br,
           split_part(coalesce(nullif(m.nome_social, ''), m.nome), ' ', 1) as nome_jovem
      from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      join public.mentorados m on m.id = d.mentorado_id
     where d.status = 'ativa'
       and e.status in ('agendado', 'realizado')
       and e.data_hora between v_agora - interval '14 days'
                           and v_agora - interval '24 hours'
       and not exists (
         select 1 from public.registros r where r.encontro_id = e.id
       )
     order by e.data_hora, e.id
  loop
    v_avaliados := v_avaliados + 1;
    -- serializa a varredura do encontro: dois ticks paralelos não se
    -- chocam na janela check→insert (o on conflict já bastaria; o lock
    -- evita a espera em row lock — mesmo desenho da 0108, sal = issue)
    perform pg_advisory_xact_lock(hashtextextended(v_e.id::text, 214));

    -- cap de 48h da coordenação: nudge manual recente cobre a pendência —
    -- o automático não empilha em cima do humano. O marco NÃO vai pro
    -- ledger (o próximo tick reavalia). O teto `<= v_agora` mantém o
    -- backfill honesto: um nudge que "ainda não existia" no dia simulado
    -- não suprime marco retroativo.
    if exists (
      select 1 from public.interacoes i
       where i.dupla_id = v_e.dupla_id
         and i.tipo = 'nudge'
         and i.created_at between v_agora - interval '48 hours' and v_agora
    ) then
      continue;
    end if;

    foreach v_marco in array array['24h','72h'] loop
      -- if aninhado, sem `case ... end` dentro de `if` (o splitter do
      -- supabase CLI quebra). Marcos devidos acumulam: encontro com 80h
      -- sem registro dispara 24h e 72h na mesma run.
      v_devido := false;
      if v_marco = '72h' then
        v_devido := v_e.data_hora <= v_agora - interval '72 hours';
      else
        v_devido := v_e.data_hora <= v_agora - interval '24 hours';
      end if;
      if not v_devido then continue; end if;

      v_ledger := null;
      insert into public.registro_lembretes (encontro_id, marco)
      values (v_e.id, v_marco)
      on conflict (encontro_id, marco) do nothing
      returning id into v_ledger;
      if v_ledger is not null and v_e.mentor_id is not null then
        insert into public.notificacoes
          (profile_id, tipo, titulo, corpo, href, created_by)
        values (
          v_e.mentor_id,
          'lembrete',
          format('Registro do %sº encontro', v_e.numero),
          format(
            'O encontro de %s com %s ainda está sem registro. Conte como foi.',
            v_e.data_br, v_e.nome_jovem
          ),
          format('/duplas/%s#registrar-%s', v_e.dupla_id, v_e.id),
          -- sem autor humano: automação, o tipo já diz a origem
          null
        )
        returning id into v_notif;
        update public.registro_lembretes
           set notificacao_id = v_notif
         where id = v_ledger;
        v_enviados := v_enviados + 1;
        v_por_marco := jsonb_set(
          v_por_marco,
          array[v_marco],
          to_jsonb(coalesce((v_por_marco ->> v_marco)::int, 0) + 1),
          true
        );
      end if;
    end loop;
  end loop;

  -- {lembretes:[{marco,n}]} agregado — o log do tick guarda o que saiu
  -- sem precisar consultar o ledger
  select coalesce(jsonb_agg(jsonb_build_object(
           'marco', e.key,
           'n', e.value)),
         '[]'::jsonb)
    into v_lembretes
    from jsonb_each(v_por_marco) e;

  return jsonb_build_object(
    'ok', true,
    'agora', v_agora,
    'avaliados', v_avaliados,
    'enviados', v_enviados,
    'lembretes', v_lembretes
  );
end $$;

-- interna: só service_role executa (o handler do tick). O PostgREST dos
-- papéis não a vê — mesmo desenho de processar_lembretes_trilha (0108)
revoke all on function public.processar_lembretes_registro(timestamptz)
  from public, anon, authenticated;

commit;

-- rollback manual:
-- drop function public.processar_lembretes_registro(timestamptz);
-- drop table public.registro_lembretes;
