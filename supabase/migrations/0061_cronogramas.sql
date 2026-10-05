-- 0061: cronogramas — a entidade que faltava pra segunda turma coexistir
-- (REALIZA-15, spec docs/planos/spec-realiza-15.md).
--
-- Até aqui "ciclo" era um texto solto em duplas e ciclo_eventos, e o
-- calendário era global: com a Turma 2 entrando no ar (06/10), dois
-- cronogramas com datas diferentes corrompiam o semáforo, a agenda e a
-- trilha — cada dupla precisa ser medida contra o calendário DELA.
--
--   cronogramas               — novo; um calendário oficial por turma
--   ciclo_eventos.ciclo       — sai; vira FK cronograma_id (o label da
--                               turma passa a vir do cronograma)
--   duplas.ciclo              — rename pra duplas.turma (label da turma)
--                               + nova FK cronograma_id (o calendário
--                               contra o qual a dupla corre)
--   vaga do mentorado         — sai de (ciclo, mentorado_id, trilha) pra
--                               (mentorado_id, trilha) global: a decisão
--                               fechada é 1 DPP + 1 especialista no máximo,
--                               em qualquer turma (decisões 3ª rodada)
--
-- Especialista não tem cronograma (a trilha dele é livre — 5 encontros do
-- catálogo): duplas.cronograma_id é nullable e o CHECK só exige o vínculo
-- pra DPP ativa/pausada. Histórica (concluída/encerrada) pode ficar sem —
-- a ficha dela cai no fallback de render pelos encontros reais.
begin;

-- ============ 1) a entidade ============
create table if not exists public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) <= 120),
  turma text not null check (char_length(turma) <= 80),
  -- só DPP tem calendário oficial; especialista vive sem cronograma
  trilha text not null default 'dpp' check (trilha in ('dpp')),
  inicio_em date,
  fim_em date,
  encontros_esperados smallint check (encontros_esperados is null or encontros_esperados >= 0),
  status text not null default 'ativo' check (status in ('rascunho', 'ativo', 'encerrado')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.cronogramas enable row level security;

revoke all on public.cronogramas from public, anon;
grant select, insert, update, delete on public.cronogramas to authenticated;

-- mesmo recorte de ciclo_eventos: leitura pra quem tem papel, escrita coord
drop policy if exists cronogramas_select on public.cronogramas;
create policy cronogramas_select on public.cronogramas for select
  using (public.my_role() is not null);
drop policy if exists cronogramas_coord on public.cronogramas;
create policy cronogramas_coord on public.cronogramas for all
  using (public.my_role() = 'coordenacao') with check (public.my_role() = 'coordenacao');

-- ============ 2) backfill: um cronograma por label de ciclo ============
-- União dos DOIS domínios: um label que só exista em duplas (turma sem
-- calendário lançado) também vira cronograma, senão o update de duplas no
-- passo 4 não achava a row e a dupla ficava órfã.
insert into public.cronogramas (nome, turma, inicio_em, fim_em, encontros_esperados)
  select 'Calendário oficial', v.ciclo, e.inicio, e.fim, e.esp::smallint
    from (select ciclo from public.ciclo_eventos
          union
          select ciclo from public.duplas) v(ciclo)
    left join lateral (
      select min(data) as inicio,
             max(greatest(data, coalesce(data_fim, data))) as fim,
             count(*) filter (where tipo = 'encontro') as esp
        from public.ciclo_eventos e
       where e.ciclo = v.ciclo
    ) e on true;

-- ============ 3) ciclo_eventos: texto -> FK ============
alter table public.ciclo_eventos
  add column if not exists cronograma_id uuid references public.cronogramas (id);

update public.ciclo_eventos e
   set cronograma_id = c.id
  from public.cronogramas c
 where c.turma = e.ciclo;

alter table public.ciclo_eventos
  alter column cronograma_id set not null,
  drop column ciclo;

-- identidade do encontro oficial é (cronograma, numero) — numero solto não
-- identifica mais nada. Sem WHERE: o índice também serve FK/join lookup.
create unique index if not exists ciclo_eventos_cronograma_numero_key
  on public.ciclo_eventos (cronograma_id, numero);

-- ============ 4) duplas: ganha FK, ciclo vira turma ============
alter table public.duplas
  add column if not exists cronograma_id uuid references public.cronogramas (id);

update public.duplas d
   set cronograma_id = c.id
  from public.cronogramas c
 where c.turma = d.ciclo;

-- self-test antes de seguir: DPP ativa/pausada sem cronograma aqui significa
-- backfill furado — aborta a transação com mensagem clara
do $$
begin
  if exists (select 1 from public.duplas
              where cronograma_id is null
                and trilha = 'dpp'
                and status in ('ativa', 'pausada')) then
    raise exception '0061: dupla DPP ativa/pausada sem cronograma após backfill';
  end if;
end $$;

alter table public.duplas rename column ciclo to turma;
-- o rename herda o default '2026/2027' — dupla nova sem turma explícita
-- ganharia label fantasma em silêncio. Sem default: quem insere informa.
alter table public.duplas alter column turma drop default;

create index if not exists duplas_cronograma_idx
  on public.duplas (cronograma_id) where cronograma_id is not null;

