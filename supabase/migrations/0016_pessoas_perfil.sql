-- ===== perfil público interno: foto do mentorado + mural de notas =====
-- "tipo rede social": a página /pessoas/[id] mostra identidade + duplas + feed
-- de notas individuais (observações da coordenação, do mentor, do supervisor).

alter table public.mentorados add column avatar_path text;

-- a coordenação cadastra/gerencia a foto de qualquer pessoa — a policy
-- pasta-por-usuário (0014) continua valendo pro upload do próprio avatar
create policy avatares_coord_write on storage.objects for all
  using (bucket_id = 'avatares' and public.my_role() = 'coordenacao')
  with check (bucket_id = 'avatares' and public.my_role() = 'coordenacao');

-- nota individual no perfil de uma pessoa (profile OU mentorado — nunca os dois)
create table public.pessoa_notas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  mentorado_id uuid references public.mentorados (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 10000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1)
);

alter table public.pessoa_notas enable row level security;
create index pessoa_notas_profile_idx on public.pessoa_notas (profile_id, created_at desc);
create index pessoa_notas_mentorado_idx on public.pessoa_notas (mentorado_id, created_at desc);

-- leitura: staff (coord + supervisor) lê tudo; mentor lê só as notas do
-- mentorado da própria dupla — o vínculo vale inclusive pra dupla encerrada
-- (histórico), e nota sobre staff nunca é visível pro mentor
create policy pessoa_notas_select on public.pessoa_notas for select
  using (
    public.my_role() in ('coordenacao', 'supervisor')
    or (
      mentorado_id is not null
      and exists (
        select 1 from public.duplas d
        where d.mentorado_id = pessoa_notas.mentorado_id
          and d.mentor_id = public.my_profile_id()
      )
    )
  );

-- escrita: mesmo escopo da leitura — mentor anota só no próprio mentorado
create policy pessoa_notas_insert on public.pessoa_notas for insert
  with check (
    public.my_role() in ('coordenacao', 'supervisor')
    or (
      mentorado_id is not null
      and exists (
        select 1 from public.duplas d
        where d.mentorado_id = pessoa_notas.mentorado_id
          and d.mentor_id = public.my_profile_id()
      )
    )
  );

-- apagar: o autor ou a coordenação — nota errada não fica presa no mural
create policy pessoa_notas_delete on public.pessoa_notas for delete
  using (
    created_by = public.my_profile_id()
    or public.my_role() = 'coordenacao'
  );
