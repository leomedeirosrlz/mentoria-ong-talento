-- 0053: hardening pós-auditoria de segurança
-- (.devin/security/db-rls.md + actions-api.md — probes reais em produção)
--
-- Ordem = severidade dos achados. Em resumo:
--   1. guards de papel com bypass por NULL (`<> 'papel'` avalia NULL quando
--      my_role() volta null — usuário desativado/sem papel com JWT válido
--      pulava o raise e a função rodava como definer);
--   2. evidência de assinatura fornecida pelo chamador (hash/ip/ua/dados
--      livres) + corrida last-writer-wins em assinar_com_token;
--   3/4. exposição ampla das RPCs por token (civis em qualquer status;
--      to_jsonb da row inteira);
--   5. aceite de especialista fora do RPC atômico;
--   6-10. integridade de agenda, consent_lgpd, supervisões, storage e
--      higiene (índices de RLS, rls_auto_enable, cleanup de handoffs).

begin;

-- ============ 1) guards de papel NULL-safe ============
--
-- `my_role()` volta NULL pra ativo=false e pra profile sem papel (estado
-- "cadastro recebido"). Em PL/pgSQL `if NULL then` é falso — então
-- `if my_role() <> 'coordenacao' then raise` NÃO barrava: desligar a
-- pessoa não revoga JWT/refresh, e um ex-coordenador seguia revogando
-- assinaturas e mintando links novos. `is distinct from` trata NULL como
-- diferente → nega. (Service role/script que precisar mexer atualiza a
-- tabela direto — RLS bypass — não precisa chamar a RPC.)
create or replace function public.revogar_assinatura(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'só a coordenação revoga';
  end if;
  update assinaturas set status = 'revogado'
    where id = p_id and status in ('pendente', 'assinado', 'expirado');
end $$;

create or replace function public.regenerar_token_assinatura(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid := gen_random_uuid();
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'só a coordenação reenvia';
  end if;
  update assinaturas set token = v_token, token_expira_em = now() + interval '30 days'
    where id = p_id and status = 'pendente';
  if not found then
    raise exception 'assinatura não está pendente';
  end if;
  return v_token;
end $$;

-- Auditoria do mesmo padrão nas funções de carimbo (0027/0037/0041):
-- `campo <> my_profile_id() and my_role() <> 'coordenacao'` avaliava NULL
-- quando o caller não tem papel — a forja era aceita em silêncio (a RLS da
-- tabela ainda barrava a escrita, então era defesa adormecida, não breach).
-- Convenção do projeto: contexto sem usuário (service role, SQL editor,
-- seed) escreve livre — o gate passa a ser `auth.uid() is not null`, que
-- distingue JWT de usuário real de chamada service; pra JWT o check é
-- NULL-safe nas duas pontas (is distinct from).
create or replace function public.stamp_solicitacao_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null then
    new.created_by := public.my_profile_id();
  elsif auth.uid() is not null
        and public.my_role() is distinct from 'coordenacao'
        and new.created_by is distinct from public.my_profile_id() then
    raise exception 'created_by não pode ser forjado';
  end if;
  return new;
end $$;

create or replace function public.stamp_encerramento_decisor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo is not null and new.decidido_por is null then
    new.decidido_por := public.my_profile_id();
  elsif new.decidido_por is not null
        and auth.uid() is not null
        and public.my_role() is distinct from 'coordenacao'
        and new.decidido_por is distinct from public.my_profile_id() then
    raise exception 'decidido_por não pode ser forjado';
  end if;
  return new;
end $$;

create or replace function public.stamp_supervisao_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null then
    new.created_by := public.my_profile_id();
  elsif auth.uid() is not null
        and public.my_role() is distinct from 'coordenacao'
        and new.created_by is distinct from public.my_profile_id() then
    raise exception 'created_by não pode ser forjado';
  end if;
  return new;
end $$;

-- ============ 2) evidência de assinatura confiável ============
--
-- Antes: p_ip/p_ua/p_hash/p_dados entravam verbatim na row e no sync-back
-- — um portador do token forjava a "evidência" e plantava chaves
-- arbitrárias no campo coord-only dados_civis/responsavel. Agora:
--   · hash_documento é sha256 COMPUTADO NO BANCO sobre o conjunto gravado;
--   · p_dados passa por validação de schema (dados_civis_ok) antes de
--     gravar e de voltar pra ficha;
--   · o mentorado_nome do snapshot da autorização vem da tabela, não do
--     cliente (o cliente manda só os civis do responsável + parentesco);
--   · o update é atômico (where status='pendente') — corrida devolve o id
--     da assinatura já gravada, mesmo padrão de submeter_resposta_formulario.
--
-- Receita do hash NOVO: sha256 hex do texto canônico do jsonb
--   {slug, versao, dados, texto, ip, ua}   (assinar_com_token)
--   {slug, dados, texto, ip, ua}           (assinar_termo — sem versao:
--     é o conjunto de chaves que a action JS já usava pra esse fluxo)
-- jsonb normaliza a ordem das chaves, então o texto é estável. Os hashes
-- gravados antes da 0053 usam a receita JS (JSON.stringify na ordem da
-- action) — ambos os formatos são recomputáveis pra verificação
-- posterior; o que muda é quem calcula, não o que se prova.
--
-- LIMITAÇÃO conhecida (aceita, documentada no relatório): p_ip/p_ua seguem
-- parâmetros — o PostgREST enxerga o servidor Next, não o browser do
-- signatário, então a action lê x-forwarded-for/user-agent do request e
-- repassa. Um caller anon direto poderia mentir os dois — o hash no banco
-- garante ao menos a consistência interna do conjunto (ip+ua+payload
-- gravados são exatamente o que foi hasheado).

create extension if not exists pgcrypto with schema extensions;

-- dados_civis_ok: shape mínimo do DadosCivis declarado no ato (a action
-- tem a validação cheia com DV de CPF; aqui é o piso sanitário que protege
-- o sync-back e o renderer — chaves fechadas, tipos, caps e formatos).
create or replace function public.dados_civis_ok(
  d jsonb,
  com_parentesco boolean default false
)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  e jsonb;
  chaves text[] := array['nome_civil', 'rg', 'cpf', 'data_nascimento', 'endereco'];
begin
  if d is null or jsonb_typeof(d) is distinct from 'object' then
    return false;
  end if;
  if com_parentesco then
    chaves := array_append(chaves, 'parentesco');
  end if;
  -- allowlist fechada de chaves — o sync-back grava o payload na ficha,
  -- nada fora do contrato pode entrar
  if exists (
    select 1 from jsonb_object_keys(d) as k(key)
    where k.key <> all (chaves)
  ) then
    return false;
  end if;
  if jsonb_typeof(d->'nome_civil') is distinct from 'string'
     or char_length(d->>'nome_civil') not between 1 and 200 then
    return false;
  end if;
  if jsonb_typeof(d->'rg') is distinct from 'string'
     or char_length(d->>'rg') not between 1 and 40 then
    return false;
  end if;
  if jsonb_typeof(d->'cpf') is distinct from 'string'
     or (d->>'cpf') !~ '^\d{11}$' then
    return false;
  end if;
  -- data de nascimento: ausente, null ou string de data válida
  if d ? 'data_nascimento'
     and jsonb_typeof(d->'data_nascimento') is distinct from 'null' then
    if jsonb_typeof(d->'data_nascimento') is distinct from 'string' then
      return false;
    end if;
    begin
      perform (d->>'data_nascimento')::date;
    exception when others then
      return false;
    end;
  end if;
  if com_parentesco
     and (jsonb_typeof(d->'parentesco') is distinct from 'string'
          or char_length(d->>'parentesco') not between 1 and 60) then
    return false;
  end if;
  -- endereço: objeto de chaves fechadas, strings com cap, uf/cep no formato
  e := d->'endereco';
  if e is null or jsonb_typeof(e) is distinct from 'object' then
    return false;
  end if;
  if exists (
    select 1 from jsonb_object_keys(e) as k(key)
    where k.key <> all (array['logradouro','numero','complemento','bairro','cidade','uf','cep'])
  ) then
    return false;
  end if;
  if jsonb_typeof(e->'logradouro') is distinct from 'string'
     or char_length(e->>'logradouro') not between 1 and 200 then
    return false;
  end if;
  if jsonb_typeof(e->'numero') is distinct from 'string'
     or char_length(e->>'numero') not between 1 and 20 then
    return false;
  end if;
  if e ? 'complemento'
     and jsonb_typeof(e->'complemento') is distinct from 'null'
     and (jsonb_typeof(e->'complemento') is distinct from 'string'
          or char_length(e->>'complemento') > 100) then
    return false;
  end if;
  if jsonb_typeof(e->'bairro') is distinct from 'string'
     or char_length(e->>'bairro') not between 1 and 120 then
    return false;
  end if;
  if jsonb_typeof(e->'cidade') is distinct from 'string'
     or char_length(e->>'cidade') not between 1 and 120 then
    return false;
  end if;
  if jsonb_typeof(e->'uf') is distinct from 'string'
     or (e->>'uf') !~ '^[A-Z]{2}$' then
    return false;
  end if;
  if jsonb_typeof(e->'cep') is distinct from 'string'
     or (e->>'cep') !~ '^\d{8}$' then
    return false;
  end if;
  return true;
end $$;

-- helper interno: só roda dentro das RPCs definer
revoke all on function public.dados_civis_ok(jsonb, boolean)
  from public, anon, authenticated;

-- uma solicitação viva por documento por alvo: fecha a corrida do
-- double-submit (duas pendentes pro mesmo mentorado+template) e do
-- duplo-termo (duas assinadas do mesmo perfil+template). Reemissão
-- legítima = revogar a anterior (ou regenerar o token) — nunca duas vivas.
create unique index if not exists assinaturas_viva_uk
  on public.assinaturas (coalesce(profile_id, mentorado_id), template_id)
  where status in ('pendente', 'assinado');

drop function if exists public.assinar_com_token(uuid, jsonb, text, text, text, text);
drop function if exists public.assinar_com_token(uuid, jsonb, text, text, text);

create function public.assinar_com_token(
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
      'responsavel', p_dados
    );
  else
    if not public.dados_civis_ok(p_dados) then
      raise exception 'dados civis inválidos';
    end if;
    v_snapshot := p_dados;
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
      'texto', p_texto, 'ip', p_ip, 'ua', p_ua
    )::text,
    'sha256'), 'hex');

  -- gate atômico (0036): só uma chamada vence o pendente; a perdedora
  -- devolve o id já gravado — ou o estado real se perdeu pra expiração
  update assinaturas set
      status = 'assinado', dados_snapshot = v_snapshot,
      assinatura_texto = p_texto, assinado_em = now(),
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
    update mentorados set responsavel = p_dados where id = a.mentorado_id;
  elsif a.profile_id is not null then
    update profiles set dados_civis = p_dados where id = a.profile_id;
  else
    update mentorados set dados_civis = p_dados where id = a.mentorado_id;
  end if;
  return a.id;
