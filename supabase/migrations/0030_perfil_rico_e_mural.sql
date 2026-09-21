-- 0030: perfil profissional rico + mural de solicitações com nome do mentorado
--
-- Parte 1 — bio/linkedin/areas/voluntariado em profiles. São colunas
-- públicas-internas (como nome/avatar): entram no grant de coluna da 0026 e
-- NÃO entram no guard_profiles_self_columns — a pessoa edita a própria bio.
-- CHECKs fecham no banco o que a action valida (mesmo raciocínio da 0023):
-- linkedin só http(s) (javascript:/data: seriam XSS armazenado), caps de
-- char_length nos textos livres e areas com ≤10 tags de ≤40 chars, sem vazias.

begin;

alter table public.profiles
  add column bio text,
  add column linkedin text,
  add column areas text[],
  add column voluntariado text;

-- CHECK não aceita subquery (not exists + unnest estoura
-- "cannot use subquery in check constraint") — a validação por elemento vai
-- pra função immutable chamada na constraint.
create or replace function public.areas_perfil_ok(areas text[])
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select areas is null
     or (
       coalesce(array_length(areas, 1), 0) <= 10
       and not exists (
         select 1 from unnest(areas) as tag
         where char_length(tag) > 40 or char_length(tag) = 0
       )
     );
$$;

alter table public.profiles
  add constraint profiles_linkedin_http
    check (linkedin is null or linkedin ~ '^https?://'),
  add constraint profiles_bio_cap
    check (bio is null or char_length(bio) <= 1000),
  add constraint profiles_voluntariado_cap
    check (voluntariado is null or char_length(voluntariado) <= 300),
  add constraint profiles_areas_ok
    check (public.areas_perfil_ok(areas));

-- mesmo padrão da 0026: SELECT da tabela é por coluna
grant select (bio, linkedin, areas, voluntariado) on public.profiles to authenticated;

-- Parte 2 — mural de solicitações com o nome do jovem.
-- O embed mentorado:mentorados(nome) voltava null pro especialista porque a
-- RLS de mentorados não o alcança — mas por decisão do produto o especialista
-- DEVE ver o nome do jovem na demanda (comunidade curada), e SÓ o nome.
-- Como profiles_contato (0026): view roda como owner (security definer é o
-- default de view) e o WHERE replica EXATAMENTE o escopo da policy sol_select
-- (0027): coord tudo; mentor/supervisor da dupla DPP de origem; especialista
-- vê as abertas + as que aceitou.
create or replace view public.solicitacoes_mural as
select
  s.id,
  s.mentorado_id,
  s.dupla_dpp_id,
  s.demanda,
  s.especialista_desejado_id,
  s.especialista_id,
  s.dupla_id,
  s.status,
  s.created_by,
  s.created_at,
  s.respondida_em,
  m.nome as mentorado_nome
from public.solicitacoes_especialista s
join public.mentorados m on m.id = s.mentorado_id
where
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = s.dupla_dpp_id
      and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
  )
  or (s.status = 'aberta' and public.my_role() = 'mentor_especialista')
  or s.especialista_id = public.my_profile_id();

-- os default privileges do Supabase dão ALL em objetos novos do schema
-- public pra anon/authenticated/service_role (vale pra view também — foi o
-- que deixou profiles_contato com ALL até pra anon). Superfície mínima:
-- tira tudo de anon/PUBLIC e deixa authenticated só com SELECT.
revoke all on public.solicitacoes_mural from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.solicitacoes_mural from authenticated;
grant select on public.solicitacoes_mural to authenticated;

commit;
