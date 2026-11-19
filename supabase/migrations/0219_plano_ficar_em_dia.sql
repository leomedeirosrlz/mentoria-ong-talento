begin;

create table public.dupla_planos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  status text not null default 'proposto'
    check (status in ('proposto','aceito','ativo','concluido','expirado','contestado')),
  escopo jsonb not null,
  versao integer not null,
  proposto_por uuid references public.profiles (id),
  proposto_via text not null default 'app' check (proposto_via in ('app','liza')),
  aprovado_por uuid references public.profiles (id),
  aprovado_lado text check (aprovado_lado in ('mentor','mentorado')),
  aprovado_em timestamptz,
  contestado_por uuid references public.profiles (id),
  contestado_motivo text,
  contestado_em timestamptz,
  expira_em timestamptz not null default (now() + interval '28 days'),
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- um plano vivo por dupla
create unique index dupla_planos_vivo on public.dupla_planos (dupla_id)
  where status in ('proposto','aceito','ativo');
create index dupla_planos_dupla on public.dupla_planos (dupla_id, created_at desc);

-- escopo: {"numeros":[3,4],"ritmo":1,"janela":{"inicio":"YYYY-MM-DD","fim":"YYYY-MM-DD"},"nivel":"ritmo_normal|semana_dupla|conversa_coord","passos":[{"numero":3,"data":"YYYY-MM-DD","acao":"agendar|remarcar"}]}

create table public.dupla_plano_passos (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.dupla_planos (id) on delete cascade,
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  encontro_id uuid references public.encontros (id) on delete set null,
  data_anterior timestamptz,
  data_nova timestamptz not null,
  motivo text,
  aplicado_por uuid references public.profiles (id),
  aplicado_via text not null default 'app' check (aplicado_via in ('app','liza')),
  aplicado_em timestamptz not null default now(),
  unique (plano_id, numero)
);
create index dupla_plano_passos_dupla on public.dupla_plano_passos (dupla_id);

create table public.dupla_plano_eventos (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.dupla_planos (id) on delete cascade,
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  tipo text not null check (tipo in ('proposto','aceito','contestado','passo_aplicado','concluido','expirado')),
  de text,
  para text,
  motivo text,
  por uuid references public.profiles (id),
  meta jsonb not null default '{}'::jsonb,
  em timestamptz not null default now()
);
create index dupla_plano_eventos_plano on public.dupla_plano_eventos (plano_id);

alter table public.dupla_planos enable row level security;
alter table public.dupla_plano_passos enable row level security;
alter table public.dupla_plano_eventos enable row level security;

grant select on public.dupla_planos to authenticated;
grant select on public.dupla_plano_passos to authenticated;
grant select on public.dupla_plano_eventos to authenticated;

-- leitura no escopo da dupla, SEM o mentorado: o recorte dele (sem
-- semáforo/motivos internos) sai pela RPC jovem_plano — molde
-- jovem_recessos (0218). Escrita só pelas RPCs abaixo.
create policy dupla_planos_select on public.dupla_planos
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_planos.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))));
create policy dupla_plano_passos_select on public.dupla_plano_passos
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_plano_passos.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))));
create policy dupla_plano_eventos_select on public.dupla_plano_eventos
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_plano_eventos.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))));

-- ============ notificacoes: tipos do plano ============
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','formulario_respondido',
    'avaliacao_pendente','apoio_jovem','encontro_marcado',
    'encontro_alterado','encontro_desfeito','solicitacao_triagem',
    'solicitacao_recusada','solicitacao_proposta','chamado_aberto',
    'chamado_atribuido','chamado_atualizacao','chamado_resposta_autor',
    'chamado_resolvido','chamado_reaberto','chamado_mencao',
    'sugestao_especialista','devolutiva_especialista','lembrete',
    'dupla_reta_final','terceiro_respondeu','trilha_prazo',
    'trilha_prazo_coord',
    'plano_proposto','plano_aceito','plano_contestado','plano_lembrete',
    'plano_intervencao'
  ]));

