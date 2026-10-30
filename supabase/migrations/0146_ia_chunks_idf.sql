-- 0146 refinamento do match_ia_chunks a partir do eval de recall
-- (97,3% hit@4, mas misses por diluição de filler e ordinais por extenso):
--
--   * setweight por campo — até aqui guia/secao/texto concatenavam num
--     tsv todo peso D. Agora: secao=A (o título "16º encontro — …" é o
--     sinal mais forte), guia=B, texto=C. ts_rank honra os pesos e a
--     pergunta "encontro 16" passa a preferir o chunk cujo TÍTULO diz 16
--     em vez de um que só menciona o número no corpo.
--   * cobertura ponderada por df (IDF-lite) — antes cada lexema valia 1
--     ponto de cobertura: "fazer"/"mentoria"/"encontro" (este em 57% dos
--     chunks!) empatavam com termos raros e o único miss do eval veio
--     daí ("encontro 12 da mentoria" perdeu pro cap. 12). Agora cob
--     soma 1/sqrt(df) — lexema ubíquo quase não pontua, raro domina.
--     O df é computado por query sobre ~230 chunks — custo irrisório.
--   * ia_norm_query — ordinais por extenso do usuário ("oitavo",
--     "décimo segundo") viram dígitos ANTES do tsvector, casando com o
--     corpus que escreve "8º"/"12" (depois do strip de º/ª da 0145).
--     Roda sobre a forma unaccented pra "decimo"/"setimo" casarem também.
--
-- Tudo é rebuild da generated column + replace da RPC — corpus intocado.

begin;

-- normalizador de pergunta: minúsculas, sem acento (unaccent — os mesmos
-- termos que o pt_unaccent produz nos lexemas), º/ª removidos e ordinais
-- por extenso → dígitos. Immutable + search_path vazio (padrão pós-0085).
create or replace function public.ia_norm_query(p text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  par text[];
  mapa constant text[][] := array[
    -- compostos primeiro: "décimo segundo" vira 12, não "10 2"
    ['decimo primeiro', '11'], ['decimo segundo', '12'],
    ['decimo terceiro', '13'], ['decimo quarto', '14'],
    ['decimo quinto', '15'], ['decimo sexto', '16'],
    -- unigramas (forma unaccented casa com e sem acento)
    ['primeiro', '1'], ['segundo', '2'], ['terceiro', '3'],
    ['quarto', '4'], ['quinto', '5'], ['sexto', '6'],
    ['setimo', '7'], ['oitavo', '8'], ['nono', '9'], ['decimo', '10'],
    ['primeira', '1'], ['segunda', '2'], ['terceira', '3'],
    ['quarta', '4'], ['quinta', '5'], ['sexta', '6'],
    ['setima', '7'], ['oitava', '8'], ['nona', '9'], ['decima', '10']
  ];
begin
  p := extensions.unaccent(lower(regexp_replace(p, '[ºª]', '', 'g')));
  foreach par slice 1 in array mapa loop
    p := regexp_replace(p, '\m' || par[1] || '\M', par[2], 'g');
  end loop;
  return p;
end $$;

comment on function public.ia_norm_query(text) is
  'Normaliza a pergunta do match_ia_chunks: unaccent+minúsculas, º/ª '
  'removidos, ordinais por extenso → dígitos ("oitavo"→8, "décimo '
  'segundo"→12). Simétrico ao tsv (que stripa º/ª e desacentua).';

alter table public.ia_chunks drop column tsv;
alter table public.ia_chunks
  add column tsv tsvector generated always as
    (setweight(
       to_tsvector('public.pt_unaccent',
         regexp_replace(coalesce(secao, ''), '[ºª]', '', 'g')), 'A')
     || setweight(
       to_tsvector('public.pt_unaccent',
         regexp_replace(guia, '[ºª]', '', 'g')), 'B')
     || setweight(
       to_tsvector('public.pt_unaccent',
         regexp_replace(texto, '[ºª]', '', 'g')), 'C')) stored;

create index ia_chunks_tsv_idx on public.ia_chunks using gin (tsv);

comment on column public.ia_chunks.tsv is
  'FTS pt_unaccent ponderado: secao=A, guia=B, texto=C — o título da '
  'seção ("16º encontro — …") é o sinal mais forte; ordinais normalizados.';

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
    -- lexemas da pergunta normalizada (ordinais + º/ª + unaccent) —
    -- quote_literal: token com caractere especial não quebra o tsquery
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
    -- document frequency por lexema do corpus — ~230 chunks, custo
    -- irrisório por query e é o que transforma "encontro" (57% dos
    -- chunks) em quase-zero e "nudge" (1 chunk) em peso cheio
    select t.x, count(*)::real as n
    from public.ia_chunks c,
         unnest(tsvector_to_array(c.tsv)) t(x)
    group by t.x
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
        -- cobertura ponderada: soma 1/sqrt(df) dos lexemas da pergunta
        -- presentes no chunk — filler ubíquo não infla mais o score
        select coalesce(sum(1 / sqrt(greatest(d.n, 1))), 0)::real
        from unnest(tsvector_to_array(c.tsv)) t(x)
        join df d on d.x = t.x
        where t.x = any(lx.a)
      ) as cob,
      (
        -- cobertura só na SEÇÃO: desempata "encontro 12" (o 12º encontro
        -- está no título do roteiro; "cap. 12 · Avaliação" não tem o
        -- termo no título). Perde só pra cob cheia, ganha do ts_rank
        select count(*)::real
        from unnest(
          tsvector_to_array(
            to_tsvector('public.pt_unaccent',
              regexp_replace(coalesce(c.secao, ''), '[ºª]', '', 'g'))
          )
        ) s(x)
        where s.x = any(lx.a)
      ) as cob_secao
    from public.ia_chunks c
    cross join lex lx
    where lx.q is not null
      and c.tsv @@ lx.q
  ),
  norm as (
    -- normaliza cob e rank pro mesmo eixo antes de somar: o peso cheio
    -- de cobertura é sum(1/sqrt(df)) dos lexemas da pergunta
    select
      h.*,
      coalesce((
        select sum(1 / sqrt(greatest(d.n, 1)))
        from unnest(lx.a) u
        left join df d on d.x = u
      ), 1) as cheio
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
    (n.cob / greatest(n.cheio, 1) + n.rank) as score
  from norm n
  order by n.cob desc, n.cob_secao desc, n.rank desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int) is
  'Busca FTS pt_unaccent nos chunks dos guias (tool guia_consulta): '
  'ordinais normalizados, OR dos lexemas rankeado por cobertura '
  'ponderada por df (lexema raro pesa, ubíquo quase não) + ts_rank com '
  'setweight por campo (secao=A, guia=B, texto=C). p_limit clamp [1,10].';

commit;
