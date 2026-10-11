-- 0073 — agenda real do especialista + capacidade por trilha
--
-- REALIZA-111: o `disponibilidade` jsonb (0034/0038) é palpite de matching,
-- não calendário. Aqui a agenda vira dados de verdade:
--
--   1) `especialista_grade` — janelas semanais recorrentes do especialista
--      (dia_semana × hora_inicio..hora_fim, horário de Brasília).
--   2) `especialista_excecoes` — datas pontuais: `bloqueio` (tira da grade)
--      e `extra` (abre fora dela, ex.: sábado avulso).
--   3) `especialista_slots_livres` — os slots reais: dentro da grade/extra,
--      fora dos bloqueios e sem encontro agendado/remarcado do especialista
--      em cima. Sessões de 1h, largadas a cada 30min.
--   4) `especialista_slot_livre` — validação de um slot exato (a proposta do
--      jovem na REALIZA-112 usa ela).
--   5) `mentor_profiles.capacidade_especialista` — capacidade por trilha.
--      Corrige o bug da 0025: o trigger somava TODAS as duplas (dpp+esp)
--      contra `capacidade` — um mentor DPP com capacidade 1 e uma dupla
--      ativa não conseguia aceitar nenhuma trilha de especialista.
--   6) `solicitacoes_especialista.slot_proposto` — coluna aditiva pro fluxo
--      jovem-iniciado (a máquina de estados é a 112; aqui só o campo).
--
-- O "até 3 meses" do guia deixa de ser prazo rígido e vira sinal de
-- estagnação no semáforo (lado app, `saudadeDaDupla`) — nada no banco.


-- ── 1) grade semanal ─────────────────────────────────────────────────────

create table public.especialista_grade (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- extract(dow) do Postgres: 0=domingo … 6=sábado
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio),
  -- janelas no mesmo dia podem se sobrepor (o cálculo une e deduplica); o
  -- que não faz sentido é a mesma janela cadastrada duas vezes
  unique (profile_id, dia_semana, hora_inicio)
);

comment on table public.especialista_grade is
  'Janelas semanais recorrentes de disponibilidade do especialista (horário de Brasília).';

-- ── 2) exceções datadas ──────────────────────────────────────────────────

create table public.especialista_excecoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  -- bloqueio: rasga a grade naquele dia (viagem, prova, feriado pessoal)
  -- extra: abre janela fora da grade (sábado avulso, férias com folga)
  tipo text not null check (tipo in ('bloqueio', 'extra')),
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

comment on table public.especialista_excecoes is
  'Exceções datadas da grade: bloqueio remove disponibilidade, extra adiciona fora dela.';

create index especialista_excecoes_profile_data
  on public.especialista_excecoes (profile_id, data);

-- ── RLS: quem escreve é o dono da agenda (especialista) ou a coordenação ──
-- O jovem nunca lê a tabela crua — os slots chegam via RPC definer (o
-- catálogo mostra horários, não o planejamento íntimo da semana do adulto).

alter table public.especialista_grade enable row level security;
alter table public.especialista_excecoes enable row level security;

create policy especialista_grade_select on public.especialista_grade
  for select to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao');

create policy especialista_grade_insert on public.especialista_grade
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id() and public.my_role() = 'mentor_especialista')
    or public.my_role() = 'coordenacao'
  );

create policy especialista_grade_update on public.especialista_grade
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id() and public.my_role() = 'mentor_especialista')
    or public.my_role() = 'coordenacao'
  );

create policy especialista_grade_delete on public.especialista_grade
  for delete to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao');

create policy especialista_excecoes_select on public.especialista_excecoes
  for select to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao');

create policy especialista_excecoes_insert on public.especialista_excecoes
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id() and public.my_role() = 'mentor_especialista')
    or public.my_role() = 'coordenacao'
  );

create policy especialista_excecoes_update on public.especialista_excecoes
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id() and public.my_role() = 'mentor_especialista')
    or public.my_role() = 'coordenacao'
  );

create policy especialista_excecoes_delete on public.especialista_excecoes
  for delete to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao');

-- ── 3) slots livres ──────────────────────────────────────────────────────
-- Sessão oficial: 1h ("até 5 encontros de 1h"). Candidatos a cada 30min
-- dentro de cada janela; um início vale quando o bloco [inicio, +60min)
-- não toca nenhum bloqueio nem encontro agendado/remarcado do especialista
-- (qualquer trilha — a agenda física dele é uma só). Os encontros do JOVEM
-- entram na checagem da proposta (112), não aqui.