-- ============ plano_propor — registra a proposta ============
-- coord ou o mentor da dupla; dupla DPP ativa com cronograma; escopo com
-- encontros da trilha, ritmo 1..4, janela válida; nenhum numero já
-- realizado entra no escopo. Um plano vivo por dupla.
create or replace function public.plano_propor(
  p_dupla uuid,
  p_escopo jsonb,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d record;
  v_vers int;
  v_id uuid;
  v_max int;
  v_ritmo int;
  v_ini date;
  v_fim date;
  v_jovem uuid;
begin
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;

  select d.id, d.status, d.trilha, d.cronograma_id, d.mentor_id, d.mentorado_id
    into v_d
    from public.duplas d
   where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or (public.my_role() = 'mentor_dpp' and v_d.mentor_id = public.my_profile_id())
  ) then
    return jsonb_build_object('error', 'sem permissão pra propor plano desta dupla');
  end if;
  if v_d.trilha is distinct from 'dpp' then
    return jsonb_build_object('error', 'plano em dia é da trilha DPP');
  end if;
  if v_d.status <> 'ativa' then
    return jsonb_build_object('error', 'só dá pra propor plano de dupla ativa');
  end if;
  if v_d.cronograma_id is null then
    return jsonb_build_object('error', 'essa dupla está sem cronograma');
  end if;
  if exists (select 1 from public.dupla_planos p
      where p.dupla_id = p_dupla and p.status in ('proposto','aceito','ativo')) then
    return jsonb_build_object('error', 'já existe um plano aberto — conteste ou conclua antes de propor outro');
  end if;

  -- escopo: encontros da trilha, nenhum já realizado
  if p_escopo is null
     or jsonb_typeof(p_escopo->'numeros') <> 'array'
     or jsonb_array_length(p_escopo->'numeros') = 0 then
    return jsonb_build_object('error', 'escolha ao menos um encontro pro plano');
  end if;
  select max(ev.numero) into v_max
    from public.ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if exists (
    select 1 from jsonb_array_elements_text(p_escopo->'numeros') n
     where n::int < 1 or n::int > coalesce(v_max, 16)
  ) then
    return jsonb_build_object('error', 'encontro fora da trilha desta dupla');
  end if;
  if exists (
    select 1 from public.encontros e
     where e.dupla_id = p_dupla and e.status = 'realizado'
       and e.numero in (select n::int from jsonb_array_elements_text(p_escopo->'numeros') n)
  ) then
    return jsonb_build_object('error', 'encontro já realizado não entra no plano');
  end if;

  v_ritmo := coalesce((p_escopo->>'ritmo')::int, 2);
  if v_ritmo < 1 or v_ritmo > 4 then
    return jsonb_build_object('error', 'ritmo precisa ser entre 1 e 4 encontros por semana');
  end if;
  begin
    v_ini := (p_escopo->'janela'->>'inicio')::date;
    v_fim := (p_escopo->'janela'->>'fim')::date;
  exception when others then
    return jsonb_build_object('error', 'janela do plano inválida');
  end;
  if v_ini is null or v_fim is null or v_ini > v_fim then
    return jsonb_build_object('error', 'janela do plano inválida');
  end if;

  v_vers := 1 + coalesce((
    select max(p.versao) from public.dupla_planos p where p.dupla_id = p_dupla), 0);

  insert into public.dupla_planos
    (dupla_id, escopo, versao, proposto_por, proposto_via)
  values (p_dupla, p_escopo, v_vers, public.my_profile_id(), p_via)
  returning id into v_id;

  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, para, por, meta)
  values (v_id, p_dupla, 'proposto', 'proposto', public.my_profile_id(),
          jsonb_build_object('versao', v_vers, 'via', p_via));

  -- aviso pro outro lado ver/aceitar (desenho item 7): mentor/coord
  -- propõe → o jovem (e o mentor, quando a proposta é da coord) recebe.
  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'plano_proposto',
           'Plano "ficar em dia" proposto',
           'A Liza montou um plano pra colocar vocês em dia — veja o combinado e aceite.',
           case when dest.role = 'mentorado' then '/jovem/agenda'
                else '/duplas/' || p_dupla end,
           public.my_profile_id()
      from profiles dest
     where dest.id = any (array[v_d.mentor_id, v_jovem])
       and dest.id is distinct from public.my_profile_id();

  return jsonb_build_object('ok', true, 'id', v_id, 'versao', v_vers);
