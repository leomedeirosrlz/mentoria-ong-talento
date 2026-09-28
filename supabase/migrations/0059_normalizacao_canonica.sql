-- 0059: canonicalização de inputs — a app agora grava nomes em title case,
-- e-mail minúsculo, telefone/CPF/CEP só dígitos e trim em tudo. Esta migração
-- (a) traz o legado pro mesmo formato, (b) trava o contrato no schema e
-- (c) fecha os caminhos que escreviam fora do contrato (handle_new_user e
-- as RPCs públicas de assinatura, que aceitavam texto com padding direto).

begin;

-- ---------- helper: title case pt-BR (espelha nomeProprio do app) ----------
-- initcap já resolve hífen/apóstrofo ("ANA-LUCIA" → "Ana-Lucia"); as
-- partículas voltam pra minúsculas só no meio do nome (1ª palavra nunca).
create or replace function public.nome_proprio(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(replace(replace(replace(
    initcap(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')),
    ' De ', ' de '), ' Da ', ' da '), ' Do ', ' do '),
    ' Das ', ' das '), ' Dos ', ' dos '), ' E ', ' e ')
$$;

-- ---------- legado → canônico ----------

-- 1) trim + colapso de espaços em nomes (seguro pra qualquer row)
update public.profiles set nome = regexp_replace(btrim(nome), '\s+', ' ', 'g')
  where nome <> regexp_replace(btrim(nome), '\s+', ' ', 'g');
update public.mentorados set nome = regexp_replace(btrim(nome), '\s+', ' ', 'g')
  where nome <> regexp_replace(btrim(nome), '\s+', ' ', 'g');
update public.profiles set nome_social = regexp_replace(btrim(nome_social), '\s+', ' ', 'g')
  where nome_social is not null
    and nome_social <> regexp_replace(btrim(nome_social), '\s+', ' ', 'g');

-- 2) title case SÓ onde a row é mono-case (inteira maiúscula ou minúscula) —
--    "Maria Silva" já certa não passa por initcap (não vira "Maria silva" e
--    um "McKee" da vida não corrompe)
update public.profiles set nome = public.nome_proprio(nome)
  where nome = lower(nome) or nome = upper(nome);
update public.mentorados set nome = public.nome_proprio(nome)
  where nome = lower(nome) or nome = upper(nome);
update public.profiles set nome_social = public.nome_proprio(nome_social)
  where nome_social is not null
    and (nome_social = lower(nome_social) or nome_social = upper(nome_social));

-- 3) e-mail minúsculo trimado; whatsapp só dígitos ("" pós-strip vira null)
update public.profiles set email = lower(btrim(email))
  where email <> lower(btrim(email));
update public.mentorados set email = lower(btrim(email))
  where email is not null and email <> lower(btrim(email));
update public.profiles
  set whatsapp = nullif(regexp_replace(whatsapp, '\D', '', 'g'), '')
  where whatsapp is not null and whatsapp !~ '^\d+$';
update public.mentorados
  set whatsapp = nullif(regexp_replace(whatsapp, '\D', '', 'g'), '')
  where whatsapp is not null and whatsapp !~ '^\d+$';

-- ---------- contrato no schema ----------

-- defesa em profundidade: qualquer caminho futuro (seed, SQL manual, cliente
-- novo) que escreva e-mail com maiúscula ou whatsapp com máscara falha aqui
alter table public.profiles
  add constraint profiles_email_lower check (email = lower(email)),
  add constraint profiles_whatsapp_digits
      check (whatsapp is null or whatsapp ~ '^\d+$');
alter table public.mentorados
  add constraint mentorados_email_lower
      check (email is null or email = lower(email)),
  add constraint mentorados_whatsapp_digits
      check (whatsapp is null or whatsapp ~ '^\d+$');

-- e-mail é a identidade do magic link: a coluna unique é case-sensitive, mas
-- a allowlist (0045) e o handle comparam com lower() — "A@x" + "a@x"
-- coexistindo quebram o vínculo do 1º login. Índice ci fecha o buraco.
create unique index if not exists profiles_email_ci_key
  on public.profiles ((lower(email)));

-- ---------- handle_new_user: e-mail canônico + nome apresentável ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  if not found then
    insert into public.profiles (user_id, email, nome)
    values (
      new.id,
      lower(btrim(new.email)),
      coalesce(
        nullif(public.nome_proprio(coalesce(
          new.raw_user_meta_data ->> 'nome',
          translate(split_part(new.email, '@', 1), '._-', '   ')
        )), ''),
        split_part(new.email, '@', 1)
      )
    );
  end if;
  return new;
end;
$$;

-- ---------- assinatura: payload jsonb com trim em todos os campos ----------
-- a RPC é pública (o token é a posse): um POST direto com " nome " passava
-- no char_length do dados_civis_ok e ia pro snapshot com padding.
create or replace function public.civis_btrim(d jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(d, '{}'::jsonb)
    || coalesce(
         (select jsonb_object_agg(k, to_jsonb(btrim(v)))
            from jsonb_each_text(d) as e(k, v)
           where k in ('nome_civil', 'rg', 'cpf', 'parentesco',
                       'data_nascimento', 'numero', 'complemento')),
         '{}'::jsonb)
    || jsonb_build_object(
         'endereco', coalesce(
           (select jsonb_object_agg(k2, to_jsonb(btrim(v2)))
              from jsonb_each_text(d -> 'endereco') as e2(k2, v2)),
           d -> 'endereco'))
$$;

-- ---------- RPCs: texto da assinatura e civis gravados já trimados ----------
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

create or replace function public.assinar_termo(
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

  p_dados := public.civis_btrim(p_dados);

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
      'texto', btrim(p_texto), 'ip', p_ip, 'ua', p_ua
    )::text,
    'sha256'), 'hex');

  -- promove pendente existente ou insere já assinada; a unique
  -- assinaturas_viva_uk faz o insert perdedor de corrida falhar em vez de
  -- gravar uma segunda row assinada
  update assinaturas set
      status = 'assinado', dados_snapshot = p_dados,
      assinatura_texto = btrim(p_texto), assinado_em = now(),
      ip = p_ip, user_agent = p_ua, hash_documento = v_hash
    where profile_id = v_eu and template_id = v_tpl and status = 'pendente'
    returning id into v_id;
  if v_id is null then
    insert into assinaturas (
      template_id, profile_id, status, dados_snapshot, assinatura_texto,
      assinado_em, ip, user_agent, hash_documento
    ) values (
      v_tpl, v_eu, 'assinado', p_dados, btrim(p_texto), now(), p_ip, p_ua, v_hash
    ) returning id into v_id;
  end if;

  update profiles set dados_civis = p_dados where id = v_eu;
  return v_id;
end $$;

commit;