end $$;

revoke all on function public.assinar_com_token(uuid, jsonb, text, text, text)
  from public;
grant execute on function public.assinar_com_token(uuid, jsonb, text, text, text)
  to anon, authenticated;

drop function if exists public.assinar_termo(jsonb, text, text, text, text);

create function public.assinar_termo(
  p_dados jsonb, p_texto text, p_ip text, p_ua text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := public.my_profile_id();
  v_tpl uuid;
  v_id uuid;
  v_hash text;
begin
  if v_eu is null then
    raise exception 'sessão inválida';
  end if;
  if not public.dados_civis_ok(p_dados) then
    raise exception 'dados civis inválidos';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) not between 2 and 200
     or char_length(coalesce(p_ip, '')) > 100
     or char_length(coalesce(p_ua, '')) > 800 then
    raise exception 'dados de assinatura inválidos';
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

  -- sem 'versao': mesmo conjunto de chaves que a action JS já hasheava
  v_hash := encode(extensions.digest(
    jsonb_build_object(
      'slug', 'termo-voluntario', 'dados', p_dados,
      'texto', p_texto, 'ip', p_ip, 'ua', p_ua
    )::text,
    'sha256'), 'hex');

  -- promove pendente existente ou insere já assinada; a unique
  -- assinaturas_viva_uk faz o insert perdedor de corrida falhar em vez de
  -- gravar uma segunda row assinada
  update assinaturas set
      status = 'assinado', dados_snapshot = p_dados,
      assinatura_texto = p_texto, assinado_em = now(),
      ip = p_ip, user_agent = p_ua, hash_documento = v_hash
    where profile_id = v_eu and template_id = v_tpl and status = 'pendente'
    returning id into v_id;
  if v_id is null then
    insert into assinaturas (
      template_id, profile_id, status, dados_snapshot, assinatura_texto,
      assinado_em, ip, user_agent, hash_documento
    ) values (
      v_tpl, v_eu, 'assinado', p_dados, p_texto, now(), p_ip, p_ua, v_hash
    ) returning id into v_id;
  end if;

  update profiles set dados_civis = p_dados where id = v_eu;
  return v_id;
