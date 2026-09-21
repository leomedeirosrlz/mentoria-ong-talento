-- 0024: avatares aceitam só imagem raster. O bucket é público e o Supabase
-- serve o objeto inline com o content-type original — um .svg/.html subido
-- pela pasta própria executaria script no domínio do storage ao abrir o
-- link. A UI já limita a PNG/JPG/WebP; a policy agora garante o mesmo.

drop policy if exists avatares_insert on storage.objects;
create policy avatares_insert on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
    and name ~* '\.(png|jpe?g|webp)$'
  );

drop policy if exists avatares_update on storage.objects;
create policy avatares_update on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
    and name ~* '\.(png|jpe?g|webp)$'
  );

-- caminho da coordenação (admin) — mesma restrição de extensão no with check
drop policy if exists avatares_coord_write on storage.objects;
create policy avatares_coord_write on storage.objects for all
  using (
    bucket_id = 'avatares'
    and public.my_role() = 'coordenacao'
  )
  with check (
    bucket_id = 'avatares'
    and public.my_role() = 'coordenacao'
    and name ~* '\.(png|jpe?g|webp)$'
  );
