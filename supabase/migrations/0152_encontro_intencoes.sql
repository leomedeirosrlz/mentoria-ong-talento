-- REALIZA-21 — checklist de intenções por encontro.
-- Chave (dupla_id, numero) como encontro_notas (0015): a intenção precede o
-- agendamento e segue o nº do guia na remarcação/não-aconteceu — remarcar,
-- "não aconteceu" e desfazer nunca tocam a checklist. Fechamento deriva de
-- feito+feito_em, sem enum novo (pendente é feito=false).
--
-- Escopo idêntico ao da nota: a intenção é plano privado do mentor (pode
-- citar o jovem) — coord tudo, mentor escreve na própria dupla, supervisor
-- lê; NENHUM ramo mentorado/jovem por desenho (privacidade por omissão).

begin;

create table if not exists public.encontro_intencoes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  texto text not null check (char_length(texto) between 1 and 280),
  feito boolean not null default false,
  feito_em timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encontro_intencoes enable row level security;

create index if not exists encontro_intencoes_dupla_idx
  on public.encontro_intencoes (dupla_id);
-- o recorte do carry-over e do aviso da agenda: pendentes por (dupla, nº)
create index if not exists encontro_intencoes_pendentes_idx
  on public.encontro_intencoes (dupla_id, numero) where not feito;

-- feito_em carimba a transição antes do update, sem confiar no caller:
-- false→true estampa now(), true→false limpa (idempotente por action,
-- PATCH ou reparo manual)
create or replace function public.intencao_carimba_feito()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.feito and not old.feito then
    new.feito_em := now();
  elsif not new.feito then
    new.feito_em := null;
  end if;
  return new;
end
$$;

drop trigger if exists encontro_intencoes_feito on public.encontro_intencoes;
create trigger encontro_intencoes_feito
  before update on public.encontro_intencoes
  for each row execute function public.intencao_carimba_feito();

drop trigger if exists encontro_intencoes_touch on public.encontro_intencoes;
create trigger encontro_intencoes_touch
  before update on public.encontro_intencoes
  for each row execute function public.touch_updated_at();

-- policies verbatim do escopo de encontro_notas (0015): coord lê/escreve
-- tudo; mentor escreve na própria dupla; supervisor só lê as supervisionadas
drop policy if exists encontro_intencoes_select on public.encontro_intencoes;
create policy encontro_intencoes_select on public.encontro_intencoes for select
  to authenticated
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );

drop policy if exists encontro_intencoes_mentor_write on public.encontro_intencoes;
create policy encontro_intencoes_mentor_write on public.encontro_intencoes for all
  to authenticated
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

commit;
