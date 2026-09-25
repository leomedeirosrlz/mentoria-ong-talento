-- 0054: campos do intake real (Google Forms) + documentos múltiplos por pessoa
--
-- O intake do programa roda em Google Forms ("dados para o matching" de
-- mentores/mentorados e cadastro Brasil Participativo). Duas necessidades:
--
--   a) campos coletados que não tinham coluna: cor/raça (autodeclaração) e
--      o payload integral da resposta (form_bruto) — o raw preserva o que
--      ainda não tem casa estruturada (inspirações, valores, realizações,
--      dados bancários do BP etc.) sem poluir o schema;
--   b) documentos por pessoa: o form coleta N anexos (RG/CNH, comprovante de
--      residência, currículo, comprovante bancário, CPF) e `documento_path`
--      comporta 1 só (o documento oficial — termo/autorização).
--      `documentos_pessoa` é o arquivo morto do intake, coord-only como o
--      `documento_path` já é.
--
-- cor_raca e form_bruto são sensíveis: ficam fora dos grants de coluna e
-- entram só nas views *_pessoal (coord). form_bruto também é protegido no
-- guard de auto-edição — é registro de submissão, não campo de perfil.

begin;

-- ---------- profiles ----------

alter table public.profiles
  add column cor_raca text,
  add column form_bruto jsonb;

alter table public.profiles
  add constraint profiles_cor_raca_check
    check (cor_raca is null or cor_raca in
      ('branca', 'negra', 'parda', 'amarela', 'indigena', 'outro',
       'prefiro_nao_dizer')),
  add constraint profiles_form_bruto_ok
    check (form_bruto is null or jsonb_typeof(form_bruto) = 'object');

-- sensíveis: sem grant de coluna + revoke explícito documentando a intenção
-- (mesmo padrão da 0034)
revoke select (cor_raca, form_bruto) on public.profiles from authenticated;

-- form_bruto é arquivo morto da submissão — nem o dono edita (a coordenação
-- escreve; o guard só trava a própria pessoa, updatePessoa/updateMeuPerfil
-- não passam por ele pra coord)
create or replace function public.guard_profiles_self_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_profile_id() = old.id and (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.ativo is distinct from old.ativo
    or new.user_id is distinct from old.user_id
    or new.documento_path is distinct from old.documento_path
    or new.form_bruto is distinct from old.form_bruto
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'campo protegido do perfil';
  end if;
  -- latch do consentimento LGPD (0053) — preservado no replace
  if auth.uid() is not null
     and public.my_role() is distinct from 'coordenacao'
     and new.consent_lgpd_em is distinct from old.consent_lgpd_em
     and (old.consent_lgpd_em is not null
          or new.consent_lgpd_em is null
          or new.consent_lgpd_em < now() - interval '1 hour'
          or new.consent_lgpd_em > now() + interval '5 minutes') then
    raise exception 'o carimbo de consentimento não pode ser alterado';
  end if;
  return new;
end;
$$;

-- ---------- mentorados ----------

alter table public.mentorados
  add column cor_raca text,
  add column form_bruto jsonb;

alter table public.mentorados
  add constraint mentorados_cor_raca_check
    check (cor_raca is null or cor_raca in
      ('branca', 'negra', 'parda', 'amarela', 'indigena', 'outro',
       'prefiro_nao_dizer')),
  add constraint mentorados_form_bruto_ok
    check (form_bruto is null or jsonb_typeof(form_bruto) = 'object');

revoke select (cor_raca, form_bruto) on public.mentorados from authenticated;

-- ---------- views coord-only (append no fim — regra do CREATE OR REPLACE) --

create or replace view public.profiles_pessoal as
select
  p.id,
  p.nome,
  p.data_nascimento,
  p.genero,
  p.pref_genero_par,
  p.motivacao,
  p.dados_civis,
  p.cor_raca,
  p.form_bruto
from public.profiles p
where public.my_role() = 'coordenacao';

create or replace view public.mentorados_pessoal as
select
  m.id,
  m.nome,
  m.data_nascimento,
  m.genero,
  m.pref_genero_par,
  m.motivacao,
  m.dados_civis,
  m.responsavel,
  m.cor_raca,
  m.form_bruto
from public.mentorados m
where public.my_role() = 'coordenacao';

-- ---------- documentos por pessoa (N por pessoa, coord-only) ----------

create table public.documentos_pessoa (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  mentorado_id uuid references public.mentorados (id) on delete cascade,
  tipo text not null check (tipo in
    ('rg', 'cpf', 'comprovante_residencia', 'comprovante_bancario',
     'curriculo', 'outro')),
  path text not null unique,
  nome text check (nome is null or char_length(nome) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1)
);

create index documentos_pessoa_profile_idx
  on public.documentos_pessoa (profile_id) where profile_id is not null;
create index documentos_pessoa_mentorado_idx
  on public.documentos_pessoa (mentorado_id) where mentorado_id is not null;

alter table public.documentos_pessoa enable row level security;

-- coord-only integral: o conteúdo é documento civil sensível, nem o próprio
-- dono lê por aqui (ele nem sabe que o intake guardou — espelha documento_path)
create policy documentos_pessoa_coord on public.documentos_pessoa
  for all
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

-- superfície mínima (padrão da casa — sem revoke de authenticated, tabela
-- nova nasce com ALL pelos default privileges). SELECT não é enfeite: as
-- policies do bucket `documentos` fazem exists nessa tabela como invoker —
-- sem o grant, qualquer operação de storage no bucket estoura permission
-- denied (o incidente que motivou a 0026).
revoke all on public.documentos_pessoa from public, anon;
revoke all on public.documentos_pessoa from authenticated;
grant select, insert, update, delete
  on public.documentos_pessoa to authenticated;

-- storage do bucket `documentos`: as policies (0026 — leem profiles_contato
-- porque documento_path está fora do grant de coluna) exigem que o objeto já
-- seja `documento_path` de alguém; agora também vale ser `path` de
-- documentos_pessoa — a subquery roda sob RLS, então pra não-coord a tabela
-- vem vazia e o exists é falso (mesma semântica da view). Recria
-- SELECT/INSERT com a condição ampliada (UPDATE/DELETE seguem bucket+coord).
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
      or exists (select 1 from public.documentos_pessoa d where d.path = name)
    )
  );

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.my_role() = 'coordenacao'
    and (
      exists (select 1 from public.profiles_contato p where p.documento_path = name)
      or exists (select 1 from public.mentorados m where m.documento_path = name)
      or exists (select 1 from public.documentos_pessoa d where d.path = name)
    )
  );

commit;
