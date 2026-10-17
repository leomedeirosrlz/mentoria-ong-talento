-- 0084: Chamados unificados (WP1 telas finais) — fila de atendimento +
-- conversa pública/privada por pedido de apoio. Substitui os canais soltos
-- (registros.precisa_apoio, avaliacoes_encontro.pedir_apoio, pedirApoio do
-- mentor, pedirAjudaJovem) por um inbox com dono, estado e trilha.
--
-- Contratos do plano (docs/planos/implementacao-telas-finais.md §WP1):
-- * Chamado = pedido de suporte como objeto próprio: número legível CHA-000142,
--   categoria, assunto, fila, dono, estado, conversa pública (autor ↔ equipe),
--   comentário interno (só equipe) e anexos.
-- * Papéis: coordenação tudo; auxiliar executivo (supervisor) lê toda a fila e
--   trata não técnicos — `plataforma` fica restrita à coordenação NO BANCO
--   (a view chamados_fila entrega a linha mascarada só com metadados); autor
--   lê o próprio chamado + trilha pública, nunca comentário interno; mentor
--   NÃO enxerga chamado do mentorado só por dividir a dupla (a ficha pode ser
--   sobre ele — é o canal seguro do jovem).
-- * Estados via RPC definer (nada de update direto): assumir ("quem assumir
--   primeiro trata"), atribuir (coord), devolver à fila, resolver (resumo
--   obrigatório), reabrir (equipe) e pedir reabertura (autor).
-- * Dual-run com os flags: flags continuam o dado de origem; triggers abrem/
--   resolvem o chamado correspondente e a RPC de resolução limpa a flag de
--   origem na mesma transação (bypass transaction-local realiza.chamado_flag_sync
--   + pg_trigger_depth() pra não haver recursão).
-- * Notificações chamado_* substituem pedido_apoio/apoio_jovem novos; urgência
--   e origem jovem disparam e-mail redundante (a action envia — Resend mora
--   fora do banco — com os destinatários devolvidos pela RPC).

-- ---------- tabelas ----------

create sequence public.chamados_numero_seq;

create table public.chamados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default
    ('CHA-' || lpad(nextval('public.chamados_numero_seq')::text, 6, '0')),
  -- autor: mentor/staff têm profile; o jovem que pede ajuda pelo link público
  -- da avaliação não tem login — entra por autor_mentorado_id (a ficha dele).
  autor_id uuid references public.profiles(id),
  autor_mentorado_id uuid references public.mentorados(id),
  dupla_id uuid references public.duplas(id),
  categoria text not null check (categoria in
    ('agenda','metodologia','plataforma','urgencia','outro')),
  descricao_outro text check (descricao_outro is null
    or char_length(btrim(descricao_outro)) between 1 and 280),
  assunto text not null check (char_length(btrim(assunto)) between 2 and 200),
  mensagem text check (mensagem is null or char_length(mensagem) <= 5000),
  status text not null default 'aberto' check (status in
    ('aberto','em_atendimento','resolvido')),
  atribuido_a uuid references public.profiles(id),
  origem text not null default 'manual' check (origem in
    ('manual','registro','avaliacao_jovem')),
  -- chaves do dual-run: 1 chamado por flag de origem (unique parcial → o
  -- backfill e os triggers ficam idempotentes via on conflict do nothing)
  registro_id uuid references public.registros(id) on delete set null,
  avaliacao_id uuid references public.avaliacoes_encontro(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references public.profiles(id),
  resolucao_resumo text check (resolucao_resumo is null
    or char_length(btrim(resolucao_resumo)) between 1 and 1000),
  check (autor_id is not null or autor_mentorado_id is not null),
  check (categoria <> 'outro'
         or (descricao_outro is not null
             and char_length(btrim(descricao_outro)) >= 2)),
  check (status <> 'resolvido' or resolvido_em is not null),
  check (status <> 'em_atendimento' or atribuido_a is not null)
);
create unique index chamados_registro_key on public.chamados (registro_id)
  where registro_id is not null;
create unique index chamados_avaliacao_key on public.chamados (avaliacao_id)
  where avaliacao_id is not null;
create index chamados_fila_idx on public.chamados (status, created_at desc);
create index chamados_autor_idx on public.chamados (autor_id, created_at desc);
create index chamados_autor_mentorado_idx
  on public.chamados (autor_mentorado_id, created_at desc);
create index chamados_atribuido_idx on public.chamados (atribuido_a)
  where status <> 'resolvido';
create trigger chamados_touch_updated_at before update on public.chamados
  for each row execute function public.touch_updated_at();

