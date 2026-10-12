begin;

-- 0074: solicitações de especialista v2 — pedido por sessão, iniciado pelo jovem.
--
-- Modelo novo (REALIZA-112):
--   TODA sessão de especialista = uma solicitacao_especialista. A primeira do
--   par é o "gate" (demanda rica); sessões 2-5 são slot-only. O encontro só
--   nasce no aceite — n solicitações alimentam UMA dupla especialista.
--   O jovem pode pedir direto (origem='jovem'): com dupla DPP o pedido já vai
--   'aberta' e o mentor DPP é notificado como adulto de referência; sem DPP
--   o pedido entra 'aguardando_coord' e a triagem da coordenação define a
--   turma antes de liberar pro mural/especialista.
--
-- Decisões travadas com o Thiago:
--   - teto de 3 trilhas de especialista simultâneas por jovem;
--   - pedido staff sem slot: o especialista escolhe o horário NO ACEITE;
--   - nome do jovem visível no mural broadcast; pedido dirigido só alcança
--     o destinatário (o vazamento do mural era correção obrigatória);
--   - budget 5 sessões por PAR na mesma turma, somando TODAS as duplas do
--     par (anti-reset por reengajamento). Consome no aceite; devolve por
--     regra de contagem — status fora de (agendado, remarcado, realizado)
--     já exclui a linha, então recusa/cancelamento/nao_aconteceu não
--     precisam de RPC de refund separada;
--   - expiração lazy: pedido pendente com slot no passado lê 'expirada'
--     (status_efetivo) sem writer — pg_cron não existe em prod;
--   - contra-propostas em thread append-only (solicitacao_propostas), máx.
--     4 propostas — depois disso a RPC manda combinar por outro canal;
--   - encontros.numero passa a ser a TENTATIVA (não o passo do guia): um
--     nao_aconteceu não queima passo — o rank entre realizados vira o passo
--     (mudança no app); por isso o teto sobe 16→24;
--   - duracao_min vira whitelist (30/45/60/90/120) no banco, não só no app.
--
-- Atomicidade: tudo numa transaction — dupla_dpp_id nullable muda trigger,
-- aceite, unique, policies e views de uma vez; fatiar deixaria invariante
-- quebrado no meio do caminho.

-- 1) colunas novas + dupla_dpp_id/demanda nullable -------------------------

alter table public.solicitacoes_especialista
  alter column dupla_dpp_id drop not null,
  alter column demanda drop not null,
  add column if not exists origem text,
  add column if not exists motivo text,
  add column if not exists justificativa_recusa text,
  add column if not exists turma text;

update public.solicitacoes_especialista set origem = 'staff' where origem is null;
alter table public.solicitacoes_especialista
  alter column origem set not null,
  alter column origem set default 'staff';

-- legado: a turma da solicitação vinha sempre da dupla DPP no aceite
update public.solicitacoes_especialista s
   set turma = d.turma
  from public.duplas d
 where d.id = s.dupla_dpp_id and s.turma is null;

-- 2) CHECKs -----------------------------------------------------------------

alter table public.solicitacoes_especialista
  drop constraint if exists solicitacoes_especialista_status_check,
  add constraint solicitacoes_especialista_status_check check (
    status in ('aberta','aguardando_coord','contra_proposta',
               'aceita','recusada','cancelada','expirada')),
  drop constraint if exists solicitacoes_especialista_demanda_check,
  add constraint solicitacoes_especialista_demanda_check check (
    demanda is null or char_length(btrim(demanda)) between 10 and 1000),
  add constraint solicitacoes_origem_check check (origem in ('staff','jovem')),
  add constraint solicitacoes_motivo_check check (
    motivo is null or char_length(btrim(motivo)) between 3 and 500),
  add constraint solicitacoes_recusa_check check (
    justificativa_recusa is null
    or char_length(btrim(justificativa_recusa)) between 3 and 500);

alter table public.encontros
  drop constraint if exists encontros_duracao_faixa,
  add constraint encontros_duracao_faixa check (
    duracao_min is null or duracao_min in (30, 45, 60, 90, 120)),
  -- numero é tentativa: nao_aconteceu não queima passo, então o ordinal pode
  -- passar dos 5 do guia. 24 é folga honesta (budget capa as vivas em 5).
  drop constraint if exists encontros_numero_faixa,
  add constraint encontros_numero_faixa check (numero between 1 and 24);

-- 3) índices -----------------------------------------------------------------

-- n solicitações apontam pra mesma dupla (sessões 2-5) — a unique morre
drop index if exists public.solicitacoes_dupla_uk;

drop index if exists public.solicitacoes_status_idx;
create index solicitacoes_status_idx on public.solicitacoes_especialista (status)
  where status in ('aberta','aguardando_coord','contra_proposta');

