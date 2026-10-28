-- 0140 — desfecho estruturado e histórico auditável de duplas (REALIZA-267)
--
-- Hoje `status` (ativa/pausada/encerrada/concluida) não diz POR QUE a dupla
-- fechou: "concluída" e "encerrada" viram o mesmo balde no filtro e no
-- semáforo. E a troca de status não deixa trilha (quem, quando, motivo).
--
--   * `desfecho` diz o que aconteceu (sucesso vs desistência por lado vs
--     remanejamento vs outro); `motivo`/`obs` carregam o detalhe; `em`/`por`
--     quem fechou.
--   * `dupla_eventos` é append-only: cada mudança de status/desfecho vira
--     uma linha com de→para, motivo, obs, autor e timestamp. É a fonte da
--     "auditoria" que o rito de encerramento (0037) não tinha.
--   * Backfill: 'concluida' → concluida; 'encerrada' → 'outro' (com o
--     `motivo_encerramento` legado), pra que o histórico antigo não suma.
--
-- A action (updateDupla) grava o evento; a RLS de insert é coord-only
-- (mesma régua de status). Leitura: coord tudo; supervisor/mentor as
-- próprias duplas.
begin;

do $$ begin
  create type public.dupla_desfecho as enum (
    'concluida', 'desistencia_jovem', 'desistencia_mentor', 'remanejada', 'outro'
  );
exception when duplicate_object then null; end $$;

alter table public.duplas
  add column if not exists desfecho public.dupla_desfecho,
  add column if not exists desfecho_motivo text,
  add column if not exists desfecho_obs text,
  add column if not exists desfecho_em timestamptz,
  add column if not exists desfecho_por uuid references public.profiles(id) on delete set null;

create table if not exists public.dupla_eventos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  tipo text not null,
  de text,
  para text,
  desfecho public.dupla_desfecho,
  motivo text,
  observacao text,
  por uuid references public.profiles(id) on delete set null,
  em timestamptz not null default now()
);
create index if not exists dupla_eventos_dupla_em_idx
  on public.dupla_eventos (dupla_id, em desc);

alter table public.dupla_eventos enable row level security;

drop policy if exists dupla_eventos_select on public.dupla_eventos;
create policy dupla_eventos_select on public.dupla_eventos for select using (
  exists (
    select 1 from public.duplas d
    where d.id = dupla_eventos.dupla_id and (
      public.my_role() = 'coordenacao'::app_role
      or d.supervisor_id = public.my_profile_id()
      or d.mentor_id = public.my_profile_id()
    )
  )
);

drop policy if exists dupla_eventos_insert on public.dupla_eventos;
create policy dupla_eventos_insert on public.dupla_eventos for insert with check (
  public.my_role() = 'coordenacao'::app_role
);

-- backfill: o que já fechou não some do histórico
update public.duplas
   set desfecho = 'concluida',
       desfecho_em = coalesce(concluida_em, encerrada_em, now()),
       desfecho_obs = motivo_encerramento
 where status = 'concluida' and desfecho is null;

update public.duplas
   set desfecho = 'outro',
       desfecho_motivo = coalesce(motivo_encerramento, 'legado'),
       desfecho_em = coalesce(encerrada_em, now()),
       desfecho_obs = motivo_encerramento
 where status = 'encerrada' and desfecho is null;

commit;
