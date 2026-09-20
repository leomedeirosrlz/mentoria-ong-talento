-- anexos de evidencia por registro (foto do PDM, Roda da Vida preenchida).
-- Nao confundir com `materiais` (biblioteca da coordenacao): aqui e evidencia
-- POR encontro/registro, subida pelo mentor da dupla.
--
-- Ordem do upload no client: (1) insere a row de metadados, (2) sobe o arquivo.
-- A policy de INSERT do storage.objects confere a row em registro_anexos com
-- path = name — sem ela, o objeto e recusado (nao da pra plantar arquivo orfao).

create table public.registro_anexos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.registros (id) on delete cascade,
  path text not null unique,
  nome text not null,
  tamanho integer,
  mime text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.registro_anexos enable row level security;

-- mesmo escopo de registros_select: coord le tudo; mentor e supervisor leem a dupla
create policy registro_anexos_select on public.registro_anexos for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );

-- mesmo escopo de registros_mentor_write: so coord e mentor da dupla escrevem
create policy registro_anexos_mentor_write on public.registro_anexos for all
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id and d.mentor_id = public.my_profile_id()
    )
  ) with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id and d.mentor_id = public.my_profile_id()
    )
  );

-- bucket privado — acesso via signed URL gerada pelo route handler /api/anexo/[id]
insert into storage.buckets (id, name, public)
values ('registro-anexos', 'registro-anexos', false);

-- storage.objects: o objeto so vale se existir a row de metadados com path = name
create policy registro_anexos_storage_select on storage.objects for select
  using (
    bucket_id = 'registro-anexos'
    and exists (
      select 1 from public.registro_anexos a
      join public.registros r on r.id = a.registro_id
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where a.path = name
        and (
          public.my_role() = 'coordenacao'
          or d.mentor_id = public.my_profile_id()
          or d.supervisor_id = public.my_profile_id()
        )
    )
  );

create policy registro_anexos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'registro-anexos'
    and exists (
      select 1 from public.registro_anexos a
      join public.registros r on r.id = a.registro_id
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where a.path = name
        and (public.my_role() = 'coordenacao' or d.mentor_id = public.my_profile_id())
    )
  );

create policy registro_anexos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'registro-anexos'
    and exists (
      select 1 from public.registro_anexos a
      join public.registros r on r.id = a.registro_id
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where a.path = name
        and (public.my_role() = 'coordenacao' or d.mentor_id = public.my_profile_id())
    )
  );