-- a unique antiga era (mentorado_id, trilha): travava o jovem a UMA trilha
-- especialista. Agora: uma dupla DPP por jovem (como antes) e uma dupla por
-- PAR especialista; o teto de 3 trilhas fica nas RPCs (índice não conta).
drop index if exists public.duplas_mentorado_ativa_key;
create unique index duplas_mentorado_dpp_uk on public.duplas (mentorado_id)
  where status in ('ativa','pausada') and coalesce(trilha, 'dpp') = 'dpp';
create unique index duplas_mentorado_esp_uk on public.duplas (mentorado_id, mentor_id)
  where status in ('ativa','pausada') and trilha = 'especialista';

-- 4) thread de propostas (append-only) ---------------------------------------

create table if not exists public.solicitacao_propostas (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_especialista (id) on delete cascade,
  autor_id uuid not null references public.profiles (id),
  slot_proposto timestamptz not null,
  mensagem text check (mensagem is null or char_length(btrim(mensagem)) between 3 and 500),
  created_at timestamptz not null default now()
);
create index if not exists solicitacao_propostas_sol
  on public.solicitacao_propostas (solicitacao_id, created_at desc);

alter table public.solicitacao_propostas enable row level security;
revoke all on public.solicitacao_propostas from public, anon;
grant select on public.solicitacao_propostas to authenticated;

-- quem vê a thread: as partes da negociação + quem vê a solicitação pai
create policy prop_select on public.solicitacao_propostas for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.solicitacoes_especialista s
    where s.id = solicitacao_id
      and (s.created_by = public.my_profile_id()
        or s.especialista_id = public.my_profile_id()
        or s.especialista_desejado_id = public.my_profile_id()
        or s.mentorado_id = public.my_mentorado_id()
        or exists (
          select 1 from public.duplas d
          where d.id = s.dupla_dpp_id
            and (d.mentor_id = public.my_profile_id()
              or d.supervisor_id = public.my_profile_id())))));
-- sem policy/grant de insert: só as RPCs definer escrevem — append-only de
-- verdade, ninguém reescreve a negociação por PostgREST.

-- 5) integridade v2 -----------------------------------------------------------
-- diferenças vs. 0029: dupla_dpp_id nullable (mentorado_id vira referência
-- direta — a derivação server-side mora nas RPCs), NULL-safe com IS DISTINCT
-- FROM em tudo (o <> antigo engolia mudança de/para NULL), e o gate de
-- demanda aqui vale pros DOIS caminhos de insert (policy do staff + RPC do
-- jovem — a RPC já valida, mas o trigger é a última linha pra qualquer outro
-- caminho de escrita).

create or replace function public.solicitacao_integridade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.dupla_dpp_id is not null
       and new.mentorado_id is distinct from (
         select d.mentorado_id from public.duplas d where d.id = new.dupla_dpp_id
       ) then
      raise exception 'mentorado_id diverge do mentorado da dupla';
    end if;
    if new.especialista_desejado_id is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.especialista_desejado_id
        and p.role = 'mentor_especialista' and p.ativo
    ) then
      raise exception 'especialista de destino inválido';
    end if;
    if new.dupla_id is not null and not exists (
      select 1 from public.duplas d
      where d.id = new.dupla_id and d.trilha = 'especialista'
        and d.mentorado_id = new.mentorado_id
    ) then
      raise exception 'dupla de destino inválida';
    end if;
    -- gate sem demanda: pedido que NÃO encosta num par existente precisa do
    -- porquê; pedido de sessão seguinte (dupla_id ou par já ativo) é slot-only
    if new.demanda is null and new.dupla_id is null and not exists (
      select 1 from public.duplas d
      where d.mentorado_id = new.mentorado_id and d.trilha = 'especialista'
        and d.status in ('ativa','pausada')
        and (new.especialista_desejado_id is null
             or d.mentor_id = new.especialista_desejado_id)
    ) then
      raise exception 'pedido novo precisa de demanda';
    end if;
    -- autoria não se forja (service role/seed roda sem role e passa reto)
    if public.my_role() is not null and public.my_role() <> 'coordenacao' then
      if new.created_by is distinct from public.my_profile_id() then
        raise exception 'created_by tem que ser o autor';
      end if;
      if new.origem = 'jovem' and public.my_role() <> 'mentorado' then
        raise exception 'origem jovem exige autor mentorado';
      end if;
      if new.origem = 'staff' and public.my_role() = 'mentorado' then
        raise exception 'jovem não cria pedido como staff';
      end if;
      if new.status not in ('aberta','aguardando_coord') then
        raise exception 'status inicial inválido';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: pra não-coord os campos de identidade/conteúdo são imutáveis.
  -- As RPCs rodam com a role do chamador, então o que elas mexem é só
  -- status/slot_proposto/respondida_em/especialista_id/dupla_id/
  -- justificativa_recusa — exatamente os campos que ficam de fora aqui.
  if public.my_role() is not null and public.my_role() <> 'coordenacao' then
    if new.mentorado_id is distinct from old.mentorado_id
       or new.dupla_dpp_id is distinct from old.dupla_dpp_id
       or new.demanda is distinct from old.demanda
       or new.motivo is distinct from old.motivo
       or new.origem is distinct from old.origem
       or new.turma is distinct from old.turma
       or new.created_by is distinct from old.created_by
       or new.especialista_desejado_id is distinct from old.especialista_desejado_id then
      raise exception 'campos da solicitação são imutáveis';
    end if;
  end if;
  return new;
