-- comunicados: avisos gerais publicados pela coordenação.
-- audiencia reusa os 4 valores dos materiais — mesmo modelo mental, mesma
-- matriz de policy (supervisor enxerga 'todos'; 'coordenacao' é só coord).
create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 140),
  corpo text not null check (char_length(corpo) between 1 and 5000),
  audiencia text not null default 'todos'
    check (audiencia in ('todos', 'dpp', 'especialista', 'coordenacao')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index comunicados_created_idx on public.comunicados (created_at desc);

-- notificacoes in-app por destinatário. comunicado_id com cascade: excluir o
-- aviso remove os pings dele junto. href restrito a path interno — a row nunca
-- carrega URL externa/ativa.
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada'
  )),
  titulo text not null check (char_length(titulo) between 1 and 200),
  corpo text check (char_length(corpo) <= 1000),
  href text check (href is null or href like '/%'),
  comunicado_id uuid references public.comunicados (id) on delete cascade,
  created_by uuid references public.profiles (id),
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index notificacoes_nao_lidas_idx
  on public.notificacoes (profile_id) where lida_em is null;
create index notificacoes_profile_idx
  on public.notificacoes (profile_id, created_at desc);

alter table public.comunicados enable row level security;
alter table public.notificacoes enable row level security;

create policy comunicados_select on public.comunicados for select using (
  audiencia = 'todos'
  or public.my_role() = 'coordenacao'
  or (audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
  or (audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
);
create policy comunicados_insert on public.comunicados for insert
  with check (public.my_role() = 'coordenacao');
-- delete sim, edit não: aviso errado sai e republica (o cascade remove os pings)
create policy comunicados_delete on public.comunicados for delete
  using (public.my_role() = 'coordenacao');

create policy notificacoes_select on public.notificacoes for select
  using (profile_id = public.my_profile_id());
create policy notificacoes_update on public.notificacoes for update
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());
-- insert escopado pelo papel do DESTINATÁRIO: coord notifica qualquer um;
-- não-coord só escreve pra staff (o único fluxo legítimo é pedido de apoio →
-- coordenação/supervisor). Mentor não consegue notificar outro mentor.
create policy notificacoes_insert on public.notificacoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.role in ('coordenacao', 'supervisor')
    )
  );
-- sem delete: histórico cai naturalmente pelo limit da query
