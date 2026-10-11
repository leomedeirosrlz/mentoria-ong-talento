-- 0071 avaliacao_encontro (REALIZA-109 / D4): o jovem avalia todos os encontros
-- realizados (DPP e especialista). A estrela é dele; a visibilidade é por trilha.
--
-- Decisões refletidas:
-- * tabela dedicada (formulario_respostas é coord-only por tabela inteira).
-- * RPC por token espelhando assinatura_por_token — o jovem sem login responde
--   pelo link; o logado responde direto do /jovem. Identidade híbrida igual aos
--   links de assinatura (0070): autenticado ≠ destinatário é recusado.
-- * DPP vê SÓ média agregada via avaliacao_media_dpp: quantizada em 0,5 e
--   liberada em lotes de ≥3 (snapshot das k primeiras, k=floor(n/3)*3) — fecha
--   o ataque por diferença estrela_k = k·m̄_k − (k−1)·m̄_{k−1}.
-- * Especialista vê SÓ estrelas das próprias sessões (view definer; sem
--   comentario/sentimento/temas/pedir_apoio — com 1 avaliador, conteúdo
--   identifica → autocensura + retaliação).
-- * avaliacao_visivel_mentor: dono do toggle é o jovem (coord ligando = coerção).
-- * pedir_apoio: notificação apoio_jovem coord+sup + e-mail redundante (log em
--   emails_enviados via RPC definer — a policy é coord-only por tabela) + flag
--   só-coord-limpa (molde guard_registro_apoio 0004) + avaliação imutável.
-- * Disparo: trigger em encontros→'realizado' cobre salvarRegistro, retroativo
--   (born-realizado) e PATCH. Gera o link SEMPRE (jovem sem login precisa dele)
--   e notifica só quando mentorados.profile_id existe. Supressão de notificação
--   via set_config('realiza.no_notify','on') pro backfill (precedente GUC).
-- * Backfill dos 24 encontros realizado existentes: minta links, zero
--   notificações (o trigger é de UPDATE/INSERT em encontros, não retroativo).

-- ---------- tabelas ----------

create table avaliacoes_encontro (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references duplas(id),
  encontro_id uuid not null unique references encontros(id),
  estrelas smallint not null check (estrelas between 1 and 5),
  sentimento text,
  avancei text check (avancei in ('sim','um_pouco','nao')),
  temas text[],
  comentario text,
  pedir_apoio boolean not null default false,
  avaliacao_visivel_mentor boolean not null default false,
  respondido_por_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table avaliacoes_encontro is
  'Avaliação do encontro FEITA PELO JOVEM (1-5★). Não confundir com '
  'registros.avaliacao (4-pt, do mentor) nem avaliacao_360 (forms, fim de ciclo).';
create index avaliacoes_encontro_dupla on avaliacoes_encontro(dupla_id);

create table avaliacao_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 20),
  encontro_id uuid not null unique references encontros(id),
  dupla_id uuid not null references duplas(id),
  expira_em timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente','respondido','expirado')),
  respondido_em timestamptz,
  respondido_por_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table avaliacao_links is
  'Bearer token por encontro realizado — canal do jovem sem login (WhatsApp '
  'via coord). Mintado pelo trigger em encontros→realizado; expiração lazy.';

grant select, update on avaliacoes_encontro to authenticated;
grant select on avaliacao_links to authenticated;

alter table avaliacoes_encontro enable row level security;
alter table avaliacao_links enable row level security;

-- oracle de pertencimento do jovem é a view definer jovem_duplas (lição 0068:
-- exists() em policy avalia sob o RLS do invoker na tabela referenciada).
create policy avaliacoes_select on avaliacoes_encontro
  for select to authenticated using (
    my_role() = 'coordenacao'
    or (my_role() = 'supervisor' and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.supervisor_id = my_profile_id()))
    or (my_role() = 'mentor_dpp' and avaliacao_visivel_mentor and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.mentor_id = my_profile_id()))
    or (my_role() = 'mentorado' and exists (
      select 1 from jovem_duplas jd where jd.id = dupla_id))
  );
-- insert: só via RPC definer (token ou vínculo). delete: ninguém.
-- update: coord (limpar pedir_apoio). O guard trava o resto.
create policy avaliacoes_update on avaliacoes_encontro
  for update to authenticated
  using (my_role() = 'coordenacao')
  with check (my_role() = 'coordenacao');

-- coord lê os links pra reemitir/encaminhar por WhatsApp (jovem sem login).
create policy avaliacao_links_select on avaliacao_links
  for select to authenticated using (my_role() = 'coordenacao');

-- ---------- guards ----------

