-- 0034: campos de matching/perfil — ficha cadastral enriquecida pra alimentar
-- o pareamento dupla×mentor e o cadastro completo de pessoas.
-- (numerado 0034 porque 0033_assinaturas já ocupa o prefixo 0033)
--
-- profiles: dados pessoais (nome social, nascimento, gênero), localização,
-- interesses, motivação, preferência de gênero do par, dados profissionais
-- (cargo/empresa), origem (como chegou ao programa) e o carimbo do
-- consentimento LGPD.
-- mentorados: a mesma ficha pessoal + objetivos e escolaridade (sem cargo/
-- empresa/consent — quem assina pelo jovem é o responsável, 0033).
-- mentor_profiles: experiência prévia, formação externa e a grade semanal de
-- disponibilidade — os insumos do matching.
--
-- Modelo de privacidade — o mesmo da 0026 (Postgres não tem RLS por coluna):
--   · profiles já tem o SELECT table-level revogado: as colunas novas
--     públicas-internas entram no grant por coluna; as sensíveis
--     (data_nascimento, genero, pref_genero_par, motivacao) ficam FORA do
--     grant e só a coordenação as lê, pelas views *_pessoal.
--   · mentorados tinha o SELECT table-level default do Supabase — ele
--     cobriria as colunas sensíveis novas. Sai o table-level e volta grant
--     por coluna com a mesma lista de antes + as públicas novas.
--     documento_path permanece no grant: as policies do bucket `documentos`
--     subconsultam essa coluna na avaliação de QUALQUER leitura/escrita de
--     storage por autenticado — tirá-la quebraria até download de avatar.
--   · mentor_profiles segue com o grant table-level de sempre: os campos
--     novos não são sensíveis e já nascem legíveis por autenticado.
-- UPDATE não é tocado em tabela nenhuma: os grants de escrita são
-- table-level e cobrem colunas novas — self edita o próprio perfil (o
-- guard_profiles_self_columns da 0023 só trava email/role/etc.), coord
-- gerencia mentorados/mentor_profiles.

begin;

-- ---------- profiles ----------

alter table public.profiles
  add column nome_social text,
  add column data_nascimento date,
  add column genero text,
  add column cidade text,
  add column uf text,
  add column interesses text[] not null default '{}',
  add column motivacao text,
  add column pref_genero_par text,
  add column cargo text,
  add column empresa text,
  add column origem text,
  add column consent_lgpd_em timestamptz;

-- interesses: mesma ideia do areas_perfil_ok (0030) — CHECK não aceita
-- subquery, então a validação por elemento mora numa função immutable.
-- Teto mais folgado que o de `areas` (lista curada): 20 tags de ≤60 chars.
create or replace function public.interesses_ok(interesses text[])
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select interesses is null
     or (
       coalesce(array_length(interesses, 1), 0) <= 20
       and not exists (
         select 1 from unnest(interesses) as tag
         where char_length(tag) > 60 or char_length(tag) = 0
       )
     );
$$;

alter table public.profiles
  add constraint profiles_genero_check
    check (genero is null or genero in
      ('feminino', 'masculino', 'nao_binario', 'outro', 'prefiro_nao_dizer')),
  add constraint profiles_pref_genero_par_check
    check (pref_genero_par is null or pref_genero_par in
      ('feminino', 'masculino', 'indiferente')),
  add constraint profiles_uf_check
    check (uf is null or uf ~ '^[A-Z]{2}$'),
  add constraint profiles_interesses_ok
    check (public.interesses_ok(interesses)),
  add constraint profiles_matching_caps check (
    char_length(coalesce(nome_social, '')) <= 150
    and char_length(coalesce(cidade, '')) <= 100
    and char_length(coalesce(cargo, '')) <= 120
    and char_length(coalesce(empresa, '')) <= 150
    and char_length(coalesce(origem, '')) <= 300
    and char_length(coalesce(motivacao, '')) <= 2000
  );

-- ---------- mentorados ----------

alter table public.mentorados
  add column nome_social text,
  add column data_nascimento date,
  add column genero text,
  add column cidade text,
  add column uf text,
  add column interesses text[] not null default '{}',
  add column motivacao text,
  add column pref_genero_par text,
  add column objetivos text,
  add column escolaridade text,
  add column origem text;