-- trilha pública: mensagens da equipe pro autor, informações acrescentadas
-- pelo autor e eventos de sistema (aberto/atribuído/resolvido/reaberto)
create table public.chamado_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  autor_id uuid references public.profiles(id), -- null = evento de sistema
  tipo text not null default 'publica' check (tipo in ('publica','sistema')),
  texto text not null check (char_length(btrim(texto)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index chamado_atualizacoes_idx
  on public.chamado_atualizacoes (chamado_id, created_at);

-- conversa interna da equipe — o autor nunca lê (policy própria, sem exceção)
create table public.chamado_comentarios (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  texto text not null check (char_length(btrim(texto)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index chamado_comentarios_idx
  on public.chamado_comentarios (chamado_id, created_at);

-- metadados de anexo; o binário mora no bucket privado chamado-anexos e a
-- policy do storage confere a row (mesmo molde de registro_anexos, 0009).
-- interno=true espelha a regra do comentário interno: só a equipe lê.
create table public.chamado_anexos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  path text not null unique,
  nome text not null,
  tamanho integer,
  mime text,
  interno boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index chamado_anexos_idx on public.chamado_anexos (chamado_id);

-- ---------- helpers ----------

-- equipe que recebe chamado: coordenação + auxiliar executivo ativos
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path to ''
as $$ select public.my_role() in ('coordenacao','supervisor') $$;

-- coordenação ou supervisor; pra supervisor, chamado de plataforma não é
-- dele (nem metadados de conteúdo — a view entrega a linha mascarada)
create or replace function public.chamado_visivel_equipe(p_chamado public.chamados)
returns boolean language sql stable security definer set search_path to ''
as $$
  select public.my_role() = 'coordenacao'
      or (public.my_role() = 'supervisor' and p_chamado.categoria <> 'plataforma');
$$;

-- ---------- RLS ----------

alter table public.chamados enable row level security;
alter table public.chamado_atualizacoes enable row level security;
alter table public.chamado_comentarios enable row level security;
alter table public.chamado_anexos enable row level security;

-- leitura: coord tudo; supervisor tudo MENOS plataforma (o "existe mas é da
-- coordenação" da fila sai mascarado pela view); autor lê o próprio —
-- autor_id (profile) ou autor_mentorado_id (conta jovem → ficha).
-- dupla_id sozinho NÃO dá acesso: a ficha pode ser sobre o mentor.
create policy chamados_select on public.chamados for select using (
  public.chamado_visivel_equipe(chamados.*)
  or autor_id = public.my_profile_id()
  or autor_mentorado_id = public.my_mentorado_id()
);
-- sem políticas de escrita: tudo passa pelas RPCs definer

-- trilha pública: quem vê o chamado vê a trilha (o exists corre sob a RLS
-- do chamados — mesmo truque da 0068). Autor e equipe escrevem via RPC.
create policy chamado_atualizacoes_select on public.chamado_atualizacoes
  for select using (
    exists (select 1 from public.chamados c where c.id = chamado_id)
  );

-- comentário interno: só a equipe do chamado (plataforma = coord-only)
create policy chamado_comentarios_select on public.chamado_comentarios
  for select using (
    public.my_role() = 'coordenacao'
    or (public.my_role() = 'supervisor' and exists
        (select 1 from public.chamados c where c.id = chamado_id))
  );

-- anexos: públicos seguem a visibilidade do chamado; internos só a equipe
create policy chamado_anexos_select on public.chamado_anexos for select using (
  exists (select 1 from public.chamados c where c.id = chamado_id)
  and (not interno or public.eh_equipe())
);
-- insert direto só do metadado (o binário vai via storage policy que confere
-- a row); autor anexa no próprio chamado público, equipe anexa qualquer
-- (interno=true só pra equipe)
create policy chamado_anexos_insert on public.chamado_anexos for insert
  with check (
    exists (select 1 from public.chamados c where c.id = chamado_id)
    and (not interno or public.eh_equipe())
  );

-- ---------- view da fila (staff): máscara plataforma pro auxiliar ----------

-- Definer de propósito (mesmo padrão de jovem_contatos/profiles_contato):
-- entrega ao supervisor as linhas de plataforma como "restritas à
-- coordenação" — protocolo, categoria, estado e idade, sem conteúdo/dono.
create view public.chamados_fila as
select
  c.id,
  c.numero,
  c.categoria,
  c.status,
  c.origem,
  c.created_at,
  c.resolvido_em,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.assunto end as assunto,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.mensagem end as mensagem,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.descricao_outro end as descricao_outro,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.autor_id end as autor_id,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.autor_mentorado_id end as autor_mentorado_id,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.dupla_id end as dupla_id,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.atribuido_a end as atribuido_a,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.resolvido_por end as resolvido_por,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.resolucao_resumo end as resolucao_resumo,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.registro_id end as registro_id,
  case when c.categoria = 'plataforma' and public.my_role() = 'supervisor'
       then null else c.avaliacao_id end as avaliacao_id,
  c.updated_at
from public.chamados c
where public.eh_equipe();

grant select on public.chamados to authenticated;
grant select on public.chamado_atualizacoes to authenticated;
grant select on public.chamado_comentarios to authenticated;
grant select, insert on public.chamado_anexos to authenticated;
grant select on public.chamados_fila to authenticated;

-- ---------- sync flag ↔ chamado (dual-run) ----------

-- Os guards de 0004/0071 continuam mandando ("só a coordenação resolve o
-- flag") — a RPC de resolução do chamado limpa a flag de origem na mesma
-- transação sob o bypass transaction-local, e os triggers de sync saem de
-- campo enquanto a RPC já fez o trabalho imperativamente.
create or replace function public.guard_registro_apoio()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.precisa_apoio = false and old.precisa_apoio = true
     and public.my_role() is distinct from 'coordenacao'
     and current_setting('realiza.chamado_flag_sync', true) is distinct from 'on' then
    raise exception 'apenas a coordenacao resolve pedidos de apoio';
  end if;
  return new;
end $$;

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
  if new.pedir_apoio = false and old.pedir_apoio = true
     and public.my_role() is distinct from 'coordenacao'
     and current_setting('realiza.chamado_flag_sync', true) is distinct from 'on' then
    raise exception 'apenas a coordenacao resolve pedidos de apoio';
  end if;
  return new;
end $$;

-- evento de sistema na trilha pública (usado por triggers e RPCs)
create or replace function public.chamado_evento(
  p_chamado uuid, p_texto text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into chamado_atualizacoes (chamado_id, autor_id, tipo, texto)
  values (p_chamado, null, 'sistema', p_texto);
end $$;

-- notificação chamado_* pra equipe (coords + supervisor da dupla; sem dupla
-- ou urgência sem supervisor → todos os supervisores ativos ficam de fora —
-- urgência sem dupla vai só pra coordenação, molde do submeter_avaliacao)
create or replace function public.chamado_notifica_equipe(
  p_chamado uuid, p_tipo text, p_titulo text, p_corpo text,
  p_autor uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_chamado;
  if not found then return; end if;
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  select p.id, p_tipo, p_titulo, p_corpo,
         '/chamados?c=' || v.id, coalesce(p_autor, public.my_profile_id())
    from profiles p
   where p.ativo and p.role = 'coordenacao'
     and p.id is distinct from coalesce(p_autor, public.my_profile_id())
  union all
  select d.supervisor_id, p_tipo, p_titulo, p_corpo,
         '/chamados?c=' || v.id, coalesce(p_autor, public.my_profile_id())
    from duplas d
   where d.id = v.dupla_id and d.supervisor_id is not null
     and v.categoria <> 'plataforma'  -- plataforma não é do auxiliar
     and d.supervisor_id is distinct from coalesce(p_autor, public.my_profile_id());
end $$;

-- notifica o autor do chamado (profile ou conta jovem da ficha)
create or replace function public.chamado_notifica_autor(
  p_chamado uuid, p_tipo text, p_titulo text, p_corpo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
  v_dest uuid;
begin
  select * into v from chamados where id = p_chamado;
  if not found then return; end if;
  v_dest := coalesce(v.autor_id,
    (select m.profile_id from mentorados m where m.id = v.autor_mentorado_id));
  if v_dest is null then return; end if;
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  values (v_dest, p_tipo, p_titulo, p_corpo,
    case when (select p.role from profiles p where p.id = v_dest) = 'mentorado'
         then '/jovem/perfil?c=' || v.id
         else '/chamados?c=' || v.id end,
    public.my_profile_id());
end $$;

-- flag do registro ligada → abre o chamado (origem registro, categoria fixa
-- 'outro' com a descrição do texto de origem — decisão D4 do plano).
-- flag desligada por qualquer caminho → resolve o chamado aberto.
create or replace function public.registro_apoio_chamado_sync()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_encontro record;
  v_chamado_id uuid;
begin
  if pg_trigger_depth() > 1
     or current_setting('realiza.chamado_flag_sync', true) = 'on' then
    return coalesce(new, old);
  end if;

  if (tg_op = 'INSERT' and new.precisa_apoio)
     or (tg_op = 'UPDATE' and new.precisa_apoio and not old.precisa_apoio) then
    select e.id, e.numero, e.dupla_id into v_encontro
      from encontros e where e.id = new.encontro_id;
    insert into chamados
      (autor_id, dupla_id, categoria, descricao_outro, assunto, mensagem,
       origem, registro_id)
    select coalesce(new.created_by, d.mentor_id),
      v_encontro.dupla_id, 'outro',
      'Pedido de apoio marcado no registro do ' || v_encontro.numero || 'º encontro',
      'Pedido de apoio no registro — ' || v_encontro.numero || 'º encontro',
      left(nullif(btrim(concat_ws(E'\n',
        new.dificuldade_detalhe, new.proximo_passo_detalhe, new.reflexoes,
        new.observacoes)), ''), 5000),
      'registro', new.id
      from duplas d where d.id = v_encontro.dupla_id
    on conflict do nothing
    returning id into v_chamado_id;
    if v_chamado_id is not null then
      perform chamado_evento(v_chamado_id,
        'Chamado aberto automaticamente — o mentor marcou "preciso de apoio" no registro.');
      perform chamado_notifica_equipe(v_chamado_id, 'chamado_aberto',
        'Chamado aberto',
        'Pedido de apoio no registro do encontro — assuma o chamado pra responder.');
    end if;
  elsif tg_op = 'UPDATE' and old.precisa_apoio and not new.precisa_apoio then
    -- flag desligada por fora (resolverApoio legado já passa pela RPC, mas
    -- qualquer caminho de limpeza resolve o chamado — sync é bidirecional)
    for v_chamado_id in
      update chamados c set status = 'resolvido', resolvido_em = now(),
        resolvido_por = public.my_profile_id()
      where c.registro_id = new.id and c.status <> 'resolvido'
      returning c.id
    loop
      perform chamado_evento(v_chamado_id,
        'Pedido de apoio marcado como atendido na ficha do registro.');
      perform chamado_notifica_autor(v_chamado_id, 'chamado_resolvido',
        'Pedido de apoio atendido',
        'O pedido de apoio do registro foi marcado como atendido pela equipe.');
    end loop;
  end if;
  return new;
end $$;

create trigger registros_apoio_chamado_sync
  after insert or update of precisa_apoio on public.registros
  for each row execute function public.registro_apoio_chamado_sync();

-- idem pra avaliacao_encontro.pedir_apoio (origem avaliacao_jovem; o flag do
-- jovem é canal de segurança → categoria urgencia: notifica coord + sup e
-- manda e-mail redundante, como o apoio_jovem já fazia)
create or replace function public.avaliacao_apoio_chamado_sync()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_encontro record;
  v_mentorado uuid;
  v_chamado_id uuid;
begin
  if pg_trigger_depth() > 1
     or current_setting('realiza.chamado_flag_sync', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' and new.pedir_apoio then
    select e.numero into v_encontro from encontros e where e.id = new.encontro_id;
    select d.mentorado_id into v_mentorado from duplas d where d.id = new.dupla_id;
    insert into chamados
      (autor_id, autor_mentorado_id, dupla_id, categoria, assunto, mensagem,
       origem, avaliacao_id)
    values (new.respondido_por_profile_id, v_mentorado, new.dupla_id, 'urgencia',
      'Preciso de ajuda — avaliação do ' || coalesce(v_encontro.numero::text, 'encontro') || 'º encontro',
      left(coalesce(new.comentario, ''), 5000), 'avaliacao_jovem', new.id)
    on conflict do nothing
    returning id into v_chamado_id;
    if v_chamado_id is not null then
      perform chamado_evento(v_chamado_id,
        'Chamado aberto — a pessoa mentorada marcou "preciso de ajuda" na avaliação do encontro.');
      perform chamado_notifica_equipe(v_chamado_id, 'chamado_aberto',
        'Pedido de ajuda',
        'Uma avaliação de encontro marcou "preciso de ajuda". Combinado do programa: responder em 1 dia útil.');
    end if;
  elsif tg_op = 'UPDATE' and old.pedir_apoio and not new.pedir_apoio then
    for v_chamado_id in
      update chamados c set status = 'resolvido', resolvido_em = now(),
        resolvido_por = public.my_profile_id()
      where c.avaliacao_id = new.id and c.status <> 'resolvido'
      returning c.id
    loop
      perform chamado_evento(v_chamado_id,
        'Pedido de ajuda marcado como atendido na ficha da avaliação.');
      perform chamado_notifica_autor(v_chamado_id, 'chamado_resolvido',
        'Pedido de ajuda atendido',
        'O pedido de ajuda da sua avaliação foi marcado como atendido pela equipe.');
    end loop;
  end if;
  return coalesce(new, old);
end $$;

create trigger avaliacoes_apoio_chamado_sync
  after insert or update of pedir_apoio on public.avaliacoes_encontro
  for each row execute function public.avaliacao_apoio_chamado_sync();

-- ---------- RPCs definer (todo o workflow passa por aqui) ----------

-- abre chamado manual: mentor/especialista/coord informam dupla opcional;
-- mentorado usa a própria dupla ativa quando o assunto é a mentoria. Retorna
-- {id, numero, destinatarios_email?} — urgência/origem jovem dispara e-mail
-- redundante pela action (Resend não mora no banco).
create or replace function public.abrir_chamado(
  p_categoria text, p_assunto text, p_mensagem text,
  p_descricao_outro text default null, p_dupla_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_role text := public.my_role();
  v_autor uuid := public.my_profile_id();
  v_mentorado uuid := public.my_mentorado_id();
  v_id uuid; v_numero text; v_dests jsonb;
begin
  if v_autor is null or v_role is null then
    raise exception 'sem sessão ativa';
  end if;
  if p_categoria is null or p_categoria not in
     ('agenda','metodologia','plataforma','urgencia','outro') then
    raise exception 'categoria inválida';
  end if;
  if p_categoria = 'outro' and
     (p_descricao_outro is null or char_length(btrim(p_descricao_outro)) < 2) then
    raise exception 'descreva em poucas palavras o assunto do chamado';
  end if;
  if p_assunto is null or char_length(btrim(p_assunto)) < 2
     or char_length(p_assunto) > 200 then
    raise exception 'assunto precisa ter entre 2 e 200 caracteres';
  end if;
  if p_mensagem is not null and char_length(p_mensagem) > 5000 then
    raise exception 'mensagem passa de 5000 caracteres';
  end if;
  if v_role = 'mentorado' then
    -- o jovem não escolhe dupla no formulário; a dupla ativa dele entra como
    -- contexto pra equipe saber de quem se trata (não dá acesso ao mentor)
    if p_dupla_id is null then
      select d.id into p_dupla_id from duplas d
       where d.mentorado_id = v_mentorado and d.status = 'ativa'
       order by d.iniciada_em desc nulls last limit 1;
    elsif not exists (select 1 from duplas d
      where d.id = p_dupla_id and d.mentorado_id = v_mentorado) then
      raise exception 'dupla não encontrada';
    end if;
  elsif p_dupla_id is not null then
    -- mentor/especialista só abre chamado atrelado a dupla própria; equipe livre
    if v_role in ('mentor_dpp','mentor_especialista') and not exists
       (select 1 from duplas d where d.id = p_dupla_id
          and (d.mentor_id = v_autor or d.especialista_id = v_autor)) then
      raise exception 'dupla não encontrada';
    end if;
  end if;

  insert into chamados
    (autor_id, autor_mentorado_id, dupla_id, categoria, descricao_outro,
     assunto, mensagem, origem)
  values (v_autor,
    case when v_role = 'mentorado' then v_mentorado end,
    p_dupla_id, p_categoria, nullif(btrim(p_descricao_outro), ''),
    btrim(p_assunto), nullif(p_mensagem, ''), 'manual')
  returning id, numero into v_id, v_numero;

  perform chamado_evento(v_id,
    'Chamado aberto por ' ||
    coalesce((select nome from profiles where id = v_autor), 'autor') || '.');
  perform chamado_notifica_equipe(v_id, 'chamado_aberto',
    'Chamado ' || v_numero || ' aberto',
    'Categoria ' || p_categoria || ': ' || btrim(p_assunto));

  -- urgência e chamado do jovem viram e-mail redundante pro staff
  if p_categoria = 'urgencia' or v_role = 'mentorado' then
    select jsonb_agg(jsonb_build_object(
             'profile_id', p.id, 'email', p.email, 'nome', p.nome))
      into v_dests
      from profiles p
     where p.ativo and (
       p.role = 'coordenacao'
       or (p_categoria <> 'plataforma' and p.id =
           (select d.supervisor_id from duplas d where d.id = p_dupla_id)));
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero,
    'destinatarios', coalesce(v_dests, '[]'::jsonb));
end $$;
grant execute on function abrir_chamado(text, text, text, text, uuid)
  to authenticated;

-- quem assumir primeiro trata: update condicional resolve a corrida
create or replace function public.assumir_chamado(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if v.status = 'resolvido' then
    raise exception 'chamado já resolvido — reabra se precisar retomar';
  end if;
  -- coord pode assumir de outro dono ("assumir de X"); auxiliar só pega sem
  -- dono (tomar chamado de colega é decisão da coordenação)
  if v.atribuido_a is not null and v.atribuido_a is distinct from public.my_profile_id()
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'este chamado já está com outra pessoa da equipe';
  end if;
  update chamados set status = 'em_atendimento',
    atribuido_a = public.my_profile_id()
   where id = p_id and status <> 'resolvido';
  perform chamado_evento(p_id, 'Chamado assumido por ' ||
    coalesce((select nome from profiles where id = public.my_profile_id()), 'equipe') || '.');
end $$;
grant execute on function assumir_chamado(uuid) to authenticated;

-- atribuir é decisão da coordenação; auxiliar executivo só recebe chamado
-- não técnico (plataforma segue coord-only)
create or replace function public.atribuir_chamado(p_id uuid, p_para uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'só a coordenação atribui chamados';
  end if;
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if v.status = 'resolvido' then
    raise exception 'chamado já resolvido — reabra antes de atribuir';
  end if;
  if p_para is not null then
    if not exists (select 1 from profiles p
      where p.id = p_para and p.ativo
        and p.role in ('coordenacao','supervisor')) then
      raise exception 'responsável precisa ser alguém da equipe ativa';
    end if;
    if v.categoria = 'plataforma' and exists
       (select 1 from profiles p where p.id = p_para and p.role = 'supervisor') then
      raise exception 'chamado de plataforma fica com a coordenação';
    end if;
  end if;
  update chamados set atribuido_a = p_para,
    status = case when p_para is null then 'aberto' else 'em_atendimento' end
   where id = p_id;
  if p_para is null then
    perform chamado_evento(p_id, 'Chamado devolvido à fila, sem responsável.');
  else
    perform chamado_evento(p_id, 'Chamado atribuído a ' ||
      (select nome from profiles where id = p_para) || '.');
    if p_para is distinct from public.my_profile_id() then
      insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
      values (p_para, 'chamado_atribuido', 'Chamado ' || v.numero || ' com você',
        v.assunto, '/chamados?c=' || v.id, public.my_profile_id());
    end if;
  end if;
end $$;
grant execute on function atribuir_chamado(uuid, uuid) to authenticated;

-- devolver à fila: o dono ou a coordenação
create or replace function public.devolver_chamado_fila(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if v.status = 'resolvido' then
    raise exception 'chamado já resolvido';
  end if;
  if v.atribuido_a is distinct from public.my_profile_id()
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'só o responsável ou a coordenação devolvem à fila';
  end if;
  update chamados set status = 'aberto', atribuido_a = null where id = p_id;
  perform chamado_evento(p_id, 'Chamado devolvido à fila.');
end $$;
grant execute on function devolver_chamado_fila(uuid) to authenticated;

-- resolve: resumo obrigatório (vira a mensagem pública de fechamento);
-- limpa a flag de origem na mesma transação (bypass do guard + saída dos
-- triggers de sync — a RPC já fez as duas pontas)
create or replace function public.resolver_chamado(p_id uuid, p_resumo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if v.status = 'resolvido' then
    raise exception 'chamado já resolvido';
  end if;
  -- auxiliar resolve o sem dono ou o seu; chamado com outro dono é da pessoa
  if public.my_role() is distinct from 'coordenacao'
     and v.atribuido_a is not null
     and v.atribuido_a is distinct from public.my_profile_id() then
    raise exception 'este chamado está com outra pessoa da equipe';
  end if;
  if p_resumo is null or char_length(btrim(p_resumo)) < 2 then
    raise exception 'escreva um resumo da resolução';
  end if;
  if char_length(p_resumo) > 1000 then
    raise exception 'resumo passa de 1000 caracteres';
  end if;

  perform set_config('realiza.chamado_flag_sync', 'on', true);

  update chamados set status = 'resolvido', resolvido_em = now(),
    resolvido_por = public.my_profile_id(), resolucao_resumo = btrim(p_resumo)
   where id = p_id;
  if v.registro_id is not null then
    update registros set precisa_apoio = false where id = v.registro_id;
  end if;
  if v.avaliacao_id is not null then
    update avaliacoes_encontro set pedir_apoio = false where id = v.avaliacao_id;
  end if;

  perform chamado_evento(p_id, 'Chamado resolvido — ' || btrim(p_resumo));
  perform chamado_notifica_autor(p_id, 'chamado_resolvido',
    'Chamado ' || v.numero || ' resolvido',
    'Sua solicitação foi respondida pela equipe: ' || btrim(p_resumo));
end $$;
grant execute on function resolver_chamado(uuid, text) to authenticated;

-- reabrir (equipe): volta a em_atendimento com o mesmo dono; sem dono → fila
create or replace function public.reabrir_chamado(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if v.status <> 'resolvido' then
    raise exception 'só chamado resolvido pode ser reaberto';
  end if;
  perform set_config('realiza.chamado_flag_sync', 'on', true);
  update chamados set status = case when v.atribuido_a is null then 'aberto'
                                    else 'em_atendimento' end,
    resolvido_em = null, resolvido_por = null, resolucao_resumo = null
   where id = p_id;
  -- o chamado voltou → a flag de origem volta a acender (dual-run coerente)
  if v.registro_id is not null then
    update registros set precisa_apoio = true where id = v.registro_id;
  end if;
  if v.avaliacao_id is not null then
    update avaliacoes_encontro set pedir_apoio = true where id = v.avaliacao_id;
  end if;
  perform chamado_evento(p_id, 'Chamado reaberto pela equipe.');
  perform chamado_notifica_autor(p_id, 'chamado_atualizacao',
    'Chamado ' || v.numero || ' reaberto',
    'A equipe reabriu sua solicitação e vai retomar o atendimento.');
end $$;
grant execute on function reabrir_chamado(uuid) to authenticated;

-- pedir reabertura (autor): devolve à fila e avisa a equipe — o autor não
-- reabre sozinho, a equipe decide o encaminhamento
create or replace function public.pedir_reabertura_chamado(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if v.autor_id is distinct from public.my_profile_id()
     and v.autor_mentorado_id is distinct from public.my_mentorado_id() then
    raise exception 'só o autor pode pedir a reabertura';
  end if;
  if v.status <> 'resolvido' then
    raise exception 'este chamado ainda está aberto';
  end if;
  perform set_config('realiza.chamado_flag_sync', 'on', true);
  update chamados set status = 'aberto', atribuido_a = null,
    resolvido_em = null, resolvido_por = null, resolucao_resumo = null
   where id = p_id;
  if v.registro_id is not null then
    update registros set precisa_apoio = true where id = v.registro_id;
  end if;
  if v.avaliacao_id is not null then
    update avaliacoes_encontro set pedir_apoio = true where id = v.avaliacao_id;
  end if;
  perform chamado_evento(p_id, 'O autor pediu a reabertura do chamado.');
  perform chamado_notifica_equipe(p_id, 'chamado_reaberto',
    'Chamado ' || v.numero || ' reaberto a pedido do autor',
    v.assunto || ' — o autor pediu para retomar o atendimento.',
    v.autor_id);
end $$;
grant execute on function pedir_reabertura_chamado(uuid) to authenticated;

-- atualização pública (equipe → autor): trilha + notificação + e-mail (a
-- action envia com o destinatário que a RPC devolve)
create or replace function public.publicar_atualizacao_chamado(
  p_id uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
  v_dest jsonb;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if v.status = 'resolvido' then
    raise exception 'chamado resolvido — reabra antes de atualizar';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) = 0
     or char_length(p_texto) > 4000 then
    raise exception 'atualização vazia ou acima de 4000 caracteres';
  end if;
  insert into chamado_atualizacoes (chamado_id, autor_id, tipo, texto)
  values (p_id, public.my_profile_id(), 'publica', btrim(p_texto));
  perform chamado_notifica_autor(p_id, 'chamado_atualizacao',
    'Atualização no chamado ' || v.numero,
    left(btrim(p_texto), 240));
  select jsonb_build_object('profile_id', p.id, 'email', p.email, 'nome', p.nome)
    into v_dest from profiles p
   where p.id = coalesce(v.autor_id,
     (select m.profile_id from mentorados m where m.id = v.autor_mentorado_id));
  return jsonb_build_object('ok', true, 'autor', coalesce(v_dest, 'null'::jsonb));
end $$;
grant execute on function publicar_atualizacao_chamado(uuid, text)
  to authenticated;

-- comentário interno + @menções (a equipe marca colegas; eles são avisados)
create or replace function public.comentar_chamado(
  p_id uuid, p_texto text, p_mencionados uuid[] default '{}')
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
  v_m uuid;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if not public.chamado_visivel_equipe(v) then
    raise exception 'este chamado é tratado pela coordenação';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) = 0
     or char_length(p_texto) > 4000 then
    raise exception 'comentário vazio ou acima de 4000 caracteres';
  end if;
  insert into chamado_comentarios (chamado_id, autor_id, texto)
  values (p_id, public.my_profile_id(), btrim(p_texto));
  foreach v_m in array coalesce(p_mencionados, '{}') loop
    if v_m is not null and v_m is distinct from public.my_profile_id()
       and exists (select 1 from profiles p
         where p.id = v_m and p.ativo
           and p.role in ('coordenacao','supervisor')) then
      insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
      values (v_m, 'chamado_mencao', 'Você foi marcado no chamado ' || v.numero,
        left(btrim(p_texto), 240), '/chamados?c=' || v.id, public.my_profile_id());
    end if;
  end loop;
end $$;
grant execute on function comentar_chamado(uuid, text, uuid[]) to authenticated;

-- o autor acrescenta informação (não pode quando resolvido — o caminho é
-- pedir reabertura); avisa o dono, ou a coordenação se o chamado está na fila
create or replace function public.acrescentar_info_chamado(p_id uuid, p_texto text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_id;
  if not found then raise exception 'chamado não encontrado'; end if;
  if v.autor_id is distinct from public.my_profile_id()
     and v.autor_mentorado_id is distinct from public.my_mentorado_id() then
    raise exception 'só o autor pode acrescentar informação';
  end if;
  if v.status = 'resolvido' then
    raise exception 'chamado resolvido — peça a reabertura se ainda precisar';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) = 0
     or char_length(p_texto) > 4000 then
    raise exception 'informação vazia ou acima de 4000 caracteres';
  end if;
  insert into chamado_atualizacoes (chamado_id, autor_id, tipo, texto)
  values (p_id, public.my_profile_id(), 'publica', btrim(p_texto));
  if v.atribuido_a is not null then
    insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    values (v.atribuido_a, 'chamado_resposta_autor',
      'Autor respondeu no chamado ' || v.numero,
      left(btrim(p_texto), 240), '/chamados?c=' || v.id, public.my_profile_id());
  else
    perform chamado_notifica_equipe(p_id, 'chamado_resposta_autor',
      'Autor respondeu no chamado ' || v.numero, left(btrim(p_texto), 240),
      v.autor_id);
  end if;
end $$;
grant execute on function acrescentar_info_chamado(uuid, text) to authenticated;

-- resolução atômica a partir da flag (mantém os botões "marcar como
-- atendido" das fichas funcionais: resolve o chamado e limpa a flag na mesma
-- transação — o bypass do guard mora na transaction-local)
create or replace function public.resolver_chamado_por_origem(
  p_registro_id uuid default null, p_avaliacao_id uuid default null,
  p_resumo text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v public.chamados%rowtype;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'só a coordenação resolve pedidos de apoio';
  end if;
  perform set_config('realiza.chamado_flag_sync', 'on', true);
  if p_registro_id is not null then
    select * into v from chamados where registro_id = p_registro_id;
    update registros set precisa_apoio = false where id = p_registro_id;
  elsif p_avaliacao_id is not null then
    select * into v from chamados where avaliacao_id = p_avaliacao_id;
    update avaliacoes_encontro set pedir_apoio = false where id = p_avaliacao_id;
  else
    raise exception 'origem não informada';
  end if;
  if v.id is not null and v.status <> 'resolvido' then
    update chamados set status = 'resolvido', resolvido_em = now(),
      resolvido_por = public.my_profile_id(),
      resolucao_resumo = coalesce(nullif(btrim(p_resumo), ''),
        'Marcado como atendido a partir da ficha de origem.')
     where id = v.id;
    perform chamado_evento(v.id, 'Chamado resolvido — ' ||
      coalesce(nullif(btrim(p_resumo), ''),
        'marcado como atendido na ficha de origem.'));
    perform chamado_notifica_autor(v.id, 'chamado_resolvido',
      'Chamado ' || v.numero || ' resolvido',
      'O pedido de apoio foi marcado como atendido pela equipe.');
  end if;
end $$;
grant execute on function resolver_chamado_por_origem(uuid, uuid, text)
  to authenticated;

-- ---------- submeter_avaliacao: chamado nasce pelo trigger ----------

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
  v_chamado record;
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
    if not exists (select 1 from duplas d
      where d.id = v_dupla_id and d.mentorado_id = public.my_mentorado_id()) then
      raise exception 'encontro não encontrado';
    end if;
  end if;

  if exists (select 1 from avaliacoes_encontro a
    where a.encontro_id = p_encontro_id) then
    raise exception 'este encontro já foi avaliado';
  end if;

  -- o insert dispara o trigger que abre o chamado (urgencia) + avisa a
  -- equipe no sino — nada de pedido_apoio/apoio_jovem novos por aqui
  insert into avaliacoes_encontro
    (dupla_id, encontro_id, estrelas, sentimento, avancei, temas, comentario,
     pedir_apoio, avaliacao_visivel_mentor, respondido_por_profile_id)
  values (v_dupla_id, p_encontro_id, p_estrelas, nullif(p_sentimento, ''),
    p_avancei, p_temas, nullif(p_comentario, ''), coalesce(p_pedir_apoio, false),
    coalesce(p_visivel_mentor, false),
    case when auth.uid() is null then null else public.my_profile_id() end)
  returning id into v_aval_id;

  update avaliacao_links
     set status = 'respondido', respondido_em = now(),
         respondido_por_profile_id =
           case when auth.uid() is null then null else public.my_profile_id() end
   where encontro_id = p_encontro_id and status = 'pendente';

  if coalesce(p_pedir_apoio, false) then
    select id, numero into v_chamado from chamados
     where avaliacao_id = v_aval_id;
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
    'chamado_id', v_chamado.id, 'chamado_numero', v_chamado.numero,
    'destinatarios', coalesce(v_dests, '[]'::jsonb));
end $$;

-- log de e-mail de chamado (policy de emails_enviados é coord-only — a RPC
-- definer é o caminho pra qualquer papel registrar o disparo do próprio fluxo)
create or replace function public.registrar_email_chamado(
  p_chamado_id uuid, p_assunto text, p_destinatarios int,
  p_enviados int, p_falhas text[])
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from chamados c where c.id = p_chamado_id) then
    raise exception 'chamado não encontrado';
  end if;
  insert into emails_enviados
    (autor_id, tipo, ref_id, assunto, audiencia, destinatarios, enviados, falhas)
  values
    (public.my_profile_id(), 'chamado', p_chamado_id, p_assunto,
     array['chamado'], p_destinatarios, p_enviados, p_falhas);
end $$;
grant execute on function registrar_email_chamado(uuid, text, int, int, text[])
  to authenticated;

-- ---------- backfill dos flags abertos (idempotente) ----------

insert into public.chamados
  (autor_id, dupla_id, categoria, descricao_outro, assunto, mensagem,
   origem, registro_id, created_at)
select coalesce(r.created_by, d.mentor_id), e.dupla_id, 'outro',
  'Pedido de apoio marcado no registro do ' || e.numero || 'º encontro',
  'Pedido de apoio no registro — ' || e.numero || 'º encontro',
  left(nullif(btrim(concat_ws(E'\n',
    r.dificuldade_detalhe, r.proximo_passo_detalhe, r.reflexoes,
    r.observacoes)), ''), 5000),
  'registro', r.id, r.created_at
from public.registros r
join public.encontros e on e.id = r.encontro_id
join public.duplas d on d.id = e.dupla_id
where r.precisa_apoio
on conflict do nothing;

insert into public.chamados
  (autor_id, autor_mentorado_id, dupla_id, categoria, assunto, mensagem,
   origem, avaliacao_id, created_at)
select a.respondido_por_profile_id, d.mentorado_id, a.dupla_id, 'urgencia',
  'Preciso de ajuda — avaliação do ' || e.numero || 'º encontro',
  left(coalesce(a.comentario, ''), 5000), 'avaliacao_jovem', a.id, a.created_at
from public.avaliacoes_encontro a
join public.encontros e on e.id = a.encontro_id
join public.duplas d on d.id = a.dupla_id
where a.pedir_apoio
on conflict do nothing;

insert into public.chamado_atualizacoes (chamado_id, autor_id, tipo, texto, created_at)
select c.id, null, 'sistema',
  'Chamado criado na migração dos pedidos de apoio em aberto.', c.created_at
from public.chamados c
where c.origem in ('registro','avaliacao_jovem')
  and not exists (select 1 from public.chamado_atualizacoes u
                  where u.chamado_id = c.id);

-- ---------- tipos novos de notificação / e-mail ----------

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem',
    'encontro_marcado','encontro_alterado','encontro_desfeito',
    'solicitacao_triagem','solicitacao_recusada','solicitacao_proposta',
    'chamado_aberto','chamado_atribuido','chamado_atualizacao',
    'chamado_resposta_autor','chamado_resolvido','chamado_reaberto',
    'chamado_mencao'));

-- e-mail de chamado (urgência → equipe; atualização → autor). Lista atual
-- vem da 0071: ('comunicado','material','assinatura','apoio_jovem').
alter table public.emails_enviados drop constraint emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura','apoio_jovem','chamado']));

-- ---------- storage: anexos do chamado ----------

insert into storage.buckets (id, name, public)
values ('chamado-anexos', 'chamado-anexos', false)
on conflict (id) do nothing;

-- o objeto só entra se a row de metadados já existir (molde 0009) e a
-- visibilidade for a do anexo: interno → equipe; público → quem vê o chamado
create policy chamado_anexos_storage_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chamado-anexos'
    and exists (select 1 from public.chamado_anexos a
      where a.path = name and exists
        (select 1 from public.chamados c where c.id = a.chamado_id)
        and (not a.interno or public.eh_equipe()))
  );

create policy chamado_anexos_storage_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chamado-anexos'
    and exists (select 1 from public.chamado_anexos a
      where a.path = name and exists
        (select 1 from public.chamados c where c.id = a.chamado_id)
        and (not a.interno or public.eh_equipe()))
  );

create policy chamado_anexos_storage_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'chamado-anexos' and public.my_role() = 'coordenacao');
