begin;

-- 0070 — combinados + identidade híbrida dos links tokenizados (REALIZA-108)
--
-- 1) jovem_encaminhamentos: os combinados DO jovem (responsavel='mentorado' —
--    descricao é o conteúdo endereçado a ele, sai; registro_id fica: é o link
--    interno pro registro do mentor, que o jovem não lê). Mesmo padrão das
--    views jovem_* (0067): definer + role-check no WHERE.
-- 2) marcar_combinado(id, feito): único write do jovem em encaminhamentos —
--    definer, valida vínculo + responsavel + flip pendente↔feito (o bool
--    impossibilita 'atrasado', que é valor fantasma do enum — vencido deriva
--    de prazo na UI, vide encaminhamentos-list.tsx).
-- 3) jovem_assinaturas: +token/token_expira_em/slug/titulo — o jovem abre o
--    termo dele e encaminha a autorização ao responsável; o token é dele.
-- 4) formulario_links.respondido_por_profile_id + enforce de identidade:
--    link tokenizado funciona deslogado (bearer), mas AUTENTICADO cujo
--    my_profile_id()/my_mentorado_id() diverge do dest_* é recusado
--    ("este link é de outra pessoa") — impede responder "por" outra pessoa
--    logado. Quando autenticado, grava quem respondeu (resposta-por-sessão
--    vs por-portador, auditoria).
-- 5) Mesmo gate nas RPCs de assinatura: termo-mentorando exige o próprio
--    jovem; autorizacao-responsavel é sempre do responsável (não é usuário
--    da plataforma) — autenticado recebe orientação pra encaminhar.

-- 1) ---------------------------------------------------------------------
create or replace view public.jovem_encaminhamentos as
select e.id, e.dupla_id, e.descricao, e.prazo, e.status, e.created_at
from public.encaminhamentos e
where public.my_role() = 'mentorado'
  and e.responsavel = 'mentorado'
  and exists (
    select 1 from public.duplas d
    where d.id = e.dupla_id
      and d.mentorado_id = public.my_mentorado_id()
  );

grant select on public.jovem_encaminhamentos to authenticated;

-- 2) ---------------------------------------------------------------------
create or replace function public.marcar_combinado(p_id uuid, p_feito boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enc public.encaminhamentos%rowtype;
begin
  if public.my_role() is distinct from 'mentorado' then
    raise exception 'Só o mentorado marca os próprios combinados';
  end if;

  select * into v_enc from public.encaminhamentos where id = p_id;
  if not found
     or v_enc.responsavel <> 'mentorado'
     or not exists (
       select 1 from public.duplas d
       where d.id = v_enc.dupla_id
         and d.mentorado_id = public.my_mentorado_id()
     ) then
    raise exception 'Combinado não encontrado';
  end if;

  update public.encaminhamentos
    set status = (case when p_feito then 'feito' else 'pendente' end)::public.encaminhamento_status
    where id = p_id;
end;
$$;

revoke all on function public.marcar_combinado(uuid, boolean) from public, anon;
grant execute on function public.marcar_combinado(uuid, boolean) to authenticated;

-- 3) ---------------------------------------------------------------------
-- colunas mudam (token/slug/titulo entram) — or replace não renomeia; a view
-- é de 0067, nada depende dela ainda.
drop view if exists public.jovem_assinaturas;
create view public.jovem_assinaturas as
select a.id, a.template_id, t.slug, t.titulo, a.status, a.token,
       a.token_expira_em, a.assinado_em, a.created_at
from public.assinaturas a
join public.documento_templates t on t.id = a.template_id
where a.mentorado_id = public.my_mentorado_id()
  and public.my_role() = 'mentorado';

grant select on public.jovem_assinaturas to authenticated;

-- 4) ---------------------------------------------------------------------
alter table public.formulario_links
  add column if not exists respondido_por_profile_id uuid
    references public.profiles(id);

create or replace function public.formulario_por_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_nome text;
  v_identidade text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo, f.descricao, f.campos, f.ativo, f.versao
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    return null;
  end if;

  -- identidade híbrida (0070): autenticado só enxerga link endereçado a ele
  -- (ou genérico). Fora isso, o form não vaza — o conteúdo pode ser pessoal.
  v_identidade := case
    when auth.uid() is null then 'anon'
    when (l.dest_profile_id is not null
          and l.dest_profile_id is distinct from public.my_profile_id())
      or (l.dest_mentorado_id is not null
          and l.dest_mentorado_id is distinct from public.my_mentorado_id())
      then 'outra_pessoa'
    else 'ok' end;

  select coalesce(p.nome, m.nome) into v_nome
    from formulario_links fl
    left join profiles p on p.id = fl.dest_profile_id
    left join mentorados m on m.id = fl.dest_mentorado_id
    where fl.id = l.id;

  if v_identidade = 'outra_pessoa' then
    return jsonb_build_object(
      'status', 'outra_pessoa',
      'destinatario', v_nome
    );
  end if;

  return jsonb_build_object(
    'status', case
      when l.usado_em is not null then 'respondido'
      when not l.ativo then 'inativo'
      when l.expira_em is not null and l.expira_em < now() then 'expirado'
      else 'pendente' end,
    'expira_em', l.expira_em,
    'respondido_em', l.usado_em,
    'destinatario', v_nome,
    'formulario', jsonb_build_object(
      'id', l.f_id,
      'titulo', l.titulo,
      'descricao', l.descricao,
      'campos', l.campos,
      'versao', l.versao
    )
  );
