-- 0125: escopo do auxiliar por pessoa (REALIZA-32) — "só as duplas dele"
-- (padrão, o comportamento de sempre) ou "toda a turma".
--
-- CONTEXTO
-- O auxiliar executivo (papel `supervisor`) enxergava só as duplas com
-- `duplas.supervisor_id = ele` — predicado espalhado por policies, views
-- definer e RPCs como `d.supervisor_id = my_profile_id()`. A decisão é o
-- alcance ser configurável POR PESSOA na atribuição do papel:
--   'duplas' — default; igual a hoje: as duplas em que é supervisor_id;
--   'turma'  — as supervisionadas + TODAS as duplas da turma escolhida, com
--              as mesmas permissões (o escopo amplia, nunca substitui).
--
-- MODELO
-- `profile_papeis` ganha `escopo_supervisao` ('duplas'|'turma') — só tem
-- efeito em linhas `papel = 'supervisor'` (nos demais papéis a coluna fica
-- no default e ninguém lê). A visão de turma mora numa LINHA de papel
-- escopada — (supervisor, escopo_turma = label, escopo_supervisao = 'turma')
-- ao lado da linha-identidade global (escopo null) que continua marcando
-- "a pessoa é auxiliar": a unique (profile_id, papel, escopo_turma) admite
-- as duas sem ambiguidade, escopo_turma null + 'turma' não vale (a turma
-- precisa estar definida) e o papel/primário não muda de lugar.
--
-- O predicado novo é `public.supervisiona_dupla(dupla)`: supervisor_id = eu
-- OU grant de turma casando com `duplas.turma` OU `cronogramas.turma` via
-- `cronograma_id` (a dupla pode herdar a turma pelo calendário — os dois
-- caminhos contam). Policies, views e RPCs que significavam "ele enxerga/
-- age nessa dupla" trocam `d.supervisor_id = my_profile_id()` por
-- `supervisiona_dupla(d.id)` — expressão idêntica fora isso. Onde o
-- predicado é "o supervisor É a pessoa" (autoria/alvo da supervisão,
-- notificação pro supervisor DA DUPLA, participante de relatório público),
-- nada muda — está no relatório da issue.

begin;

-- ============ 1) a coluna ============

alter table public.profile_papeis
  add column escopo_supervisao text not null default 'duplas'
    check (escopo_supervisao in ('duplas', 'turma'));

comment on column public.profile_papeis.escopo_supervisao is
  'Alcance do auxiliar (REALIZA-32): só tem efeito em papel ''supervisor''. ''duplas'' = só as duplas supervisionadas; ''turma'' = supervisionadas + todas as duplas da turma em escopo_turma (escopo_turma null + ''turma'' não vale).';

-- ============ 2) o predicado ============

-- sql stable security definer, mesma forma de has_papel/my_papeis: lê duplas
-- e profile_papeis como owner — sem RLS própria não recorre na policy que a
-- chama. Barato: uma linha de duplas pelo PK + join no PK de cronogramas +
-- varredura do profile_papeis (profile_id indexado) do próprio usuário.
create or replace function public.supervisiona_dupla(p_dupla uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.duplas d
      left join public.cronogramas c on c.id = d.cronograma_id
     where d.id = p_dupla
       and (
         d.supervisor_id = public.my_profile_id()
         or exists (
           select 1
             from public.profile_papeis pp
            where pp.profile_id = public.my_profile_id()
              and pp.papel = 'supervisor'
              and pp.escopo_supervisao = 'turma'
              and pp.escopo_turma is not null
              and pp.escopo_turma in (d.turma, c.turma)
         )
       )
  );
$$;

comment on function public.supervisiona_dupla(uuid) is
  'A dupla está sob supervisão do usuário atual? (REALIZA-32) supervisor_id direto OU papel supervisor com escopo_supervisao=''turma'' casando com duplas.turma ou cronogramas.turma.';

revoke all on function public.supervisiona_dupla(uuid) from public, anon;
grant execute on function public.supervisiona_dupla(uuid) to authenticated, service_role;

