-- 0198 — adocao_* (REALIZA-417, fase 2): agregações da aba Adoção do
-- workbench de relatórios. Lêem produto_eventos (0197) e devolvem
-- formas pequenas e prontas pro client — ~100k eventos/janela não podem
-- descer brutos pro browser agregar.
--
-- Todas `security invoker` (default): a RLS de produto_eventos faz a
-- borda — coordenação vê o programa inteiro agregado; qualquer outro
-- papel recebe o agregado honesto dos próprios eventos (inofensivo e
-- coerente com o select dele na tabela). Nenhuma função vaza dado que o
-- caller já não poderia ler linha a linha.
--
-- p_papel = filtro de recorte da régua da aba (null = todos). Os
-- agregados trabalham sobre `papel` gravado no evento — o papel efetivo
-- no momento do gesto, não o papel atual da pessoa.

begin;

-- Re-aplicável: a revisão da auditoria mudou assinaturas (p_papel novo)
-- e o return type de adocao_superficies (ganhou tendencia) — create or
-- replace não troca returns nem remove overloads velhos, então derruba
-- as formas anteriores antes. Sem dados nessas funções (são views
-- computadas), o drop é seguro.
drop function if exists public.adocao_resumo(timestamptz, timestamptz);
drop function if exists public.adocao_caminhos(timestamptz, int);
drop function if exists public.adocao_superficies(timestamptz, text);

-- O beacon carimba `meta.ts` (epoch ms do client) porque o lote grava
-- num statement só — transaction_timestamp() empataria os 20 eventos e
-- a sessionização dos caminhos perderia a ordem real. created_at usa o
-- ts quando ele é plausível (relógio do client não é confiável: aceita
-- até 1h no passado, 5min no futuro; fora disso cai no now() do banco).
create or replace function public.registrar_produto_eventos(p_eventos jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_papel text;
  v_n int := 0;
begin
  v_profile := public.my_profile_id();
  if v_profile is null then
    return 0;
  end if;
  v_papel := public.my_role();

  insert into public.produto_eventos (profile_id, papel, superficie, acao, meta, created_at)
    select
      v_profile,
      coalesce(v_papel, 'desconhecido'),
      left(e.superficie, 64),
      e.acao,
      coalesce(e.meta, '{}'::jsonb),
      case
        when (e.meta->>'ts') ~ '^\d+$'
          and to_timestamp((e.meta->>'ts')::double precision / 1000)
              between now() - interval '1 hour' and now() + interval '5 minutes'
        then to_timestamp((e.meta->>'ts')::double precision / 1000)
        else now()
      end
    from jsonb_to_recordset(
      case when jsonb_typeof(p_eventos) = 'array' then p_eventos else '[]'::jsonb end
    ) as e(superficie text, acao text, meta jsonb)
    where e.acao in (
      'pageview', 'busca', 'sort', 'dialog',
      'nudge', 'form_emitido', 'material_aberto', 'lembrete_whatsapp'
    )
      and e.acao is not null
      and e.superficie is not null and e.superficie <> ''
      and jsonb_typeof(coalesce(e.meta, '{}'::jsonb)) = 'object'
    limit 20;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- KPIs da régua: janela atual × janela anterior equivalente --
-- coletando_desde ancora o estado "acumulando" da aba.
create or replace function public.adocao_resumo(
  p_desde timestamptz,
  p_ate timestamptz default now(),
  p_papel text default null
)
returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'ativas', (select count(distinct profile_id) from produto_eventos
                where created_at >= p_desde and created_at < p_ate
                  and (p_papel is null or papel = p_papel)),
    'ativas_prev', (select count(distinct profile_id) from produto_eventos
                     where created_at >= p_desde - (p_ate - p_desde)
                       and created_at < p_desde
                       and (p_papel is null or papel = p_papel)),
    'gestos', (select count(*) from produto_eventos
                where created_at >= p_desde and created_at < p_ate
                  and (p_papel is null or papel = p_papel)),
    'gestos_prev', (select count(*) from produto_eventos
                     where created_at >= p_desde - (p_ate - p_desde)
                       and created_at < p_desde
                       and (p_papel is null or papel = p_papel)),
    'sups_vivas', (select count(distinct superficie) from produto_eventos
                    where created_at >= p_desde and created_at < p_ate
                      and (p_papel is null or papel = p_papel)
                      and superficie in (
                        'home','duplas','ficha_dupla','turmas','agenda',
                        'registros','materiais','jovem','relatorios',
                        'formularios','pessoas','chamados','ia',
                        'assistente','perfil','ajuda','assinar')),
    'coletando_desde', (select min(created_at) from produto_eventos)
  );