create or replace function public.especialista_slots_livres(
  p_especialista uuid,
  p_desde date default current_date,
  p_ate date default current_date + 21
)
returns table (inicio timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with dias as (
    select generate_series(p_desde, p_ate, interval '1 day')::date as d
  ),
  janelas as (
    select i.d as data, g.hora_inicio as hi, g.hora_fim as hf
    from dias i
    join public.especialista_grade g
      on g.profile_id = p_especialista
     and g.dia_semana = extract(dow from i.d)::smallint
    union all
    select x.data, x.hora_inicio, x.hora_fim
    from public.especialista_excecoes x
    where x.profile_id = p_especialista
      and x.tipo = 'extra'
      and x.data between p_desde and p_ate
  ),
  candidatos as (
    -- inicio_local é timestamp naïve de Brasília: `date + time` vira
    -- timestamp direto, e as checagens de bloqueio/encontro ficam todas no
    -- mesmo espaço — sem wraparound de `time` nem interval como chave
    select distinct h.slot as inicio_local
    from janelas w
    cross join lateral generate_series(
      w.data + w.hi,
      w.data + w.hf - interval '60 minutes',
      interval '30 minutes'
    ) as h(slot)
  )
  select c.inicio_local at time zone 'America/Sao_Paulo'
  from candidatos c
  where c.inicio_local at time zone 'America/Sao_Paulo' > now()
    -- bloqueio datado rasga a grade naquele dia
    and not exists (
      select 1 from public.especialista_excecoes b
      where b.profile_id = p_especialista
        and b.tipo = 'bloqueio'
        and c.inicio_local < b.data + b.hora_fim
        and c.inicio_local + interval '60 minutes' > b.data + b.hora_inicio
    )
    -- encontro marcado do especialista em qualquer trilha dele
    and not exists (
      select 1
      from public.encontros e
      join public.duplas d on d.id = e.dupla_id
      where d.mentor_id = p_especialista
        and e.status in ('agendado', 'remarcado')
        and e.data_hora is not null
        and e.data_hora
            < c.inicio_local at time zone 'America/Sao_Paulo' + interval '60 minutes'
        and e.data_hora + coalesce(e.duracao_min, 60) * interval '1 minute'
            > c.inicio_local at time zone 'America/Sao_Paulo'
    )
  order by 1;
$$;

comment on function public.especialista_slots_livres(uuid, date, date) is
  'Slots de início livres do especialista (sessões de 1h a cada 30min) dentro da grade + extras − bloqueios − encontros marcados. Aberto a autenticado: é a oferta pública do catálogo.';

-- ── 4) validação de um slot exato (usada pela proposta jovem→especialista,
--    REALIZA-112; antecipada aqui pra RPC e UI checarem a mesma regra) ─────

create or replace function public.especialista_slot_livre(
  p_especialista uuid,
  p_inicio timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.especialista_slots_livres(
      p_especialista,
      (p_inicio at time zone 'America/Sao_Paulo')::date,
      (p_inicio at time zone 'America/Sao_Paulo')::date
    ) s
    where s.inicio = p_inicio
  );
$$;

revoke all on function public.especialista_slots_livres(uuid, date, date) from public, anon;
revoke all on function public.especialista_slot_livre(uuid, timestamptz) from public, anon;
grant execute on function public.especialista_slots_livres(uuid, date, date) to authenticated;
grant execute on function public.especialista_slot_livre(uuid, timestamptz) to authenticated;

-- ── 5) capacidade por trilha ─────────────────────────────────────────────
-- `capacidade` passa a nomear o pool DPP (todas as 26 linhas de prod são
-- dpp=1); `capacidade_especialista` governa a trilha de especialista.
-- Pools independentes: uma sessão de especialista não come vaga de DPP.

alter table public.mentor_profiles
  add column capacidade_especialista smallint not null default 1
    check (capacidade_especialista >= 1);

comment on column public.mentor_profiles.capacidade_especialista is
  'Vagas simultâneas na trilha de especialista — pool separado de `capacidade` (DPP).';

create or replace function public.check_mentor_capacidade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  em_curso int;
  trilha_nova text;
begin
  -- serializa por mentor mesmo sem linha em mentor_profiles: a 0025 usava
  -- `for update` na linha, que é no-op quando ela não existe (race aberto
  -- pra cap=1 implícito). O advisory lock de transação cobre os dois casos.
  perform pg_advisory_xact_lock(hashtext('cap:' || NEW.mentor_id::text));

  trilha_nova := coalesce(NEW.trilha, 'dpp');

  select case when trilha_nova = 'especialista'
              then coalesce(capacidade_especialista, 1)
              else coalesce(capacidade, 1) end
    into cap
    from public.mentor_profiles
    where profile_id = NEW.mentor_id;
  if not found then
    cap := 1;
  end if;

  -- pool por trilha: dupla de especialista não consome vaga de DPP e
  -- vice-versa (o bug da 0025 somava tudo contra `capacidade`)
  select count(*) into em_curso
  from duplas
  where mentor_id = NEW.mentor_id
    and status in ('ativa', 'pausada')
    and coalesce(trilha, 'dpp') = trilha_nova
    and id <> NEW.id;

  if em_curso >= cap then
    -- prefixo preservado: actions-especialista casa /capacidade do mentor
    -- excedida/i pra mensagem amigável
    raise exception 'capacidade do mentor excedida (trilha %)', trilha_nova;
  end if;
  return NEW;
end;
$$;

-- ── 6) slot proposto pelo jovem (fundação da REALIZA-112) ────────────────

alter table public.solicitacoes_especialista
  add column slot_proposto timestamptz;

comment on column public.solicitacoes_especialista.slot_proposto is
  'Início de sessão proposto (dentro dos slots livres do especialista) — preenchido no fluxo jovem-iniciado.';