end $$;

-- 6) policies -----------------------------------------------------------------

-- sol_insert (0028) continua: staff entra por policy, sempre 'aberta' e sem
-- slot — quem define o horário de pedido staff é o especialista no aceite.
-- O jovem NÃO tem ramo de insert: ele só cria via pedir_especialista_jovem
-- (definer), que deriva mentorado_id/created_by no servidor.

-- sol_update quase congelada: coordenação edita livre (triagem é dela);
-- todo o resto só anda dentro das RPCs, que ligam a flag transaction-local.
drop policy if exists sol_update on public.solicitacoes_especialista;
create policy sol_update on public.solicitacoes_especialista for update using (
  public.my_role() = 'coordenacao'
  or current_setting('realiza.sol_transicao', true) = 'on'
) with check (
  public.my_role() = 'coordenacao'
  or current_setting('realiza.sol_transicao', true) = 'on'
);

-- sol_select v2: o ramo especialista ganha o escopo dirigido (o vazamento do
-- mural — pedido destinado a UM especialista aparecia no pool inteiro) e os
-- estados novos; jovem/autor veem os próprios pedidos.
drop policy if exists sol_select on public.solicitacoes_especialista;
create policy sol_select on public.solicitacoes_especialista for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id
      and (d.mentor_id = public.my_profile_id()
        or d.supervisor_id = public.my_profile_id()))
  or (public.my_role() = 'mentor_especialista'
      and status in ('aberta','contra_proposta')
      and (especialista_desejado_id is null
           or especialista_desejado_id = public.my_profile_id()))
  or especialista_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and mentorado_id = public.my_mentorado_id()));

-- mural v2: mesmas linhas da policy + colunas novas + status_efetivo (lazy
-- expiry na leitura — respondida_em continua null, o pedido "expirou" sem
-- writer) + nome do especialista engajado (o autor vê com quem negocia).
-- drop+create: or replace não reordena/renomeia colunas; os grants voltam abaixo
drop view if exists public.solicitacoes_mural;
create view public.solicitacoes_mural as
select
  s.id,
  s.mentorado_id,
  s.dupla_dpp_id,
  s.demanda,
  s.motivo,
  s.especialista_desejado_id,
  s.especialista_id,
  s.dupla_id,
  s.status,
  case
    when s.status in ('aberta','contra_proposta')
         and s.slot_proposto is not null
         and s.slot_proposto <= now() then 'expirada'
    else s.status
  end as status_efetivo,
  s.slot_proposto,
  s.origem,
  s.turma,
  s.justificativa_recusa,
  s.created_by,
  s.created_at,
  s.respondida_em,
  m.nome as mentorado_nome,
  p.nome as especialista_nome,
  ed.devolutiva_pdm,
  ed.encerrada_em as trilha_encerrada_em
from public.solicitacoes_especialista s
join public.mentorados m on m.id = s.mentorado_id
left join public.profiles p on p.id = s.especialista_id
left join public.duplas ed on ed.id = s.dupla_id
where
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = s.dupla_dpp_id
      and (d.mentor_id = public.my_profile_id()
        or d.supervisor_id = public.my_profile_id()))
  or (s.status in ('aberta','contra_proposta')
      and public.my_role() = 'mentor_especialista'
      and (s.especialista_desejado_id is null
           or s.especialista_desejado_id = public.my_profile_id()))
  or s.especialista_id = public.my_profile_id()
  or s.created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and s.mentorado_id = public.my_mentorado_id());

revoke all on public.solicitacoes_mural from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.solicitacoes_mural from authenticated;
grant select on public.solicitacoes_mural to authenticated;

-- 7) helper privado de notificação -------------------------------------------

create or replace function public.sol_notificar(
  p_profile uuid, p_tipo text, p_titulo text, p_corpo text, p_href text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_profile is null then return; end if;
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href)
  values (p_profile, p_tipo, p_titulo, p_corpo, p_href);