create or replace function public.guard_avaliacao_encontro()
returns trigger language plpgsql set search_path to '' as $$
begin
  if new.encontro_id is distinct from old.encontro_id
     or new.dupla_id is distinct from old.dupla_id
     or new.estrelas is distinct from old.estrelas
     or new.sentimento is distinct from old.sentimento
     or new.avancei is distinct from old.avancei
     or new.temas is distinct from old.temas
     or new.comentario is distinct from old.comentario
     or new.respondido_por_profile_id is distinct from old.respondido_por_profile_id
     or new.created_at is distinct from old.created_at then
    raise exception 'avaliação de encontro é imutável';
  end if;
  -- molde guard_registro_apoio (0004): só a coord resolve pedido de apoio
  if new.pedir_apoio = false and old.pedir_apoio = true
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'apenas a coordenacao resolve pedidos de apoio';
  end if;
  return new;
end $$;

create trigger avaliacoes_encontro_guard
  before update on avaliacoes_encontro
  for each row execute function guard_avaliacao_encontro();

-- ---------- trigger: encontro vira realizado → link + prompt ----------

create or replace function public.avaliacao_ao_realizar()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text;
  v_profile uuid;
begin
  -- mint sempre (idempotente): jovem sem login precisa do link pra responder.
  insert into avaliacao_links (token, encontro_id, dupla_id, expira_em)
  values (gen_random_uuid()::text, new.id, new.dupla_id,
          now() + interval '60 days')
  on conflict (encontro_id) do nothing
  returning token into v_token;
  if v_token is null then
    select token into v_token from avaliacao_links where encontro_id = new.id;
  end if;

  -- backfill/operação: supressão por sessão (precedente realiza.*)
  if current_setting('realiza.no_notify', true) = 'on' then
    return new;
  end if;

  -- jovem sem login: só o link (coord encaminha por WhatsApp) — não quebra.
  select m.profile_id into v_profile
    from duplas d join mentorados m on m.id = d.mentorado_id
   where d.id = new.dupla_id;
  if v_profile is null then
    return new;
  end if;

  -- dedup: não-lida de mesmo destino já cobre o prompt
  if exists (select 1 from notificacoes n
    where n.profile_id = v_profile and n.tipo = 'avaliacao_pendente'
      and n.lida_em is null and n.href = '/avaliar/' || v_token) then
    return new;
  end if;

  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  values (v_profile, 'avaliacao_pendente',
    'Como foi seu encontro?',
    'Conte em 1 minuto como foi. Pro seu mentor, a nota só aparece na média.',
    '/avaliar/' || v_token, public.my_profile_id());
  return new;
end $$;

create trigger encontros_avaliacao_prompt
  after insert or update of status on encontros
  for each row when (new.status = 'realizado')
  execute function avaliacao_ao_realizar();

-- ---------- view: especialista vê SÓ estrelas das próprias sessões ----------

create view especialista_avaliacoes as
  select a.id, a.dupla_id, a.encontro_id, a.estrelas, a.created_at,
         e.numero, e.realizado_em
    from avaliacoes_encontro a
    join duplas d on d.id = a.dupla_id
    join encontros e on e.id = a.encontro_id
   where public.my_role() = 'mentor_especialista'
     and d.trilha = 'especialista'
     and d.mentor_id = public.my_profile_id();
grant select on especialista_avaliacoes to authenticated;

-- ---------- RPCs ----------

