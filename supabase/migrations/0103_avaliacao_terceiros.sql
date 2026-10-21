-- 0103 avaliacao_terceiros (REALIZA-165): avaliação por terceiros do guia DPP
-- (semana 1→2). O jovem indica até 9 pessoas (3 amigos + 3 familiares + 3
-- colegas); o mentor envia a cada uma um link com 2 perguntas abertas —
-- pontos fortes / aspectos a melhorar — e consolida as respostas ANTES do 2º
-- encontro retirando tudo que identifique quem respondeu.
--
-- Decisões refletidas:
-- * tabelas dedicadas (molde 0071_avaliacao_encontro), NÃO a engine de
--   formulários: o respondente é externo — não cabe em dest_profile_id/
--   dest_mentorado_id — e o dedup de link genérico da engine impediria os
--   9 convites nomeados por dupla.
-- * privacidade por tabela: mentor lê respostas IDENTIFICADAS (ele consolida);
--   o jovem só alcança terceiros_consolidacao e só depois de publicado_em —
--   sem exists() em duplas pra ele (lição 0068: vai pelo oracle jovem_duplas).
-- * consolidado é dado CURADO pelo mentor (o guia é editorial: agrupar o que
--   se repete e remover marcas), não agregação automática — por isso texto
--   livre + publicado_em explícito.
-- * convite é bearer token por contato: posse = autorização (o respondente
--   não é usuário; molde assinatura/avaliacao_links). Cancelar = deletar
--   convite 'pendente' — respondido nunca se apaga (o dado é o valor).
-- * submit consome o convite por UPDATE gateado (status='pendente') — a
--   corrida de dois submits é decidida pelo banco, não pelo client.
-- * escrita de status/token/respondido_* só via RPCs definer: o grant de
--   update cobre só nome/vinculo/whatsapp (colunas de cadastro).
-- * cap 9 por trigger — o guia fixa 3+3+3; validação de app sozinha seria
--   contornável.

begin;

-- ---------- tabelas ----------

create table public.terceiros_contatos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references duplas(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 120),
  vinculo text not null
    check (vinculo in ('amigo','familiar','colega','outro')),
  whatsapp text check (whatsapp is null or char_length(whatsapp) between 8 and 25),
  token text not null unique check (char_length(token) >= 20)
    default translate(encode(extensions.gen_random_bytes(24),'base64'),'+/=','-_'),
  expira_em timestamptz not null default (now() + interval '30 days'),
  status text not null default 'pendente'
    check (status in ('pendente','respondido','expirado')),
  respondido_em timestamptz,
  -- quem cadastrou (o convite é insert direto via policy — o default resolve
  -- sem custo de RPC); não é grant-able, então ninguém forja. Anulável:
  -- insert por service-role não tem JWT → my_profile_id() devolve null
  created_by uuid default public.my_profile_id() references profiles(id),
  created_at timestamptz not null default now()
);
comment on table public.terceiros_contatos is
  'Convite da avaliação por terceiros: pessoa indicada pelo jovem + bearer '
  'token. Deletar convite pendente = cancelar (o token morre com a row).';

create index terceiros_contatos_dupla on public.terceiros_contatos(dupla_id);

create table public.terceiros_respostas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null unique references public.terceiros_contatos(id)
    on delete cascade,
  pontos_fortes text not null check (char_length(pontos_fortes) between 1 and 4000),
  a_melhorar text not null check (char_length(a_melhorar) between 1 and 4000),
  respondido_em timestamptz not null default now()
);
comment on table public.terceiros_respostas is
  '1 resposta por convite, imutável. O mentor lê identificado (ele consolida);'
  ' o jovem nunca lê esta tabela — só o consolidado publicado.';

create table public.terceiros_consolidacao (
  dupla_id uuid primary key references duplas(id) on delete cascade,
  consolidado text check (consolidado is null or char_length(consolidado) <= 8000),
  publicado_em timestamptz,
  escrito_por uuid references profiles(id),
  updated_at timestamptz not null default now()
);
comment on table public.terceiros_consolidacao is
  'Síntese curada pelo mentor — o ÚNICO artefato de terceiros que o jovem '
  'lê, e só quando publicado_em está marcado.';

-- ---------- grants + policies ----------

