-- ===== interacoes: log de nudges e contatos da coordenação com a dupla =====
-- A coordenação monitora e faz nudge (WhatsApp, e-mail...) — sem registro não dá
-- pra saber se uma dupla já foi cobrada ou ficou sem contato. Cada clique no
-- botão de nudge (e contatos fora da plataforma) vira uma linha aqui.
create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  autor_id uuid references public.profiles (id),
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'email', 'outro')),
  tipo text not null default 'nudge' check (tipo in ('nudge', 'contato', 'apoio')),
  nota text,
  created_at timestamptz not null default now()
);

alter table public.interacoes enable row level security;

create index interacoes_dupla_idx on public.interacoes (dupla_id, created_at desc);

-- mesmo escopo de duplas_select: coord lê tudo; mentor e supervisor leem as suas
create policy interacoes_select on public.interacoes for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );

-- quem vê a dupla pode registrar contato nela
create policy interacoes_insert on public.interacoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );
