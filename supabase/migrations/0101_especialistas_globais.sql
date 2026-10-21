-- 0101: especialistas globais (REALIZA-158, decisão do Léo out/2026).
-- Especialista é pool GLOBAL do programa — não fica restrito à turma da
-- dupla/mentorado. Com várias turmas em paralelo (e ex-mentorados virando
-- mentores, REALIZA-159), escopo por turma só encolhe a oferta sem ganho.
--
-- O que já era global e fica como está: mural de pedidos (sol_select/
-- solicitacoes_mural), gates de atuação (has_papel sem escopo desde 0087),
-- getEspecialistas do app.
--
-- Os 4 restos de restrição removidos aqui:
--   1) jovem_especialistas (0086): o catálogo do jovem escopava
--      mentor_especialista pela turma da DPP dele — esp de outra turma
--      era invisível. Escopo sai (escopo null = qualquer papel).
--   2) sol_efetivar (0097): o budget "5 sessões por par" contava só duplas
--      da MESMA turma — trocar de turma resetava o teto. Conta todas.
--   3) rematch_dupla (0098): a trilha especialista exigia papel escopado
--      na turma da dupla. mentor_especialista passa a checar escopo null;
--      mentor_dpp segue escopado (o DPP é da turma, isso não muda).
--   4) reconhecer_solicitacao (0074): liberar a triagem exigia escolher
--      turma. p_turma vira opcional — sem ela o pedido sai aberto e a
--      turma da dupla resolve no efetivar (s.turma → DPP → cronograma
--      vigente, coalesce já existente).
--
-- ATENÇÃO — a escolha de papel pra REMANEJO de trilha esp segue válida:
-- o candidato precisa do papel mentor_especialista ativo; o que cai é o
-- filtro de turma, não o do papel.

begin;

-- ============ 1) jovem_especialistas: catálogo sem escopo de turma ====
-- verbatim da 0086 — só muda o predicado has_papel (escopo null).
drop view if exists public.jovem_especialistas;
create view public.jovem_especialistas as
select
  p.id,
  p.nome,
  p.nome_social,
  p.avatar_path,
  p.areas,
  p.bio,
  p.cargo,
  p.empresa,
  p.cidade,
  p.uf,
  p.voluntariado,
  mp.experiencia_previa,
  mp.formacao_externa,
  (select array_agg(lbl order by dow, per_ord)
     from (select distinct
             g.dia_semana as dow,
             case per when 'manha' then 1 when 'tarde' then 2 else 3 end as per_ord,
             case g.dia_semana when 0 then 'dom' when 1 then 'seg'
                  when 2 then 'ter' when 3 then 'qua' when 4 then 'qui'
                  when 5 then 'sex' else 'sáb' end
             || case per when 'manha' then ' de manhã'
                         when 'tarde' then ' à tarde' else ' à noite' end as lbl
             from public.especialista_grade g
             cross join lateral (select unnest(array[
               case when g.hora_inicio < '12:00'::time then 'manha' end,
               case when g.hora_inicio < '18:00'::time
                      and g.hora_fim > '12:00'::time then 'tarde' end,
               case when g.hora_fim > '18:00'::time then 'noite' end
             ]) as per) pp
            where pp.per is not null and g.profile_id = p.id) x) as grade_resumo,
  greatest(0, coalesce(mp.capacidade_especialista, 1) - (
    select count(*) from public.duplas d
     where d.mentor_id = p.id and d.trilha = 'especialista'
       and d.status in ('ativa','pausada')))::int as vagas
from public.profiles p
left join public.mentor_profiles mp on mp.profile_id = p.id
where p.ativo
  and public.my_role() = 'mentorado'
  -- pool global (0101): qualquer escopo conta — o catálogo do jovem não
  -- depende mais da turma da DPP dele
  and public.has_papel(p.id, 'mentor_especialista')
  and not exists (
    select 1 from public.duplas d
     where d.mentorado_id = public.my_mentorado_id()
       and d.mentor_id = p.id
       and coalesce(d.trilha,'dpp') = 'dpp'
       and d.status in ('ativa','pausada'));

revoke all on public.jovem_especialistas from public, anon;
grant select on public.jovem_especialistas to authenticated;