-- ============ 3) policies — "ele enxerga/age nessa dupla" ============
-- drop + create com o MESMO nome/comando/roles e a expressão das
-- migrations de origem; só o predicado de acesso à dupla troca
-- (d.supervisor_id = my_profile_id() → public.supervisiona_dupla(d.id)).
-- Predicados de posse/identidade (mentor_id = eu, supervisor_id da
-- supervisão, mentorado/jovem) ficam intocados.

-- avaliacoes_encontro (0071/0098): estrela do jovem — supervisor lê a da
-- dupla supervisionada
drop policy if exists avaliacoes_select on public.avaliacoes_encontro;
create policy avaliacoes_select on avaliacoes_encontro
  for select to authenticated using (
    my_role() = 'coordenacao'
    or (public.has_papel('supervisor'::public.app_role) and exists (
      select 1 from duplas d
      where d.id = dupla_id and public.supervisiona_dupla(d.id)))
    or (public.has_papel('mentor_dpp'::public.app_role)
      and avaliacao_visivel_mentor and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.mentor_id = my_profile_id()
        and d.trilha is distinct from 'especialista'))
    or (my_role() = 'mentorado' and exists (
      select 1 from jovem_duplas jd where jd.id = dupla_id))
  );

-- dupla_saude_snapshots (0107): saúde diária da dupla — supervisor lê a das
-- supervisionadas
drop policy if exists dupla_saude_snapshots_select on public.dupla_saude_snapshots;
create policy dupla_saude_snapshots_select on public.dupla_saude_snapshots
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_saude_snapshots.dupla_id
        and public.supervisiona_dupla(d.id)
    )
  );

-- duplas (0001): a policy raiz do escopo — dela depende toda leitura do app
drop policy if exists duplas_select on public.duplas;
create policy duplas_select on public.duplas for select
  using (
    public.my_role() = 'coordenacao'
    or mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(id)
  );

-- encaminhamentos / encerramentos / encontro_notas / encontros: recursos da
-- dupla — mentor da própria, auxiliar da supervisionada
drop policy if exists encaminhamentos_select on public.encaminhamentos;
create policy encaminhamentos_select on public.encaminhamentos for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

drop policy if exists encerramentos_select on public.encerramentos;
create policy encerramentos_select on public.encerramentos for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = encerramentos.dupla_id
      and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
  )
);

drop policy if exists encontro_notas_select on public.encontro_notas;
create policy encontro_notas_select on public.encontro_notas for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

drop policy if exists encontros_select on public.encontros;
create policy encontros_select on public.encontros for select using (
  public.my_role() = 'coordenacao'
  or exists (select 1 from public.duplas d
             where d.id = encontros.dupla_id
               and (d.mentor_id = public.my_profile_id()
                    or public.supervisiona_dupla(d.id)))
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.jovem_duplas jd
                  where jd.id = encontros.dupla_id))
);

-- interacoes (0008/0094): o lembrete (nudge) é escrita do auxiliar na dupla
drop policy if exists interacoes_insert on public.interacoes;
create policy interacoes_insert on public.interacoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

drop policy if exists interacoes_select on public.interacoes;
create policy interacoes_select on public.interacoes for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

-- mentorados: a ficha do jovem é visível pro mentor dela e pro auxiliar da
-- dupla dela
drop policy if exists mentorados_select on public.mentorados;
create policy mentorados_select on public.mentorados for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1
      from public.duplas d
      where d.mentorado_id = mentorados.id
        and (
          d.mentor_id = public.my_profile_id()
          or public.supervisiona_dupla(d.id)
        )
    )
  );

-- storage.objects (0009): anexo do registro só abre com a row pai no escopo
drop policy if exists registro_anexos_storage_select on storage.objects;
create policy registro_anexos_storage_select on storage.objects for select
  using (
    bucket_id = 'registro-anexos'
    and exists (
      select 1 from public.registro_anexos a
      join public.registros r on r.id = a.registro_id
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where a.path = name
        and (
          public.my_role() = 'coordenacao'
          or d.mentor_id = public.my_profile_id()
          or public.supervisiona_dupla(d.id)
        )
    )
  );