$$;

-- ---------- matriz superfície × papel (o heatmap, toggle pessoas/gestos)
create or replace function public.adocao_matriz(
  p_desde timestamptz,
  p_papel text default null
)
returns table(superficie text, papel text, pessoas bigint, gestos bigint)
language sql stable set search_path = public as $$
  select superficie, papel,
         count(distinct profile_id),
         count(*)
  from produto_eventos
  where created_at >= p_desde
    and (p_papel is null or papel = p_papel)
  group by 1, 2;
$$;

-- ---------- série diária (barras por dia; papel abre empilhamento) ----
create or replace function public.adocao_serie_dia(
  p_desde timestamptz,
  p_papel text default null
)
returns table(dia date, papel text, gestos bigint, pessoas bigint)
language sql stable set search_path = public as $$
  select (created_at at time zone 'America/Sao_Paulo')::date, papel,
         count(*),
         count(distinct profile_id)
  from produto_eventos
  where created_at >= p_desde
    and (p_papel is null or papel = p_papel)
  group by 1, 2
  order by 1;
$$;

-- ---------- a lista de trabalho L3: uma linha por superfície ----------
-- tendencia = série diária da própria superfície (sparkline da linha).
create or replace function public.adocao_superficies(
  p_desde timestamptz,
  p_papel text default null
)
returns table(superficie text, gestos bigint, pessoas bigint,
              papeis jsonb, ultimo timestamptz, tendencia jsonb)
language sql stable set search_path = public as $$
  select s.superficie,
         count(*),
         count(distinct s.profile_id),
         jsonb_agg(distinct s.papel order by s.papel),
         max(s.created_at),
         (select jsonb_agg(jsonb_build_object('d', t.dia, 'g', t.g) order by t.dia)
            from (select (e.created_at at time zone 'America/Sao_Paulo')::date as dia,
                         count(*) as g
                    from produto_eventos e
                    where e.superficie = s.superficie
                      and e.created_at >= p_desde
                      and (p_papel is null or e.papel = p_papel)
                    group by 1) t) as tendencia
  from produto_eventos s
  where s.created_at >= p_desde
    and (p_papel is null or s.papel = p_papel)
  group by 1;
$$;

-- ---------- coorte de retorno: semana do 1º evento × semanas ativas ---
-- "ativo" = emitiu pageview naquela semana (gesto neutro de presença —
-- nudge emitido pela coord não conta retorno do usuário). Retenção é
-- dimensão-pessoa (papel do evento ≠ papel estável), então o recorte de
-- papel não se aplica aqui — a aba declara isso no card.
-- semanas_vivas emite semana=0 também quando ninguém voltou: distingue
-- "0% real" de "semana que ainda não chegou" (célula ausente = futuro).
-- Cap de 12 coortes recentes: grade mais antiga já não informa decisão.
create or replace function public.adocao_coorte(
  p_semanas int default 10
)
returns table(coorte date, semana int, ativas bigint, total bigint)
language sql stable set search_path = public as $$
  with primeiros as (
    select profile_id,
           date_trunc('week', min(created_at) at time zone 'America/Sao_Paulo')::date as c0
    from produto_eventos
    group by profile_id
  ), coortes as (
    select c0, count(*) as total
    from primeiros
    group by c0
    order by c0 desc
    limit 12
  ), semanas_vivas as (
    select c.c0, generate_series(0, least(
      greatest(((date_trunc('week', now())::date - c.c0) / 7)::int, 0),
      greatest(p_semanas, 1) - 1
    ))::int as semana
    from coortes c
  ), ativ as (
    select p.c0,
           ((date_trunc('week', e.created_at at time zone 'America/Sao_Paulo')::date - p.c0) / 7)::int as semana,
           count(distinct e.profile_id) as ativas
    from primeiros p
    join produto_eventos e on e.profile_id = p.profile_id
    where e.acao = 'pageview'
      -- bound pela coorte viva (≤12 semanas): não varrer o histórico todo
      and e.created_at >= (select min(c0) from coortes)
    group by 1, 2
  )
  select s.c0, s.semana, coalesce(a.ativas, 0), c.total
  from semanas_vivas s
  join coortes c on c.c0 = s.c0
  left join ativ a on a.c0 = s.c0 and a.semana = s.semana
  order by 1, 2;