end $$;

revoke all on function public.plano_propor(uuid, jsonb, text) from public, anon;
grant execute on function public.plano_propor(uuid, jsonb, text) to authenticated;

-- ============ plano_responder — aceitar ou contestar ============
-- Qualquer um dos dois lados (mentor OU mentorado) responde; aprovação de
-- um lado basta e o outro é notificado. Contestação até um encontro do
-- escopo acontecer.
create or replace function public.plano_responder(
  p_plano uuid,
  p_acao text,
  p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p public.dupla_planos%rowtype;
  v_d record;
  v_lado text;
  v_jovem uuid;
begin
  if p_acao not in ('aceitar','contestar') then
    return jsonb_build_object('error', 'ação inválida');
  end if;

  select * into v_p from public.dupla_planos p where p.id = p_plano for update;
  if not found then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;
  select d.mentor_id, d.mentorado_id into v_d
    from public.duplas d where d.id = v_p.dupla_id;

  v_lado := case
    when v_d.mentor_id = public.my_profile_id() then 'mentor'
    when v_d.mentorado_id = public.my_mentorado_id() then 'mentorado'
  end;
  if v_lado is null then
    return jsonb_build_object('error', 'só a dupla responde o plano');
  end if;
  if v_p.status not in ('proposto','aceito','ativo') then
    return jsonb_build_object('error', 'esse plano não está mais aberto');
  end if;

  select m.profile_id into v_jovem from public.mentorados m where m.id = v_d.mentorado_id;

  if p_acao = 'aceitar' then
    if v_p.aprovado_por is not null and v_p.aprovado_lado = v_lado then
      return jsonb_build_object('ok', true, 'idempotente', true, 'status', v_p.status);
    end if;
    update public.dupla_planos
       set status = case when status = 'proposto' then 'aceito' else status end,
           aprovado_por = coalesce(aprovado_por, public.my_profile_id()),
           aprovado_lado = coalesce(aprovado_lado, v_lado),
           aprovado_em = coalesce(aprovado_em, now()),
           updated_at = now()
     where id = p_plano;
    insert into public.dupla_plano_eventos
      (plano_id, dupla_id, tipo, de, para, por, meta)
    values (p_plano, v_p.dupla_id, 'aceito', v_p.status, 'aceito',
            public.my_profile_id(), jsonb_build_object('lado', v_lado));
    insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
      select dest.id, 'plano_aceito',
             'Plano "ficar em dia" aceito',
             'O plano foi aceito — se discordar, dá pra contestar até o próximo encontro acontecer.',
             case when dest.role = 'mentorado' then '/jovem/agenda'
                  else '/duplas/' || v_p.dupla_id end,
             public.my_profile_id()
        from profiles dest
       where dest.id = any (array[v_d.mentor_id, v_jovem])
         and dest.id is distinct from public.my_profile_id();
    return jsonb_build_object('ok', true);
  end if;

  -- contestar: só até um encontro do escopo acontecer de fato
  if exists (
    select 1 from public.encontros e
     where e.dupla_id = v_p.dupla_id and e.status = 'realizado'
       and e.numero in (select n::int from jsonb_array_elements_text(v_p.escopo->'numeros') n)
       and e.realizado_em >= coalesce(v_p.aprovado_em, v_p.created_at)
  ) then
    return jsonb_build_object('error', 'o plano já teve encontro acontecendo — fale com a coordenação');
  end if;

  update public.dupla_planos
     set status = 'contestado',
         contestado_por = public.my_profile_id(),
         contestado_motivo = nullif(btrim(p_motivo), ''),
         contestado_em = now(),
         updated_at = now()
   where id = p_plano;
  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, de, para, motivo, por, meta)
  values (p_plano, v_p.dupla_id, 'contestado', v_p.status, 'contestado',
          nullif(btrim(p_motivo), ''), public.my_profile_id(),
          jsonb_build_object('lado', v_lado));
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'plano_contestado',
           'Plano "ficar em dia" contestado',
           'O plano foi contestado — conversem e a Liza monta uma nova versão.',
           case when dest.role = 'mentorado' then '/jovem/agenda'
                else '/duplas/' || v_p.dupla_id end,
           public.my_profile_id()
      from profiles dest
     where dest.id = any (array[v_d.mentor_id, v_jovem])
       and dest.id is distinct from public.my_profile_id();
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.plano_responder(uuid, text, text) from public, anon;
grant execute on function public.plano_responder(uuid, text, text) to authenticated;