end $$;

revoke all on function public.assinar_termo(jsonb, text, text, text)
  from public, anon;
grant execute on function public.assinar_termo(jsonb, text, text, text)
  to authenticated;

-- ============ 3) assinatura_por_token: civis só enquanto assinável ============
--
-- O prefill (RG/CPF/endereço completos) é a feature — mas só enquanto o
-- link serve pra assinar. Depois de assinado/revogado/expirado a PII não
-- precisa continuar na URL (histórico de WhatsApp, forwards, proxies).
create or replace function public.assinatura_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_nome text;
  v_civis jsonb := null;
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
  if a.status = 'pendente'
     and (a.token_expira_em is null or a.token_expira_em > now()) then
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

-- ============ 4) assinatura_completa_por_token: allowlist ============
--
-- A via pública (token = posse) precisa do que o PDF de evidências
-- renderiza: id/status/snapshot/texto/data/ip/ua/hash + template. A row
-- inteira vazava token de volta, ids internos e created_by — fora.
-- `signatario` do template entra no embed: é ele que diz ao renderer se a
-- prova de posse foi o link tokenizado (mentorado) ou a sessão (profile).
create or replace function public.assinatura_completa_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'dados_snapshot', a.dados_snapshot,
      'assinatura_texto', a.assinatura_texto,
      'assinado_em', a.assinado_em,
      'ip', a.ip,
      'user_agent', a.user_agent,
      'hash_documento', a.hash_documento,
      'template', jsonb_build_object(
        'slug', t.slug, 'titulo', t.titulo, 'versao', t.versao,
        'signatario', t.signatario))
    into r
    from public.assinaturas a
    join public.documento_templates t on t.id = a.template_id
    where a.token = p_token and a.status = 'assinado';
  return r;
