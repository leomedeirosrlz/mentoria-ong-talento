-- 0150 braço vetorial opcional no match_ia_chunks (pgvector):
-- p_embedding NULL = só o braço FTS da 0147, resultado idêntico ao de
-- hoje (fallback estrutural: embedding API fora → busca não muda).
-- Com vetor, os dois rankings (FTS cobertura+seção e distância cosseno)
-- fundem via RRF k=60 — insensível à escala dos scores, sem calibração.
-- SEM índice em embedding: seq scan em ~200 chunks é exato e instantâneo;
-- HNSW só faria sentido acima de ~20k linhas (regra documentada).
-- A coluna embedding_modelo versiona o gerador — trocar de modelo exige
-- re-embedar o corpus inteiro (o script de ingest já faz isso).

begin;

create extension if not exists vector with schema extensions;

alter table public.ia_chunks
  add column if not exists embedding extensions.vector(512) null,
  add column if not exists embedding_modelo text null;

-- a assinatura nova NÃO substitui a antiga: viraria overload e a
-- PostgREST ficaria ambígua nas chamadas sem p_embedding (as de hoje).
-- Drop explícito da (text, int) — chamadas antigas caem no default do
-- novo arg e o comportamento FTS fica idêntico.
drop function if exists public.match_ia_chunks(text, int);

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
  df as (
    select t.x, count(*)::real as n
    from public.ia_chunks c,
         unnest(tsvector_to_array(c.tsv)) t(x)
    group by t.x
  ),
  df_secao as (
    select s.x, count(*)::real as n
    from public.ia_chunks c,
         unnest(
           tsvector_to_array(
             to_tsvector('public.pt_unaccent',
               regexp_replace(coalesce(c.secao, ''), '[ºª]', '', 'g'))
           )
         ) s(x)
    group by s.x
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
  'null = só FTS. Fusão RRF k=60. p_limit clamp [1,10].';

revoke all on function public.match_ia_chunks(text, int, extensions.vector)
  from public, anon;
grant execute on function public.match_ia_chunks(text, int, extensions.vector)
  to authenticated;

commit;
