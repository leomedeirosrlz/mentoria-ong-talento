create extension if not exists pgcrypto;

-- ===== enums =====
create type public.app_role as enum ('coordenacao', 'supervisor', 'mentor_dpp', 'mentor_especialista');
create type public.dupla_status as enum ('ativa', 'pausada', 'encerrada');
create type public.encontro_status as enum ('agendado', 'realizado', 'remarcado', 'nao_aconteceu', 'cancelado');
create type public.encaminhamento_status as enum ('pendente', 'feito', 'atrasado');

-- ===== pessoas =====
-- profiles pode existir antes do primeiro login (cadastro pela coordenacao).
-- user_id fica null ate a pessoa entrar com magic link; o trigger em auth.users faz o link.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  email text not null unique,
  whatsapp text,
  role public.app_role,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.mentor_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('dpp', 'especialista')),
  areas text[] not null default '{}',
  capacidade smallint not null default 1,
  termo_ok boolean not null default false,
  formacao_ok boolean not null default false
);

create table public.mentorados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  whatsapp text,
  ong_origem text,
  notas text,
  created_at timestamptz not null default now()
);

create table public.duplas (
  id uuid primary key default gen_random_uuid(),
  ciclo text not null default '2026/2027',
  mentor_id uuid not null references public.profiles (id),
  mentorado_id uuid not null references public.mentorados (id),
  supervisor_id uuid references public.profiles (id),
  status public.dupla_status not null default 'ativa',
  iniciada_em date,
  created_at timestamptz not null default now(),
  unique (ciclo, mentorado_id)
);

-- calendario oficial do ciclo (seed vem do cronograma Juventude Solidaria)
create table public.ciclo_eventos (
  id uuid primary key default gen_random_uuid(),
  ciclo text not null default '2026/2027',
  tipo text not null check (tipo in ('encontro', 'formacao', 'recesso', 'marco')),
  numero smallint,
  data date not null,
  data_fim date,
  titulo text not null,
  fase text,
  instrumentos text[] not null default '{}'
);

create table public.encontros (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  data_hora timestamptz,
  duracao_min smallint not null default 60,
  status public.encontro_status not null default 'agendado',
  origem text not null default 'plataforma' check (origem in ('plataforma', 'externo')),
  link text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (dupla_id, numero)
);

-- registro pos-encontro = follow-up (campos do "Sugestao de registros do(a) mentor(a)")
create table public.registros (
  id uuid primary key default gen_random_uuid(),
  encontro_id uuid not null unique references public.encontros (id) on delete cascade,
  tema text,
  ferramenta text,
  reflexoes text,
  observacoes text,
  precisa_apoio boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encaminhamentos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  registro_id uuid references public.registros (id) on delete set null,
  descricao text not null,
  responsavel text not null default 'mentorado' check (responsavel in ('mentor', 'mentorado')),
  prazo date,
  status public.encaminhamento_status not null default 'pendente',
  created_at timestamptz not null default now()
);

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null check (tipo in ('guia', 'template', 'conteudo', 'link')),
  url text,
  audiencia text not null default 'todos' check (audiencia in ('todos', 'dpp', 'especialista', 'coordenacao')),
  encontro_num smallint,
  ordem smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ===== helpers para RLS (security definer evita recursao em profiles) =====
create or replace function public.my_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.profiles where user_id = auth.uid() $$;

create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() $$;

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentorados enable row level security;
alter table public.duplas enable row level security;
alter table public.ciclo_eventos enable row level security;
alter table public.encontros enable row level security;
alter table public.registros enable row level security;
alter table public.encaminhamentos enable row level security;
alter table public.materiais enable row level security;

-- profiles: qualquer usuario com papel le a lista (nomes aparecem nas duplas); coord gerencia
create policy profiles_select on public.profiles for select
  using (public.my_role() is not null or user_id = auth.uid());
create policy profiles_self_update on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and role = public.my_role());
create policy profiles_coord on public.profiles for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- mentor_profiles: dono le, coord gerencia
create policy mentor_profiles_select on public.mentor_profiles for select
  using (public.my_role() is not null);
create policy mentor_profiles_self_update on public.mentor_profiles for update
  using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());
create policy mentor_profiles_coord on public.mentor_profiles for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- mentorados: coord/supervisor leem tudo; mentor le so os das suas duplas
create policy mentorados_select on public.mentorados for select
  using (
    public.my_role() in ('coordenacao', 'supervisor')
    or exists (
      select 1 from public.duplas d
      where d.mentorado_id = id and d.mentor_id = public.my_profile_id()
    )
  );
create policy mentorados_coord on public.mentorados for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- duplas: mentor ve as suas, supervisor as supervisionadas, coord tudo
create policy duplas_select on public.duplas for select
  using (
    public.my_role() = 'coordenacao'
    or mentor_id = public.my_profile_id()
    or supervisor_id = public.my_profile_id()
  );
create policy duplas_coord on public.duplas for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');
create policy duplas_supervisor_update on public.duplas for update
  using (supervisor_id = public.my_profile_id() or public.my_role() = 'coordenacao');

-- encontros: a dupla agenda; mentor cria/edita os seus; supervisor le
create policy encontros_select on public.encontros for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );
create policy encontros_mentor_write on public.encontros for all
  using (
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

-- registros: mesmo escopo dos encontros
create policy registros_select on public.registros for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );
create policy registros_mentor_write on public.registros for all
  using (
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

-- encaminhamentos: mentor da dupla gerencia; supervisor le; coord tudo
create policy encaminhamentos_select on public.encaminhamentos for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );
create policy encaminhamentos_mentor_write on public.encaminhamentos for all
  using (
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

-- ciclo_eventos e materiais: leitura para todo usuario com papel; escrita so coord
create policy ciclo_eventos_select on public.ciclo_eventos for select
  using (public.my_role() is not null);
create policy ciclo_eventos_coord on public.ciclo_eventos for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

create policy materiais_select on public.materiais for select
  using (public.my_role() is not null);
create policy materiais_coord on public.materiais for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- ===== trigger: vincula profile pre-cadastrado ao primeiro login =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set user_id = new.id
  where email = new.email and user_id is null;
  if not found then
    insert into public.profiles (user_id, email, nome)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatico em registros
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger registros_touch
  before update on public.registros
  for each row execute function public.touch_updated_at();
