-- 0001 escreveu "d.mentorado_id = id" e o id pelado resolveu pra d.id
-- (a própria dupla) — EXISTS sempre falso, mentor nunca via o mentorado
-- embutido e a home quebrava em dupla.mentorado.nome. Referencia a tabela
-- externa explicitamente.
drop policy if exists mentorados_select on public.mentorados;

create policy mentorados_select on public.mentorados for select
  using (
    public.my_role() in ('coordenacao', 'supervisor')
    or exists (
      select 1
      from public.duplas d
      where d.mentorado_id = mentorados.id
        and d.mentor_id = public.my_profile_id()
    )
  );
