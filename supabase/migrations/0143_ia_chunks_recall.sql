-- 0143 recall do match_ia_chunks: a busca dos guias respondia "não achei" pra
-- perguntas naturais ("o que acontece na semana 3 da trilha dpp") por duas
-- falhas empilhadas:
--
--   * o tsv indexava só `texto` — "dpp" nunca era lexema (vive no slug da
--     coluna guia: guia-mentor-dpp → guia|mentor|dpp). Agora o tsv cobre
--     guia + secao + texto: o nome do documento e o título da seção passam
--     a participar do match E do rank (secao "Os 16 encontros" encontra
--     "encontros" mesmo quando o trecho não repete a palavra).
--   * plainto_tsquery faz AND de todos os lexemas — pergunta natural quase
--     nunca traz todos os termos no mesmo chunk. Mantido como 1ª tentativa
--     (precisão quando funciona); quando zera, cai pro OR dos lexemas da
--     pergunta, rankeado por ts_rank com peso 0.5 (chunk que cobre mais
--     termos sobe — "semana 3 dpp" elege o roteiro do 3º encontro do guia
--     DPP). quote_literal nos lexemas: token com caractere especial não
--     pode quebrar a sintaxe do to_tsquery.
--
-- O drop/recreate do tsv é barato (corpus ~centenas de chunks) e reconstrói
-- o GIN junto — sem reingestão, a generated column reindexa os textos
-- existentes.

begin;

alter table public.ia_chunks drop column tsv;
alter table public.ia_chunks
  add column tsv tsvector generated always as
    (to_tsvector(
      'portuguese',
      guia || ' ' || coalesce(secao, '') || ' ' || texto
    )) stored;

create index ia_chunks_tsv_idx on public.ia_chunks using gin (tsv);

comment on column public.ia_chunks.tsv is
  'FTS portuguese sobre guia + secao + texto — o slug do documento e o '
  'título da seção são lexemas também (dpp, especialista, roteiros).';

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
  with q_and as (
    select plainto_tsquery('portuguese', p_query) as q
  ),
  q_or as (
    select to_tsquery(
      'portuguese',
      string_agg(quote_literal(l.lex), ' | ')
    ) as q
    from (
      select unnest(
        tsvector_to_array(to_tsvector('portuguese', p_query))
      ) as lex
    ) l
  ),
  hits_and as (
    select c.guia, c.secao, c.pagina, c.texto, qa.q,
           ts_rank(c.tsv, qa.q) as score
    from public.ia_chunks c
    cross join q_and qa
    where c.tsv @@ qa.q
  ),
  hits_or as (
    select c.guia, c.secao, c.pagina, c.texto, qo.q,
           ts_rank(c.tsv, qo.q) * 0.5 as score
    from public.ia_chunks c
    cross join q_or qo
    where qo.q is not null
      and not exists (select 1 from hits_and)
      and c.tsv @@ qo.q
  ),
  hits as (
    select * from hits_and
    union all
    select * from hits_or
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
    h.score
  from hits h
  order by h.score desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int) is
  'Busca FTS portuguese nos chunks dos guias (tool guia_consulta do '
  'assistente). AND estrito primeiro; se zerar, OR dos lexemas rankeado '
  'por ts_rank (peso 0.5). Devolve guia/secao/pagina pra citação + trecho '
  'ts_headline + score. p_limit clamp [1,10], default 4.';

commit;
