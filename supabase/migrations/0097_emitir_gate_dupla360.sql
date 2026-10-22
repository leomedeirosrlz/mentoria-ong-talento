begin;

-- 0097 — correções pós-auditoria WP7 (domínio):
--
-- 1) emitir_link_instrumento: gate simétrico — coordenação também exige
--    trilha DPP e jornada viva (ativa|pausada). my_role() permanece no
--    ramo coord (0090 deliberado — has_papel estenderia a emissão a quem
--    tem papel secundário de coord). O 360º não passa por esta RPC
--    (rejeitada na lista branca) — o fluxo de encerramento usa
--    gerarLinksParaDupla e não é afetado.
--
-- 2) formulario_links.dupla_id corrigido retroativamente: gerarLinks-
--    Formulario resolvia a dupla do destinatário sem filtrar trilha — um
--    360º emitido pra mentorado com trilha especialista ativa ligava na
--    dupla esp e sumia (checklist avaliacao_360_enviada nunca ligava,
--    painel/jornada invisíveis). Re-aponta pra dupla DPP do mentorado
--    (a resolução no app ganha o filtro em forms/actions.ts).

create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
  v_rodas int;
  v_momento text;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;

  select d.id, d.mentor_id, d.mentorado_id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação ou o mentor DPP da dupla — e a jornada
  -- precisa estar viva nos dois casos (0097: o ramo coord não checava
  -- trilha/status e conseguia emitir instrumento em dupla especialista,
  -- cujo link virava órfão invisível, e em dupla encerrada).
  -- autorização primeiro: quem não pode nem ver a dupla recebe o erro
  -- genérico — os diferenciais de trilha/status vazariam a classificação
  -- pra qualquer autenticado que chutasse o UUID (execute é de
  -- authenticated, como sempre foi)
  if (
    public.my_role() = 'coordenacao'
    or (
      public.has_papel('mentor_dpp'::public.app_role)
      and v_dupla.mentor_id = public.my_profile_id()
    )
  ) is not true then
    raise exception 'sem permissão pra enviar instrumento desta dupla';
  end if;
  if v_dupla.trilha = 'especialista' then
    raise exception 'trilha de especialista não usa os instrumentos da jornada DPP';
  elsif v_dupla.status not in ('ativa', 'pausada') then
    raise exception 'jornada encerrada — instrumento é ferramenta de dupla viva';
  end if;

  select f.id, f.ativo into v_form
    from formularios f
   where f.sistema = p_sistema;
  if not found then
    raise exception 'instrumento oficial ainda não está cadastrado';
  end if;
  if not v_form.ativo then
    raise exception 'este instrumento está encerrado — reative em Formulários';
  end if;

  -- WP7: momento da aplicação (roda_vida) — a régua são as RESPONDIDAS:
  -- nenhuma roda respondida ainda → esta emissão é da leitura inicial
  -- (re-envio de link expirado continua inicial); com ≥1 respondida, a
  -- aplicação seguinte é a formal. Contagem total erraria dos dois
  -- lados: inicial respondida + nova emissão sairia "inicial", e um
  -- re-envio de link morto sairia "formal" sem a inicial ter acontecido.
  v_momento := null;
  if p_sistema = 'roda_vida' then
    select count(*) into v_rodas
      from formulario_links x
      join formularios xf on xf.id = x.formulario_id
     where xf.sistema = 'roda_vida'
       and x.dupla_id = v_dupla.id
       and x.usado_em is not null;
    v_momento := case when v_rodas = 0 then 'inicial' else 'formal' end;
  end if;

  -- reusa link pendente vigente pro mesmo mentorado+form (um link vivo por
  -- destinatário por instrumento, como na action de emissão). Escopo da
  -- dupla: link dela ou órfão (dupla_id null — emitido por Formulários sem
  -- contexto); um link vivo apontando pra OUTRA dupla não é furtado.
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and l.dest_mentorado_id = v_dupla.mentorado_id
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.dupla_id = v_dupla.id or l.dupla_id is null)
   order by l.created_at desc
   limit 1;
  if found then
    -- link órfão de dupla (destinatário certo, dupla preenchida depois)
    -- passa a apontar pra esta — a resposta ganha o contexto certo.
    -- momento só é preenchido quando ausente: o valor já gravado vence.
    update formulario_links
       set dupla_id = v_dupla.id,
           contexto = contexto
             || '{"origem":"instrumentos"}'::jsonb
             || case
                  when v_momento is not null
                       and contexto ->> 'momento' is null
                    then jsonb_build_object('momento', v_momento)
                  else '{}'::jsonb end
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from 'instrumentos'
            or (v_momento is not null and contexto ->> 'momento' is null));
    return jsonb_build_object('token', v_link.token, 'reutilizado', true);
  end if;

  insert into formulario_links (
    formulario_id, token, dest_mentorado_id, dupla_id, contexto, created_by
  ) values (
    v_form.id,
    -- 24 bytes → 32 chars base64url, mesmo fator de posse da action
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    v_dupla.mentorado_id,
    v_dupla.id,
    '{"origem":"instrumentos"}'::jsonb
      || case
           when v_momento is not null
             then jsonb_build_object('momento', v_momento)
           else '{}'::jsonb end,
    public.my_profile_id()
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

-- 2) correção retroativa: 360º carimbado na dupla de especialista do mesmo
--    mentorado volta pra dupla DPP (a viva de preferência — mesma régua da
--    jovem_jornada). Quando dest_mentorado_id é null (link endereçado a
--    profile, ex.: resposta do mentor) resolve pelo mentorado da própria
--    dupla carimbada — sem isso todo 360 do mentor virava órfão. Só fica
--    órfão de verdade se o mentorado não tem NENHUMA dupla não-esp — aí
--    o link some de todas as superfícies (jornada exige DPP), o que é
--    honesto: sem DPP não há checklist pra ele marcar mesmo.
update formulario_links l
   set dupla_id = (
         select d2.id
           from duplas d2
          where d2.mentorado_id = coalesce(
                    l.dest_mentorado_id,
                    (select d4.mentorado_id from duplas d4
                      where d4.id = l.dupla_id))
            and d2.trilha <> 'especialista'
          order by (d2.status in ('ativa', 'pausada')) desc,
                   d2.iniciada_em desc nulls last, d2.created_at desc
          limit 1)
  from formularios f
 where l.formulario_id = f.id
   and f.sistema = 'avaliacao_360'
   and l.dupla_id is not null
   and l.dupla_id in (select d3.id from duplas d3 where d3.trilha = 'especialista');


