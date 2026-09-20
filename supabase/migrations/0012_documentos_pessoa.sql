-- documento oficial por pessoa: termo de responsabilidade do mentor (profiles)
-- e autorizacao do responsavel do mentorado. UM arquivo por pessoa — path
-- nullable porque os documentos chegam ao longo do ciclo.
-- Diferente de materiais (biblioteca, audiencia ampla) e registro_anexos
-- (evidencias por encontro): aqui e documento sensivel — so a coordenacao
-- ve e gerencia, nem supervisor nem o proprio mentor tem acesso.
--
-- Ordem do upload no client: (1) grava documento_path na row, (2) sobe o
-- arquivo. A policy de INSERT do storage.objects confere a row com
-- documento_path = name — sem ela, o objeto e recusado (sem arquivo orfao).

alter table public.profiles add column documento_path text;
alter table public.mentorados add column documento_path text;

-- unico quando presente (1 pessoa = 1 documento; varios podem estar sem)
create unique index profiles_documento_path_key on public.profiles (documento_path)
  where documento_path is not null;
create unique index mentorados_documento_path_key on public.mentorados (documento_path)
  where documento_path is not null;

-- bucket privado — acesso via signed URL gerada pelo route handler /api/documento/[id]
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false);

-- SELECT: so a coordenacao, e so de objeto cujo name ja e documento_path de
-- alguma pessoa (profile ou mentorado) — invisivel/orfao -> sem acesso
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
    )
  );

-- INSERT: so coord, e o objeto so vale se a row ja tiver documento_path = name
create policy documentos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
    )
  );

-- UPDATE/DELETE do objeto: so coord (o component remove o objeto antes de
-- zerar o documento_path)
create policy documentos_storage_update on storage.objects for update
  using (bucket_id = 'documentos' and public.my_role() = 'coordenacao')
  with check (bucket_id = 'documentos' and public.my_role() = 'coordenacao');

create policy documentos_storage_delete on storage.objects for delete
  using (bucket_id = 'documentos' and public.my_role() = 'coordenacao');
