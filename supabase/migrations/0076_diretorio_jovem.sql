-- 0076: diretório do jovem (REALIZA-113 / D6) — views dedicadas de leitura +
-- o aperto reverso do profiles_select. Decisões da issue:
--   * o jovem vê: especialistas (catálogo 0075), colegas da turma, os adultos
--     das suas duplas e a coordenação — civis/documentos NUNCA
--   * contato de adulto visível por default (jovem_contatos já entrega); de
--     colega pra colega é OPT-IN — `contato_compartilhado` default false e o
--     dono do toggle é o próprio jovem (RPC self; coord pré-seta no intake
--     com consentimento do responsável)
--   * colega sem conta (profile_id null) é invisível no diretório
--   * profiles_select: adulto lê profile de menor só se for de uma dupla
--     dele — antes qualquer staff lia o card de todo jovem logado
begin;

-- ---------- flag colega↔colega ----------
alter table public.mentorados
  add column contato_compartilhado boolean not null default false;

-- a flag em si não é sensível (o que ela libera é); mesmo grant das públicas
-- da 0034 — a fronteira real continua sendo a policy de linha
grant select (contato_compartilhado) on public.mentorados to authenticated;
grant insert (contato_compartilhado) on public.mentorados to authenticated;
grant update (contato_compartilhado) on public.mentorados to authenticated;

-- ---------- oráculo: "esse profile é jovem de uma dupla minha" ----------
-- mentor_dpp e supervisor veem o jovem da dupla deles; o especialista cai no
-- mesmo ramo (na dupla de especialista o mentor_id é ele). definer como o
-- par_de_mim (0072): policy não consulta tabela direto pra não depender de
-- short-circuit de permissão
create or replace function public.jovem_relacionado(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from duplas d
    join mentorados m on m.id = d.mentorado_id
    where m.profile_id = p_profile
      and (d.mentor_id = public.my_profile_id()
           or d.supervisor_id = public.my_profile_id())
  );
$$;

revoke all on function public.jovem_relacionado(uuid) from public, anon;
grant execute on function public.jovem_relacionado(uuid) to authenticated;

-- ---------- profiles_select apertado ----------
-- antes: staff (coord/sup/dpp/esp) lia TODOS os profiles — bastava o jovem
-- logar pra virar card público do diretório. agora: staff lê qualquer profile
-- de adulto como sempre; profile de mentorado só se relacionado. role null
-- (pré-cadastro sem papel) também fica fora — deny by default pra menor.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.my_role() = 'coordenacao'::app_role
    or (
      public.my_role() = any (array[
        'supervisor'::app_role, 'mentor_dpp'::app_role, 'mentor_especialista'::app_role
      ])
      and (
        role <> 'mentorado'::app_role
        or public.jovem_relacionado(id)
      )
    )
  );

-- ---------- colegas da turma ----------
-- projeção mínima + whatsapp atrás do opt-in. coorte = divide alguma turma
-- comigo (turma textual da dupla — "T1 · 2026/2027"); sem coorte o WHERE
-- fecha sozinho e restam especialistas+coord, como decidido. o jovem sem
-- conta não aparece — não consentiu presença no diretório.
create or replace view public.mentorados_turma as
select
  m.id,
  m.nome,
  m.nome_social,
  m.avatar_path,
  m.cidade,
  m.uf,
  m.interesses,
  case when m.contato_compartilhado then m.whatsapp else null end as whatsapp
from public.mentorados m
where public.my_role() = 'mentorado'::app_role
  and m.profile_id is not null
  and m.id <> public.my_mentorado_id()
  and exists (
    select 1
    from public.duplas minha
    join public.duplas colega
      on colega.mentorado_id = m.id
     and colega.turma = minha.turma
    where minha.mentorado_id = public.my_mentorado_id()
      and minha.turma is not null
  );

revoke all on public.mentorados_turma from public, anon;
grant select on public.mentorados_turma to authenticated;

-- ---------- toggle do próprio jovem ----------
create or replace function public.set_contato_compartilhado(p_ligado boolean)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if public.my_role() <> 'mentorado' then
    raise exception 'Só o próprio jovem controla o compartilhamento do contato';
  end if;
  update public.mentorados
     set contato_compartilhado = p_ligado
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.set_contato_compartilhado(boolean) from public, anon;
grant execute on function public.set_contato_compartilhado(boolean) to authenticated;

-- ---------- jovem_perfil ganha a flag (append no fim) ----------
create or replace view public.jovem_perfil as
select
  m.id,
  m.nome,
  m.nome_social,
  m.email,
  m.whatsapp,
  m.avatar_path,
  m.data_nascimento,
  m.genero,
  m.cidade,
  m.uf,
  m.interesses,
  m.motivacao,
  m.objetivos,
  m.escolaridade,
  m.origem,
  m.ong_origem,
  m.pref_genero_par,
  m.disponibilidade,
  m.dados_civis,
  m.responsavel,
  m.cor_raca,
  m.created_at,
  m.contato_compartilhado
from public.mentorados m
where m.id = public.my_mentorado_id()
  and public.my_role() = 'mentorado'::app_role;

-- ---------- jovem_contatos: papel certo pra trilha esp ----------
-- a dupla de especialista tem mentor_id = o especialista; antes caía como
-- 'mentor' e a home rotulava "Seu mentor" pro especialista. mesma projeção,
-- papel derivado da trilha
create or replace view public.jovem_contatos as
select dupla_id, papel, id, nome, nome_social, avatar_path, whatsapp, email, role
from (
  select
    d.id as dupla_id,
    case when d.trilha = 'especialista' then 'especialista' else 'mentor' end as papel,
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.mentor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select
    d.id, 'supervisor',
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.supervisor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select
    null::uuid, 'coordenacao',
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.profiles p
  where p.role = 'coordenacao'::app_role and p.ativo
) contatos
where public.my_role() = 'mentorado'::app_role;

-- ---------- mentorados_pessoal (coord) ganha a flag ----------
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
  m.form_bruto,
  m.contato_compartilhado
from public.mentorados m
where public.my_role() = 'coordenacao'::app_role;

commit;