end $$;
revoke all on function public.sol_notificar(uuid, text, text, text, text)
  from public, anon, authenticated;

-- destinatários de coordenação (pedidos do jovem e broadcast sempre passam
-- pelo radar deles — a coord é o adulto de referência quando não há DPP)
create or replace function public.sol_coords()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where role = 'coordenacao' and ativo
$$;
revoke all on function public.sol_coords() from public, anon, authenticated;

-- 8) criar pedido (jovem) ------------------------------------------------------
-- Identidade derivada no servidor: mentorado_id e created_by NUNCA vêm do
-- cliente. Gate = pedido sem par existente → demanda obrigatória (o trigger
-- revalida); follow-up num par ativo → slot-only.
create or replace function public.pedir_especialista_jovem(
  p_especialista_id uuid default null,
  p_demanda text default null,
  p_motivo text default null,
  p_slot timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  meu uuid := public.my_profile_id();
  ment uuid := public.my_mentorado_id();
  v_dpp record;
  v_dupla uuid;
  v_status text;
  v_id uuid;
  v_nome text;
  v_dest uuid;
begin
  if public.my_role() is distinct from 'mentorado' or ment is null then
    raise exception 'Só jovens mentorados podem pedir um especialista';
  end if;

  -- teto de trilhas simultâneas
  if (select count(*) from public.duplas d
      where d.mentorado_id = ment and d.trilha = 'especialista'
        and d.status in ('ativa','pausada')) >= 3 then
    raise exception 'Você já tem o máximo de trilhas de especialista em andamento';
  end if;

  -- dedup: um pedido aberto por par alvo; teto de abertos no total
  if p_especialista_id is not null and exists (
    select 1 from public.solicitacoes_especialista s
    where s.mentorado_id = ment and s.status in ('aberta','aguardando_coord','contra_proposta')
      and coalesce(s.especialista_desejado_id, s.especialista_id) = p_especialista_id
  ) then
    raise exception 'Você já tem um pedido em aberto com esse especialista';
  end if;
  if (select count(*) from public.solicitacoes_especialista s
      where s.mentorado_id = ment
        and s.status in ('aberta','aguardando_coord','contra_proposta')) >= 3 then
    raise exception 'Você já tem pedidos demais em aberto — espere uma resposta';
  end if;

  if p_especialista_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_especialista_id and p.role = 'mentor_especialista' and p.ativo
  ) then
    raise exception 'Especialista não encontrado';
  end if;

  -- slot só dirigido, no futuro e dentro da grade REAL do especialista
  if p_slot is not null then
    if p_especialista_id is null then
      raise exception 'Escolha um especialista pra propor um horário';
    end if;
    if p_slot <= now() then
      raise exception 'O horário precisa ser no futuro';
    end if;
    if not public.especialista_slot_livre(p_especialista_id, p_slot) then
      raise exception 'Esse horário não está na agenda dele — escolha um dos horários livres';
    end if;
  end if;

  -- follow-up: já existe dupla desse par → pedido é slot-only e nasce apontando
  -- pra ela; sem par → gate (demanda obrigatória, o trigger revalida)
  if p_especialista_id is not null then
    select d.id into v_dupla from public.duplas d
     where d.mentor_id = p_especialista_id and d.mentorado_id = ment
       and d.trilha = 'especialista' and d.status in ('ativa','pausada');
  end if;

  -- dupla DPP ativa do jovem: vira o vínculo do pedido (visibilidade do mentor
  -- DPP + turma). Sem ela o pedido entra na fila de triagem da coordenação.
  select d.id, d.turma into v_dpp from public.duplas d
   where d.mentorado_id = ment and coalesce(d.trilha,'dpp') = 'dpp'
     and d.status = 'ativa'
   limit 1;
  v_status := case when v_dpp.id is null then 'aguardando_coord' else 'aberta' end;

  insert into public.solicitacoes_especialista (
    dupla_dpp_id, mentorado_id, demanda, motivo, especialista_desejado_id,
    slot_proposto, origem, status, turma, dupla_id, created_by
  ) values (
    v_dpp.id, ment, nullif(btrim(p_demanda),''), nullif(btrim(p_motivo),''),
    p_especialista_id, p_slot, 'jovem', v_status, v_dpp.turma, v_dupla, meu
  ) returning id into v_id;

  select nome into v_nome from public.mentorados where id = ment;

  if v_status = 'aguardando_coord' then
    for v_dest in select * from public.sol_coords() loop
      perform public.sol_notificar(v_dest, 'solicitacao_triagem',
        'Pedido de especialista pra triagem',
        v_nome || ' pediu apoio de especialista e não tem dupla DPP — defina a turma pra liberar.',
        '/');
    end loop;
  else
    if p_especialista_id is not null then
      perform public.sol_notificar(p_especialista_id, 'demanda_especialista',
        'Novo pedido de sessão',
        v_nome || ' pediu uma sessão com você.',
        '/');
    end if;
    -- mentor DPP é o adulto de referência quando a dupla existe
    if v_dpp.id is not null then
      perform public.sol_notificar(
        (select d.mentor_id from public.duplas d where d.id = v_dpp.id),
        'solicitacao_registrada', 'Pedido de especialista registrado',
        v_nome || ' pediu apoio de especialista.',
        '/duplas/' || v_dpp.id);
    end if;
    -- broadcast (sem destino) também vai pro radar da coord
    if p_especialista_id is null then
      for v_dest in select * from public.sol_coords() loop
        perform public.sol_notificar(v_dest, 'solicitacao_registrada',
          'Pedido de especialista em aberto',
          v_nome || ' pediu apoio de especialista sem escolher um nome — o mural decide.',
          '/');
      end loop;
    end if;
  end if;

  return v_id;
