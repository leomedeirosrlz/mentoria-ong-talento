-- foto de perfil pra identificação (sidebar, header da dupla, lista de
-- pessoas). Um arquivo por upload em pasta própria (<profile_id>/<uuid>.ext)
-- — path novo a cada troca, sem stale de CDN; o antigo é removido no update.
-- Bucket público: avatar é dado de identificação, visível entre papéis —
-- a alternativa (signed URL por render) não compensa pra foto de perfil.

alter table public.profiles add column avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true);

-- escrita só na própria pasta: o primeiro segmento do path é o profile_id
create policy avatares_insert on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  );
create policy avatares_update on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  );
create policy avatares_delete on storage.objects for delete
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  );
