-- 0033: assinatura eletrônica nativa de documentos (termo de adesão do
-- voluntário, autorização do responsável pelo mentorado, futuros).
--
-- Modelo genérico: `documento_templates` guarda os metadados (o corpo é
-- renderizado em código por slug — contratos de texto puro, versionados em
-- PR) e `assinaturas` guarda o workflow + a evidência: quem assinou, com
-- quais dados civis (snapshot imutável), quando, de onde (ip/ua) e o hash
-- do conteúdo assinado. O PDF final é renderizado sob demanda a partir do
-- snapshot + versão do template — não guardamos bytes, guardamos a prova.
--
-- Dois caminhos de assinatura:
--   · logado (mentor): RPC assinar_termo — self-service, banner no home
--   · sem login (responsável do jovem): token uuid na URL + RPCs
--     assinatura_por_token / assinar_com_token, executáveis por anon
-- Toda transição de status passa por RPC — a RLS só permite select do dono/
-- coord e insert de solicitação pela coordenação. Update/delete não existem.

begin;

create table public.documento_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  versao int not null default 1,
  signatario text not null check (signatario in ('profile', 'mentorado')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.documento_templates (id),
  -- exatamente um alvo: o voluntário (profile) ou o mentorado cujo
  -- responsável assina
  profile_id uuid references public.profiles (id) on delete cascade,
  mentorado_id uuid references public.mentorados (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'assinado', 'revogado', 'expirado')),
  -- dados civis conforme preenchidos NO ATO — imutável depois de assinado;
  -- PII sensível (cpf/rg/endereço) fica aqui e não em profiles, que é
  -- legível por qualquer autenticado
  dados_snapshot jsonb,
  -- acesso sem login: o token É a autorização — uuid v4, expira em 30d
  token uuid not null default gen_random_uuid(),
  token_expira_em timestamptz,
  -- evidência da assinatura
  assinatura_texto text,        -- nome digitado pelo signatário
  assinado_em timestamptz,
  ip text,                      -- x-forwarded-for capturado server-side
  user_agent text,
  hash_documento text,          -- sha256 do payload canônico (conteúdo+evidência)
  created_by uuid references public.profiles (id), -- coord que emitiu (null = self)
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1)
);

create index assinaturas_profile_idx on public.assinaturas (profile_id)
  where profile_id is not null;
create index assinaturas_mentorado_idx on public.assinaturas (mentorado_id)
  where mentorado_id is not null;
create index assinaturas_token_idx on public.assinaturas (token);

alter table public.documento_templates enable row level security;
alter table public.assinaturas enable row level security;

-- templates: qualquer autenticado lê (são metadados públicos do programa)
create policy templates_select on public.documento_templates for select
  to authenticated using (true);

-- assinaturas: o signatário lê as próprias; a coordenação lê tudo (ela é a
-- guardiã dos documentos — mesma fronteira do bucket `documentos`).
-- mentorado nunca tem login, então linhas de mentorado são coord-only.
create policy assinaturas_select on public.assinaturas for select
  to authenticated using (
    profile_id = public.my_profile_id()
    or public.my_role() = 'coordenacao'
  );

-- insert direto só pra coord criar solicitação de autorização (mentorado);
-- o mentor que assina o próprio termo passa pelo RPC — nunca insere row.
create policy assinaturas_insert on public.assinaturas for insert
  to authenticated with check (
    public.my_role() = 'coordenacao'
    and mentorado_id is not null
    and profile_id is null
    and status = 'pendente'
  );

-- sem policies de update/delete: revogar, regenerar token e assinar são
-- transições de estado com regra própria — todas por RPC security definer.
grant select on public.documento_templates to authenticated;
grant select, insert on public.assinaturas to authenticated;

-- ---------- RPCs ----------

-- Mentor/voluntário logado assina o próprio termo. Idempotente: se já
-- existe assinatura ativa devolve o id dela; se há pendente, promove;
-- senão cria já assinada. O trigger abaixo reflete em termo_ok.
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
  return v_id;
end $$;

-- Público (anon): metadados da pendência pra renderizar /assinar/<token>.
-- Não devolve dados_snapshot nem evidências — só o necessário pra tela.
create or replace function public.assinatura_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_nome text;
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
  return jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'assinado_em', a.assinado_em,
    'template', jsonb_build_object(
      'slug', a.t_slug, 'titulo', a.t_titulo, 'versao', a.t_versao),
    'alvo', jsonb_build_object('nome', v_nome)
  );
end $$;

