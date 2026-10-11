-- REALIZA-110 / D3 — agenda livre DPP: o jovem agenda/remarca/desmarca pelo
-- RPC definer (nunca policy branch — write irrestrito bypassaria aceite,
-- colunas e trilha). O outro lado é notificado por trigger em encontros:
-- cobre action, RPC, retroativo e PATCH direto, num lugar só.

-- 1) duracao_min 30–120 era só app-level (actions.ts) — CHECK no banco.
alter table encontros
  add constraint encontros_duracao_faixa
  check (duracao_min is null or duracao_min between 30 and 120);

-- 2) tipos novos de notificação de agenda
alter table notificacoes drop constraint notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check check (
  tipo in ('comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem',
    'encontro_marcado','encontro_alterado','encontro_desfeito')
);

-- 3a) oracle definer pro ramo mentor↔mentorado — policy não pode referenciar
--     `mentorados` direto: `authenticated` não tem SELECT grant nela, e o
--     Postgres checa privilégio de TODA tabela do plano (não há short-circuit
--     nos ramos OR) → todo insert de não-privilegiado tomaria 42501. Mesma
--     lição das views jovem_* da 0068: pertencimento entra via definer.
create or replace function par_de_mim(p_profile uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from duplas d
    join mentorados m on m.id = d.mentorado_id
    where (d.mentor_id = my_profile_id() and m.profile_id = p_profile)
       or (m.profile_id = my_profile_id() and d.mentor_id = p_profile));
$$;
grant execute on function par_de_mim(uuid) to authenticated;

-- 3b) ramo mentor↔mentorado em notificacoes_insert — o trigger é definer
--    (bypassa), o ramo cobre inserts diretos futuros e documenta o contrato:
--    destinatário tem que ser o outro lado de uma dupla do autor.
drop policy notificacoes_insert on notificacoes;
create policy notificacoes_insert on notificacoes for insert with check (
  my_role() = 'coordenacao'
  or (created_by = my_profile_id() and (
    -- ramo agenda: mentor↔mentorado do mesmo par (qualquer trilha)
    (tipo in ('encontro_marcado','encontro_alterado','encontro_desfeito')
      and par_de_mim(notificacoes.profile_id))
    or (tipo = 'pedido_apoio'
      and exists (select 1 from profiles p
        where p.id = notificacoes.profile_id
          and p.role in ('coordenacao','supervisor')))
    or (tipo = 'pedido_apoio' and my_role() = 'mentorado'
      and exists (select 1 from jovem_contatos jc where jc.id = notificacoes.profile_id))
    or (tipo = 'demanda_especialista'
      and exists (select 1 from profiles p
        where p.id = notificacoes.profile_id and p.role = 'mentor_especialista'))
    or (tipo in ('solicitacao_registrada','solicitacao_cancelada')
      and exists (select 1 from profiles p
        where p.id = notificacoes.profile_id and p.role = 'coordenacao'))
    or (tipo = 'especialista_aceitou' and my_role() = 'mentor_especialista'
      and (exists (select 1 from profiles p
             where p.id = notificacoes.profile_id and p.role = 'coordenacao')
        or exists (select 1 from solicitacoes_especialista s
             where s.created_by = notificacoes.profile_id
               and s.especialista_id = my_profile_id())))
    or (tipo = 'trilha_encerrada' and my_role() = 'mentor_especialista'
      and (exists (select 1 from profiles p
             where p.id = notificacoes.profile_id and p.role = 'coordenacao')
        or exists (select 1 from solicitacoes_especialista s
             where s.created_by = notificacoes.profile_id
               and s.especialista_id = my_profile_id())))
    or (tipo = 'supervisao_registrada' and my_role() = 'supervisor'
      and exists (select 1 from supervisoes s
        where s.supervisor_id = my_profile_id()
          and s.mentor_id = notificacoes.profile_id))
  ))
);

