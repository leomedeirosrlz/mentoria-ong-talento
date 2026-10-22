-- 0107 — dupla_saude_snapshots (REALIZA-182): histórico do semáforo, uma row
-- por (dupla_id, dia). Hoje a saúde é derivada a cada render por
-- saudadeDaDupla() (TS puro) e nada persiste — sem esta tabela não dá pra
-- responder "como estava a dupla semana passada?" nem plotar tendência
-- (consumidores: 56 dashboards, 52 score).
--
-- O cálculo continua em TypeScript — nada de reimplementar o semáforo em
-- PL/pgSQL. Quem computa é o route handler /api/jobs/tick (Vercel Cron
-- diário; pg_cron/pg_net não existem no ambiente) com service role, e a
-- escrita passa por UMA porta: a RPC gravar_saude_snapshots abaixo.
--
-- Leitura: mesmo escopo das telas vivas — coordenação tudo, supervisor as
-- duplas que supervisiona. Mentor/jovem/anon não leem (o histórico não
-- amplia o que já veem). Sem grant nem policy de escrita pra authenticated.

begin;

create table public.dupla_saude_snapshots (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  -- dia civil em America/Sao_Paulo (o handler computa com âncora de
  -- meio-dia BRT; a unique abaixo torna o upsert idempotente por dia)
  dia date not null,
  semaforo text not null check (semaforo in ('ok','atencao','risco')),
  -- motivos = textos do semáforo (motivos[0] é o "motivo" legado);
  -- sinais = [{tipo,tom,texto,detalhe?}] — contagens/ordinais/datas/labels
  -- de enum, sem nome de pessoa nem texto livre (verificação LGPD do PR)
  motivos jsonb not null default '[]',
  sinais jsonb not null default '[]',
  esperado int not null default 0,
  feitos int not null default 0,
  registro_pendente boolean not null default false,
  pediu_apoio boolean not null default false,
  apoio_jovem boolean not null default false,
  avaliacao_jovem_pendente int not null default 0,
  -- cron = tick diário · lazy = write quente (ação humana) · backfill =
  -- recalc retroativo com dados atuais (aproximação, não replay)
  fonte text not null default 'cron'
    check (fonte in ('cron','lazy','backfill')),
  computado_em timestamptz not null default now(),
  unique (dupla_id, dia)
);
create index dupla_saude_snapshots_dia_idx
  on public.dupla_saude_snapshots (dia);

alter table public.dupla_saude_snapshots enable row level security;

-- superfície mínima: anon não lê nada (0032 já revoga por default, mas a
-- revogação explícita é o checklist de toda tabela nova); authenticated lê
-- via policy; escrever ninguém — só a RPC definer abaixo
revoke all on public.dupla_saude_snapshots from public, anon;
grant select on public.dupla_saude_snapshots to authenticated;

-- leitura: coordenação tudo; supervisor só das duplas que supervisiona
-- (mesmo desenho das policies de duplas/registros)
drop policy if exists dupla_saude_snapshots_select
  on public.dupla_saude_snapshots;
create policy dupla_saude_snapshots_select on public.dupla_saude_snapshots
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_saude_snapshots.dupla_id
        and d.supervisor_id = public.my_profile_id()
    )
  );

-- Única porta de escrita: o handler chama com o array de rows do dia
-- (security definer — roda como o owner, então service role não precisa de
-- grant de escrita na tabela e o revogado de anon/authenticated fecha o
-- resto). Upsert na unique natural: o ÚLTIMO cálculo do dia ganha — cron
-- atrasado rodando 2× ou backfill não duplicam nem travam, e computado_em
-- diz quando a row foi (re)escrita.
create or replace function public.gravar_saude_snapshots(p_rows jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_n int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'gravar_saude_snapshots: p_rows deve ser um array jsonb';
  end if;

  insert into dupla_saude_snapshots (
    dupla_id, dia, semaforo, motivos, sinais, esperado, feitos,
    registro_pendente, pediu_apoio, apoio_jovem,
    avaliacao_jovem_pendente, fonte
  )
  select
    r.dupla_id, r.dia, r.semaforo,
    coalesce(r.motivos, '[]'::jsonb),
    coalesce(r.sinais, '[]'::jsonb),
    coalesce(r.esperado, 0),
    coalesce(r.feitos, 0),
    coalesce(r.registro_pendente, false),
    coalesce(r.pediu_apoio, false),
    coalesce(r.apoio_jovem, false),
    coalesce(r.avaliacao_jovem_pendente, 0),
    coalesce(r.fonte, 'cron')
  from jsonb_populate_recordset(null::dupla_saude_snapshots, p_rows) r
  on conflict (dupla_id, dia) do update set
    semaforo = excluded.semaforo,
    motivos = excluded.motivos,
    sinais = excluded.sinais,
    esperado = excluded.esperado,
    feitos = excluded.feitos,
    registro_pendente = excluded.registro_pendente,
    pediu_apoio = excluded.pediu_apoio,
    apoio_jovem = excluded.apoio_jovem,
    avaliacao_jovem_pendente = excluded.avaliacao_jovem_pendente,
    fonte = excluded.fonte,
    computado_em = now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- interna: só service_role executa (o PostgREST dos papéis não tem acesso;
-- o handler é a única chamada). Mesmo desenho de sol_efetivar (0097).
revoke all on function public.gravar_saude_snapshots(jsonb)
  from public, anon, authenticated;

commit;
