-- ===== anotações do mentor por encontro do ciclo =====
-- Plano de aula e lembretes pré-encontro. Chave (dupla_id, numero) — não FK pra
-- encontros: a nota pode existir antes do agendamento e segue o nº mesmo quando
-- o encontro é remarcado ou marcado como não-aconteceu.
create table public.encontro_notas (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  texto text not null default '' check (char_length(texto) <= 10000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dupla_id, numero)
);

alter table public.encontro_notas enable row level security;
create index encontro_notas_dupla_idx on public.encontro_notas (dupla_id);

-- mesmo escopo de encaminhamentos (0001): coord lê/escreve tudo; mentor escreve
-- na própria dupla; supervisor só lê as supervisionadas
create policy encontro_notas_select on public.encontro_notas for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );

create policy encontro_notas_mentor_write on public.encontro_notas for all
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id()
    )
  ) with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id()
    )
  );

create trigger encontro_notas_touch
  before update on public.encontro_notas
  for each row execute function public.touch_updated_at();