end $$;

revoke all on function public.assinatura_completa_por_token(uuid) from public;
grant execute on function public.assinatura_completa_por_token(uuid)
  to anon, authenticated;

-- ============ 5) aceite de especialista só via RPC atômico ============
--
-- Probe real: PATCH direto como mentor_especialista gravava
-- status='aceita' + especialista_id sem dupla nem respondida_em — o mural
-- mostrava aceite sem dupla existir. Agora o branch do especialista no
-- WITH CHECK exige a flag transaction-local realiza.sol_aceite — que só
-- aceitar_solicitacao() liga (PostgREST roda um statement por transação e
-- set_config não é alcançável pela API — mesmo padrão de
-- realiza.assinatura_sync/formacao_sync, 0040/0052). A flag também cobre o
-- caso de FORCE RLS um dia: o update do RPC passa no check.
--
-- Branch do mentor DPP: enquanto a solicitação está aberta ele não escreve
-- campos de resposta — especialista_id/dupla_id nunca (o probe mostrava
-- que passavam); respondida_em só no carimbo do cancelamento (o app grava
-- respondida_em ao cancelar — liberado só quando a row nova é 'cancelada').
-- E a linha antiga precisa estar 'aberta' no USING — antes o mentor podia
-- reverter uma solicitação já aceita pra cancelada, deixando a dupla de
-- especialista órfã.
drop policy if exists sol_update on public.solicitacoes_especialista;
create policy sol_update on public.solicitacoes_especialista for update using (
  public.my_role() = 'coordenacao'
  or (public.my_role() = 'mentor_especialista' and status = 'aberta')
  or (
    status = 'aberta'
    and exists (
      select 1 from public.duplas d
      where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()
    )
  )
) with check (
  public.my_role() = 'coordenacao'
  or (
    public.my_role() = 'mentor_especialista'
    and status = 'aceita'
    and especialista_id = public.my_profile_id()
    and dupla_id is not null
    and respondida_em is not null
    and current_setting('realiza.sol_aceite', true) = 'on'
  )
  or (
    status in ('aberta', 'cancelada')
    and especialista_id is null
    and dupla_id is null
    and (respondida_em is null or status = 'cancelada')
    and exists (
      select 1 from public.duplas d
      where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()
    )
  )
);

