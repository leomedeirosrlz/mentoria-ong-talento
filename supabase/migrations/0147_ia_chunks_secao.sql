-- 0147 desempate por seção no match_ia_chunks: a 0146 ponderou df e
-- campos, mas "o que fazer no encontro 12 da mentoria" ainda empatava com
-- "12 · Avaliação e suporte" (capítulo 12 ≠ 12º encontro). O sinal que
-- separa os dois está no TÍTULO da seção — "12º encontro — Leitura da
-- Roda da Vida" carrega os termos, "12 · Avaliação e suporte" não.
-- Nova métrica cob_secao conta lexemas da pergunta presentes só na seção
-- e entra como desempate entre cob cheia e ts_rank. Função substituída
-- integralmente (idêntica à 0146 + a coluna e o order by).

begin;

create or replace function public.match_ia_chunks(
  p_query text,
  p_limit int default 4
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
    -- df restrito a títulos de seção: "encontr" em seção é raro (~16
    -- roteiros), "mentor" é ubíquo — sem isso "12 · Avaliação e suporte
    -- ao mentor" (capítulo) empata com "12º encontro" (roteiro)
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
        -- cobertura ponderada só na seção: desempata número-de-capítulo
        -- vs número-de-encontro — "12º encontro" casa '12'+'encontr'
        -- (raro em seção), "12 · Avaliação" casa '12'+'mentor' (ubíquo)
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
  )
  select
    n.guia,
    n.secao,
    n.pagina,
    ts_headline(
      'public.pt_unaccent',
      n.texto,
      n.q,
      'MaxWords=40, MinWords=15, ShortWord=3, MaxFragments=1'
    ) as trecho,
    (n.cob / greatest(n.cheio, 1)
      + n.cob_secao / greatest(n.cheio_secao, 1)
      + n.rank) as score
  from norm n
  -- soma normalizada, não portão: seção com dígito fraco ("3. X") não
  -- ganha de corpo com cobertura cheia; seção tópica ("12º encontro")
  -- decide contra capítulo homônimo. ts_rank é o último desempate
  order by
    (n.cob / greatest(n.cheio, 1)
      + n.cob_secao / greatest(n.cheio_secao, 1)) desc,
    n.rank desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int) is
  'Busca FTS pt_unaccent nos chunks dos guias (tool guia_consulta): '
  'ordinais normalizados, OR rankeado por cobertura ponderada por df, '
  'desempate por cobertura na seção (capítulo ≠ encontro) + ts_rank com '
  'setweight por campo. p_limit clamp [1,10].';

commit;
