-- 0145 unaccent + ordinais no FTS dos guias: duas assimetrias restantes
-- entre pergunta e documento que zeravam matches legítimos:
--
--   * acento — "avaliacao" não batia em "avaliação" (usuário digita sem
--     acento o tempo todo). Fix: config de busca pt_unaccent (receita
--     padrão do unaccent — dictionary na cadeia antes do stem) aplicada
--     nos DOIS lados, tsv e query. Bônus: ts_headline com a mesma config
--     volta a marcar os termos no texto acentuado.
--   * ordinal — o corpus escreve "3º encontro"/"360º" e o usuário pergunta
--     "encontro 3"/"avaliação 360". O º/ª vira parte do lexema ("360º" ≠
--     "360") e o unaccent sozinho mapeia pra "360o" — pior. regexp_replace
--     tira o marcador ANTES do tsvector nos dois lados: doc vira "360",
--     pergunta vira "360".
--
-- Tudo é rebuild da generated column + replace da RPC — corpus intocado.

begin;

create extension if not exists unaccent with schema extensions;

-- config pt_unaccent: portuguese com o dictionary unaccent na frente do
-- stem nos tokens de palavra (hword/hword_part/word — mesmos 3 tipos que a
-- receita oficial usa; números/símbolos seguem o mapeamento padrão)
create text search configuration public.pt_unaccent (
  copy = pg_catalog.portuguese
);
alter text search configuration public.pt_unaccent
  alter mapping for hword, hword_part, word
  with extensions.unaccent, pg_catalog.portuguese_stem;

comment on text search configuration public.pt_unaccent is
  'FTS portuguese com unaccent — match simétrico pra digitação sem acento '
  '("avaliacao" ≡ "avaliação"). Usada pelo tsv de ia_chunks e pela RPC '
  'match_ia_chunks.';

alter table public.ia_chunks drop column tsv;
alter table public.ia_chunks
  add column tsv tsvector generated always as
    (to_tsvector(
      'public.pt_unaccent',
      regexp_replace(
        guia || ' ' || coalesce(secao, '') || ' ' || texto,
        '[ºª]', '', 'g'
      )
    )) stored;

create index ia_chunks_tsv_idx on public.ia_chunks using gin (tsv);

comment on column public.ia_chunks.tsv is
  'FTS pt_unaccent (sem acento) sobre guia+secao+texto com ordinais '
  'normalizados (º/ª removidos — "360" encontra "360º").';

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
    -- lexemas da pergunta normalizados pela MESMA pipeline do tsv
    -- (pt_unaccent + strip de º/ª) — simetria é o que garante o match.
    -- quote_literal: token com caractere especial não quebra o to_tsquery.
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
          to_tsvector(
            'public.pt_unaccent',
            regexp_replace(p_query, '[ºª]', '', 'g')
          )
        )
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
      'public.pt_unaccent',
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
  'Busca FTS pt_unaccent nos chunks dos guias (tool guia_consulta do '
  'assistente): sem acento + ordinais normalizados, OR dos lexemas rankeado '
  'por cobertura + ts_rank. Devolve guia/secao/pagina pra citação + trecho '
  'ts_headline + score. p_limit clamp [1,10], default 4.';

commit;