create or replace function public.aceitar_solicitacao(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  nova uuid;
  meu uuid := public.my_profile_id();
begin
  if public.my_role() is distinct from 'mentor_especialista' then
    raise exception 'Só mentores especialistas podem aceitar demandas';
  end if;

  select * into s
    from public.solicitacoes_especialista
   where id = p_id
   for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status <> 'aberta' then
    raise exception 'Essa demanda não está mais aberta';
  end if;
  if s.especialista_desejado_id is not null
     and s.especialista_desejado_id is distinct from meu then
    raise exception 'Essa demanda foi direcionada a outro especialista';
  end if;

  insert into public.mentor_profiles (profile_id, tipo, capacidade)
  values (meu, 'especialista', 1)
  on conflict (profile_id) do nothing;

  insert into public.duplas (mentor_id, mentorado_id, trilha, demanda, solicitacao_id, iniciada_em)
    values (meu, s.mentorado_id, 'especialista', s.demanda, s.id, current_date)
    returning id into nova;

  -- flag transaction-local: é a única chave que destrava o branch de
  -- aceite no WITH CHECK da sol_update (0053) — PATCH direto no PostgREST
  -- não consegue ligá-la, então o aceite só acontece por aqui, atômico
  perform set_config('realiza.sol_aceite', 'on', true);

  update public.solicitacoes_especialista
     set status = 'aceita',
         especialista_id = meu,
         dupla_id = nova,
         respondida_em = now()
   where id = s.id;

  return nova;
end
$$;

-- ============ 6) integridade de agenda ============
--
-- registros_mentor_insert não exigia o encontro 'realizado' — follow-up
-- em encontro agendado/cancelado corrompia o semáforo. A action
-- salvarRegistro passou a marcar o encontro ANTES de gravar o registro
-- (a invariante pede essa ordem). Coordenação segue livre (reparo de dado).
drop policy if exists registros_mentor_insert on public.registros;
create policy registros_mentor_insert on public.registros
  for insert with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id
        and d.mentor_id = public.my_profile_id()
        and e.status = 'realizado'
    )
  );