end $$;
grant execute on function public.pedir_especialista_jovem(uuid, text, text, timestamptz)
  to authenticated;

-- 9) efetivação compartilhada --------------------------------------------------
-- O miolo do aceite: valida tudo que é atômico (slot livre sob lock, conflito
-- do lado do jovem em TODAS as trilhas dele — o especialista não lê as outras
-- —, teto de trilhas, capacidade e budget), cria/reusa a dupla e nasce o
-- encontro. Privada: só as RPCs públicas chamam.
create or replace function public.sol_efetivar(
  p_sol uuid, p_esp uuid, p_slot timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  v_dupla uuid;
  v_turma text;
  v_cronograma uuid;
  v_cap int;
begin
  select * into s from public.solicitacoes_especialista where id = p_sol;

  perform pg_advisory_xact_lock(hashtext('cap:' || p_esp::text));
  perform pg_advisory_xact_lock(hashtext('sol:' || s.mentorado_id::text));

  -- re-check pós-lock: o slot podia estar livre na tela e ter sido tomado
  if not public.especialista_slot_livre(p_esp, p_slot) then
    raise exception 'Esse horário acabou de ser ocupado — escolha outro';
  end if;
  -- conflito do lado do jovem, em todas as duplas dele (DPP inclusive —
  -- visão que o especialista sozinho não tem)
  if exists (
    select 1 from public.encontros e
    join public.duplas d on d.id = e.dupla_id
    where d.mentorado_id = s.mentorado_id
      and e.status in ('agendado','remarcado')
      and e.data_hora < p_slot + interval '1 hour'
      and e.data_hora + make_interval(mins => coalesce(e.duracao_min, 60)) > p_slot
  ) then
    raise exception 'O jovem já tem um compromisso nesse horário';
  end if;

  select d.id into v_dupla from public.duplas d
   where d.mentor_id = p_esp and d.mentorado_id = s.mentorado_id
     and d.trilha = 'especialista' and d.status in ('ativa','pausada');

  if v_dupla is null then
    if (select count(*) from public.duplas d
        where d.mentorado_id = s.mentorado_id and d.trilha = 'especialista'
          and d.status in ('ativa','pausada')) >= 3 then
      raise exception 'O jovem já tem o máximo de trilhas de especialista em andamento';
    end if;
    select coalesce(mp.capacidade_especialista, 1) into v_cap
      from public.mentor_profiles mp where mp.profile_id = p_esp;
    v_cap := coalesce(v_cap, 1);
    if (select count(*) from public.duplas d
        where d.mentor_id = p_esp and d.trilha = 'especialista'
          and d.status in ('ativa','pausada')) >= v_cap then
      raise exception 'capacidade do mentor excedida';
    end if;
  end if;

  -- turma: a da solicitação (triagem/DPP), senão a da dupla DPP, senão a do
  -- cronograma vigente — sem ela o budget por par+turma não fecha
  v_turma := coalesce(
    s.turma,
    (select d.turma from public.duplas d where d.id = s.dupla_dpp_id),
    (select c.turma from public.cronogramas c
      where c.status = 'ativo'
      order by case when (c.inicio_em is null or c.inicio_em <= current_date)
                     and (c.fim_em is null or c.fim_em >= current_date)
                    then 0 else 1 end,
               c.inicio_em asc nulls last
      limit 1));
  v_cronograma := coalesce(
    (select d.cronograma_id from public.duplas d where d.id = s.dupla_dpp_id),
    (select c.id from public.cronogramas c
      where c.turma = v_turma and c.status = 'ativo' limit 1));

  -- budget: 5 sessões por par na mesma turma, através de TODAS as duplas do
  -- par (anti-reset). Só contam vivas/efetivadas — nao_aconteceu já devolve.
  if (select count(*) from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where d.mentor_id = p_esp and d.mentorado_id = s.mentorado_id
        and d.trilha = 'especialista' and d.turma is not distinct from v_turma
        and e.status in ('agendado','remarcado','realizado')) >= 5 then
    raise exception 'O par já usou as 5 sessões da trilha nessa turma';
  end if;

  if v_dupla is null then
    insert into public.mentor_profiles (profile_id, tipo, capacidade, capacidade_especialista)
    values (p_esp, 'especialista', 1, 1)
    on conflict (profile_id) do nothing;

    insert into public.duplas (
      mentor_id, mentorado_id, trilha, demanda, solicitacao_id,
      iniciada_em, turma, cronograma_id
    ) values (
      p_esp, s.mentorado_id, 'especialista', coalesce(s.demanda, s.motivo),
      s.id, current_date, v_turma, v_cronograma
    ) returning id into v_dupla;
  end if;

  insert into public.encontros (dupla_id, numero, data_hora, duracao_min, status)
  values (
    v_dupla,
    (select coalesce(max(e.numero), 0) + 1 from public.encontros e
      where e.dupla_id = v_dupla),
    p_slot, 60, 'agendado'
  );

  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'aceita', especialista_id = p_esp, dupla_id = v_dupla,
         slot_proposto = p_slot, respondida_em = now()
   where id = s.id;

  return v_dupla;
end $$;
revoke all on function public.sol_efetivar(uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- 10) aceite pelo especialista --------------------------------------------------
-- a assinatura ganha p_slot — drop da versão antiga pra não virar overload
drop function if exists public.aceitar_solicitacao(uuid);
create or replace function public.aceitar_solicitacao(
  p_id uuid, p_slot timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
  v_slot timestamptz;
  v_dupla uuid;
  v_nome text;
  v_mentor_dpp uuid;
begin
  if public.my_role() is distinct from 'mentor_especialista' then
    raise exception 'Só mentores especialistas podem aceitar demandas';
  end if;

  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status = 'aguardando_coord' then
    raise exception 'Esse pedido ainda passa pela coordenação';
  end if;
  if s.status not in ('aberta','contra_proposta') then
    raise exception 'Essa demanda não está mais aberta';
  end if;
  if s.especialista_desejado_id is not null
     and s.especialista_desejado_id is distinct from meu then
    raise exception 'Essa demanda foi direcionada a outro especialista';
  end if;
  -- expiry lazy: proposta/pedido com horário vencido não aceita mais
  if s.slot_proposto is not null and s.slot_proposto <= now() then
    raise exception 'O horário proposto já passou — peça um novo';
  end if;
  -- em negociação, a última proposta é a oferta na mesa — não se aceita a
  -- própria proposta
  if s.status = 'contra_proposta' and (
    select p.autor_id from public.solicitacao_propostas p
     where p.solicitacao_id = s.id
     order by p.created_at desc limit 1) = meu then
    raise exception 'A última proposta é sua — espere a resposta';
  end if;

  v_slot := coalesce(p_slot, s.slot_proposto);
  if v_slot is null then
    raise exception 'Escolha um horário da sua agenda pra essa sessão';
  end if;
  -- aceitar com horário diferente do proposto é contra-proposta disfarçada
  if p_slot is not null and s.slot_proposto is not null
     and p_slot is distinct from s.slot_proposto then
    raise exception 'Pra propor outro horário use a contra-proposta';
  end if;
  if v_slot <= now() then
    raise exception 'O horário precisa ser no futuro';
  end if;

  v_dupla := public.sol_efetivar(s.id, meu, v_slot);

  select nome into v_nome from public.mentorados where id = s.mentorado_id;
  v_mentor_dpp := (select d.mentor_id from public.duplas d where d.id = s.dupla_dpp_id);

  perform public.sol_notificar(s.created_by, 'especialista_aceitou',
    'Pedido de especialista aceito',
    case when s.created_by = (select m.profile_id from public.mentorados m
                              where m.id = s.mentorado_id)
          then 'Seu pedido de especialista foi aceito — sessão marcada.'
          else 'Seu pedido pra ' || v_nome || ' foi aceito — sessão marcada.' end,
    '/');
  -- o jovem só recebe se não for o próprio autor (evita eco)
  if s.created_by is distinct from (
    select m.profile_id from public.mentorados m where m.id = s.mentorado_id) then
    perform public.sol_notificar(
      (select m.profile_id from public.mentorados m where m.id = s.mentorado_id),
      'especialista_aceitou', 'Especialista confirmado',
      'Sua sessão de especialista foi marcada.', '/jovem/agenda');
  end if;
  if v_mentor_dpp is not null and v_mentor_dpp is distinct from s.created_by then
    perform public.sol_notificar(v_mentor_dpp, 'especialista_aceitou',
      'Especialista confirmado',
      'A sessão de especialista de ' || v_nome || ' foi marcada.',
      '/duplas/' || s.dupla_dpp_id);
  end if;

  return v_dupla;
end $$;
grant execute on function public.aceitar_solicitacao(uuid, timestamptz)
  to authenticated;

-- 11) aceite pelo autor (resposta à contra-proposta do especialista) ------------
create or replace function public.aceitar_proposta(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
  v_dupla uuid;
begin
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.created_by is distinct from meu and public.my_role() <> 'coordenacao' then
    raise exception 'Só o autor do pedido aceita a proposta';
  end if;
  if s.status <> 'contra_proposta' or s.especialista_id is null then
    raise exception 'Não há proposta na mesa';
  end if;
  if (select p.autor_id from public.solicitacao_propostas p
      where p.solicitacao_id = s.id
      order by p.created_at desc limit 1) is distinct from s.especialista_id then
    raise exception 'A última proposta não é do especialista';
  end if;
  if s.slot_proposto is null or s.slot_proposto <= now() then
    raise exception 'O horário proposto já passou';
  end if;

  v_dupla := public.sol_efetivar(s.id, s.especialista_id, s.slot_proposto);

  perform public.sol_notificar(s.especialista_id, 'especialista_aceitou',
    'Proposta aceita',
    'Sua proposta de horário foi aceita — sessão marcada.',
    '/');
  return v_dupla;
end $$;
grant execute on function public.aceitar_proposta(uuid) to authenticated;

-- 12) contra-proposta (bilateral, thread append-only) -----------------------------
create or replace function public.contra_propor_solicitacao(
  p_id uuid, p_slot timestamptz, p_mensagem text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
  v_esp uuid;
  v_outro uuid;
  v_qtd int;
begin
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status not in ('aberta','contra_proposta') then
    raise exception 'Essa demanda não está em negociação';
  end if;
  if s.slot_proposto is not null and s.slot_proposto <= now() then
    raise exception 'O horário proposto já passou — o pedido expirou';
  end if;
  if p_slot is null or p_slot <= now() then
    raise exception 'O horário proposto precisa ser no futuro';
  end if;

  -- quem pode propor: o autor, ou o especialista engajado/dirigido; em pedido
  -- broadcast qualquer especialista pode engajar propondo
  if not (
    s.created_by = meu
    or s.especialista_id = meu
    or s.especialista_desejado_id = meu
    or (public.my_role() = 'mentor_especialista'
        and s.especialista_id is null
        and s.especialista_desejado_id is null)
  ) then
    raise exception 'Você não é parte dessa negociação';
  end if;

  v_esp := coalesce(s.especialista_id, s.especialista_desejado_id);
  if v_esp is null and public.my_role() = 'mentor_especialista' then
    v_esp := meu;  -- broadcast: quem propõe primeiro engaja
  end if;
  if v_esp is null then
    raise exception 'Ainda não há especialista na negociação';
  end if;

  -- o horário SEMPRE sai da grade real do especialista — dos dois lados
  if not public.especialista_slot_livre(v_esp, p_slot) then
    raise exception 'Esse horário não está na agenda do especialista';
  end if;

  select count(*) into v_qtd from public.solicitacao_propostas p
   where p.solicitacao_id = s.id;
  if v_qtd >= 4 then
    raise exception 'Muitas idas e vindas — combinem o horário por outro canal';
  end if;
  if v_qtd > 0 and (
    select p.autor_id from public.solicitacao_propostas p
     where p.solicitacao_id = s.id
     order by p.created_at desc limit 1) = meu then
    raise exception 'A última proposta é sua — espere a resposta';
  end if;

  insert into public.solicitacao_propostas (solicitacao_id, autor_id, slot_proposto, mensagem)
  values (s.id, meu, p_slot, nullif(btrim(p_mensagem),'')); 

  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'contra_proposta',
         slot_proposto = p_slot,
         especialista_id = coalesce(especialista_id,
           case when public.my_role() = 'mentor_especialista' then meu end)
   where id = s.id;

  -- notifica o outro lado da mesa — o href é o do DESTINATÁRIO
  v_outro := case when meu = s.created_by then v_esp else s.created_by end;
  perform public.sol_notificar(v_outro, 'solicitacao_proposta',
    'Nova proposta de horário',
    'Chegou uma contra-proposta pro pedido de especialista.',
    case when (select p.role from public.profiles p where p.id = v_outro) = 'mentorado'
         then '/jovem' else '/' end);
end $$;
grant execute on function public.contra_propor_solicitacao(uuid, timestamptz, text)
  to authenticated;

-- 13) recusa (só pedido dirigido/engajado — broadcast simplesmente não é pego) ----
create or replace function public.recusar_solicitacao(
  p_id uuid, p_justificativa text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
  v_nome text;
begin
  if public.my_role() is distinct from 'mentor_especialista' then
    raise exception 'Só especialistas recusam demandas';
  end if;
  if p_justificativa is null or char_length(btrim(p_justificativa)) < 3 then
    raise exception 'Explique o motivo da recusa';
  end if;

  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status not in ('aberta','contra_proposta') then
    raise exception 'Essa demanda não está mais aberta';
  end if;
  if meu is distinct from s.especialista_desejado_id
     and meu is distinct from s.especialista_id then
    raise exception 'Só o especialista procurado pode recusar';
  end if;

  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'recusada', justificativa_recusa = btrim(p_justificativa),
         especialista_id = meu, respondida_em = now()
   where id = s.id;

  select nome into v_nome from public.mentorados where id = s.mentorado_id;
  perform public.sol_notificar(s.created_by, 'solicitacao_recusada',
    'Pedido de especialista recusado',
    'O especialista não pôde assumir o pedido de ' || v_nome || '.',
    case when (select p.role from public.profiles p where p.id = s.created_by) = 'mentorado'
         then '/jovem' else '/' end);
end $$;
grant execute on function public.recusar_solicitacao(uuid, text) to authenticated;

-- 14) triagem da coordenação (pedido sem DPP → libera com a turma certa) ---------
create or replace function public.reconhecer_solicitacao(
  p_id uuid, p_turma text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação faz a triagem';
  end if;
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status <> 'aguardando_coord' then
    raise exception 'Esse pedido não está na triagem';
  end if;
  if p_turma is null or not exists (
    select 1 from public.cronogramas c where c.turma = p_turma
  ) then
    raise exception 'Escolha uma turma válida';
  end if;

  update public.solicitacoes_especialista
     set status = 'aberta', turma = p_turma
   where id = s.id;

  perform public.sol_notificar(s.created_by, 'solicitacao_registrada',
    'Pedido liberado',
    'A coordenação liberou seu pedido de especialista.',
    case when exists (select 1 from public.mentorados m
                      where m.id = s.mentorado_id and m.profile_id = s.created_by)
          then '/jovem' else '/' end);
  if s.especialista_desejado_id is not null then
    perform public.sol_notificar(s.especialista_desejado_id, 'demanda_especialista',
      'Novo pedido de sessão',
      'Um pedido direcionado a você foi liberado pela coordenação.',
      '/');
  end if;
end $$;
grant execute on function public.reconhecer_solicitacao(uuid, text) to authenticated;

-- 15) cancelamento pelo autor ----------------------------------------------------
create or replace function public.cancelar_solicitacao(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
begin
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.created_by is distinct from meu and public.my_role() <> 'coordenacao' then
    raise exception 'Só o autor cancela o pedido';
  end if;
  if s.status not in ('aberta','aguardando_coord','contra_proposta') then
    raise exception 'Esse pedido não pode mais ser cancelado';
  end if;

  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'cancelada', respondida_em = now()
   where id = s.id;

  perform public.sol_notificar(
    coalesce(s.especialista_id, s.especialista_desejado_id),
    'solicitacao_cancelada', 'Pedido de especialista cancelado',
    'O pedido direcionado a você foi cancelado pelo autor.', '/');
end $$;
grant execute on function public.cancelar_solicitacao(uuid) to authenticated;

-- 16) tipos novos de notificação -----------------------------------------------
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (
  tipo in ('comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem',
    'encontro_marcado','encontro_alterado','encontro_desfeito',
    'solicitacao_triagem','solicitacao_recusada','solicitacao_proposta')
);

commit;

-- rollback manual (ordem reversa, se precisar):
--   drop function sol_notificar, sol_coords, sol_efetivar, pedir_especialista_jovem,
--     aceitar_solicitacao, aceitar_proposta, contra_propor_solicitacao,
--     recusar_solicitacao, reconhecer_solicitacao, cancelar_solicitacao;
--   drop table solicitacao_propostas; recriar policies/views conforme 0027-0053;
--   recreate unique indexes solicitacoes_dupla_uk + duplas_mentorado_ativa_key;
--   restaurar CHECKs (status 3 valores, demanda not-null 10..1000,
--     duracao 30-120, numero 1-16); drop colunas novas;
--   alter dupla_dpp_id/demanda set not null (precisa de backfill antes).