-- 3) aceitar_solicitacao: guard de autoatribuição — o mentor DPP da
--    jovem não pode se tornar também o especialista dela aceitando o
--    pedido (broadcast ou direcionado). Verbatim da 0087 + o exists.

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
  -- 0097: quem já é o mentor DPP deste mentorado não aceita o pedido de
  -- especialista dele — a trilha pressupõe um segundo adulto na mesa.
  -- Sem o guard, o mentor híbrido via a mesa de aceite (papel
  -- mentor_especialista) na própria dupla e podia se autoatribuir.
  if exists (
    select 1 from public.duplas d
     where d.mentor_id = meu
       and d.mentorado_id = s.mentorado_id
       and d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
  ) then
    raise exception 'Você já é o mentor DPP deste mentorado — a trilha de especialista pede um segundo adulto';
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

-- 4) sol_efetivar: o mesmo guard no choke point (ver comentário inline) —
--    verbatim da 0074 + o exists antes da criação da dupla
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


-- ─── jovem_contatos: coordenação escopada na turma (REALIZA-151) ──────
-- O union global de coordenacao vazava qualquer profile com o papel —
-- personas de e2e/fixture apareciam como "Coordenação do programa" pra
-- jovem de outra turma. Mesmo predicado do catálogo jovem_especialistas
-- (0086): has_papel(profile, papel, turma da DPP do jovem). Fallback
-- decidido no review: jovem sem dupla DPP (turma null) → has_papel com
-- escopo null conta papel em QUALQUER escopo — ele não perde o canal.
create or replace view public.jovem_contatos as
select dupla_id, papel, id, nome, nome_social, avatar_path, whatsapp, email, role
from (
  select
    d.id as dupla_id,
    case when d.trilha = 'especialista' then 'especialista' else 'mentor' end as papel,
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.mentor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select
    d.id, 'supervisor',
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.duplas d
  join public.profiles p on p.id = d.supervisor_id and p.ativo
  where d.mentorado_id = public.my_mentorado_id()
  union all
  select
    null::uuid, 'coordenacao',
    p.id, p.nome, p.nome_social, p.avatar_path, p.whatsapp, p.email, p.role
  from public.profiles p
  where p.ativo
    and public.has_papel(
      p.id, 'coordenacao'::app_role,
      (select d.turma from public.duplas d
        where d.mentorado_id = public.my_mentorado_id()
          and coalesce(d.trilha,'dpp') = 'dpp'
          and d.status in ('ativa', 'pausada')
        -- mesma régua do jovem_jornada: a viva mais recente vence —
        -- sem ORDER BY duas DPP em ciclos diferentes escolhem turma
        -- não-determinística; pausada conta (dupla viva ≠ "sem DPP")
        order by d.iniciada_em desc nulls last, d.created_at desc
        limit 1))
) contatos
where public.my_role() = 'mentorado'::app_role;

-- NULL-trap do gate de autor (0074:684/894) — `my_role() <> 'coordenacao'`
-- com role NULL devolve NULL, o `and` morre e o raise não dispara: um
-- autenticado sem papel (pré-cadastrado) aceitava contra-proposta ou
-- cancelava pedido alheio só conhecendo o UUID. `is distinct from`
-- trata NULL como "não é coordenação" — e `meu is null` cobre profile
-- ainda não vinculado (mesma régua do contra_propor).
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
  if meu is null or (
    s.created_by is distinct from meu
    and public.my_role() is distinct from 'coordenacao'
  ) then
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
  if meu is null or (
    s.created_by is distinct from meu
    and public.my_role() is distinct from 'coordenacao'
  ) then
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

commit;