-- Leitura do link (espelha assinatura_por_token): contexto do encontro sem
-- vazar nada além — nem nome completo de mentor por trilha (o 1º nome basta
-- pra o jovem reconhecer).
create or replace function public.avaliacao_por_token(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_l record;
  v_identidade text;
begin
  select l.id, l.status, l.expira_em, l.dupla_id, l.encontro_id,
         e.numero as e_numero, e.data_hora, e.realizado_em,
         split_part(pm.nome, ' ', 1) as mentor_nome,
         m.nome as jovem_nome
    into v_l
    from avaliacao_links l
    join encontros e on e.id = l.encontro_id
    join duplas d on d.id = l.dupla_id
    join profiles pm on pm.id = d.mentor_id
    join mentorados m on m.id = d.mentorado_id
   where l.token = p_token;
  if not found then
    return null;
  end if;
  if v_l.status = 'pendente' and v_l.expira_em < now() then
    update avaliacao_links set status = 'expirado' where id = v_l.id;
    v_l.status := 'expirado';
  end if;

  -- híbrido (0070): autenticado só abre link endereçado a ele
  v_identidade := case
    when auth.uid() is null then 'anon'
    when exists (select 1 from duplas d
      where d.id = v_l.dupla_id and d.mentorado_id = public.my_mentorado_id())
      then 'ok'
    else 'outra_pessoa' end;
  if v_identidade = 'outra_pessoa' then
    return jsonb_build_object(
      'status', v_l.status, 'identidade', v_identidade,
      'alvo', jsonb_build_object('jovem_nome', v_l.jovem_nome));
  end if;

  return jsonb_build_object(
    'status', v_l.status,
    'identidade', v_identidade,
    'respondida', exists (select 1 from avaliacoes_encontro a
      where a.encontro_id = v_l.encontro_id),
    'encontro', jsonb_build_object(
      'numero', v_l.e_numero, 'data_hora', v_l.data_hora,
      'realizado_em', v_l.realizado_em),
    'mentor', jsonb_build_object('nome', v_l.mentor_nome),
    'alvo', jsonb_build_object('jovem_nome', v_l.jovem_nome));
end $$;
grant execute on function avaliacao_por_token(text) to anon, authenticated;

-- Núcleo compartilhado do submit: valida dono da dupla + encontro realizado +
-- não-respondido, grava a avaliação, consome o link (se houver) e dispara
-- apoio_jovem quando pedido. Retorna destinatários do e-mail redundante —
-- quem manda é a action (Resend fica no app, não no banco).
create or replace function public.submeter_avaliacao(
  p_encontro_id uuid, p_token text,
  p_estrelas smallint, p_sentimento text default null,
  p_avancei text default null, p_temas text[] default null,
  p_comentario text default null, p_pedir_apoio boolean default false,
  p_visivel_mentor boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_dupla_id uuid;
  v_aval_id uuid;
  v_dests jsonb;
begin
  if p_estrelas is null or p_estrelas < 1 or p_estrelas > 5 then
    raise exception 'nota de 1 a 5 estrelas é obrigatória';
  end if;
  if p_avancei is not null and p_avancei not in ('sim','um_pouco','nao') then
    raise exception 'avancei inválido';
  end if;

  select e.dupla_id into v_dupla_id
    from encontros e where e.id = p_encontro_id and e.status = 'realizado';
  if not found then
    raise exception 'encontro não encontrado';
  end if;

  -- caminho do token: link pendente + não expirado + (se logado) dele
  if p_token is not null then
    if not exists (select 1 from avaliacao_links l
      where l.token = p_token and l.encontro_id = p_encontro_id) then
      raise exception 'link inválido';
    end if;
    update avaliacao_links set status = 'expirado'
      where token = p_token and status = 'pendente' and expira_em < now();
    if not exists (select 1 from avaliacao_links l
      where l.token = p_token and l.status = 'pendente') then
      raise exception 'este link já foi usado ou expirou';
    end if;
    if auth.uid() is not null and not exists (select 1 from duplas d
      where d.id = v_dupla_id and d.mentorado_id = public.my_mentorado_id()) then
      raise exception 'este link é de outra pessoa';
    end if;
  else
    -- caminho autenticado: o jovem só avalia encontro da própria dupla
    if not exists (select 1 from duplas d
      where d.id = v_dupla_id and d.mentorado_id = public.my_mentorado_id()) then
      raise exception 'encontro não encontrado';
    end if;
  end if;

  if exists (select 1 from avaliacoes_encontro a
    where a.encontro_id = p_encontro_id) then
    raise exception 'este encontro já foi avaliado';
  end if;

  insert into avaliacoes_encontro
    (dupla_id, encontro_id, estrelas, sentimento, avancei, temas, comentario,
     pedir_apoio, avaliacao_visivel_mentor, respondido_por_profile_id)
  values (v_dupla_id, p_encontro_id, p_estrelas, nullif(p_sentimento, ''),
    p_avancei, p_temas, nullif(p_comentario, ''), coalesce(p_pedir_apoio, false),
    coalesce(p_visivel_mentor, false),
    case when auth.uid() is null then null else public.my_profile_id() end)
  returning id into v_aval_id;

  -- consome o link qualquer que seja o caminho (dedup com o fluxo anon)
  update avaliacao_links
     set status = 'respondido', respondido_em = now(),
         respondido_por_profile_id =
           case when auth.uid() is null then null else public.my_profile_id() end
   where encontro_id = p_encontro_id and status = 'pendente';

  if coalesce(p_pedir_apoio, false) then
    insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'apoio_jovem',
      'Pedido de ajuda',
      'Uma avaliação de encontro marcou "preciso de ajuda". Combinado do programa: responder em 1 dia útil.',
      '/duplas/' || v_dupla_id, public.my_profile_id()
      from profiles p
     where p.role = 'coordenacao' and p.ativo
    union all
    select d.supervisor_id, 'apoio_jovem',
      'Pedido de ajuda',
      'Uma avaliação de encontro marcou "preciso de ajuda". Combinado do programa: responder em 1 dia útil.',
      '/duplas/' || v_dupla_id, public.my_profile_id()
      from duplas d
     where d.id = v_dupla_id and d.supervisor_id is not null;

    -- e-mail redundante: canal de segurança de menor não depende do sino
    select jsonb_agg(jsonb_build_object(
             'profile_id', p.id, 'email', p.email, 'nome', p.nome))
      into v_dests
      from profiles p
     where p.ativo and (
       p.role = 'coordenacao'
       or p.id = (select d.supervisor_id from duplas d where d.id = v_dupla_id));
  end if;

  return jsonb_build_object(
    'ok', true, 'avaliacao_id', v_aval_id,
    'pedir_apoio', coalesce(p_pedir_apoio, false),
    'destinatarios', coalesce(v_dests, '[]'::jsonb));
end $$;
grant execute on function submeter_avaliacao(uuid, text, smallint, text, text,
  text[], text, boolean, boolean) to anon, authenticated;

-- Média do DPP: quantizada (round(avg*2)/2) + release em lotes de ≥3
-- (snapshot das k primeiras por created_at). Só o mentor daquela dupla DPP.
create or replace function public.avaliacao_media_dpp(p_dupla_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_n int;
  v_k int;
  v_media numeric;
begin
  if not exists (select 1 from duplas d
    where d.id = p_dupla_id and d.trilha = 'dpp'
      and d.mentor_id = public.my_profile_id()) then
    raise exception 'dupla não encontrada';
  end if;
  select count(*) into v_n from avaliacoes_encontro where dupla_id = p_dupla_id;
  v_k := (v_n / 3) * 3;
  if v_k < 3 then
    return jsonb_build_object('n', v_n, 'liberado', false);
  end if;
  select round(avg(estrelas) * 2) / 2 into v_media
    from (select estrelas from avaliacoes_encontro
          where dupla_id = p_dupla_id
          order by created_at limit v_k) s;
  return jsonb_build_object('n', v_n, 'liberado', true,
    'media', v_media, 'base', v_k);
end $$;
grant execute on function avaliacao_media_dpp(uuid) to authenticated;

-- Toggle do jovem: mostrar esta avaliação ao mentor DPP.
create or replace function public.definir_visibilidade_avaliacao(
  p_id uuid, p_visivel boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from avaliacoes_encontro a
    join duplas d on d.id = a.dupla_id
    where a.id = p_id and d.mentorado_id = public.my_mentorado_id()) then
    raise exception 'avaliação não encontrada';
  end if;
  update avaliacoes_encontro set avaliacao_visivel_mentor = p_visivel
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function definir_visibilidade_avaliacao(uuid, boolean)
  to authenticated;

-- Log do e-mail redundante em emails_enviados (policy da tabela é coord-only;
-- o write vem da action pós-Resend, como anon ou jovem logado — por isso RPC).
create or replace function public.registrar_email_apoio_avaliacao(
  p_avaliacao_id uuid, p_assunto text, p_destinatarios int,
  p_enviados int, p_falhas text[] default '{}')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_autor uuid;
begin
  select a.respondido_por_profile_id into v_autor
    from avaliacoes_encontro a
   where a.id = p_avaliacao_id and a.pedir_apoio;
  if not found then
    raise exception 'avaliação sem pedido de apoio';
  end if;
  insert into emails_enviados
    (autor_id, tipo, ref_id, assunto, audiencia, destinatarios, enviados, falhas)
  values (v_autor, 'apoio_jovem', p_avaliacao_id, p_assunto,
    array['coordenacao','supervisor'], p_destinatarios, p_enviados, p_falhas);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function registrar_email_apoio_avaliacao(uuid, text, int, int,
  text[]) to anon, authenticated;

-- ---------- CHECKs de tipos ----------

alter table notificacoes drop constraint notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem']));

alter table emails_enviados drop constraint emails_enviados_tipo_check;
alter table emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura','apoio_jovem']));

-- ---------- backfill: links pros 24 realizado já existentes ----------
-- Sem notificação (o trigger não é retroativo): o canal fica pronto pra a
-- coord encaminhar; o prompt do jovem vale pros próximos encontros.

insert into avaliacao_links (token, encontro_id, dupla_id, expira_em)
select gen_random_uuid()::text, e.id, e.dupla_id,
       now() + interval '60 days'
  from encontros e
 where e.status = 'realizado'
on conflict (encontro_id) do nothing;
