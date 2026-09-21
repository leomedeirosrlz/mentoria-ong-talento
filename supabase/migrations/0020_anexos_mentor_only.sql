-- Evidência é escrita do mentor. Antes a policy de write de registro_anexos
-- (for all) e as de storage insert/delete admitiam coordenação — a UI já
-- escondia, mas a regra tem que valer na RLS. A coord fica só com SELECT
-- (acompanhamento) e DELETE (moderação de arquivo impróprio).

drop policy registro_anexos_mentor_write on public.registro_anexos;

create policy registro_anexos_mentor_insert on public.registro_anexos
  for insert with check (
    exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id and d.mentor_id = public.my_profile_id()
    )
  );

create policy registro_anexos_write_delete on public.registro_anexos
  for delete using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id and d.mentor_id = public.my_profile_id()
    )
  );

drop policy registro_anexos_storage_insert on storage.objects;
create policy registro_anexos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'registro-anexos'
    and exists (
      select 1 from public.registro_anexos a
      join public.registros r on r.id = a.registro_id
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where a.path = name and d.mentor_id = public.my_profile_id()
    )
  );

-- delete segue com coord (moderação) — o arquivo sai junto com a row
