-- 0087: o híbrido DPP+especialista FUNCIONA como especialista (D9/WP0b).
-- A 0086 já lista o híbrido no catálogo do jovem — sem esta, pedido
-- dirigido a ele cairia num mural que o `my_role()` dele (papel primário =
-- mentor_dpp) nunca vê. Aqui `my_role() = 'mentor_especialista'` vira
-- `has_papel('mentor_especialista')` (self, qualquer escopo) em todos os
-- gates de atuação: grade própria (0073), leitura do mural (sol_select +
-- solicitacoes_mural), aceite/recusa/contra-proposta e a validação do alvo
-- dirigido no pedir_especialista_jovem.
--
-- `has_papel` inclui o gate `ativo` — paridade exata com my_role() (que lê
-- o papel primário do profile ativo). Escopo por turma NÃO se aplica aqui
-- de propósito: o papel 'mentor_especialista' escopado atende qualquer
-- pedido (a régua de escopo estreita a ATRIBUIÇÃO, e o especialista só
-- enxerga pedido dirigido a ele ou broadcast — decisão da 0074 mantida).
--
-- Corpos replicados verbatim das definições vigentes (0073 policies,
-- 0074 view/policy/RPCs) — só muda o predicado de papel.
--
-- Risco: quem tem o papel passa a agir mesmo quando o primário é outro —
-- é exatamente o comportamento buscado; nenhum ator anterior perde acesso
-- (primário mentor_especialista ⇒ has_papel verdadeiro).

begin;

-- ============ 1) agenda própria (policies 0073) ============

drop policy if exists especialista_grade_insert on public.especialista_grade;
create policy especialista_grade_insert on public.especialista_grade
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy if exists especialista_grade_update on public.especialista_grade;
create policy especialista_grade_update on public.especialista_grade
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy if exists especialista_excecoes_insert on public.especialista_excecoes;
create policy especialista_excecoes_insert on public.especialista_excecoes
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy if exists especialista_excecoes_update on public.especialista_excecoes;
create policy especialista_excecoes_update on public.especialista_excecoes
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

-- ============ 2) leitura do mural (policy + view da 0074) ============

drop policy if exists sol_select on public.solicitacoes_especialista;
create policy sol_select on public.solicitacoes_especialista for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id
      and (d.mentor_id = public.my_profile_id()
        or d.supervisor_id = public.my_profile_id()))
  or (public.has_papel('mentor_especialista'::public.app_role)
      and status in ('aberta','contra_proposta')
      and (especialista_desejado_id is null
           or especialista_desejado_id = public.my_profile_id()))
  or especialista_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and mentorado_id = public.my_mentorado_id()));

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
      and public.has_papel('mentor_especialista'::public.app_role)
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

-- sol_coords (0074): o radar da coordenação também alcança o híbrido cujo
-- primário não é coordenacao — mesmo predicado, papel como relação
create or replace function public.sol_coords()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p
   where p.ativo and public.has_papel(p.id, 'coordenacao')
$$;
revoke all on function public.sol_coords() from public, anon, authenticated;

-- ============ 3) RPCs — corpos da 0074 com o predicado trocado ============

-- pedir_especialista_jovem: o alvo dirigido pode ser o híbrido (o trigger da
-- 0086 já valida por has_papel — aqui é só a mensagem amigável espelhada)
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
    where p.id = p_especialista_id and p.ativo
      and public.has_papel(p.id, 'mentor_especialista')
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

-- aceitar_solicitacao: o gate de papel vira has_papel — o híbrido aceita
-- demanda mesmo com primário mentor_dpp
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
  if not public.has_papel('mentor_especialista'::public.app_role) then
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

-- contra_propor_solicitacao: engajar broadcast + propor exigem o papel
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
    or (public.has_papel('mentor_especialista'::public.app_role)
        and s.especialista_id is null
        and s.especialista_desejado_id is null)
  ) then
    raise exception 'Você não é parte dessa negociação';
  end if;

  v_esp := coalesce(s.especialista_id, s.especialista_desejado_id);
  if v_esp is null and public.has_papel('mentor_especialista'::public.app_role) then
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
           case when public.has_papel('mentor_especialista'::public.app_role) then meu end)
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

-- recusar_solicitacao: idem
create or replace function public.recusar_solicitacao(
  p_id uuid, p_justificativa text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  meu uuid := public.my_profile_id();
  v_nome text;
begin
  if not public.has_papel('mentor_especialista'::public.app_role) then
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

commit;

-- rollback: recreate as 4 policies da 0073 (my_role), a sol_select e a view
-- solicitacoes_mural da 0074, e os 4 corpos de função com my_role() (ver
-- verbatim em 0074_solicitacao_v2.sql).