end $$;

create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dest_profile_id, fl.dest_mentorado_id,
         f.ativo as f_ativo, f.campos
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- gate de identidade (0070): autenticado não responde link de outra pessoa
  if auth.uid() is not null
     and ((l.dest_profile_id is not null
           and l.dest_profile_id is distinct from public.my_profile_id())
       or (l.dest_mentorado_id is not null
           and l.dest_mentorado_id is distinct from public.my_mentorado_id())) then
    raise exception 'este link é de outra pessoa';
  end if;

  -- idempotente: já respondido devolve a resposta existente
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas);

  update formulario_links
    set usado_em = now(),
        respondido_por_profile_id = public.my_profile_id()
    where id = l.id and usado_em is null;
  if not found then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;
  return v_id;
end $$;

-- 5) ---------------------------------------------------------------------
create or replace function public.assinatura_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_nome text;
  v_civis jsonb;
  v_p record;
  v_m record;
  v_identidade text;
begin
  select s.*, t.slug as t_slug, t.titulo as t_titulo, t.versao as t_versao
    into a
    from assinaturas s join documento_templates t on t.id = s.template_id
    where s.token = p_token;
  if not found then
    return null;
  end if;
  -- expiração é lazy: primeiro acesso após o prazo marca e devolve o estado
  if a.status = 'pendente' and a.token_expira_em is not null
     and a.token_expira_em < now() then
    update assinaturas set status = 'expirado' where id = a.id;
    a.status := 'expirado';
  end if;

  -- identidade híbrida (0070): autenticado só abre documento endereçado a
  -- ele; autorização é sempre do responsável (que não é usuário — a sessão
  -- de quem quer que esteja logado nunca bate).
  v_identidade := case
    when auth.uid() is null then 'anon'
    when a.t_slug = 'autorizacao-responsavel' then 'signatario_externo'
    when a.profile_id is not null
         and a.profile_id is distinct from public.my_profile_id()
      then 'outra_pessoa'
    when a.mentorado_id is not null
         and a.mentorado_id is distinct from public.my_mentorado_id()
      then 'outra_pessoa'
    else 'ok' end;

  select coalesce(p.nome, m.nome) into v_nome
    from assinaturas s
    left join profiles p on p.id = s.profile_id
    left join mentorados m on m.id = s.mentorado_id
    where s.id = a.id;

  if v_identidade <> 'ok' and v_identidade <> 'anon' then
    return jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'identidade', v_identidade,
      'template', jsonb_build_object(
        'slug', a.t_slug, 'titulo', a.t_titulo, 'versao', a.t_versao),
      'alvo', jsonb_build_object('nome', v_nome)
    );
  end if;

  if a.profile_id is not null then
    select p.nome, p.data_nascimento, p.dados_civis into v_p
      from profiles p where p.id = a.profile_id;
    if found then
      v_civis := coalesce(v_p.dados_civis, '{}'::jsonb);
      if coalesce(v_civis->>'nome_civil', '') = '' then
        v_civis := jsonb_set(v_civis, '{nome_civil}', to_jsonb(v_p.nome));
      end if;
      if coalesce(v_civis->>'data_nascimento', '') = '' and v_p.data_nascimento is not null then
        v_civis := jsonb_set(v_civis, '{data_nascimento}', to_jsonb(v_p.data_nascimento::text));
      end if;
    end if;
  elsif a.t_slug = 'autorizacao-responsavel' then
    select m.responsavel into v_civis
      from mentorados m where m.id = a.mentorado_id;
  else
    -- termo do jovem: dados civis dele, nome/nascimento da ficha de graça
    select m.nome, m.data_nascimento, m.dados_civis into v_m
      from mentorados m where m.id = a.mentorado_id;
    if found then
      v_civis := coalesce(v_m.dados_civis, '{}'::jsonb);
      if coalesce(v_civis->>'nome_civil', '') = '' then
        v_civis := jsonb_set(v_civis, '{nome_civil}', to_jsonb(v_m.nome));
      end if;
      if coalesce(v_civis->>'data_nascimento', '') = '' and v_m.data_nascimento is not null then
        v_civis := jsonb_set(v_civis, '{data_nascimento}', to_jsonb(v_m.data_nascimento::text));
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'assinado_em', a.assinado_em,
    'identidade', v_identidade,
    'template', jsonb_build_object(
      'slug', a.t_slug, 'titulo', a.t_titulo, 'versao', a.t_versao),
    'alvo', jsonb_build_object('nome', v_nome),
    'civis', v_civis
  );