-- pdm (0109): documento da dupla — mentor dela, auxiliar dela, jovem dela
drop policy if exists pdm_select on public.pdm;
create policy pdm_select on public.pdm for select to authenticated using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
     where d.id = pdm.dupla_id
       and (d.mentor_id = public.my_profile_id()
            or public.supervisiona_dupla(d.id)
            or d.mentorado_id = public.my_mentorado_id()))
  or exists (
    select 1 from public.jovem_duplas jd where jd.id = pdm.dupla_id)
);

drop policy if exists pdm_itens_select on public.pdm_itens;
create policy pdm_itens_select on public.pdm_itens for select to authenticated using (
  exists (
    select 1 from public.pdm p
     where p.id = pdm_itens.pdm_id
       and (public.my_role() = 'coordenacao'
            or exists (
              select 1 from public.duplas d
               where d.id = p.dupla_id
                 and (d.mentor_id = public.my_profile_id()
                      or public.supervisiona_dupla(d.id)
                      or d.mentorado_id = public.my_mentorado_id()))
            or exists (
              select 1 from public.jovem_duplas jd where jd.id = p.dupla_id)))
);

-- presencas: o auxiliar lê a formação de mentor de dupla supervisionada
drop policy if exists presencas_select on public.presencas;
create policy presencas_select on public.presencas for select using (
  public.my_role() = 'coordenacao'
  or profile_id = public.my_profile_id()
  or (
    public.my_role() = 'supervisor'
    and exists (
      select 1 from public.duplas d
      where d.mentor_id = presencas.profile_id
        and public.supervisiona_dupla(d.id)
        and d.status in ('ativa', 'pausada')
    )
  )
);

-- registros + anexos: follow-up da dupla — mentor dela, auxiliar dela
drop policy if exists registro_anexos_select on public.registro_anexos;
create policy registro_anexos_select on public.registro_anexos for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

drop policy if exists registros_select on public.registros;
create policy registros_select on public.registros for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where e.id = encontro_id
        and (d.mentor_id = public.my_profile_id() or public.supervisiona_dupla(d.id))
    )
  );

-- solicitacoes_especialista + propostas (0074/0087): a demanda nasce na
-- dupla DPP — mentor dela e auxiliar dela acompanham a negociação
drop policy if exists sol_select on public.solicitacoes_especialista;
create policy sol_select on public.solicitacoes_especialista for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = dupla_dpp_id
      and (d.mentor_id = public.my_profile_id()
        or public.supervisiona_dupla(d.id)))
  or (public.has_papel('mentor_especialista'::public.app_role)
      and status in ('aberta','contra_proposta')
      and (especialista_desejado_id is null
           or especialista_desejado_id = public.my_profile_id()))
  or especialista_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and mentorado_id = public.my_mentorado_id()));

drop policy if exists prop_select on public.solicitacao_propostas;
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
              or public.supervisiona_dupla(d.id))))));

-- supervisoes (0041/0091): o CHECK tem DOIS usos de supervisor_id —
--   · supervisoes.supervisor_id = my_profile_id() é AUTORIA (quem registra)
--     → fica;
--   · os EXISTS em duplas são "o mentor/a dupla estão no meu escopo de
--     supervisão" → viram supervisiona_dupla.
drop policy if exists supervisoes_insert on public.supervisoes;
create policy supervisoes_insert on public.supervisoes
for insert with check (
  public.has_papel('coordenacao'::public.app_role)
  or (
    public.has_papel('supervisor'::public.app_role)
    and supervisor_id = public.my_profile_id()
    and exists (
      select 1 from public.duplas d
      where public.supervisiona_dupla(d.id)
        and d.mentor_id = supervisoes.mentor_id)
    and (
      dupla_id is null
      or exists (
        select 1 from public.duplas d
        where d.id = supervisoes.dupla_id
          and public.supervisiona_dupla(d.id)
          and d.mentor_id = supervisoes.mentor_id)
    )
  )
);