revoke all on public.terceiros_contatos from public, anon;
revoke all on public.terceiros_respostas from public, anon;
revoke all on public.terceiros_consolidacao from public, anon;

-- o default privilege do supabase concede ALL na tabela inteira — revogo a
-- escrita table-level e re-concedo só o cadastro: status/token/expira_em/
-- respondido_em/created_by ficam exclusivos das RPCs security definer.
revoke insert, update on public.terceiros_contatos from authenticated;
revoke insert, update, delete on public.terceiros_respostas from authenticated;
revoke insert, update, delete on public.terceiros_consolidacao from authenticated;

grant select, delete on public.terceiros_contatos to authenticated;
grant insert (dupla_id, nome, vinculo, whatsapp)
  on public.terceiros_contatos to authenticated;
grant update (nome, vinculo, whatsapp)
  on public.terceiros_contatos to authenticated;
grant select on public.terceiros_respostas to authenticated;
grant select on public.terceiros_consolidacao to authenticated;

alter table public.terceiros_contatos enable row level security;
alter table public.terceiros_respostas enable row level security;
alter table public.terceiros_consolidacao enable row level security;

-- escopo de leitura compartilhado: coord, mentor da dupla, supervisor da dupla.
-- O jovem NÃO lê contatos nem respostas (saber quem respondeu já revela).
create policy terceiros_contatos_select on public.terceiros_contatos
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id()
             or d.supervisor_id = public.my_profile_id())));

-- só dupla DPP viva recebe convite novo (a jornada de terceiros é a semana 1-2)
create policy terceiros_contatos_insert on public.terceiros_contatos
  for insert to authenticated with check (
    (public.my_role() = 'coordenacao'
     or exists (select 1 from duplas d
       where d.id = dupla_id and d.mentor_id = public.my_profile_id()))
    and exists (select 1 from duplas d
      where d.id = dupla_id and d.trilha = 'dpp'
        and d.status in ('ativa','pausada')));

-- cadastro editável enquanto o convite está vivo: pendente corrige e
-- expirado é o caminho de reaproveitar a row (editar + reemitir); depois de
-- respondido a atribuição nome↔resposta é dado histórico e não se mexe
create policy terceiros_contatos_update on public.terceiros_contatos
  for update to authenticated using (
    status in ('pendente','expirado')
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id())))
  with check (
    status in ('pendente','expirado')
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id())));

-- cancelar convite = delete enquanto pendente — vale pra coord também:
-- respondido é dado, não sai por ninguém (o cascade levaria a resposta)
create policy terceiros_contatos_delete on public.terceiros_contatos
  for delete to authenticated using (
    status = 'pendente'
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id())));

create policy terceiros_respostas_select on public.terceiros_respostas
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.terceiros_contatos c
      join duplas d on d.id = c.dupla_id
      where c.id = contato_id
        and (d.mentor_id = public.my_profile_id()
             or d.supervisor_id = public.my_profile_id())));
-- insert só via RPC definer; update/delete: ninguém (resposta é imutável)

create policy terceiros_consolidacao_select on public.terceiros_consolidacao
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id()
             or d.supervisor_id = public.my_profile_id()))
    or (public.my_role() = 'mentorado'
        and publicado_em is not null
        and exists (select 1 from jovem_duplas jd where jd.id = dupla_id)));
-- escrita só via salvar_consolidado_terceiros (upsert + toggle atômicos)

-- ---------- guard: cap 9 por dupla ----------

create or replace function public.guard_terceiros_cap()
returns trigger language plpgsql set search_path to '' as $$
begin
  -- serializa inserts da mesma dupla: dois requests concorrentes liriam o
  -- mesmo count(*) read-committed e os dois passariam do cap
  -- (convenção pg_advisory_xact_lock da 0102/0099)
  perform pg_advisory_xact_lock(hashtext('terceiros_cap:' || new.dupla_id::text));
  if (select count(*) from public.terceiros_contatos
       where dupla_id = new.dupla_id) >= 9 then
    raise exception 'o guia prevê até 9 pessoas indicadas por dupla (3 amigos + 3 familiares + 3 colegas)';
  end if;
  -- o 3+3+3 do guia: sem limite por vínculo o mentor podia indicar 9 amigos
  -- e zero familiares — a diversidade é o ponto do instrumento
  if (select count(*) from public.terceiros_contatos
       where dupla_id = new.dupla_id and vinculo = new.vinculo) >= 3 then
    raise exception 'o guia prevê até 3 pessoas por vínculo (amigos, familiares, colegas)';
  end if;
  return new;
