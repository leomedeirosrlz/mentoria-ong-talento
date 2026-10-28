-- 0139 — audiência granular de materiais (expand)
--
-- O material tinha UMA audiência (`audiencia`: todos | dpp | especialista |
-- coordenacao) — não dava pra endereçar coordenação E auxiliares no mesmo
-- item, e **auxiliar executivo/supervisor nem existia** como opção (só via
-- `todos`). Passa a valer uma lista por papel (`audiencias text[]`), com
-- `todos` mantendo o sentido atual (inclui o jovem).
--
-- Expand puro: a coluna antiga fica de pé (o código em produção durante o
-- deploy continua lendo) e as duas políticas são reescritas pra ler a nova.
-- O contrato que derruba `audiencia` vem depois, com o código já no ar.
begin;

alter table public.materiais add column if not exists audiencias text[];

-- backfill a partir do valor único — a equivalência é a mesma das policies
update public.materiais
   set audiencias = case audiencia
     when 'dpp' then array['mentor_dpp']
     when 'especialista' then array['mentor_especialista']
     when 'coordenacao' then array['coordenacao']
     else array['todos']
   end
 where audiencias is null;

alter table public.materiais alter column audiencias set default array['todos'];
alter table public.materiais alter column audiencias set not null;

-- lista não vazia e só com papéis conhecidos
alter table public.materiais
  add constraint materiais_audiencias_check check (
    cardinality(audiencias) > 0
    and audiencias <@ array[
      'todos', 'coordenacao', 'supervisor',
      'mentor_dpp', 'mentor_especialista', 'mentorado'
    ]
  );

-- RLS da row: coordenação lê tudo; o resto lê `todos` ou o próprio papel
-- (efetivo — `has_papel` cobre o híbrido e o secundário de 0085)
drop policy if exists materiais_select on public.materiais;
create policy materiais_select on public.materiais for select using (
  my_role() is not null and (
    'todos' = any (audiencias)
    or has_papel('coordenacao'::app_role)
    or ('supervisor' = any (audiencias) and has_papel('supervisor'::app_role))
    or ('mentor_dpp' = any (audiencias) and has_papel('mentor_dpp'::app_role))
    or ('mentor_especialista' = any (audiencias) and has_papel('mentor_especialista'::app_role))
    or ('mentorado' = any (audiencias) and my_role() = 'mentorado'::app_role)
  )
);

-- Storage da biblioteca: mesma régua, senão o card aparece e o download 404
drop policy if exists materiais_storage_select on storage.objects;
create policy materiais_storage_select on storage.objects for select using (
  bucket_id = 'materiais' and my_role() is not null and exists (
    select 1 from public.materiais m
    where m.path = objects.name and (
      'todos' = any (m.audiencias)
      or my_role() = 'coordenacao'::app_role
      or ('supervisor' = any (m.audiencias) and has_papel('supervisor'::app_role))
      or ('mentor_dpp' = any (m.audiencias) and has_papel('mentor_dpp'::app_role))
      or ('mentor_especialista' = any (m.audiencias) and has_papel('mentor_especialista'::app_role))
      or ('mentorado' = any (m.audiencias) and my_role() = 'mentorado'::app_role)
    )
  )
);

commit;
