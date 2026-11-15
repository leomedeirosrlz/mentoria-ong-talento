-- 0196 — material_leituras (REALIZA-413): o indicador de leitura dos
-- cards de materiais (mentor vê de cara o que já abriu). Uma row por
-- (profile_id, ref), marcada na primeira abertura do material.
--
-- `ref` é texto, não FK: material "doc:<slug>" marca pelo SLUG do
-- documento nativo — a linha de catálogo e a linha sintética do encontro
-- (id "doc-…", fora de materiais) apontam pro mesmo doc, e ler um vale
-- pros dois. Material de arquivo/link externo marca pelo id da row.
--
-- Escopo mínimo: cada um lê/marca a própria leitura; coordenação lê tudo
-- (a futura cobertura de leitura dos guias sai daqui sem migration nova).
begin;

create table public.material_leituras (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ref text not null,
  lido_em timestamptz not null default now(),
  primary key (profile_id, ref)
);

alter table public.material_leituras enable row level security;

revoke all on public.material_leituras from public, anon;
grant select, insert, update on public.material_leituras to authenticated;

create policy material_leituras_select on public.material_leituras
  for select using (
    profile_id = public.my_profile_id() or public.my_role() = 'coordenacao'
  );

create policy material_leituras_insert on public.material_leituras
  for insert with check (profile_id = public.my_profile_id());

create policy material_leituras_update on public.material_leituras
  for update using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());

commit;