-- invariante no banco: DPP viva exige calendário; especialista e histórica
-- não. Sem isso um insert direto via PostgREST criava DPP sem cronograma e
-- a ficha degradava em silêncio (semáforo vazio, trilha vazia).
alter table public.duplas drop constraint if exists duplas_dpp_precisa_cronograma;
alter table public.duplas add constraint duplas_dpp_precisa_cronograma
  check (trilha <> 'dpp' or status not in ('ativa', 'pausada') or cronograma_id is not null);

-- ============ 5) vaga do mentorado: global por trilha ============
-- (o rename do passo 4 já atualizou a expressão do índice pra `turma`;
-- aqui o drop pelo nome seguido da versão nova, sem ciclo)
drop index if exists public.duplas_ciclo_mentorado_ativa_key;
create unique index if not exists duplas_mentorado_ativa_key
  on public.duplas (mentorado_id, trilha)
  where status in ('ativa', 'pausada');

-- ============ 6) sync_formacao_ok: ciclo -> turma via join ============
-- PL/pgSQL não é dependency-tracked: o drop da coluna não falharia e a
-- função quebraria em runtime na próxima presença. Replace na mesma tx.
-- Formação é da TURMA (DPP e especialista formam juntos): o denominador é
-- todo evento 'formacao' dos cronogramas daquela turma — não só os do
-- cronograma do evento marcado.
create or replace function public.sync_formacao_ok()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_turma text;
begin
  -- a sync só se aplica a presença em evento de formação — sem o gate, marcar
  -- presença num evento de outro tipo numa turma SEM formação cairia no
  -- "todos os (zero) eventos cobertos" e acenderia formacao_ok à toa
  select c.turma into v_turma
    from public.ciclo_eventos e
    join public.cronogramas c on c.id = e.cronograma_id
   where e.id = new.ciclo_evento_id and e.tipo = 'formacao';
  if not found then return new; end if;

  -- ainda falta algum evento de formação da turma → nada a fazer
  if exists (
    select 1 from public.ciclo_eventos e
    join public.cronogramas c on c.id = e.cronograma_id
    where c.turma = v_turma and e.tipo = 'formacao'
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

-- ============ 7) aceitar_solicitacao: sem o default '2026/2027' ============
-- O insert da dupla de especialista não listava `ciclo` — vivia do default
-- que o rename/drop acabou de remover. A turma certa é a da DPP de origem
-- (s.dupla_dpp_id): especialista nasce dentro da mesma turma. O resto do
-- corpo é verbatim da 0053.
create or replace function public.aceitar_solicitacao(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  nova uuid;
  meu uuid := public.my_profile_id();
begin
  if public.my_role() is distinct from 'mentor_especialista' then
    raise exception 'Só mentores especialistas podem aceitar demandas';
  end if;

  select * into s
    from public.solicitacoes_especialista
   where id = p_id
   for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status <> 'aberta' then
    raise exception 'Essa demanda não está mais aberta';
  end if;
  if s.especialista_desejado_id is not null
     and s.especialista_desejado_id is distinct from meu then
    raise exception 'Essa demanda foi direcionada a outro especialista';
  end if;

  insert into public.mentor_profiles (profile_id, tipo, capacidade)
  values (meu, 'especialista', 1)
  on conflict (profile_id) do nothing;

  insert into public.duplas (mentor_id, mentorado_id, trilha, demanda, solicitacao_id, iniciada_em, turma)
    select meu, s.mentorado_id, 'especialista', s.demanda, s.id, current_date, d.turma
      from public.duplas d
     where d.id = s.dupla_dpp_id
    returning id into nova;

  if nova is null then
    raise exception 'Solicitação sem dupla de origem';
  end if;

  -- flag transaction-local: é a única chave que destrava o branch de
  -- aceite no WITH CHECK da sol_update (0053) — PATCH direto no PostgREST
  -- não consegue ligá-la, então o aceite só acontece por aqui, atômico
  perform set_config('realiza.sol_aceite', 'on', true);

  update public.solicitacoes_especialista
     set status = 'aceita',
         especialista_id = meu,
         dupla_id = nova,
         respondida_em = now()
   where id = s.id;

  return nova;
end
$$;

commit;

-- rollback manual (se precisar reverter o schema, em ordem reversa):
--   alter table public.duplas drop constraint if exists duplas_dpp_precisa_cronograma;
--   drop index if exists public.duplas_mentorado_ativa_key;
--   drop index if exists public.duplas_cronograma_idx;
--   alter table public.duplas rename column turma to ciclo;
--   alter table public.duplas alter column ciclo set default '2026/2027';
--   create unique index duplas_ciclo_mentorado_ativa_key
--     on public.duplas (ciclo, mentorado_id, trilha) where status in ('ativa','pausada');
--   alter table public.ciclo_eventos add column ciclo text;
--   update public.ciclo_eventos e set ciclo = c.turma from public.cronogramas c
--     where c.id = e.cronograma_id;
--   alter table public.ciclo_eventos alter column ciclo set not null,
--     alter column ciclo set default '2026/2027', drop column cronograma_id;
--   drop index if exists public.ciclo_eventos_cronograma_numero_key;
--   alter table public.duplas drop column cronograma_id;
--   recriar sync_formacao_ok / aceitar_solicitacao conforme 0040/0053;
--   drop table public.cronogramas;