-- ============ 2) sol_efetivar: budget por par, não por par+turma ======
-- verbatim da 0097 — o count do budget perde o predicado de turma (e o
-- comentário/raise acompanham). v_turma/v_cronograma seguem: a dupla nova
-- continua gravando turma (not null) e cronograma, herdados da DPP/vigente.
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

  -- guard de autoatribuição (0097): a trilha pede um SEGUNDO adulto —
  -- quem já é mentor DPP da jovem não pode assumir também o papel de
  -- especialista dela. Mora no choke point porque todos os caminhos de
  -- aceite afunilam aqui: aceitar_solicitacao (esp aceita o pedido),
  -- aceitar_proposta (autor/coord aceita a contra-proposta) e o pedido
  -- direcionado com especialista_desejado_id — guardar só as bordas
  -- deixava o híbrido (DPP + papel esp secundário) se autoatribuir pela
  -- proposta, sem nenhum parceiro.
  if exists (
    select 1 from public.duplas d
     where d.mentorado_id = s.mentorado_id
       and d.mentor_id = p_esp
       and d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
  ) then
    raise exception 'O mentor DPP da jovem não pode assumir também a trilha de especialista';
  end if;

  -- e o papel tem que estar vivo no aceite: quem perdeu mentor_especialista
  -- entre proposta e efetivação não herda a dupla (janela curta, mas o
  -- choke point é o último lugar onde checar)
  if not public.has_papel(p_esp, 'mentor_especialista'::public.app_role) then
    raise exception 'O especialista não está mais habilitado pra essa trilha';
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

  -- turma: a da solicitação (triagem/DPP), senão a da dupla DPP do pedido,
  -- senão a da DPP mais recente do mentorado (qualquer status — pedido sem
  -- DPP ativa é quem chega na triagem; a turma alimenta mentorados_turma,
  -- então chutar o cronograma vigente antes do histórico do jovem jogava
  -- ele na coorte errada). Último recurso: cronograma vigente.
  v_turma := coalesce(
    s.turma,
    (select d.turma from public.duplas d where d.id = s.dupla_dpp_id),
    (select d.turma from public.duplas d
      where d.mentorado_id = s.mentorado_id
        and coalesce(d.trilha,'dpp') = 'dpp'
      order by d.created_at desc limit 1),
    (select c.turma from public.cronogramas c
      where c.status = 'ativo'
      order by case when (c.inicio_em is null or c.inicio_em <= current_date)
                     and (c.fim_em is null or c.fim_em >= current_date)
                    then 0 else 1 end,
               c.inicio_em asc nulls last
      limit 1));
  if v_turma is null then
    raise exception 'Não consegui derivar a turma do jovem — a coordenação pode defini-la na triagem';
  end if;
  v_cronograma := coalesce(
    (select d.cronograma_id from public.duplas d where d.id = s.dupla_dpp_id),
    (select c.id from public.cronogramas c
      where c.turma = v_turma and c.status = 'ativo'
      order by c.inicio_em desc nulls last, c.id limit 1));

  -- budget: 5 sessões por par, através de TODAS as duplas do par (anti-reset).
  -- Pool global (0101): a trilha é do PAR, não do par+numa turma — o teto
  -- não reseta por turma. Só contam vivas/efetivadas — nao_aconteceu devolve.
  if (select count(*) from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where d.mentor_id = p_esp and d.mentorado_id = s.mentorado_id
        and d.trilha = 'especialista'
        and e.status in ('agendado','remarcado','realizado')) >= 5 then
    raise exception 'O par já usou as 5 sessões da trilha de especialista';
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

