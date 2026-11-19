-- 0218: recesso opcional por dupla (REALIZA-462, US6 da spec 009). O
-- calendário do cronograma continua oficial e imutável; o que a dupla
-- declara é como ELA lida com cada janela de recesso: "vamos usar o
-- recesso" (usa=true — igual ao comportamento de sempre e o default
-- quando não há linha) ou "vamos seguir nos encontrando" (usa=false —
-- o planner pode sugerir datas dentro da janela e as agendas mostram o
-- período como disponível pra dupla). Uma linha por (dupla, evento de
-- recesso): redeclarar atualiza a mesma linha e declarado_em guarda a
-- data da última mudança. A decisão amarra no ID do evento, não na data —
-- se a coordenação move a janela no cronograma, a declaração segue o
-- evento.

begin;

create table public.dupla_recessos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  ciclo_evento_id uuid not null references public.ciclo_eventos (id) on delete cascade,
  usa boolean not null,
  declarado_por uuid references public.profiles (id),
  declarado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (dupla_id, ciclo_evento_id)
);

create index dupla_recessos_evento on public.dupla_recessos (ciclo_evento_id);

alter table public.dupla_recessos enable row level security;

grant select on public.dupla_recessos to authenticated;

-- leitura no escopo da dupla — mesmo desenho de encontros_select (0001):
-- staff/coord, o mentor da dupla, o supervisor dela e o mentorado via
-- jovem_duplas. ESCRITA NÃO É POLICY: só a RPC definer declarar_recesso
-- grava — a decisão passa pelos guards de domínio (dupla ativa, evento é
-- recesso do cronograma dela, autor carimbado).
create policy dupla_recessos_select on public.dupla_recessos
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_recessos.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))
    )
    or (public.my_role() = 'mentorado'
        and exists (select 1 from public.jovem_duplas jd
                    where jd.id = dupla_recessos.dupla_id))
  );

comment on table public.dupla_recessos is
'Decisão declarada da dupla sobre um recesso do cronograma (REALIZA-462). usa=true "vamos usar o recesso" (também é o default implícito quando não há linha); usa=false "vamos seguir nos encontrando" — o planner pode sugerir datas dentro da janela e a agenda trata o período como disponível pra dupla. Última declaração vale: (dupla_id, ciclo_evento_id) é único e declarado_em registra a última mudança.';

-- ============ declarar_recesso — a única porta de escrita ============
-- Guards: coordenação ou o mentor DAQUELA dupla; dupla DPP ativa; o
-- evento é recesso (tipo='recesso', com data) do cronograma DELA.
-- Recesso já passado aceita a declaração sem erro — sem efeito sobre o
-- passado, e a escolha fica visível.
create or replace function public.declarar_recesso(
  p_dupla uuid,
  p_evento uuid,
  p_usa boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_evento record;
begin
  select d.id, d.cronograma_id, d.status, d.trilha, d.mentor_id
    into v_dupla
    from public.duplas d
   where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;

  if not (
    public.my_role() = 'coordenacao'
    or (public.my_role() = 'mentor_dpp'
        and v_dupla.mentor_id = public.my_profile_id())
  ) then
    return jsonb_build_object(
      'error', 'sem permissão pra declarar o recesso desta dupla');
  end if;

  if v_dupla.status <> 'ativa' then
    return jsonb_build_object(
      'error', 'só dá pra declarar recesso de dupla ativa');
  end if;

  if v_dupla.trilha is distinct from 'dpp' then
    return jsonb_build_object(
      'error', 'recesso do cronograma só vale pra trilha DPP');
  end if;

  select e.id, e.tipo, e.cronograma_id, e.data
    into v_evento
    from public.ciclo_eventos e
   where e.id = p_evento;
  if not found or v_evento.tipo <> 'recesso' or v_evento.data is null then
    return jsonb_build_object(
      'error', 'esse evento não é um recesso do calendário');
  end if;
  if v_evento.cronograma_id is distinct from v_dupla.cronograma_id then
    return jsonb_build_object(
      'error', 'esse recesso não é do cronograma desta dupla');
  end if;

  insert into public.dupla_recessos
         (dupla_id, ciclo_evento_id, usa, declarado_por, declarado_em)
  values (p_dupla, p_evento, p_usa, public.my_profile_id(), now())
  on conflict (dupla_id, ciclo_evento_id)
  do update set usa = excluded.usa,
                declarado_por = excluded.declarado_por,
                declarado_em = excluded.declarado_em;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.declarar_recesso(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.declarar_recesso(uuid, uuid, boolean)
  to authenticated;

-- ============ jovem_recessos — a leitura do mentorado ============
-- O papel mentorado não lê ciclo_eventos (a RLS filtra) nem a tabela
-- duplas: a janela de recesso chega por definer, no mesmo gate do
-- jovem_jornada (0096). Devolve os recessos vigentes/futuros do
-- cronograma da dupla DPP dele + a decisão declarada (usa default true).
create or replace function public.jovem_recessos()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
begin
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  -- a dupla DPP mais recente — mesma régua do jovem_jornada (0096)
  select d.id, d.cronograma_id
    into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'ciclo_evento_id', e.id,
             'data', e.data,
             'data_fim', e.data_fim,
             'usa', coalesce(r.usa, true),
             'declarado_em', r.declarado_em
           ) order by e.data)
      from ciclo_eventos e
      left join dupla_recessos r
        on r.ciclo_evento_id = e.id and r.dupla_id = v_dupla.id
     where e.cronograma_id = v_dupla.cronograma_id
       and e.tipo = 'recesso'
       and e.data is not null
       and coalesce(e.data_fim, e.data) >= current_date
  ), '[]'::jsonb);
end $$;

revoke all on function public.jovem_recessos() from public, anon;
grant execute on function public.jovem_recessos() to authenticated;

commit;
