-- 0094 — "Lembrar" (D5): notificação in-app + log de interação com cap de
-- 1 lembrete por dupla a cada 48h, valendo também pro WhatsApp manual.
--
-- Dois caminhos até aqui: o botão wa.me logava `interacoes` sem gerar sino, e
-- a policy de `notificacoes` não permite supervisor→dupla nem mentor→jovem.
-- A RPC definer concentra os dois e faz cumprir a regra de frequência.

-- 1) canal 'in_app' no log de contato (o lembrete nasce dentro da plataforma;
--    o wa.me que a UI abre junto é só o meio de entrega)
alter table public.interacoes drop constraint interacoes_canal_check;
alter table public.interacoes add constraint interacoes_canal_check
  check (canal = any (array['whatsapp','email','outro','in_app']));

-- 2) tipo 'lembrete' nas notificações
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem',
    'encontro_marcado','encontro_alterado','encontro_desfeito',
    'solicitacao_triagem','solicitacao_recusada','solicitacao_proposta',
    'chamado_aberto','chamado_atribuido','chamado_atualizacao',
    'chamado_resposta_autor','chamado_resolvido','chamado_reaberto',
    'chamado_mencao','sugestao_especialista','devolutiva_especialista',
    'lembrete'
  ]));

-- 3) RPC definer — única porta pra mandar lembrete.
--    coordenacao → qualquer dupla ativa · supervisor → as supervisionadas ·
--    mentor DPP → só 'mentorado' na própria dupla. Cap 48h por dupla conta
--    QUALQUER autor (a regra é por dupla, não por remetente).
create or replace function public.enviar_lembrete(
  p_dupla_id uuid,
  p_destino text default 'mentor',
  p_titulo text default null,
  p_corpo text default null,
  p_href text default null
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_me uuid := my_profile_id();
  v_dupla record;
  v_dest uuid;
  v_ultimo timestamptz;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_sessao');
  end if;
  if p_destino not in ('mentor', 'mentorado') then
    return jsonb_build_object('ok', false, 'erro', 'destino_invalido');
  end if;
  -- href interno ou nulo — mesma régua do CHECK da tabela ('/' sozinho vale)
  if p_href is not null and p_href <> '/'
     and p_href !~ '^/[^/\\]' then
    return jsonb_build_object('ok', false, 'erro', 'href_invalido');
  end if;

  select d.id, d.status, d.mentor_id, d.supervisor_id, d.turma,
         m.profile_id as jovem_profile_id
    into v_dupla
    from duplas d
    join mentorados m on m.id = d.mentorado_id
   where d.id = p_dupla_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'dupla_inexistente');
  end if;

  -- NULL-safe: dupla sem supervisor ("= null" vira NULL e o NOT passaria).
  -- has_papel com a turma da dupla: coord escopada a outra turma fica fora
  -- ("escopo só filtra, nunca amplia" — 0085).
  if not (
    -- coalesce: dupla sem turma (a coluna é not null, mas se um dia afrouxar)
    -- não pode virar alvo de coord escopada — '' só casa coord global
    has_papel('coordenacao', coalesce(v_dupla.turma, ''))
    or (v_dupla.supervisor_id is not null and v_dupla.supervisor_id = v_me)
    or (v_dupla.mentor_id is not null and v_dupla.mentor_id = v_me
        and p_destino = 'mentorado')
  ) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  if v_dupla.status <> 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'dupla_inativa');
  end if;

  -- serializa por dupla: sem o lock, dois calls paralelos passam pelo check
  -- de 48h juntos e mandam dois lembretes (TOCTOU)
  perform pg_advisory_xact_lock(hashtextextended(p_dupla_id::text, 94));

  select max(created_at) into v_ultimo
    from interacoes
   where dupla_id = p_dupla_id
     and tipo = 'nudge'
     -- "<= now()": created_at é forjável pelo cliente via insert direto —
     -- um timestamp futuro trancaria o cap pra sempre
     and created_at <= now()
     and created_at > now() - interval '48 hours';
  if v_ultimo is not null then
    return jsonb_build_object(
      'ok', false, 'erro', 'intervalo_48h',
      'ultimo', v_ultimo,
      'bloqueado_ate', v_ultimo + interval '48 hours');
  end if;

  v_dest := case p_destino
    when 'mentor' then v_dupla.mentor_id
    else v_dupla.jovem_profile_id
  end;
  -- self-nudge (ex.: supervisor que também é o mentor da dupla chamando
  -- destino 'mentor') consumiria o cap sem notificar ninguém
  if v_dest is null or v_dest = v_me then
    return jsonb_build_object('ok', false, 'erro', 'sem_destino');
  end if;

  insert into interacoes (dupla_id, autor_id, canal, tipo, nota)
  values (p_dupla_id, v_me, 'in_app', 'nudge', 'lembrete → ' || p_destino);

  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  values (
    v_dest,
    'lembrete',
    -- trim+nullif: '   ' ou '' do client estouraria o CHECK char_length≥1
    left(coalesce(nullif(trim(p_titulo), ''), 'Lembrete'), 200),
    left(coalesce(p_corpo, ''), 1000),
    -- destino jovem pousa na superfície dele, não na staff /agenda
    coalesce(
      p_href,
      case p_destino when 'mentorado' then '/jovem' else '/agenda' end
    ),
    v_me
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function enviar_lembrete(uuid, text, text, text, text)
  from public, anon;
grant execute on function enviar_lembrete(uuid, text, text, text, text)
  to authenticated;