drop policy if exists supervisoes_select on public.supervisoes;
create policy supervisoes_select on public.supervisoes for select using (
  public.my_role() = 'coordenacao'
  or supervisor_id = public.my_profile_id()
  or mentor_id = public.my_profile_id()
  or exists (
    select 1 from public.duplas d
    where d.id = supervisoes.dupla_id
      and public.supervisiona_dupla(d.id)
  )
);

-- terceiros (0103): avaliação por terceiros da dupla — mentor dela, auxiliar
-- dela; o jovem lê a consolidação publicada (mentorado + jovem_duplas ficam)
drop policy if exists terceiros_consolidacao_select on public.terceiros_consolidacao;
create policy terceiros_consolidacao_select on public.terceiros_consolidacao
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id()
             or public.supervisiona_dupla(d.id)))
    or (public.my_role() = 'mentorado'
        and publicado_em is not null
        and exists (select 1 from jovem_duplas jd where jd.id = dupla_id)));

drop policy if exists terceiros_contatos_select on public.terceiros_contatos;
create policy terceiros_contatos_select on public.terceiros_contatos
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id()
             or public.supervisiona_dupla(d.id))));

drop policy if exists terceiros_respostas_select on public.terceiros_respostas;
create policy terceiros_respostas_select on public.terceiros_respostas
  for select to authenticated using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.terceiros_contatos c
      join duplas d on d.id = c.dupla_id
      where c.id = contato_id
        and (d.mentor_id = public.my_profile_id()
             or public.supervisiona_dupla(d.id))));

-- ============ 4) views definer com o mesmo recorte ============
-- As três rodam como owner e carregam o predicado no WHERE — sem trocar,
-- mostrariam menos do que a RLS nova deixa ver (o currículo amarrado à view
-- mentira, o contato da dupla faltava, o mural de demandas escondia).

-- profiles_contato (0026): contato do mentor das duplas supervisionadas
create or replace view public.profiles_contato as
select
  p.id,
  p.email,
  p.whatsapp,
  case when public.my_role() = 'coordenacao' then p.documento_path end as documento_path
from public.profiles p
where
  public.my_role() = 'coordenacao'
  or p.id = public.my_profile_id()
  or (
    public.my_role() = 'supervisor'
    and p.id in (
      select d.mentor_id from public.duplas d
      where public.supervisiona_dupla(d.id)
        and d.status in ('ativa', 'pausada')
    )
  );

-- mentorados_curriculo (0081): currículo do jovem das duplas supervisionadas
create or replace view public.mentorados_curriculo as
select
  m.id,
  m.nome,
  m.curriculo_path,
  m.curriculo_url
from public.mentorados m
where public.my_role() = 'coordenacao'::app_role
  or exists (
    select 1
    from public.duplas d
    where d.mentorado_id = m.id
      and public.supervisiona_dupla(d.id)
  );

-- solicitacoes_mural (0087): o mural de demandas da dupla DPP — mentor dela,
-- auxiliar dela, especialista envolvido
create or replace view public.solicitacoes_mural as
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
        or public.supervisiona_dupla(d.id)))
  or (s.status in ('aberta','contra_proposta')
      and public.has_papel('mentor_especialista'::public.app_role)
      and (s.especialista_desejado_id is null
           or s.especialista_desejado_id = public.my_profile_id()))
  or s.especialista_id = public.my_profile_id()
  or s.created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and s.mentorado_id = public.my_mentorado_id());

-- ============ 5) RPCs/guards com o mesmo gate ============
-- Só o predicado "a dupla é minha" troca; corpo idêntico fora isso.

-- jovem_relacionado (0067): o mentorado da dupla que eu mentoro ou
-- supervisiono — alimenta o profiles_select
create or replace function public.jovem_relacionado(p_profile uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from duplas d
    join mentorados m on m.id = d.mentorado_id
    where m.profile_id = p_profile
      and (d.mentor_id = public.my_profile_id()
           or public.supervisiona_dupla(d.id))
  );
$function$;