end $$;

create or replace function public.assinar_com_token(
  p_token uuid, p_dados jsonb, p_texto text, p_ip text, p_ua text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_status text;
  v_nome text;
  v_snapshot jsonb;
  v_hash text;
begin
  select s.*, t.slug as t_slug, t.versao as t_versao
    into a
    from assinaturas s join documento_templates t on t.id = s.template_id
    where s.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- gate de identidade (0070): autenticado não assina documento de outra
  -- pessoa; autorização é sempre do responsável (fora da plataforma).
  if auth.uid() is not null then
    if a.t_slug = 'autorizacao-responsavel' then
      raise exception 'este documento é assinado pelo responsável — encaminhe o link';
    end if;
    if (a.profile_id is not null
        and a.profile_id is distinct from public.my_profile_id())
       or (a.mentorado_id is not null
        and a.mentorado_id is distinct from public.my_mentorado_id()) then
      raise exception 'este link é de outra pessoa';
    end if;
  end if;

  if a.status = 'assinado' then
    return a.id; -- idempotente: reload/duplo-clique não erra
  end if;
  if a.status <> 'pendente' then
    raise exception 'link %', a.status;
  end if;
  if a.token_expira_em is not null and a.token_expira_em < now() then
    update assinaturas set status = 'expirado' where id = a.id;
    raise exception 'link expirado';
  end if;

  -- validação + montagem do snapshot por template — no banco, porque a
  -- RPC é pública (o token é a posse; o payload não é mais confiável)
  if a.t_slug = 'autorizacao-responsavel' then
    -- o cliente manda os civis do responsável + parentesco; o nome do
    -- jovem no snapshot vem da ficha — não dá pra assinar "pra" outro
    if not public.dados_civis_ok(p_dados, true) then
      raise exception 'dados civis inválidos';
    end if;
    if a.mentorado_id is null then
      raise exception 'documento inconsistente';
    end if;
    select m.nome into v_nome from mentorados m where m.id = a.mentorado_id;
    v_snapshot := jsonb_build_object(
      'mentorado_nome', v_nome,
      'responsavel', public.civis_btrim(p_dados)
    );
  else
    if not public.dados_civis_ok(p_dados) then
      raise exception 'dados civis inválidos';
    end if;
    v_snapshot := public.civis_btrim(p_dados);
  end if;

  -- caps de evidência: sem teto, um POST direto gravaria MBs por campo
  if p_texto is null or char_length(btrim(p_texto)) not between 2 and 200
     or char_length(coalesce(p_ip, '')) > 100
     or char_length(coalesce(p_ua, '')) > 800 then
    raise exception 'dados de assinatura inválidos';
  end if;

  v_hash := encode(extensions.digest(
    jsonb_build_object(
      'slug', a.t_slug, 'versao', a.t_versao, 'dados', v_snapshot,
      'texto', btrim(p_texto), 'ip', p_ip, 'ua', p_ua
    )::text,
    'sha256'), 'hex');

  -- gate atômico (0036): só uma chamada vence o pendente; a perdedora
  -- devolve o id já gravado — ou o estado real se perdeu pra expiração
  update assinaturas set
      status = 'assinado', dados_snapshot = v_snapshot,
      assinatura_texto = btrim(p_texto), assinado_em = now(),
      ip = p_ip, user_agent = p_ua, hash_documento = v_hash
    where id = a.id and status = 'pendente';
  if not found then
    select s.status into v_status from assinaturas s where s.id = a.id;
    if v_status = 'assinado' then
      return a.id;
    end if;
    raise exception 'link %', v_status;
  end if;

  -- sync-back na ficha (0046): o declarado no ato é a versão mais fresca
  if a.t_slug = 'autorizacao-responsavel' then
    update mentorados set responsavel = v_snapshot -> 'responsavel' where id = a.mentorado_id;
  elsif a.profile_id is not null then
    update profiles set dados_civis = v_snapshot where id = a.profile_id;
  else
    update mentorados set dados_civis = v_snapshot where id = a.mentorado_id;
  end if;
  return a.id;
end $$;

commit;