end $$;

create trigger terceiros_contatos_cap
  before insert on public.terceiros_contatos
  for each row execute function public.guard_terceiros_cap();

-- ---------- RPCs públicas por token ----------

-- leitura do convite: suficiente pra página renderizar, sem vazar o resto
create or replace function public.terceiro_por_token(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  select c.id, c.status, c.expira_em, c.nome as convidado_nome,
         coalesce(m.nome_social, m.nome) as jovem_nome
    into v_c
    from public.terceiros_contatos c
    join duplas d on d.id = c.dupla_id
    join mentorados m on m.id = d.mentorado_id
   where c.token = p_token;
  if not found then
    return null;
  end if;
  if v_c.status = 'pendente' and v_c.expira_em < now() then
    update public.terceiros_contatos set status = 'expirado' where id = v_c.id;
    v_c.status := 'expirado';
  end if;
  return jsonb_build_object(
    'status', v_c.status,
    'convidado', jsonb_build_object('nome', v_c.convidado_nome),
    'alvo', jsonb_build_object('jovem_nome', v_c.jovem_nome));
end $$;
grant execute on function public.terceiro_por_token(text) to anon, authenticated;

-- submit: consome o convite atomicamente, grava a resposta e avisa mentor+coord
create or replace function public.submeter_resposta_terceiro(
  p_token text, p_pontos_fortes text, p_a_melhorar text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  if p_pontos_fortes is null or char_length(btrim(p_pontos_fortes)) = 0
     or char_length(p_pontos_fortes) > 4000 then
    raise exception 'responda os pontos fortes (até 4000 caracteres)';
  end if;
  if p_a_melhorar is null or char_length(btrim(p_a_melhorar)) = 0
     or char_length(p_a_melhorar) > 4000 then
    raise exception 'responda os aspectos a melhorar (até 4000 caracteres)';
  end if;

  -- expiração lazy antes do gate (mesmo molde do 0071)
  update public.terceiros_contatos set status = 'expirado'
   where token = p_token and status = 'pendente' and expira_em < now();

  -- gate atômico: só um submit vence a corrida
  update public.terceiros_contatos
     set status = 'respondido', respondido_em = now()
   where token = p_token and status = 'pendente'
  returning id, dupla_id, nome into v_c;
  if not found then
    raise exception 'este link já foi usado ou expirou';
  end if;

  insert into public.terceiros_respostas (contato_id, pontos_fortes, a_melhorar)
  values (v_c.id, btrim(p_pontos_fortes), btrim(p_a_melhorar));

  -- quem respondeu é externo: avisa o mentor (dono da consolidação) + coord.
  -- created_by null — não há usuário autenticado por trás do submit público.
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'terceiro_respondeu', 'Resposta de avaliação por terceiros',
           v_c.nome || ' respondeu sobre ' ||
             (select coalesce(m.nome_social, m.nome) from duplas d
                join mentorados m on m.id = d.mentorado_id
               where d.id = v_c.dupla_id) || '.',
           '/duplas/' || v_c.dupla_id, null
      from (
        select d.mentor_id as id from duplas d
         where d.id = v_c.dupla_id and d.mentor_id is not null
        union
        select p.id from profiles p
         where p.role = 'coordenacao' and p.ativo
      ) dest;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.submeter_resposta_terceiro(text, text, text)
  to anon, authenticated;

-- ---------- RPCs autenticadas ----------

-- reemissão: convite expirado ganha token + prazo novos (o anterior morre —
-- molde regenerar_token_assinatura). Convite pendente devolve o mesmo token.
create or replace function public.reemitir_convite_terceiro(p_contato_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  -- expiração lazy antes de decidir: um 'pendente' já vencido tem que cair
  -- no ramo de rotação — devolver o token morto apagaria o link na hora
  update public.terceiros_contatos set status = 'expirado'
   where id = p_contato_id and status = 'pendente' and expira_em < now();

  -- for update: dois reemites concorrentes não mintam dois tokens
  select c.id, c.dupla_id, c.status, c.token into v_c
    from public.terceiros_contatos c where c.id = p_contato_id
    for update;
  if not found then
    raise exception 'convite não encontrado';
  end if;
  if public.my_role() is distinct from 'coordenacao'
     and not exists (select 1 from duplas d
       where d.id = v_c.dupla_id and d.mentor_id = public.my_profile_id()) then
    raise exception 'convite não encontrado';
  end if;
  if v_c.status = 'pendente' then
    return jsonb_build_object('token', v_c.token, 'reutilizado', true);
  end if;
  if v_c.status = 'respondido' then
    raise exception 'esta pessoa já respondeu';
  end if;
  update public.terceiros_contatos
     set token = translate(encode(extensions.gen_random_bytes(24),'base64'),'+/=','-_'),
         expira_em = now() + interval '30 days',
         status = 'pendente', respondido_em = null
   where id = v_c.id
  returning token into v_c.token;
  return jsonb_build_object('token', v_c.token, 'reutilizado', false);
end $$;
revoke execute on function public.reemitir_convite_terceiro(uuid) from public, anon;
grant execute on function public.reemitir_convite_terceiro(uuid) to authenticated;

-- consolidado: o mentor escreve a síntese e decide quando o jovem a vê
create or replace function public.salvar_consolidado_terceiros(
  p_dupla_id uuid, p_consolidado text, p_publicar boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  -- mesmo gate da insert policy: a avaliação por terceiros é instrumento DPP
  -- — sem isso um mentor_especialista publicava consolidado na própria dupla
  -- e a select policy do jovem (via jovem_duplas, sem filtro de trilha)
  -- deixava o mentorando da trilha especialista ler
  if public.my_role() is distinct from 'coordenacao'
     and not exists (select 1 from duplas d
       where d.id = p_dupla_id and d.mentor_id = public.my_profile_id()
             and d.trilha = 'dpp') then
    raise exception 'dupla não encontrada';
  end if;
  if not exists (select 1 from duplas d
       where d.id = p_dupla_id and d.trilha = 'dpp') then
    raise exception 'dupla não encontrada';
  end if;
  if p_publicar and (p_consolidado is null
      or char_length(btrim(p_consolidado)) = 0) then
    raise exception 'escreva a consolidação antes de publicar';
  end if;
  insert into public.terceiros_consolidacao
         (dupla_id, consolidado, publicado_em, escrito_por, updated_at)
  values (p_dupla_id, nullif(btrim(p_consolidado), ''),
          case when p_publicar then now() else null end,
          public.my_profile_id(), now())
  on conflict (dupla_id) do update set
    consolidado = excluded.consolidado,
    -- publicar marca; despublicar limpa; re-publicar preserva o 1º carimbo
    publicado_em = case
      when p_publicar then coalesce(terceiros_consolidacao.publicado_em, now())
      else null end,
    escrito_por = public.my_profile_id(),
    updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.salvar_consolidado_terceiros(uuid, text, boolean)
  from public, anon;
grant execute on function public.salvar_consolidado_terceiros(uuid, text, boolean)
  to authenticated;

-- ---------- CHECKs de tipos ----------

alter table notificacoes drop constraint notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada', 'especialista_aceitou',
    'solicitacao_cancelada', 'trilha_encerrada', 'supervisao_registrada',
    'formulario_respondido', 'avaliacao_pendente', 'apoio_jovem',
    'encontro_marcado', 'encontro_alterado', 'encontro_desfeito',
    'solicitacao_triagem', 'solicitacao_recusada', 'solicitacao_proposta',
    'chamado_aberto', 'chamado_atribuido', 'chamado_atualizacao',
    'chamado_resposta_autor', 'chamado_resolvido', 'chamado_reaberto',
    'chamado_mencao', 'sugestao_especialista', 'devolutiva_especialista',
    'lembrete', 'dupla_reta_final', 'terceiro_respondeu'
  ]));

commit;

-- rollback manual:
-- alter table notificacoes drop constraint notificacoes_tipo_check;
-- alter table notificacoes add constraint notificacoes_tipo_check check (
--   tipo = any (array[<lista anterior, ver 0102]>));
-- drop function salvar_consolidado_terceiros, reemitir_convite_terceiro,
--   submeter_resposta_terceiro, terceiro_por_token, guard_terceiros_cap;
-- drop table terceiros_consolidacao, terceiros_respostas, terceiros_contatos;