-- Público (anon): assina via token. Mesma gravação do fluxo logado —
-- o token no lugar da sessão é o fator de posse (e-mail/WhatsApp do
-- responsável registrado pela coordenação).
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
  return a.id;
end $$;

-- Público (anon): a via assinada — row completa SÓ depois de assinada
-- (snapshot/evidências do signatário não vazam enquanto pendente; o token
-- depois de assinar é o acesso à via, como num envelope de DocuSign).
create or replace function public.assinatura_completa_por_token(p_token uuid)
returns setof public.assinaturas
language plpgsql security definer set search_path = public as $$
begin
  return query
    select * from assinaturas
      where token = p_token and status = 'assinado';
end $$;

-- Coordenação: revoga (termo errado, versão nova, pessoa saiu) e regenera
-- token pra reenvio — só enquanto pendente.
create or replace function public.revogar_assinatura(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'coordenacao' then
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
  if public.my_role() <> 'coordenacao' then
    raise exception 'só a coordenação reenvia';
  end if;
  update assinaturas set token = v_token, token_expira_em = now() + interval '30 days'
    where id = p_id and status = 'pendente';
  if not found then
    raise exception 'assinatura não está pendente';
  end if;
  return v_token;
end $$;

-- termo_ok (mentor_profiles) deixa de ser checkbox solto: deriva de existir
-- assinatura ativa do termo. O checkbox manual legado segue até o primeiro
-- evento de assinatura da pessoa.
create or replace function public.assinatura_reflete_termo_ok()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.profile_id is null then
    return new;
  end if;
  -- termo em papel (documento_path) continua valendo: revogar uma assinatura
  -- não pode apagar o ok manual que a coordenação já tinha registrado
  update public.mentor_profiles mp
    set termo_ok = exists (
      select 1 from public.assinaturas a
        join public.documento_templates t on t.id = a.template_id
        where a.profile_id = new.profile_id
          and t.slug = 'termo-voluntario' and a.status = 'assinado')
      or p.documento_path is not null
    from public.profiles p
    where mp.profile_id = new.profile_id and p.id = new.profile_id;
  return new;
end $$;

create trigger assinaturas_termo_ok
  after insert or update of status on public.assinaturas
  for each row execute function public.assinatura_reflete_termo_ok();

-- grants: RPCs de leitura/escrita por token precisam de anon (jovem sem
-- login); os autenticados nunca vão por token — mesma função serve.
revoke all on function public.assinar_termo(jsonb, text, text, text, text)
  from public, anon;
grant execute on function public.assinar_termo(jsonb, text, text, text, text)
  to authenticated;

revoke all on function public.assinatura_por_token(uuid) from public;
grant execute on function public.assinatura_por_token(uuid)
  to anon, authenticated;

revoke all on function public.assinar_com_token(uuid, jsonb, text, text, text, text)
  from public;
grant execute on function public.assinar_com_token(uuid, jsonb, text, text, text, text)
  to anon, authenticated;

revoke all on function public.assinatura_completa_por_token(uuid) from public;
grant execute on function public.assinatura_completa_por_token(uuid)
  to anon, authenticated;

revoke all on function public.revogar_assinatura(uuid) from public, anon;
grant execute on function public.revogar_assinatura(uuid) to authenticated;

revoke all on function public.regenerar_token_assinatura(uuid) from public, anon;
grant execute on function public.regenerar_token_assinatura(uuid) to authenticated;

-- templates do programa — o corpo é renderizado em código por slug
insert into public.documento_templates (slug, titulo, versao, signatario) values
  ('termo-voluntario', 'Termo de Adesão ao Trabalho Voluntário', 1, 'profile'),
  ('autorizacao-responsavel', 'Autorização do Responsável', 1, 'mentorado');

-- assets internos no bucket `documentos`: prefixo `sistema/` foge da regra
-- "name == documento_path de alguém" (0012/0026). A contra-assinatura do
-- presidente (`sistema/contra-assinatura.png`) mora aqui — upload só pela
-- coord. Leitura por autenticados é deliberada: a imagem vai embutida em
-- todo PDF assinado, então escondê-la não protege nada.
create policy documentos_storage_select_sistema on storage.objects for select
  to authenticated using (
    bucket_id = 'documentos' and name like 'sistema/%');
create policy documentos_storage_insert_sistema on storage.objects for insert
  to authenticated with check (
    bucket_id = 'documentos' and name like 'sistema/%'
    and public.my_role() = 'coordenacao');

commit;