$$;

-- ---------- caminhos: trios de superfícies mais percorridos ----------
-- Sessionização "islands" — sessão = mesma pessoa, mesmo dia (SP), sem
-- gap >30min: o dia corta no fuso local (não às 21h de Brasília) e um
-- intervalo longo longe do app quebra a ilha em duas. Colapsa pageviews
-- repetidos da mesma superfície (home→home→agenda = home→agenda),
-- depois conta trios ordenados por profile. Responde "como navegam"
-- mais legível que sankey nesta escala.
create or replace function public.adocao_caminhos(
  p_desde timestamptz,
  p_top int default 8,
  p_papel text default null
)
returns table(de text, meio text, para text, pessoas bigint)
language sql stable set search_path = public as $$
  with pv as (
    select profile_id, (created_at at time zone 'America/Sao_Paulo')::date as dia,
           superficie, created_at,
           lag(superficie) over w as prev_sup,
           lag(created_at) over w as prev_ts
    from produto_eventos
    where acao = 'pageview' and created_at >= p_desde
      and (p_papel is null or papel = p_papel)
    window w as (partition by profile_id,
                          (created_at at time zone 'America/Sao_Paulo')::date
                 order by created_at)
  ), ilhas as (
    select profile_id, dia, superficie, created_at,
           sum(case when superficie is distinct from prev_sup
                      or created_at - prev_ts > interval '30 minutes'
                    then 1 else 0 end)
             over (partition by profile_id, dia order by created_at
                   rows unbounded preceding) as g
    from pv
  ), seq as (
    select distinct on (profile_id, dia, g) profile_id, dia, g, superficie
    from ilhas
    order by profile_id, dia, g, created_at
  ), trios as (
    select profile_id,
           superficie as de,
           lead(superficie) over w as meio,
           lead(superficie, 2) over w as para
    from seq
    window w as (partition by profile_id, dia order by g)
  )
  select de, meio, para, count(distinct profile_id)
  from trios
  where meio is not null and para is not null
  group by 1, 2, 3
  order by 4 desc, 1, 2, 3
  limit greatest(p_top, 1);
$$;

-- ---------- feed L3: gestos recentes (carga inicial do Realtime) -----
create or replace function public.adocao_recentes(
  p_limite int default 30
)
returns table(superficie text, acao text, papel text, criado_em timestamptz)
language sql stable set search_path = public as $$
  select superficie, acao, papel, created_at
  from produto_eventos
  order by created_at desc, id desc
  limit greatest(least(p_limite, 100), 1);
$$;

-- Postgres concede EXECUTE a PUBLIC por default — padrão da casa é
-- revogar antes de grant (inofensivo aqui: a RLS devolveria vazio, mas
-- mantém a superfície de ataque mínima).
revoke all on function public.registrar_produto_eventos(jsonb) from public, anon;
revoke all on function public.adocao_resumo(timestamptz, timestamptz, text) from public, anon;
revoke all on function public.adocao_matriz(timestamptz, text) from public, anon;
revoke all on function public.adocao_serie_dia(timestamptz, text) from public, anon;
revoke all on function public.adocao_superficies(timestamptz, text) from public, anon;
revoke all on function public.adocao_coorte(int) from public, anon;
revoke all on function public.adocao_caminhos(timestamptz, int, text) from public, anon;
revoke all on function public.adocao_recentes(int) from public, anon;

grant execute on function public.adocao_resumo(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.adocao_matriz(timestamptz, text) to authenticated;
grant execute on function public.adocao_serie_dia(timestamptz, text) to authenticated;
grant execute on function public.adocao_superficies(timestamptz, text) to authenticated;
grant execute on function public.adocao_coorte(int) to authenticated;
grant execute on function public.adocao_caminhos(timestamptz, int, text) to authenticated;
grant execute on function public.adocao_recentes(int) to authenticated;

-- feed "gestos recentes" da aba via Supabase Realtime (postgres_changes
-- respeita a mesma RLS — a coord inscrita recebe os eventos que pode ler).
-- Idempotente: a migration pode ser reexecutada sem "already member".
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'produto_eventos'
  ) then
    alter publication supabase_realtime add table public.produto_eventos;
  end if;
end $$;

commit;
