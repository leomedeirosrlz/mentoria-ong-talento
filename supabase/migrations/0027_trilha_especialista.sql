-- 0027: trilha de mentor especialista (guia oficial: até 5 encontros de 1h em
-- até 3 meses, sem datas fixas de terça — o especialista agenda direto).
-- Fluxo: mentor DPP registra a demanda -> especialista aceita no mural -> a
-- dupla de especialista nasce vinculada à solicitação que a originou.
begin;

-- duplas ganham trilha + vínculo com a solicitação que a originou
alter table public.duplas
  add column if not exists trilha text not null default 'dpp',
  add column if not exists demanda text,
  add column if not exists solicitacao_id uuid;

alter table public.duplas drop constraint if exists duplas_trilha_check;
alter table public.duplas
  add constraint duplas_trilha_check check (trilha in ('dpp', 'especialista'));

-- a vaga do mentorado passa a ser por trilha: com a chave (ciclo, mentorado_id)
-- a dupla de especialista não poderia existir enquanto a DPP está ativa —
-- justamente o desenho do programa (as duas rodam em paralelo). Mentorado
-- segue limitado a 1 dupla ativa/pausada POR trilha por ciclo.
drop index if exists public.duplas_ciclo_mentorado_ativa_key;
create unique index duplas_ciclo_mentorado_ativa_key
  on public.duplas (ciclo, mentorado_id, trilha)
  where status in ('ativa', 'pausada');

-- os 5 encontros do guia do especialista — sem data fixa (especialista agenda)
create table if not exists public.especialista_eventos (
  numero smallint primary key check (numero between 1 and 5),
  titulo text not null,
  foco text
);
insert into public.especialista_eventos (numero, titulo, foco) values
 (1, 'Acolhimento, vínculo e identificação da demanda', 'Escuta das demandas e desafios do jovem; identificação do tema da mentoria considerando o PDM'),
 (2, 'Orientação, proteção e aconselhamento', 'Fortalecimento da confiança; retomada das metas do PDM; consolidação da direção do processo'),
 (3, 'Definição e alinhamento das metas', 'Metas SMART; primeiras aplicações práticas; registro no PDM'),
 (4, 'Acompanhamento do plano de metas', 'Avanços no plano de metas e submetas; ajuste de estratégias; antecipação de obstáculos'),
 (5, 'Encerramento, reflexão e celebração', 'Reflexão sobre aprendizados; desafios futuros; feedback do jovem; registro final no PDM')
on conflict (numero) do update set titulo = excluded.titulo, foco = excluded.foco;
grant select on public.especialista_eventos to authenticated;
-- o event trigger `ensure_rls` do Supabase habilita RLS em toda tabela nova —
-- sem policy a leitura volta vazia mesmo com grant. Mesma convenção de
-- ciclo_eventos/materiais: catálogo de domínio legível por quem tem papel.
alter table public.especialista_eventos enable row level security;
drop policy if exists especialista_eventos_select on public.especialista_eventos;
create policy especialista_eventos_select on public.especialista_eventos
  for select using (public.my_role() is not null);

create table if not exists public.solicitacoes_especialista (
  id uuid primary key default gen_random_uuid(),
  mentorado_id uuid not null references public.mentorados(id),
  dupla_dpp_id uuid not null references public.duplas(id),
  demanda text not null check (char_length(demanda) between 10 and 1000),
  especialista_desejado_id uuid references public.profiles(id),
  especialista_id uuid references public.profiles(id),
  dupla_id uuid references public.duplas(id),
  status text not null default 'aberta' check (status in ('aberta','aceita','cancelada')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  respondida_em timestamptz
);
alter table public.duplas drop constraint if exists duplas_solicitacao_fk;
alter table public.duplas
  add constraint duplas_solicitacao_fk foreign key (solicitacao_id)
  references public.solicitacoes_especialista(id);
-- uma dupla por solicitação — trava a corrida de dois especialistas aceitando
create unique index if not exists solicitacoes_dupla_uk
  on public.solicitacoes_especialista(dupla_id) where dupla_id is not null;
create index if not exists solicitacoes_status_idx
  on public.solicitacoes_especialista(status) where status = 'aberta';

alter table public.solicitacoes_especialista enable row level security;

-- leitura: coord tudo; mentor DPP e supervisor da dupla de origem;
-- especialista vê as abertas (mural) + as que aceitou
drop policy if exists sol_select on public.solicitacoes_especialista;
create policy sol_select on public.solicitacoes_especialista for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id
      and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
  )
  or (status = 'aberta' and public.my_role() = 'mentor_especialista')
  or especialista_id = public.my_profile_id()
);

-- insert: coord, ou o mentor DPP da dupla de origem
drop policy if exists sol_insert on public.solicitacoes_especialista;
create policy sol_insert on public.solicitacoes_especialista for insert with check (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()
  )
);

-- update: coord; especialista só nas abertas (aceite); solicitante cancela a própria.
-- Sem WITH CHECK explícito o Postgres reusa o USING como check da row nova —
-- e o aceite (status 'aberta'->'aceita') seria rejeitado. O check deixa claro
-- o que cada papel pode gravar: especialista só conclui o aceite pra si;
-- solicitante edita/cancela enquanto aberta, nunca forja 'aceita'.
drop policy if exists sol_update on public.solicitacoes_especialista;
create policy sol_update on public.solicitacoes_especialista for update using (
  public.my_role() = 'coordenacao'
  or (public.my_role() = 'mentor_especialista' and status = 'aberta')
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()
  )
) with check (
  public.my_role() = 'coordenacao'
  or (
    public.my_role() = 'mentor_especialista'
    and status = 'aceita'
    and especialista_id = public.my_profile_id()
  )
  or (
    status in ('aberta', 'cancelada')
    and exists (
      select 1 from public.duplas d
      where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()
    )
  )
);

-- authorship como a 0023: created_by vem do token, não do cliente
create or replace function public.stamp_solicitacao_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null then
    new.created_by := public.my_profile_id();
  elsif new.created_by <> public.my_profile_id() and public.my_role() <> 'coordenacao' then
    raise exception 'created_by não pode ser forjado';
  end if;
  return new;
end $$;
drop trigger if exists solicitacoes_autor on public.solicitacoes_especialista;
create trigger solicitacoes_autor before insert on public.solicitacoes_especialista
  for each row execute function public.stamp_solicitacao_autor();

commit;