alter table public.mentorados
  add constraint mentorados_genero_check
    check (genero is null or genero in
      ('feminino', 'masculino', 'nao_binario', 'outro', 'prefiro_nao_dizer')),
  add constraint mentorados_pref_genero_par_check
    check (pref_genero_par is null or pref_genero_par in
      ('feminino', 'masculino', 'indiferente')),
  add constraint mentorados_uf_check
    check (uf is null or uf ~ '^[A-Z]{2}$'),
  add constraint mentorados_escolaridade_check
    check (escolaridade is null or escolaridade in
      ('fundamental', 'medio', 'tecnico', 'superior_incompleto', 'superior', 'pos')),
  add constraint mentorados_interesses_ok
    check (public.interesses_ok(interesses)),
  add constraint mentorados_matching_caps check (
    char_length(coalesce(nome_social, '')) <= 150
    and char_length(coalesce(cidade, '')) <= 100
    and char_length(coalesce(origem, '')) <= 300
    and char_length(coalesce(motivacao, '')) <= 2000
    and char_length(coalesce(objetivos, '')) <= 2000
  );

-- ---------- mentor_profiles ----------

alter table public.mentor_profiles
  add column experiencia_previa text,
  add column formacao_externa text,
  -- grade semanal pro matching: {"dias":["seg","ter",...],
  -- "periodos":["manha","tarde","noite"]} — forma validada pelo CHECK abaixo
  add column disponibilidade jsonb;

-- disponibilidade_ok: objeto com só as chaves dias/periodos, cada uma um
-- array de texto dentro do vocabulário fechado. Chave ausente é ok (a grade
-- pode vir parcial); valor null/explicito ou tipo errado reprova.
create or replace function public.disponibilidade_ok(d jsonb)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select d is null or (
    jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(d) as k
      where k not in ('dias', 'periodos')
    )
    and (
      d -> 'dias' is null
      or (
        jsonb_typeof(d -> 'dias') = 'array'
        and not exists (
          select 1 from jsonb_array_elements_text(d -> 'dias') as dia
          where dia not in ('seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom')
        )
      )
    )
    and (
      d -> 'periodos' is null
      or (
        jsonb_typeof(d -> 'periodos') = 'array'
        and not exists (
          select 1 from jsonb_array_elements_text(d -> 'periodos') as per
          where per not in ('manha', 'tarde', 'noite')
        )
      )
    )
  );
$$;

alter table public.mentor_profiles
  add constraint mentor_profiles_disponibilidade_ok
    check (public.disponibilidade_ok(disponibilidade)),
  add constraint mentor_profiles_experiencia_caps check (
    char_length(coalesce(experiencia_previa, '')) <= 2000
    and char_length(coalesce(formacao_externa, '')) <= 2000
  );

-- ---------- grants ----------

-- profiles: as colunas públicas-internas entram no grant por coluna da 0026.
grant select (nome_social, cidade, uf, interesses, cargo, empresa, origem,
  consent_lgpd_em) on public.profiles to authenticated;

-- As sensíveis ficam de fora de propósito — revoke explícito documenta a
-- intenção e segura uma re-concessão table-level futura.
revoke select (data_nascimento, genero, pref_genero_par, motivacao)
  on public.profiles from authenticated;

-- mentorados: sai o SELECT table-level (default Supabase) e volta por
-- coluna — a lista reproduz as colunas legíveis de hoje + as públicas novas;
-- as 4 sensíveis ficam de fora. Linhas continuam escopadas pela RLS (0023).
revoke select on public.mentorados from authenticated;
grant select (id, nome, email, whatsapp, ong_origem, notas, avatar_path,
  documento_path, created_at, nome_social, cidade, uf, interesses, objetivos,
  escolaridade, origem) on public.mentorados to authenticated;
revoke select (data_nascimento, genero, pref_genero_par, motivacao)
  on public.mentorados from authenticated;

-- ---------- views coord-only ----------
-- Mesmo modelo de profiles_contato: a view roda como owner (o default de
-- view ignora grants/RLS da tabela base) e o WHERE escopa por papel de app.
-- Sem self no WHERE de propósito — os campos são escritos pela coordenação
-- no cadastro/matching; se um futuro "meu perfil" precisar ler de volta, a
-- extensão é `or p.id = public.my_profile_id()`.

create or replace view public.profiles_pessoal as
select
  p.id,
  p.nome,
  p.data_nascimento,
  p.genero,
  p.pref_genero_par,
  p.motivacao
from public.profiles p
where public.my_role() = 'coordenacao';

create or replace view public.mentorados_pessoal as
select
  m.id,
  m.nome,
  m.data_nascimento,
  m.genero,
  m.pref_genero_par,
  m.motivacao
from public.mentorados m
where public.my_role() = 'coordenacao';

-- superfície mínima (o endurecimento da 0030): objetos novos do schema
-- public nascem com ALL pra anon/authenticated pelos default privileges
revoke all on public.profiles_pessoal from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles_pessoal from authenticated;
grant select on public.profiles_pessoal to authenticated;

revoke all on public.mentorados_pessoal from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.mentorados_pessoal from authenticated;
grant select on public.mentorados_pessoal to authenticated;

commit;