-- enviar_lembrete (0094): o nudge — coord da turma, auxiliar da dupla,
-- mentor falando com o próprio jovem
create or replace function public.enviar_lembrete(p_dupla_id uuid, p_destino text DEFAULT 'mentor'::text, p_titulo text DEFAULT NULL::text, p_corpo text DEFAULT NULL::text, p_href text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- has_papel com a turma da dupla: coord escopada a outra turma fica fora
  -- ("escopo só filtra, nunca amplia" — 0085). O lado do auxiliar é o
  -- predicado novo (0125): supervisionada direta ou toda a turma dele.
  if not (
    -- coalesce: dupla sem turma (a coluna é not null, mas se um dia afrouxar)
    -- não pode virar alvo de coord escopada — '' só casa coord global
    has_papel('coordenacao', coalesce(v_dupla.turma, ''))
    or public.supervisiona_dupla(p_dupla_id)
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
$function$;

-- trilha_do_jovem (0092): a árvore DPP→especialista — mentor, auxiliar e
-- coord da dupla DPP de origem
create or replace function public.trilha_do_jovem(p_dupla_dpp_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_dpp record;
  v_me  uuid := public.my_profile_id();
begin
  select d.id, d.trilha, d.mentor_id, d.supervisor_id, d.mentorado_id
    into v_dpp
    from public.duplas d
   where d.id = p_dupla_dpp_id;

  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if coalesce(v_dpp.trilha, 'dpp') <> 'dpp'
     or (v_dpp.mentor_id = v_me
         or public.supervisiona_dupla(v_dpp.id)
         or public.has_papel('coordenacao'::public.app_role)) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'dupla_id',            ed.id,
               'especialista_nome',   ep.nome,
               'demanda',             ed.demanda,
               'status',              ed.status,
               'iniciada_em',         ed.iniciada_em,
               'encerrada_em',        ed.encerrada_em,
               'motivo_encerramento', ed.motivo_encerramento,
               'devolutiva_pdm',      ed.devolutiva_pdm,
               'sessoes', coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'id',           e.id,
                            'numero',       e.numero,
                            'data_hora',    e.data_hora,
                            'realizado_em', e.realizado_em,
                            'status',       e.status,
                            'duracao_min',  e.duracao_min,
                            'motivo_reagendamento', e.motivo_reagendamento,
                            'estrelas',     av.estrelas,
                            'registro', case
                              when r.id is null then null
                              else jsonb_build_object(
                                'id',                    r.id,
                                'tema',                  r.tema,
                                'ferramenta',            r.ferramenta,
                                'atividades',            r.atividades,
                                'avaliacao',             r.avaliacao,
                                'dificuldade',           r.dificuldade,
                                'dificuldade_detalhe',   r.dificuldade_detalhe,
                                'reflexoes',             r.reflexoes,
                                'observacoes',           r.observacoes,
                                'proximo_passo',         r.proximo_passo,
                                'proximo_passo_detalhe', r.proximo_passo_detalhe,
                                'precisa_apoio',         r.precisa_apoio,
                                'created_at',            r.created_at,
                                'anexos', coalesce((
                                  select jsonb_agg(
                                           jsonb_build_object(
                                             'nome',    an.nome,
                                             'tamanho', an.tamanho,
                                             'mime',    an.mime
                                           ) order by an.created_at
                                         )
                                    from public.registro_anexos an
                                   where an.registro_id = r.id
                                ), '[]'::jsonb)
                              )
                            end
                          ) order by e.numero
                        )
                   from public.encontros e
                   left join public.registros r on r.encontro_id = e.id
                   left join public.avaliacoes_encontro av on av.encontro_id = e.id
                  where e.dupla_id = ed.id
               ), '[]'::jsonb),
               'devolutivas', coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'autor_nome', ap.nome,
                            'texto',      dv.texto,
                            'created_at', dv.created_at
                          ) order by dv.created_at
                        )
                   from public.devolutivas dv
                   left join public.profiles ap on ap.id = dv.autor_id
                  where dv.dupla_id = ed.id
               ), '[]'::jsonb)
             ) order by ed.iniciada_em desc nulls last
           )
      from public.duplas ed
      left join public.profiles ep on ep.id = ed.mentor_id
     where ed.mentorado_id = v_dpp.mentorado_id
       and ed.trilha = 'especialista'
  ), '[]'::jsonb);
end;
$function$;