-- 4) trigger de notificação de agenda — INSERT/UPDATE/DELETE em encontros.
--    Ator = my_profile_id() (nunca created_by, imutável por guard_autoria).
--    Ator=mentor → avisa o jovem; ator=jovem → avisa o mentor/especialista;
--    ator=coord/terceiro → avisa os dois lados. Jovem sem profile não tem
--    sino — só o lado adulto recebe. Definer: insert sob RLS do caller falharia.
create or replace function encontro_notifica_agenda()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_ator     uuid := my_profile_id();
  v_dupla    uuid := coalesce(new.dupla_id, old.dupla_id);
  v_mentor   uuid;
  v_jovem    uuid;              -- profile do mentorado (pode ser null)
  v_tipo     text;
  v_titulo   text;
  v_corpo    text;
  v_ator_nome text;
  v_enc      uuid := coalesce(new.id, old.id);
  v_numero   int  := coalesce(new.numero, old.numero);
  v_quando   timestamptz := coalesce(new.data_hora, old.data_hora);
  v_dest     record;
begin
  if current_setting('realiza.no_notify', true) = 'on' then
    return coalesce(new, old);
  end if;

  select d.mentor_id, m.profile_id into v_mentor, v_jovem
    from duplas d join mentorados m on m.id = d.mentorado_id
   where d.id = v_dupla;

  -- quem agiu vira "o outro lado" do destinatário; sem ator resolvido
  -- (service role/seed) o corpo credita a coordenação, não um vazio
  select coalesce(p.nome_social, p.nome) into v_ator_nome
    from profiles p where p.id = v_ator;
  v_ator_nome := coalesce(v_ator_nome, 'A coordenação');

  if tg_op = 'INSERT' then
    -- born-realizado (retroativo) não é "marcado" — a 0071 cuida do prompt
    if new.status <> 'agendado' then return new; end if;
    v_tipo := 'encontro_marcado';
    v_titulo := format('%sº encontro marcado', v_numero);
    v_corpo := format('%s marcou para %s.', v_ator_nome,
      to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'));
  elsif tg_op = 'DELETE' then
    v_tipo := 'encontro_desfeito';
    v_titulo := format('%sº encontro desmarcado', v_numero);
    v_corpo := format('%s desmarcou o encontro de %s.', v_ator_nome,
      to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM'));
  else
    -- UPDATE: três saídas — alterou data/link ainda agendado; virou
    -- nao_aconteceu; ou ressurgiu agendado (remarcação após falta)
    if new.status = 'agendado' and old.status = 'agendado'
       and (new.data_hora is distinct from old.data_hora
            or new.link is distinct from old.link) then
      v_tipo := 'encontro_alterado';
      v_titulo := format('%sº encontro alterado', v_numero);
      -- data mudou = remarcação (corpo leva motivo); só o link mudou = outro
      -- evento ("atualizou o link") — dizer "moveu" com a mesma data engana
      if new.data_hora is distinct from old.data_hora then
        v_corpo := format('%s moveu para %s.%s', v_ator_nome,
          to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
          case when new.motivo_reagendamento is not null
            then ' Motivo: ' || new.motivo_reagendamento else '' end);
      else
        v_corpo := format('%s atualizou o link do encontro de %s.', v_ator_nome,
          to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM'));
      end if;
    elsif new.status = 'nao_aconteceu' and old.status = 'agendado' then
      v_tipo := 'encontro_desfeito';
      v_titulo := format('%sº encontro não aconteceu', v_numero);
      v_corpo := format('%s marcou que o encontro de %s não aconteceu.',
        v_ator_nome,
        to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM'));
    elsif new.status = 'agendado' and old.status <> 'agendado' then
      -- ressurgiu de nao_aconteceu (desfazer/remarcar) = novo marcado
      v_tipo := 'encontro_marcado';
      v_titulo := format('%sº encontro remarcado', v_numero);
      v_corpo := format('%s remarcou para %s.', v_ator_nome,
        to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'));
    else
      return new; -- realizado e cia.: fora do escopo (0071 cuida do prompt)
    end if;
  end if;

  -- destinatários: o "outro lado" do ator; ator fora do par (coord) → os dois.
  -- jovem sem profile_id some do select sozinho (não é destino de sino).
  for v_dest in
    select p.id, p.role from profiles p
     where p.id = any (array[v_mentor, v_jovem])
       and p.id is distinct from v_ator
  loop
    -- dedup: não-lida de mesmo (destino, tipo, corpo) já cobre o evento —
    -- o corpo carrega nº+data, então encontros distintos não se colidem
    if not exists (select 1 from notificacoes n
      where n.profile_id = v_dest.id and n.tipo = v_tipo
        and n.corpo = v_corpo and n.lida_em is null) then
      insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
      values (v_dest.id, v_tipo, v_titulo, v_corpo,
        case when v_dest.role = 'mentorado'
             then '/jovem/agenda' else '/duplas/' || v_dupla end,
        v_ator);
    end if;
  end loop;
  return coalesce(new, old);
end $$;

create trigger encontros_agenda_notify
  after insert or update or delete on encontros
  for each row execute function encontro_notifica_agenda();

-- 5) RPC do jovem: agendar/remarcar encontro DPP (upsert por (dupla,numero)).
--    Espelha agendarEncontro: futuro, link http(s), motivo quando muda a data.
--    Não ressuscita nao_aconteceu nem toca realizado; numero medido contra o
--    cronograma DA DUPLA. origem='plataforma' — externo é o caminho retroativo
--    do mentor, não do jovem.
create or replace function agendar_encontro_mentorado(
  p_dupla uuid, p_numero int, p_data_hora timestamptz,
  p_link text default null, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_d duplas%rowtype;
  v_existente encontros%rowtype;
  v_max int;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error','Só o mentorado agenda por aqui.');
  end if;
  select * into v_d from duplas d
   where d.id = p_dupla and d.trilha = 'dpp' and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = d.id);
  if not found then
    return jsonb_build_object('error','Dupla não encontrada ou não está ativa.');
  end if;
  if v_d.cronograma_id is null then
    return jsonb_build_object('error','Essa dupla está sem cronograma — a coordenação vincula um.');
  end if;

  select max(ev.numero) into v_max from ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if p_numero is null or p_numero < 1 or p_numero > coalesce(v_max,16) then
    return jsonb_build_object('error','Escolha um encontro da lista.');
  end if;
  if p_data_hora is null or p_data_hora <= now() then
    return jsonb_build_object('error','Agendamento é sempre pra frente — escolha uma data futura.');
  end if;
  if p_link is not null and p_link !~ '^https?://' then
    return jsonb_build_object('error','Confira o link: precisa ser um endereço completo (https://…).');
  end if;

  select * into v_existente from encontros e
   where e.dupla_id = p_dupla and e.numero = p_numero;
  if v_existente.status = 'realizado' then
    return jsonb_build_object('error','Esse encontro já foi realizado.');
  end if;
  if v_existente.status = 'nao_aconteceu' then
    return jsonb_build_object('error','Esse encontro foi marcado como não realizado — converse com seu mentor pra remarcar.');
  end if;

  -- remarcação de verdade = a data mudou → motivo obrigatório (mesma regra
  -- da action do mentor; edição que não muda a data não exige motivo)
  if v_existente.id is not null
     and v_existente.data_hora is distinct from p_data_hora then
    if p_motivo is null or char_length(trim(p_motivo)) < 2 then
      return jsonb_build_object('error','Conte o motivo do reagendamento.');
    end if;
  elsif p_motivo is not null and char_length(trim(p_motivo)) > 1000 then
    return jsonb_build_object('error','Motivo muito longo (máx. 1000 caracteres).');
  end if;

  if v_existente.id is not null then
    update encontros set
      data_hora = p_data_hora,
      link = p_link,
      motivo_reagendamento = coalesce(trim(p_motivo), motivo_reagendamento)
    where id = v_existente.id and status = 'agendado';
    if not found then
      return jsonb_build_object('error','Esse encontro não está mais agendado.');
    end if;
  else
    insert into encontros (dupla_id, numero, data_hora, link, status, origem,
                           motivo_reagendamento, created_by)
    values (p_dupla, p_numero, p_data_hora, p_link, 'agendado', 'plataforma',
            nullif(trim(p_motivo),''), my_profile_id());
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function agendar_encontro_mentorado(uuid,int,timestamptz,text,text) to authenticated;

-- 6) RPC do jovem: "não aconteceu" — DPP e especialista (a trilha especialista
--    resolve o especialista-fantasma; o refund é semântico — nao_aconteceu não
--    consome sessão e o nº volta a ser o próximo alvo). Só agendado + passado.
create or replace function marcar_nao_aconteceu_mentorado(p_encontro uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_e encontros%rowtype;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error','Só o mentorado marca por aqui.');
  end if;
  select e.* into v_e from encontros e
   join duplas d on d.id = e.dupla_id
   where e.id = p_encontro and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = e.dupla_id);
  if not found then
    return jsonb_build_object('error','Encontro não encontrado ou dupla inativa.');
  end if;
  if v_e.data_hora > now() then
    return jsonb_build_object('error','Esse encontro ainda não aconteceu.');
  end if;
  update encontros set status = 'nao_aconteceu'
   where id = p_encontro and status = 'agendado';
  if not found then
    return jsonb_build_object('error','Esse encontro não está mais agendado.');
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function marcar_nao_aconteceu_mentorado(uuid) to authenticated;

-- 7) desmarcar = DELETE do agendado (bilateral — o modelo é edição livre dos
--    dois lados, e o trigger registra quem desfez). cancelado/remarcado do
--    enum seguem reservados: DELETE preserva o nº oficial da trilha.
create or replace function desmarcar_encontro(p_encontro uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_e encontros%rowtype;
  v_membro boolean;
begin
  select * into v_e from encontros where id = p_encontro;
  if not found then
    return jsonb_build_object('error','Encontro não encontrado.');
  end if;
  select coalesce((
    d.mentor_id = my_profile_id()
    or exists (select 1 from jovem_duplas jd where jd.id = d.id)
    or my_role() = 'coordenacao'
  ), false) into v_membro from duplas d where d.id = v_e.dupla_id;
  if not v_membro then
    return jsonb_build_object('error','Encontro não encontrado.');
  end if;
  -- passado não se apaga: agendado já vencido é limbo — o caminho honesto é
  -- 'nao_aconteceu' (mantém o sinal no semáforo), não sumir com o rastro
  delete from encontros where id = p_encontro and status = 'agendado'
    and data_hora > now();
  if not found then
    return jsonb_build_object('error','Só encontro agendado futuro pode ser desmarcado — se a data passou, marque como não realizado.');
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function desmarcar_encontro(uuid) to authenticated;

-- 8) warning de overlap — definer porque o mentor DPP não lê os encontros da
--    trilha especialista do mesmo jovem (RLS) e a checagem no client seria
--    decorativa. Caller precisa ser lado da dupla (mentor/jovem) ou coord.
create or replace function conflito_encontro(p_dupla uuid, p_data_hora timestamptz)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_mentorado uuid;
begin
  select d.mentorado_id into v_mentorado from duplas d
   where d.id = p_dupla
     and (d.mentor_id = my_profile_id()
          or exists (select 1 from jovem_duplas jd where jd.id = d.id)
          or my_role() = 'coordenacao');
  if v_mentorado is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', e.numero, 'data_hora', e.data_hora, 'trilha', d.trilha))
      from encontros e join duplas d on d.id = e.dupla_id
     where d.mentorado_id = v_mentorado and d.id <> p_dupla
       and e.status = 'agendado'
       and abs(extract(epoch from (e.data_hora - p_data_hora))) < 3600
  ), '[]'::jsonb);
end $$;
grant execute on function conflito_encontro(uuid,timestamptz) to authenticated;
