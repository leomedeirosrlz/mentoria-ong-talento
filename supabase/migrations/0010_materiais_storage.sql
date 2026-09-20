-- arquivo oficial por material (guia/instrumento em PDF ou imagem).
-- Diferente de registro_anexos (varias evidencias por registro): aqui e UM
-- arquivo por material — path nullable porque guias chegam ao longo do ciclo
-- (material sem path nem url renderiza "em breve" na biblioteca).
--
-- Ordem do upload no client: (1) salva a row em materiais ja com path,
-- (2) sobe o arquivo. A policy de INSERT do storage.objects confere a row com
-- path = name — sem ela, o objeto e recusado (nao da pra plantar arquivo orfao).

alter table public.materiais add column path text;

-- unico quando presente (1 material = 1 arquivo; varios podem estar sem arquivo)
create unique index materiais_path_key on public.materiais (path)
  where path is not null;

-- bucket privado — acesso via signed URL gerada pelo route handler /api/material/[id]
insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', false);

-- SELECT: espelha o filtro de audiencia de materiais/page.tsx — todos veem
-- 'todos', coord le tudo, dpp/especialista so a propria trilha, supervisor so 'todos'
create policy materiais_storage_select on storage.objects for select
  using (
    bucket_id = 'materiais'
    and exists (
      select 1 from public.materiais m
      where m.path = name
        and (
          m.audiencia = 'todos'
          or public.my_role() = 'coordenacao'
          or (m.audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
          or (m.audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
        )
    )
  );

-- INSERT: so coord, e o objeto so vale se a row de materiais ja tiver path = name
create policy materiais_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'materiais'
    and public.my_role() = 'coordenacao'
    and exists (select 1 from public.materiais m where m.path = name)
  );

-- UPDATE/DELETE do objeto: so coord (o component remove o objeto antes de
-- zerar o path ou excluir a row)
create policy materiais_storage_update on storage.objects for update
  using (bucket_id = 'materiais' and public.my_role() = 'coordenacao')
  with check (bucket_id = 'materiais' and public.my_role() = 'coordenacao');

create policy materiais_storage_delete on storage.objects for delete
  using (bucket_id = 'materiais' and public.my_role() = 'coordenacao');
