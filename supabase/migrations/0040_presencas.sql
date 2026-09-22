-- 0040: presença nos rituais do ciclo — a chamada que faltava. O programa
-- exige os 2 encontros de formação de mentores e até aqui formacao_ok era um
-- checkbox manual da coordenação, sem registro de quem foi em quê.
--
--   presencas — uma row por (evento do ciclo, pessoa): a coordenação faz a
--     chamada no detalhe do dia da agenda. `presente = false` é ausência
--     explícita, não "row apagada" — delete nem tem grant: o histórico da
--     chamada é dado de auditoria e sai só em cascade (pessoa ou evento).
--   sync_formacao_ok — presente em TODOS os eventos 'formacao' do ciclo →
--     mentor_profiles.formacao_ok = true. Só marca, nunca desmarca:
--     formacao_ok também cobre exceções manuais da coordenação (dispensa,
--     formação equivalente concluída fora) e desfazer a flag ao remover uma
--     presença apagaria essa decisão.
begin;

create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  ciclo_evento_id uuid not null references public.ciclo_eventos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  presente boolean not null default true,
  -- set null: apagar quem fez a chamada não derruba o histórico dela
  marcado_por uuid references public.profiles (id) on delete set null,
  marcado_em timestamptz not null default now(),
  unique (ciclo_evento_id, profile_id)
);

-- lookup por pessoa (resumo "N de M" da ficha) — a unique cobre o lookup por evento
create index presencas_profile_id on public.presencas (profile_id);

alter table public.presencas enable row level security;

grant select, insert, update on public.presencas to authenticated;

-- leitura: coordenação tudo; a própria pessoa a sua linha; supervisor lê a
-- presença dos mentores das duplas ativas/pausadas que supervisiona (mesmo
-- recorte da view profiles_contato, 0026)
create policy presencas_select on public.presencas for select using (
  public.my_role() = 'coordenacao'
  or profile_id = public.my_profile_id()
  or (
    public.my_role() = 'supervisor'
    and exists (
      select 1 from public.duplas d
      where d.mentor_id = presencas.profile_id
        and d.supervisor_id = public.my_profile_id()
        and d.status in ('ativa', 'pausada')
    )
  )
);

-- escrita: só a coordenação faz a chamada
create policy presencas_coord on public.presencas for all
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

-- marcado_por/marcado_em vêm do token, não do cliente (padrão do
-- stamp_solicitacao_autor, 0027): cada toque na row recarimba quem marcou
create or replace function public.stamp_presenca()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.marcado_por := public.my_profile_id();
  new.marcado_em := now();
  return new;
end $$;
create trigger presencas_stamp
  before insert or update on public.presencas
  for each row execute function public.stamp_presenca();

-- formação concluída = presente em TODOS os eventos 'formacao' do ciclo do
-- evento marcado (presença só existe no ciclo vigente, então o ciclo do
-- próprio evento é o recorte certo). After insert/update: delete não dispara
-- porque a sync nunca desmarca.
create or replace function public.sync_formacao_ok()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ciclo text;
begin
  -- a sync só se aplica a presença em evento de formação — sem o gate, marcar
  -- presença num evento de outro tipo num ciclo SEM formação cairia no
  -- "todos os (zero) eventos cobertos" e acenderia formacao_ok à toa
  select e.ciclo into v_ciclo from public.ciclo_eventos e
   where e.id = new.ciclo_evento_id and e.tipo = 'formacao';
  if not found then return new; end if;

  -- ainda falta algum encontro de formação do ciclo → nada a fazer
  if exists (
    select 1 from public.ciclo_eventos e
    where e.ciclo = v_ciclo and e.tipo = 'formacao'
      and not exists (
        select 1 from public.presencas p
        where p.ciclo_evento_id = e.id
          and p.profile_id = new.profile_id
          and p.presente
      )
  ) then
    return new;
  end if;

  -- a flag transaction-local libera SÓ formacao_ok no guard da 0004 — sem ela
  -- a sync cairia no "campos de validação só pela coordenação" quando a
  -- escrita em presencas não veio de um JWT de coordenação (service_role,
  -- seed, backfill via SQL). PostgREST executa um statement por transação,
  -- então um usuário não consegue ligar a flag antes de um update direto.
  perform set_config('realiza.formacao_sync', '1', true);
  update public.mentor_profiles mp
     set formacao_ok = true
   where mp.profile_id = new.profile_id and not mp.formacao_ok;
  return new;
end $$;
create trigger presencas_sync_formacao
  after insert or update on public.presencas
  for each row execute function public.sync_formacao_ok();

-- guard da 0004 com a exceção da sync: termo_ok/capacidade/tipo seguem
-- travados pra não-coord em qualquer contexto; formacao_ok também, exceto
-- quando a flag da sync está ligada (ela é a única escritora automática)
create or replace function public.guard_mentor_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and (new.termo_ok is distinct from old.termo_ok
          or new.capacidade is distinct from old.capacidade
          or new.tipo is distinct from old.tipo
          or (new.formacao_ok is distinct from old.formacao_ok
              and current_setting('realiza.formacao_sync', true) is distinct from '1')) then
    raise exception 'campos de validacao so podem ser alterados pela coordenacao';
  end if;
  return new;
end $$;

commit;