-- instrumentos_da_dupla (0080): a árvore de formulários da ficha — mentor,
-- auxiliar e jovem da dupla
create or replace function public.instrumentos_da_dupla(p_dupla_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupla record;
  v_out jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id, d.supervisor_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(v_dupla.id)
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) is not true then
    raise exception 'sem permissão pra ver instrumentos desta dupla';
  end if;

  select coalesce(jsonb_agg(inst order by ordem), '[]'::jsonb)
    into v_out
    from (
      select
        case f.sistema
          when 'visao' then 1 when 'metas' then 2
          when 'pdm' then 3 when 'roda_vida' then 4
        end as ordem,
        jsonb_build_object(
          'sistema', f.sistema,
          'formulario_id', f.id,
          'titulo', f.titulo,
          'descricao', f.descricao,
          'ativo', f.ativo,
          'campos', f.campos,
          'entregas', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'link_id', l.id,
                     -- o token sai junto: quem lê esta RPC é quem entrega
                     -- o link (mentor/coord) ou o próprio destinatário; o
                     -- submit segue protegido pelo gate de identidade (0070).
                     -- Exceção WP7: quando o caller é o mentorado da dupla,
                     -- entregas endereçadas a OUTRO destinatário saem sem
                     -- token (ela não entrega link — evita bearer theft).
                     'token', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else l.token end,
                     'destino', case
                       when l.dest_mentorado_id is not null then 'mentorado'
                       when l.dest_profile_id = v_dupla.mentor_id then 'mentor'
                       else 'outro' end,
                     'status', case
                       when l.usado_em is not null then 'respondido'
                       when l.expira_em is not null and l.expira_em < now()
                         then 'expirado'
                       else 'pendente' end,
                     'respondido_em', r.respondido_em,
                     -- token/respostas nulos em entregas NÃO endereçadas
                     -- ao mentorado quando o caller é ele: um link "pro
                     -- mentor" (insert manual coord) não pode vazar
                     -- bearer token nem resposta pra jovem — ela não
                     -- entrega link a ninguém e anon+token=posse (0070).
                     'respostas', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else r.respostas end,
                     -- WP7: a jornada precisa datar a parada e distinguir
                     -- Roda inicial (enc. 1) da formal (enc. 12–14). São
                     -- metadados do link, não conteúdo novo — por isso
                     -- whitelist de chaves (contexto é jsonb livre da
                     -- coord; nunca devolver o objeto inteiro).
                     'contexto', coalesce((
                       select jsonb_object_agg(cx.key, cx.value)
                         from jsonb_each(l.contexto) as cx(key, value)
                        where cx.key in ('origem','momento','encontro','dupla_id')
                     ), '{}'::jsonb),
                     'created_at', l.created_at,
                     'usado_em', l.usado_em,
                     'expira_em', l.expira_em
                   ) order by l.created_at)
              from formulario_links l
              left join formulario_respostas r on r.link_id = l.id
             where l.formulario_id = f.id
               and l.dupla_id = v_dupla.id
               -- só links endereçados à dupla: um genérico solto na ficha
               -- de outro lugar não vaza pra cá (dupla_id é o escopo)
               and (l.dest_mentorado_id = v_dupla.mentorado_id
                    or l.dest_profile_id = v_dupla.mentor_id)
          ), '[]'::jsonb)
        ) as inst
      from formularios f
      where f.sistema in ('visao', 'roda_vida', 'pdm', 'metas')
    ) s;

  return v_out;
end $function$;