-- campos-âncora imutáveis pra quem não é coordenação: registro não migra
-- de encontro; encontro não migra de dupla nem troca de número (a unique
-- por dupla não impedia renumerar dois encontros próprios). `is not
-- distinct from` = null-safe. Reparo excepcional: coord edita normal; SQL
-- direto desabilita o trigger (alter table ... disable trigger), como 0043.
create or replace function public.guard_registro_encontro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and new.encontro_id is distinct from old.encontro_id then
    raise exception 'registro não pode mudar de encontro';
  end if;
  return new;
end $$;

drop trigger if exists registros_encontro_guard on public.registros;
create trigger registros_encontro_guard
  before update on public.registros
  for each row
  when (old.encontro_id is distinct from new.encontro_id)
  execute function public.guard_registro_encontro();

create or replace function public.guard_encontro_identidade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and (new.dupla_id is distinct from old.dupla_id
          or new.numero is distinct from old.numero) then
    raise exception 'encontro não pode mudar de dupla nem de número';
  end if;
  return new;
end $$;

drop trigger if exists encontros_identidade_guard on public.encontros;
create trigger encontros_identidade_guard
  before update on public.encontros
  for each row
  when (old.dupla_id is distinct from new.dupla_id
        or old.numero is distinct from new.numero)
  execute function public.guard_encontro_identidade();

-- ============ 7) consent_lgpd_em: latch do titular ============
--
-- O fluxo legítimo é o carimbo do próprio usuário no perfil (consentPatch
-- grava now() quando era null). Antes o self-update aceitava qualquer
-- timestamp — trilha LGPD falsificável. Agora: mudança só vale se sai de
-- null pra um carimbo fresco (janela tolerante a clock skew entre app e
-- banco); depois disso é imutável. Coordenação livre (correção); contexto
-- sem JWT (service/backfill) também — a policy já limita update ao
-- dono/coord, então o latch é o que falta pro self-service.
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
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'campo protegido do perfil';
  end if;
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

-- ============ 8) supervisões dentro do escopo ============
--
-- supervisoes_insert exigia só role=supervisor + autoria — um supervisor
-- registrava sessão (e disparava notificação) sobre mentor que não
-- supervisionava, e vinculava a dupla alheia. Agora: o mentor precisa ter
-- alguma dupla supervisionada por mim; e a dupla vinculada precisa ser
-- minha E desse mentor (sem cruzar mentor de uma dupla com dupla de outro).
-- A action segue mais estrita (dupla ativa/pausada) — aqui é o piso.
-- Coordenação isenta (moderação/correção).
drop policy if exists supervisoes_insert on public.supervisoes;
create policy supervisoes_insert on public.supervisoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or (
      public.my_role() = 'supervisor'
      and supervisor_id = public.my_profile_id()
      and exists (
        select 1 from public.duplas d
        where d.supervisor_id = public.my_profile_id()
          and d.mentor_id = supervisoes.mentor_id
      )
      and (
        dupla_id is null
        or exists (
          select 1 from public.duplas d
          where d.id = supervisoes.dupla_id
            and d.supervisor_id = public.my_profile_id()
            and d.mentor_id = supervisoes.mentor_id
        )
      )
    )
  );

-- ============ 9) storage avatares ============
--
-- Faltava SELECT pro dono: na Storage API, update/delete passam por
-- visibilidade da row — sem select, o remove() da foto antiga falhava
-- silencioso e o avatar trocado ficava órfão e público pra sempre.
drop policy if exists avatares_select on storage.objects;
create policy avatares_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatares'
    and (
      (storage.foldername(name))[1] = public.my_profile_id()::text
      or public.my_role() = 'coordenacao'
    )
  );

-- e a extensão não basta: probe subiu .png com Content-Type text/html e foi
-- aceito. O mimetype declarado passa a ter que ser imagem nas escritas.
drop policy if exists avatares_insert on storage.objects;
create policy avatares_insert on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
    and name ~* '\.(png|jpe?g|webp)$'
    and metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp')
  );