-- ============ plano_aplicar_passo — remarcação dentro do plano ============
-- Regras duras do desenho item 3: nunca no passado; nunca em encontro
-- realizado; número dentro do escopo e data dentro da janela do plano;
-- idempotente (unique plano_id+numero — segunda chamada devolve o mesmo
-- passo); autoria + motivo gravados no passo e na linha do encontro (o
-- trigger encontro_notifica_agenda já avisa os dois lados; o ledger
-- encontro_remarcacoes continua sendo gravado pelo trigger).
create or replace function public.plano_aplicar_passo(
  p_plano uuid,
  p_numero integer,
  p_data_hora timestamptz,
  p_link text default null,
  p_motivo text default null,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p public.dupla_planos%rowtype;
  v_d record;
  v_e record;
  v_passo record;
  v_enc uuid;
  v_ini date;
  v_fim date;
begin
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;

  select * into v_p from public.dupla_planos p where p.id = p_plano for update;
  if not found then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;
  select d.mentor_id, d.mentorado_id, d.status, d.cronograma_id
    into v_d from public.duplas d where d.id = v_p.dupla_id;

  -- membro da dupla — mesma fronteira de quem agenda hoje
  if not (v_d.mentor_id = public.my_profile_id()
          or v_d.mentorado_id = public.my_mentorado_id()) then
    return jsonb_build_object('error', 'só a dupla aplica os passos do plano');
  end if;
  if v_p.status not in ('aceito','ativo') then
    return jsonb_build_object('error', 'o plano precisa estar aceito pra aplicar passos');
  end if;
  if v_d.status <> 'ativa' then
    return jsonb_build_object('error', 'a dupla não está mais ativa');
  end if;
  if p_numero is null
     or not exists (
       select 1 from jsonb_array_elements_text(v_p.escopo->'numeros') n
        where n::int = p_numero) then
    return jsonb_build_object('error', 'esse encontro não faz parte do plano');
  end if;

  -- idempotente: passo já aplicado devolve o mesmo registro
  select * into v_passo from public.dupla_plano_passos s
   where s.plano_id = p_plano and s.numero = p_numero;
  if found then
    return jsonb_build_object('ok', true, 'idempotente', true,
                              'encontro_id', v_passo.encontro_id);
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    return jsonb_build_object('error', 'reagendamento é sempre pra frente — escolha uma data futura');
  end if;
  v_ini := (v_p.escopo->'janela'->>'inicio')::date;
  v_fim := (v_p.escopo->'janela'->>'fim')::date;
  if p_data_hora::date < v_ini or p_data_hora::date > v_fim then
    return jsonb_build_object('error', 'a data precisa ficar dentro da janela do plano');
  end if;
  if p_link is not null and p_link !~ '^https?://' then
    return jsonb_build_object('error', 'confira o link: precisa ser um endereço completo (https://…)');
  end if;

  select * into v_e from public.encontros e
   where e.dupla_id = v_p.dupla_id and e.numero = p_numero;
  if v_e.status = 'realizado' then
    return jsonb_build_object('error', 'esse encontro já foi realizado');
  end if;
  if v_e.id is not null
     and v_e.data_hora is distinct from p_data_hora
     and (p_motivo is null or char_length(btrim(p_motivo)) < 2) then
    return jsonb_build_object('error', 'conte o motivo do reagendamento');
  end if;

  if v_e.id is not null then
    update public.encontros
       set data_hora = p_data_hora,
           link = p_link,
           status = 'agendado',
           motivo_reagendamento = coalesce(nullif(btrim(p_motivo), ''), motivo_reagendamento)
     where id = v_e.id and status in ('agendado','nao_aconteceu','remarcado','cancelado');
    if not found then
      return jsonb_build_object('error', 'esse encontro não está mais agendável');
    end if;
    v_enc := v_e.id;
  else
    insert into public.encontros
      (dupla_id, numero, data_hora, link, status, origem,
       motivo_reagendamento, created_by)
    values (v_p.dupla_id, p_numero, p_data_hora, p_link, 'agendado',
            'plataforma', nullif(btrim(p_motivo), ''), public.my_profile_id())
    returning id into v_enc;
  end if;

  insert into public.dupla_plano_passos
    (plano_id, dupla_id, numero, encontro_id, data_anterior, data_nova,
     motivo, aplicado_por, aplicado_via)
  values (p_plano, v_p.dupla_id, p_numero, v_enc, v_e.data_hora, p_data_hora,
          nullif(btrim(p_motivo), ''), public.my_profile_id(), p_via);

  if v_p.status = 'aceito' then
    update public.dupla_planos set status = 'ativo', updated_at = now()
     where id = p_plano;
  end if;
  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, de, para, motivo, por, meta)
  values (p_plano, v_p.dupla_id, 'passo_aplicado', null, 'ativo',
          nullif(btrim(p_motivo), ''), public.my_profile_id(),
          jsonb_build_object('numero', p_numero, 'data_anterior', v_e.data_hora,
                             'data_nova', p_data_hora, 'via', p_via));

  return jsonb_build_object('ok', true, 'encontro_id', v_enc);
