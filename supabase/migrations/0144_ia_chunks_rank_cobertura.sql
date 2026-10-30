-- 0144 ranking por cobertura no match_ia_chunks: o desenho da 0143 (AND
-- primeiro, OR só quando zera) tinha um caso ruim — um AND fraco com 1 hit
-- ("avaliação 360" → um trecho tangencial) impedia o OR de trazer os chunks
-- certos. Troca a dupla passagem por uma só: OR dos lexemas da pergunta,
-- ordenado por COBERTURA (nº de lexemas da pergunta presentes no chunk) e
-- desempate por ts_rank. Cobertura total = o que o AND acharia, então o
-- ranking preserva a precisão do AND sem o cliff de "tudo ou nada":
--
--   * "semana 3 dpp" → o chunk da trilha/cronograma que cobre os 3 termos
--     sobe acima de um que só tem "3"
--   * "avaliação 360" → os docs que falam do 360º por extenso rankeiam antes
--     de menções colaterais
--
-- Custo: tsvector_to_array por linha pra contar a cobertura — ~centenas de
-- chunks, desprezível. O tsv da 0143 (guia+secao+texto) fica como está.

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
    -- lexemas da pergunta já normalizados (stem + sem stopwords) — a
    -- cobertura e o OR nascem do mesmo array. quote_literal: token com
    -- caractere especial não pode quebrar a sintaxe do to_tsquery.
    select
      array_agg(l.x) as a,
      count(*)::real as n,
      to_tsquery(
        'portuguese',
        string_agg(quote_literal(l.x), ' | ')
      ) as q
    from (
      select unnest(
        tsvector_to_array(to_tsvector('portuguese', p_query))
      ) as x
    ) l
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
        select count(*)::real
        from unnest(tsvector_to_array(c.tsv)) t
        where t = any(lx.a)
      ) as cob
    from public.ia_chunks c
    cross join lex lx
    where lx.q is not null
      and c.tsv @@ lx.q
  )
  select
    h.guia,
    h.secao,
    h.pagina,
    ts_headline(
      'portuguese',
      h.texto,
      h.q,
      'MaxWords=40, MinWords=15, ShortWord=3, MaxFragments=1'
    ) as trecho,
    (h.cob / greatest((select n from lex), 1) + h.rank) as score
  from hits h
  order by h.cob desc, h.rank desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int) is
  'Busca FTS portuguese nos chunks dos guias (tool guia_consulta do '
  'assistente). OR dos lexemas da pergunta, ordenado por cobertura (nº de '
  'termos presentes) + ts_rank — preserva a precisão do AND sem o cliff de '
  '"tudo ou nada". Devolve guia/secao/pagina pra citação + trecho '
  'ts_headline + score. p_limit clamp [1,10], default 4.';

commit;