drop policy if exists avatares_update on storage.objects;
create policy avatares_update on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = public.my_profile_id()::text
    and name ~* '\.(png|jpe?g|webp)$'
    and metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp')
  );

drop policy if exists avatares_coord_write on storage.objects;
create policy avatares_coord_write on storage.objects for all
  using (
    bucket_id = 'avatares'
    and public.my_role() = 'coordenacao'
  )
  with check (
    bucket_id = 'avatares'
    and public.my_role() = 'coordenacao'
    and name ~* '\.(png|jpe?g|webp)$'
    and metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp')
  );

-- ============ 10) higiene ============

-- função interna do Supabase era executável via RPC (sem efeito, mas
-- superfície desnecessária). Guardada com if-exists: o objeto é do
-- próprio Supabase, não nosso — se um dia não existir, a migration segue.
do $$
begin
  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- colunas avaliadas por policy a cada query — seq scan por check de RLS
create index if not exists duplas_mentor_idx on public.duplas (mentor_id);
create index if not exists duplas_supervisor_idx on public.duplas (supervisor_id);
create index if not exists duplas_mentorado_idx on public.duplas (mentorado_id);
create index if not exists solicitacoes_especialista_esp_idx
  on public.solicitacoes_especialista (especialista_id);
create index if not exists encaminhamentos_dupla_idx
  on public.encaminhamentos (dupla_id);

-- handoffs que nunca foram resgatados ficavam pra sempre — a leitura já
-- varre; agora a escrita também (falhar segue criando tombstone, que o
-- próximo registrar/pegar limpa)
create or replace function public.registrar_login_handoff(
  p_nonce uuid,
  p_access text,
  p_refresh text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.login_handoffs where expires_at < now();
  insert into public.login_handoffs (nonce, access_token, refresh_token)
    values (p_nonce, p_access, p_refresh)
    on conflict (nonce) do nothing;
end $$;

-- ============ self-test do validador (aborta o push se falhar) ============
do $$
declare
  v_ok jsonb := jsonb_build_object(
    'nome_civil', 'Maria da Silva',
    'rg', '12.345.678-9',
    'cpf', '12345678901',
    'data_nascimento', '1990-05-20',
    'endereco', jsonb_build_object(
      'logradouro', 'Rua A', 'numero', '10', 'complemento', null,
      'bairro', 'Centro', 'cidade', 'São Paulo', 'uf', 'SP', 'cep', '01310100'));
begin
  if not public.dados_civis_ok(v_ok) then
    raise exception '0053 self-test: DadosCivis válido rejeitado';
  end if;
  if not public.dados_civis_ok(v_ok || '{"parentesco":"Mãe"}'::jsonb, true) then
    raise exception '0053 self-test: responsável com parentesco rejeitado';
  end if;
  if public.dados_civis_ok('{"foo":1}'::jsonb)
     or public.dados_civis_ok(v_ok || '{"hack":"x"}'::jsonb)
     or public.dados_civis_ok(v_ok || '{"parentesco":"Mãe"}'::jsonb)
     or public.dados_civis_ok(jsonb_set(v_ok, '{cpf}', '"123"'))
     or public.dados_civis_ok(jsonb_set(v_ok, '{endereco,uf}', '"sp"'))
     or public.dados_civis_ok(jsonb_set(v_ok, '{endereco,cep}', '"01310-100"'))
     or public.dados_civis_ok(jsonb_set(v_ok, '{data_nascimento}', '"1990-13-40"'))
     or public.dados_civis_ok(jsonb_set(v_ok, '{data_nascimento}', '1988'))
     or public.dados_civis_ok(jsonb_set(v_ok, '{nome_civil}', '42')) then
    raise exception '0053 self-test: dados_civis_ok aceitou payload inválido';
  end if;
end $$;

commit;