end $$;

revoke all on function public.plano_aplicar_passo(uuid, integer, timestamptz, text, text, text) from public, anon;
grant execute on function public.plano_aplicar_passo(uuid, integer, timestamptz, text, text, text) to authenticated;

-- ============ jovem_plano — recorte do mentorado ============
-- Molde jovem_recessos (0218): sem semáforo e sem motivos internos — só o
-- combinado (status, ritmo, passos e datas, quem aprovou, validade).
create or replace function public.jovem_plano()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
  v_p record;
begin
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  select d.id into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  select p.* into v_p
    from dupla_planos p
   where p.dupla_id = v_dupla.id
   order by (p.status in ('proposto','aceito','ativo')) desc,
            p.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'status', v_p.status,
    'versao', v_p.versao,
    'ritmo', v_p.escopo->>'ritmo',
    'janela', v_p.escopo->'janela',
    'passos', v_p.escopo->'passos',
    'aprovado_lado', v_p.aprovado_lado,
    'expira_em', v_p.expira_em,
    'passos_aplicados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', s.numero, 'data_nova', s.data_nova,
               'aplicado_em', s.aplicado_em) order by s.numero)
        from dupla_plano_passos s
       where s.plano_id = v_p.id), '[]'::jsonb)
  );
end $$;

revoke all on function public.jovem_plano() from public, anon;
grant execute on function public.jovem_plano() to authenticated;

-- ============ plano_ciclo — tick diário do job ============
-- Expira planos vivos vencidos e conclui quem cobriu o escopo inteiro.
-- service_role only (mesmo desenho de gravar_saude_snapshots).
create or replace function public.plano_ciclo()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_p record;
  v_n int := 0;
begin
  for v_p in
    select * from public.dupla_planos
     where status in ('proposto','aceito','ativo') and expira_em < now()
  loop
    update public.dupla_planos set status = 'expirado', updated_at = now()
     where id = v_p.id;
    insert into public.dupla_plano_eventos (plano_id, dupla_id, tipo, de, para)
    values (v_p.id, v_p.dupla_id, 'expirado', v_p.status, 'expirado');
    v_n := v_n + 1;
  end loop;

  for v_p in
    select * from public.dupla_planos where status in ('aceito','ativo')
  loop
    if not exists (
      select 1
        from jsonb_array_elements_text(v_p.escopo->'numeros') n
       where not exists (
         select 1 from public.encontros e
          where e.dupla_id = v_p.dupla_id
            and e.numero = n::int and e.status = 'realizado')
    ) then
      update public.dupla_planos
         set status = 'concluido', concluido_em = now(), updated_at = now()
       where id = v_p.id;
      insert into public.dupla_plano_eventos (plano_id, dupla_id, tipo, de, para)
      values (v_p.id, v_p.dupla_id, 'concluido', v_p.status, 'concluido');
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end $$;

revoke all on function public.plano_ciclo() from public, anon, authenticated;

commit;
