-- 0046 — dados civis na ficha + prefill de termos
--
-- O termo deixava o signatário redigitar RG/CPF/endereço a cada documento.
-- Agora os dados civis moram na ficha (uma vez: import da planilha ou
-- cadastro) e o formulário de assinatura vem preenchido — a pessoa só
-- confere, digita o nome e assina. Quem assina com dados corrigidos
-- atualiza a ficha de volta (self-declared é a fonte mais fresca).
--
-- Sensibilidade: SELECT é por coluna desde 0034, então colunas novas nascem
-- invisíveis pras queries públicas — coordenação lê/edita pelas views
-- *_pessoal (WHERE coord-only, mesmo modelo de sempre). UPDATE segue
-- table-level + RLS: coord edita pela ficha, como os demais campos.
--
-- Shapes (src/lib/types.ts):
--   dados_civis  = DadosCivis { nome_civil, rg, cpf, data_nascimento, endereco }
--   responsavel  = DadosCivis & { parentesco } — quem autoriza o menor

begin;

alter table public.profiles
  add column dados_civis jsonb
    check (dados_civis is null or jsonb_typeof(dados_civis) = 'object');

alter table public.mentorados
  add column dados_civis jsonb
    check (dados_civis is null or jsonb_typeof(dados_civis) = 'object'),
  add column responsavel jsonb
    check (responsavel is null or jsonb_typeof(responsavel) = 'object');

-- views coord-only ganham as colunas novas (append no fim — regra do
-- CREATE OR REPLACE VIEW). WHERE não muda: segue coord-only.
create or replace view public.profiles_pessoal as
select
  p.id,
  p.nome,
  p.data_nascimento,
  p.genero,
  p.pref_genero_par,
  p.motivacao,
  p.dados_civis
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
  m.responsavel
from public.mentorados m
where public.my_role() = 'coordenacao';

-- O signatário logado lê os PRÓPRIOS dados civis pra tela de assinatura vir
-- preenchida. Escopo mínimo: só a coluna, só a própria linha — a view
-- pessoal continua coord-only. nome/data de nascimento caem de graça: o
-- cadastro já os tem, o jsonb só precisa dos documentos.
create or replace function public.meus_dados_civis()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p record;
  v jsonb;
begin
  select pr.nome, pr.data_nascimento, pr.dados_civis into p
    from public.profiles pr
    where pr.id = public.my_profile_id();
  if not found then
    return null;
  end if;
  v := coalesce(p.dados_civis, '{}'::jsonb);
  if coalesce(v->>'nome_civil', '') = '' then
    v := jsonb_set(v, '{nome_civil}', to_jsonb(p.nome));
  end if;
  if coalesce(v->>'data_nascimento', '') = '' and p.data_nascimento is not null then
    v := jsonb_set(v, '{data_nascimento}', to_jsonb(p.data_nascimento::text));
  end if;
  return v;
end $$;

-- /assinar/<token> ganha `civis` — a sugestão de prefill do form público.
-- Por template: autorização → responsavel do mentorado; termo do jovem →
-- dados_civis do mentorado; profile (caso futuro) → dados_civis da pessoa.
create or replace function public.assinatura_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_nome text;
  v_civis jsonb;
  v_p record;
  v_m record;
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
  select coalesce(p.nome, m.nome) into v_nome
    from assinaturas s
    left join profiles p on p.id = s.profile_id
    left join mentorados m on m.id = s.mentorado_id
    where s.id = a.id;
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
    'template', jsonb_build_object(
      'slug', a.t_slug, 'titulo', a.t_titulo, 'versao', a.t_versao),
    'alvo', jsonb_build_object('nome', v_nome),
    'civis', v_civis
  );
end $$;

-- sync-back: o que o signatário declarou (e corrigiu) no ato é a versão
-- mais fresca — volta pra ficha e o próximo documento já nasce preenchido.
create or replace function public.assinar_termo(
  p_dados jsonb, p_texto text, p_ip text, p_ua text, p_hash text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := public.my_profile_id();
  v_tpl uuid;
  v_id uuid;
begin
  if v_eu is null then
    raise exception 'sessão inválida';
  end if;
  select t.id into v_tpl from documento_templates t
    where t.slug = 'termo-voluntario' and t.ativo limit 1;
  if v_tpl is null then
    raise exception 'template de termo não configurado';
  end if;

  select a.id into v_id from assinaturas a
    where a.profile_id = v_eu and a.template_id = v_tpl
      and a.status = 'assinado' limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- promove pendente existente ou insere já assinada
  update assinaturas set
      status = 'assinado', dados_snapshot = p_dados,
      assinatura_texto = p_texto, assinado_em = now(),
      ip = p_ip, user_agent = p_ua, hash_documento = p_hash
    where profile_id = v_eu and template_id = v_tpl and status = 'pendente'
    returning id into v_id;
  if v_id is null then
    insert into assinaturas (
      template_id, profile_id, status, dados_snapshot, assinatura_texto,
      assinado_em, ip, user_agent, hash_documento
    ) values (
      v_tpl, v_eu, 'assinado', p_dados, p_texto, now(), p_ip, p_ua, p_hash
    ) returning id into v_id;
  end if;

  update profiles set dados_civis = p_dados where id = v_eu;
  return v_id;
end $$;

create or replace function public.assinar_com_token(
  p_token uuid, p_dados jsonb, p_texto text, p_ip text, p_ua text, p_hash text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select * into a from assinaturas where token = p_token;
  if not found then
    raise exception 'link inválido';
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
  update assinaturas set
      status = 'assinado', dados_snapshot = p_dados,
      assinatura_texto = p_texto, assinado_em = now(),
      ip = p_ip, user_agent = p_ua, hash_documento = p_hash
    where id = a.id;

  -- sync-back na ficha: profile → dados_civis; autorização → responsavel;
  -- demais docs do mentorado (termo de participação) → dados_civis do jovem
  if a.profile_id is not null then
    update profiles set dados_civis = p_dados where id = a.profile_id;
  elsif (select t.slug from documento_templates t
          where t.id = a.template_id) = 'autorizacao-responsavel' then
    update mentorados set responsavel = p_dados->'responsavel'
      where id = a.mentorado_id;
  else
    update mentorados set dados_civis = p_dados where id = a.mentorado_id;
  end if;
  return a.id;
end $$;

revoke all on function public.meus_dados_civis() from public, anon;
grant execute on function public.meus_dados_civis() to authenticated;

-- o grant das versões anteriores segue valendo pra assinatura_por_token /
-- assinar_com_token (replace não toca em grants) — reafirmo por clareza
grant execute on function public.assinatura_por_token(uuid)
  to anon, authenticated;
grant execute on function public.assinar_com_token(uuid, jsonb, text, text, text, text)
  to anon, authenticated;
grant execute on function public.assinar_termo(jsonb, text, text, text, text)
  to authenticated;

-- termo de participação do jovem (modelo novo — PDF 2 páginas, set/2026).
-- Menor de idade: a coordenação emite a autorização do responsável em vez
-- deste — a escolha do documento é da coordenação na ficha.
insert into public.documento_templates (slug, titulo, versao, signatario) values
  ('termo-mentorando', 'Termo de Adesão e Participação no Programa de Mentoria Social', 1, 'mentorado');

commit;
