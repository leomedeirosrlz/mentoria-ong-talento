-- 0161 frequência de documento (df) dos lexemas pré-computada.
--
-- A 0150 recalculava df/df_secao a cada chamada do match_ia_chunks:
-- unnest do tsvector de TODAS as linhas de ia_chunks (e to_tsvector da
-- seção de todas) só pra pesar os termos da pergunta. O corpus só muda
-- quando scripts/ingerir-guias.mjs roda, então o df vira tabela e o
-- ingest chama atualizar_ia_chunks_df() no fim do --apply.
--
-- O match_ia_chunks abaixo é o da 0150 com as CTEs df/df_secao lendo a
-- tabela: mesma assinatura, pesos, normalização e RRF k=60. n fica real
-- (o count(*)::real de antes) pra aritmética do 1/sqrt sair bit a bit
-- igual. Corpus ingerido sem recompute = pesos defasados (não erro):
-- rodar `select public.atualizar_ia_chunks_df();` resolve.

begin;

-- origem 'corpo' = lexemas de ia_chunks.tsv (CTE df da 0150);
-- origem 'secao' = lexemas do to_tsvector da seção (CTE df_secao).
create table if not exists public.ia_chunks_df (
  origem text not null check (origem in ('corpo', 'secao')),
  lexema text not null,
  n real not null,
  primary key (origem, lexema)
);

comment on table public.ia_chunks_df is
  'df por lexema de ia_chunks (corpo = tsv, secao = to_tsvector da seção), '
  'lido pelo match_ia_chunks. Recalculado por atualizar_ia_chunks_df() '
  'no ingest dos guias.';

-- só as funções security definer leem/escrevem; sem policy = nenhum
-- acesso via PostgREST
alter table public.ia_chunks_df enable row level security;
revoke all on table public.ia_chunks_df from public, anon, authenticated;

create or replace function public.atualizar_ia_chunks_df()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_linhas int;
begin
  -- delete (não truncate): o truncate pegaria ACCESS EXCLUSIVE e travaria
  -- buscas concorrentes; com delete elas seguem vendo o df anterior até o
  -- commit. Tabela de poucos milhares de linhas, custo irrelevante.
  delete from public.ia_chunks_df;

  insert into public.ia_chunks_df (origem, lexema, n)
  select 'corpo', t.x, count(*)::real
  from public.ia_chunks c,
       unnest(tsvector_to_array(c.tsv)) t(x)
  group by t.x
  union all
  select 'secao', s.x, count(*)::real
  from public.ia_chunks c,
       unnest(
         tsvector_to_array(
           to_tsvector('public.pt_unaccent',
             regexp_replace(coalesce(c.secao, ''), '[ºª]', '', 'g'))
         )
       ) s(x)
  group by s.x;

  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.atualizar_ia_chunks_df() is
  'Recalcula public.ia_chunks_df a partir de ia_chunks. Só service_role '
  '(chamado pelo pnpm ingerir:guias --apply). Devolve linhas gravadas.';

revoke all on function public.atualizar_ia_chunks_df()
  from public, anon, authenticated;
grant execute on function public.atualizar_ia_chunks_df() to service_role;