-- ============ 3) rematch_dupla: esp global, DPP segue escopado ========
-- verbatim da 0098 — o has_papel do lado mentor ganha escopo condicional:
-- mentor_especialista checa escopo null (pool global), mentor_dpp segue
-- escopado na turma da dupla (a trilha DPP é da turma — não muda).
create or replace function public.rematch_dupla(p_dupla_id uuid, p_lado text, p_novo_id uuid, p_motivo text DEFAULT NULL::text, p_registrar_nota boolean DEFAULT true)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  antiga public.duplas%rowtype;
  nova uuid;
  novo_mentor uuid;
  novo_mentorado uuid;
  papel_esperado text;
  nota_saida text;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação remaneja duplas';
  end if;
  if p_lado not in ('mentor', 'mentorado') then
    raise exception 'Lado inválido — use mentor ou mentorado';
  end if;

  select * into antiga from public.duplas where id = p_dupla_id for update;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if antiga.status not in ('ativa', 'pausada') then
    raise exception 'Só dupla ativa ou pausada pode ser remanejada';
  end if;

  novo_mentor    := case when p_lado = 'mentor'    then p_novo_id else antiga.mentor_id end;
  novo_mentorado := case when p_lado = 'mentorado' then p_novo_id else antiga.mentorado_id end;

  if p_lado = 'mentor' then
    papel_esperado := case when antiga.trilha = 'especialista'
                           then 'mentor_especialista' else 'mentor_dpp' end;
    -- has_papel confere o papel efetivo E o ativo (join profiles) — híbrido
    -- com o papel da trilha como secundário passa a ser candidato válido.
    -- Escopo (0101): especialista é pool GLOBAL — o papel em qualquer
    -- escopo habilita; mentor_dpp segue restrito à turma da dupla.
    if not public.has_papel(
      p_novo_id, papel_esperado::public.app_role,
      case when papel_esperado = 'mentor_especialista' then null
           else antiga.turma end
    ) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
    end if;
    -- 0101: mesmo guard de autoatribuição do sol_efetivar — a trilha de
    -- especialista exige um SEGUNDO adulto; quem já é mentor DPP da jovem
    -- não pode assumir a trilha de especialista dela via rematch (o caminho
    -- cross-turma facilitou chegar aqui, então o guard mora no RPC).
    if papel_esperado = 'mentor_especialista' and exists (
      select 1 from public.duplas d
       where d.mentorado_id = antiga.mentorado_id
         and d.mentor_id = p_novo_id
         and d.trilha is distinct from 'especialista'
         and d.status in ('ativa', 'pausada')
    ) then
      raise exception 'O mentor DPP da jovem não pode assumir também a trilha de especialista';
    end if;
  else
    if not exists (select 1 from public.mentorados where id = p_novo_id) then
      raise exception 'Mentorado não encontrado';
    end if;
    if exists (
      select 1 from public.duplas
      where mentorado_id = p_novo_id
        and trilha = antiga.trilha
        and status in ('ativa', 'pausada')
    ) then
      raise exception 'Esse mentorado já está em dupla nessa trilha';
    end if;
  end if;

  update public.duplas set status = 'encerrada' where id = p_dupla_id;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id
  )
  returning id into nova;

  if p_registrar_nota and nullif(btrim(p_motivo), '') is not null then
    nota_saida := 'Saiu da dupla em ' || to_char(current_date, 'DD/MM/YYYY') ||
                  ' (remanejamento): ' || btrim(p_motivo);
    insert into public.pessoa_notas (profile_id, mentorado_id, texto, created_by)
    values (
      case when p_lado = 'mentor' then antiga.mentor_id else null end,
      case when p_lado = 'mentorado' then antiga.mentorado_id else null end,
      nota_saida,
      public.my_profile_id()
    );
  end if;

  return nova;
end;
$function$;

-- ============ 4) reconhecer_solicitacao: turma opcional na triagem ====
-- verbatim da 0074 — p_turma vira opcional: a coordenação ainda pode
-- definir a turma explicitamente, mas liberar sem ela não bloqueia mais
-- (sol_efetivar resolve pela cadeia s.turma → DPP → cronograma vigente).
create or replace function public.reconhecer_solicitacao(
  p_id uuid, p_turma text default null
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
  -- turma explícita segue válida; null = resolve na efetivação (pool
  -- global, 0101 — a liberação não depende mais de escolher turma)
  if p_turma is not null and not exists (
    select 1 from public.cronogramas c where c.turma = p_turma
  ) then
    raise exception 'Escolha uma turma válida';
  end if;

  update public.solicitacoes_especialista
     set status = 'aberta', turma = coalesce(p_turma, s.turma)
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

-- ============ 5) pedir_especialista_jovem: copy da triagem ============
-- verbatim da 0095 — só muda o texto da notificação à coordenação: a
-- liberação não depende mais de definir turma (item 4).
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
        v_nome || ' pediu apoio de especialista e não tem dupla DPP — libere o pedido pra chegar aos especialistas.',
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

commit;

-- rollback: recriar a view com has_papel escopado (0086), o budget com
-- `and d.turma is not distinct from v_turma` (0097), o rematch com escopo
-- antiga.turma direto (0098), o reconhecer exigindo p_turma e o pedir com
-- a copy antiga (0095).