-- painel_instrumentos_jornada (0096): as linhas do painel são as duplas do
-- escopo do papel
create or replace function public.painel_instrumentos_jornada()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (
    public.my_role() = 'coordenacao'
    or public.has_papel('supervisor'::public.app_role)
  ) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'dupla_id', d.id,
        'turma', d.turma,
        'cronograma_id', d.cronograma_id,
        'mentor_id', d.mentor_id,
        'mentor_nome', coalesce(pm.nome_social, pm.nome),
        'mentorado_id', d.mentorado_id,
        'jovem_nome', coalesce(m.nome_social, m.nome),
        'entregas', coalesce((
          select jsonb_object_agg(x.sistema, x.entregas)
            from (
              select f.sistema,
                     jsonb_agg(jsonb_build_object(
                       'status', case
                         when l.usado_em is not null then 'respondido'
                         when l.expira_em is not null and l.expira_em < now()
                           then 'expirado'
                         else 'pendente' end,
                       'created_at', l.created_at,
                       'destino', case
                         when l.dest_mentorado_id is not null then 'mentorado'
                         else 'mentor' end,
                       -- momento (inicial×formal) via a mesma whitelist —
                       -- sem contexto o painel diverge da jornada no corte
                       'contexto', coalesce((
                         select jsonb_object_agg(cx.key, cx.value)
                           from jsonb_each(l.contexto) as cx(key, value)
                          where cx.key in ('origem','momento','encontro','dupla_id')
                       ), '{}'::jsonb)
                     ) order by l.created_at) as entregas
                from formularios f
                join formulario_links l
                  on l.formulario_id = f.id
                 and l.dupla_id = d.id
                 and (l.dest_mentorado_id = d.mentorado_id
                      or l.dest_profile_id = d.mentor_id)
               where f.sistema in ('visao','metas','pdm','roda_vida','avaliacao_360')
               group by f.sistema
            ) x
        ), '{}'::jsonb),
        'avaliacoes_encontro', (
          select jsonb_build_object(
            'feitas', count(a.id),
            'realizados', count(e.id),
            -- posição real da dupla (não a da coorte): dupla tardia tem
            -- janela ainda aberta mesmo com a turma lá na frente
            'max_numero', max(e.numero)
          )
            from encontros e
            left join avaliacoes_encontro a on a.encontro_id = e.id
           where e.dupla_id = d.id
             and e.status = 'realizado'
        )
      )
      order by d.turma, coalesce(m.nome_social, m.nome)
    )
      from duplas d
      join profiles pm on pm.id = d.mentor_id
      join mentorados m on m.id = d.mentorado_id
     where d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
       and (
         public.my_role() = 'coordenacao'
         or public.supervisiona_dupla(d.id)
       )
  ), '[]'::jsonb);
end $function$;

-- pdm_da_dupla (0109): o PDM vivo da ficha — mentor, auxiliar, jovem e coord
create or replace function public.pdm_da_dupla(p_dupla_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupla record;
  v_pdm record;
  v_itens jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id, d.supervisor_id
    into v_dupla
    from public.duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if not (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(v_dupla.id)
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) then
    raise exception 'sem permissão pra ver o PDM desta dupla';
  end if;

  select p.id, p.visao, p.visao_em into v_pdm
    from public.pdm p where p.dupla_id = p_dupla_id;

  if v_pdm.id is null then
    return jsonb_build_object(
      'duplaId', p_dupla_id, 'visao', null, 'visaoEm', null, 'itens', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', i.id,
             'parentId', i.parent_id,
             'titulo', i.titulo,
             'porque', i.porque,
             'indicador', i.indicador,
             'areaVida', i.area_vida,
             'prazoAlvo', i.prazo_alvo,
             'status', i.status,
             'atingidaEm', i.atingida_em,
             'ordem', i.ordem,
             'origem', i.origem,
             'origemCampo', i.origem_campo)
           order by i.ordem, i.created_at), '[]'::jsonb)
    into v_itens
    from public.pdm_itens i
   where i.pdm_id = v_pdm.id;

  return jsonb_build_object(
    'duplaId', p_dupla_id,
    'visao', v_pdm.visao,
    'visaoEm', v_pdm.visao_em,
    'itens', v_itens);
end $function$;

commit;

-- rollback: drop function public.supervisiona_dupla(uuid);
--           alter table public.profile_papeis drop column escopo_supervisao;
--           e replantar as policies/views/funções com o predicado
--           d.supervisor_id = my_profile_id() (texto nas migrations de origem:
--           0001, 0008, 0009, 0026, 0037, 0041, 0053, 0067, 0071, 0074, 0076,
--           0080, 0081, 0087, 0090, 0092, 0094, 0096, 0103, 0107, 0109).