create or replace function public.match_ia_chunks(
  p_query text,
  p_limit int default 4,
  p_embedding extensions.vector(512) default null
)
returns table (
  guia text,
  secao text,
  pagina int,
  trecho text,
  score real
)
language sql stable security definer set search_path = ''
as $$
  with lex as (
    select
      array_agg(l.x) as a,
      count(*)::real as n,
      to_tsquery(
        'public.pt_unaccent',
        string_agg(quote_literal(l.x), ' | ')
      ) as q
    from (
      select unnest(
        tsvector_to_array(
          to_tsvector('public.pt_unaccent', public.ia_norm_query(p_query))
        )
      ) as x
    ) l
  ),
  -- not materialized: os joins por lexema descem até a PK da tabela em
  -- vez de varrer uma cópia materializada a cada referência
  df as not materialized (
    select f.lexema as x, f.n
    from public.ia_chunks_df f
    where f.origem = 'corpo'
  ),
  df_secao as not materialized (
    select f.lexema as x, f.n
    from public.ia_chunks_df f
    where f.origem = 'secao'
  ),
  hits as (
    select
      c.id,
      c.guia,
      c.secao,
      c.pagina,
      c.texto,
      lx.q,
      ts_rank(c.tsv, lx.q) as rank,
      (
        select coalesce(sum(1 / sqrt(greatest(d.n, 1))), 0)::real
        from unnest(tsvector_to_array(c.tsv)) t(x)
        join df d on d.x = t.x
        where t.x = any(lx.a)
      ) as cob,
      (
        select coalesce(sum(1 / sqrt(greatest(ds.n, 1))), 0)::real
        from unnest(
          tsvector_to_array(
            to_tsvector('public.pt_unaccent',
              regexp_replace(coalesce(c.secao, ''), '[ºª]', '', 'g'))
          )
        ) s(x)
        join df_secao ds on ds.x = s.x
        where s.x = any(lx.a)
      ) as cob_secao
    from public.ia_chunks c
    cross join lex lx
    where lx.q is not null
      and c.tsv @@ lx.q
  ),
  norm as (
    select
      h.*,
      coalesce((
        select sum(1 / sqrt(greatest(d.n, 1)))
        from unnest(lx.a) u
        left join df d on d.x = u
      ), 1) as cheio,
      coalesce((
        select sum(1 / sqrt(greatest(ds.n, 1)))
        from unnest(lx.a) u
        left join df_secao ds on ds.x = u
      ), 1) as cheio_secao
    from hits h, lex lx
  ),
  -- ranking FTS: mesma ordem da 0147, só ganha posição ordinal pro RRF
  fts as (
    select
      n.*,
      row_number() over (
        order by
          (n.cob / greatest(n.cheio, 1)
            + n.cob_secao / greatest(n.cheio_secao, 1)) desc,
          n.rank desc
      ) as pos
    from norm n
  ),
  -- ranking vetorial: cosseno sobre os embedados, só quando a tool manda
  -- o vetor da pergunta (null → braço inexistente → resultado = FTS puro).
  -- operator(extensions.<=>): a forma qualificada resolve sem depender de
  -- search_path — o infixo pelado NÃO resolve neste ambiente nem com
  -- extensions no path (validado contra o staging)
  vec as (
    select
      c.id,
      row_number() over (
        order by c.embedding operator(extensions.<=>) p_embedding
      ) as pos
    from public.ia_chunks c
    where p_embedding is not null
      and c.embedding is not null
    order by c.embedding operator(extensions.<=>) p_embedding
    limit 10
  ),
  -- RRF k=60: score = Σ 1/(60+rank) — a fusão padrão pra híbrido:
  -- nenhum braço rebaixa o outro, só soma as posições
  fundido as (
    select
      coalesce(f.id, v.id) as id,
      coalesce(1.0 / (60 + f.pos), 0)
        + coalesce(1.0 / (60 + v.pos), 0) as rrf
    from fts f
    full outer join vec v on v.id = f.id
  )
  select
    c.guia,
    c.secao,
    c.pagina,
    -- headline só existe pro braço FTS (marca os termos da query); hit
    -- exclusivamente vetorial vai com o início do chunk como trecho
    case when f.id is not null then
      ts_headline(
        'public.pt_unaccent',
        f.texto,
        f.q,
        'MaxWords=40, MinWords=15, ShortWord=3, MaxFragments=1'
      )
    else
      rtrim(left(c.texto, 220)) || '…'
    end as trecho,
    m.rrf::real as score
  from fundido m
  join public.ia_chunks c on c.id = m.id
  left join fts f on f.id = m.id
  order by m.rrf desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int, extensions.vector) is
  'Busca híbrida nos chunks dos guias (tool guia_consulta): FTS pt_unaccent '
  '(ordinais, IDF-lite, seção) + braço vetorial opcional via p_embedding — '
  'null = só FTS. Fusão RRF k=60. p_limit clamp [1,10]. df/df_secao lidos '
  'de ia_chunks_df (0161).';

revoke all on function public.match_ia_chunks(text, int, extensions.vector)
  from public, anon;
grant execute on function public.match_ia_chunks(text, int, extensions.vector)
  to authenticated;

select public.atualizar_ia_chunks_df();

commit;
