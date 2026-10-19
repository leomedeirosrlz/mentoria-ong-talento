-- 0095 — pedir_especialista_jovem: o teto de 3 trilhas valia também pro
-- follow-up (sessão 2..5 de um par já em trilha). Como toda sessão nova é
-- uma solicitação nova, um jovem com 3 trilhas ativas ficava sem conseguir
-- pedir a sessão seguinte de qualquer uma — o "Pedir próxima sessão" do
-- cardápio sempre errava. A v_dupla do par passa a ser resolvida ANTES do
-- teto e o teto só barra pedido pra par novo; os tetos de dedup/abertos
-- continuam valendo pro follow-up (são sobre pedidos, não trilhas).

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

  -- follow-up resolve primeiro: o teto de trilhas é sobre pares NOVOS —
  -- um pedido pra trilha já viva do par não abre trilha nenhuma
  if p_especialista_id is not null then
    select d.id into v_dupla from public.duplas d
     where d.mentor_id = p_especialista_id and d.mentorado_id = ment
       and d.trilha = 'especialista' and d.status in ('ativa','pausada');
  end if;

  -- teto de trilhas simultâneas (só par novo — follow-up já tem dupla)
  if v_dupla is null and (select count(*) from public.duplas d
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
