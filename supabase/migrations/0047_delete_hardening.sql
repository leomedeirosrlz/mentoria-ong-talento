-- DELETE em encontros e registros vira coord-only.
-- As policies `*_mentor_write for all` (0001) cobriam delete pro mentor da
-- dupla: apagar um encontro `realizado` derrubava o registro em cascata,
-- contornando o guard 0043 (que só vigia UPDATE). O app nunca deleta essas
-- rows — cancelar = status nao_aconteceu e deleteDupla usa cascata de FK
-- (que não passa por RLS) — então split insert/update/delete, espelhando 0020.
-- encaminhamentos/encontro_notas/registro_anexos seguem como estão: a UI
-- legitima o delete do mentor ali (combinado/anotação/anexo próprio) e 0020
-- já separou os anexos.

drop policy encontros_mentor_write on public.encontros;

create policy encontros_mentor_insert on public.encontros
  for insert with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id()
    )
  );

create policy encontros_mentor_update on public.encontros
  for update using (
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

create policy encontros_coord_delete on public.encontros
  for delete using (public.my_role() = 'coordenacao');

drop policy registros_mentor_write on public.registros;

create policy registros_mentor_insert on public.registros
  for insert with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id and d.mentor_id = public.my_profile_id()
    )
  );

create policy registros_mentor_update on public.registros
  for update using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id and d.mentor_id = public.my_profile_id()
    )
  ) with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id and d.mentor_id = public.my_profile_id()
    )
  );

create policy registros_coord_delete on public.registros
  for delete using (public.my_role() = 'coordenacao');
