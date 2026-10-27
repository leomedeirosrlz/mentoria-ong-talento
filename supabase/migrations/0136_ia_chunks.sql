-- 0136 ia_chunks + match_ia_chunks (REALIZA-243/244 — assistente v2): a base
-- de conhecimento do assistente. Corpus = os guias oficiais do programa e os
-- documentos operacionais consolidados em docs/rag/*.md — conteúdo
-- institucional, por construção sem PII (o termo de adesão entra só como
-- template sanitizado e os forms de matching viram referência, nunca dados
-- de pessoas). A ingestão é feita por scripts/ingerir-guias.mjs via service
-- role; aqui ficam só a tabela e a RPC de busca.
--
--   * FTS `portuguese`, não embeddings (decisão registrada na 179): corpus
--     pequeno (~centenas de chunks), zero extensão/provider extra. Se testes
--     reais mostrarem recall ruim, o upgrade documentado é pgvector +
--     embeddings pelo mesmo provider — a RPC muda por dentro, a tool e a UI
--     não mudam.
--   * `tsv` é generated column — qualquer insert/update reindexa sozinho, e
--     o GIN cobre o @@. Sem trigger, sem drift entre texto e índice.
--   * `unique nulls not distinct (guia, secao, pagina)` é o alvo do upsert
--     idempotente da ingestão (pendência DBA da 179): um chunk é definido
--     pela sua posição canônica no documento. secao/pagina nullable pedem
--     `nulls not distinct` — senão dois chunks "guia X, sem seção" nunca
--     colidem e o upsert duplica.
--   * Leitura: `grant select to authenticated` + policy `using(true)` —
--     guia não é segredo, já circula pra todo voluntário; o gate do que o
--     assistente RESPONDE é do prompt+tools, não da tabela. anon fora.
--   * `match_ia_chunks` é security definer com `set search_path = ''` (padrão
--     pós-0085, refs fully-qualified) pra o trecho vir por `ts_headline` e o
--     ranking por `ts_rank` sem depender de grants de tabela do chamador.
--     `plainto_tsquery` sanitiza texto livre (não é to_tsquery — input do
--     usuário nunca vira sintaxe de operador). p_limit travado em [1,10] —
--     bound defensivo, a tool manda 4.

begin;

create table if not exists public.ia_chunks (
  id uuid primary key default gen_random_uuid(),
  guia text not null
    check (char_length(guia) between 1 and 80),
  secao text check (secao is null or char_length(secao) between 1 and 200),
  pagina int check (pagina is null or pagina >= 0),
  texto text not null
    check (char_length(texto) between 1 and 4000),
  tsv tsvector generated always as
    (to_tsvector('portuguese', texto)) stored,
  created_at timestamptz not null default now(),
  constraint ia_chunks_origem_key
    unique nulls not distinct (guia, secao, pagina)
);

comment on table public.ia_chunks is
  'Chunks dos guias oficiais e docs operacionais do programa (ingestão por '
  'scripts/ingerir-guias.mjs via service role). Conteúdo institucional sem '
  'PII por construção do corpus. FTS portuguese na coluna generated tsv; '
  'busca exposta pela RPC match_ia_chunks (tool guia_consulta do assistente).';
comment on column public.ia_chunks.guia is
  'Documento-fonte do corpus (slug do frontmatter em docs/rag/*.md): '
  'guia-mentor-dpp, guia-mentor-especialista, ciclo-cronograma, etc.';
comment on column public.ia_chunks.secao is
  'Título da seção/capítulo de onde o chunk foi extraído (pra citação).';
comment on column public.ia_chunks.pagina is
  'Página/ordem da seção no documento-fonte quando conhecida (pra citação); '
  'null nos docs markdown sem paginação.';
comment on column public.ia_chunks.texto is
  'Trecho de ~700-900 chars com overlap ~120 entre chunks vizinhos.';
comment on constraint ia_chunks_origem_key on public.ia_chunks is
  'Identidade do chunk = posição canônica na fonte; alvo do upsert '
  'idempotente da ingestão.';

create index if not exists ia_chunks_tsv_idx
  on public.ia_chunks using gin (tsv);

alter table public.ia_chunks enable row level security;

revoke all on public.ia_chunks from public, anon, authenticated;
grant select on public.ia_chunks to authenticated;

drop policy if exists ia_chunks_select on public.ia_chunks;
create policy ia_chunks_select on public.ia_chunks
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------- busca
-- Trecho citável via ts_headline (max 40 palavras, 1 fragmento) + ranking
-- ts_rank. plainto_tsquery faz AND dos lexemas — conservador, prefere zero
-- resultado a alucinar fonte; o model decide quando a ausência de fonte
-- vira "isso não está nos guias, fale com a coordenação".
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
  select
    c.guia,
    c.secao,
    c.pagina,
    ts_headline(
      'portuguese',
      c.texto,
      plainto_tsquery('portuguese', p_query),
      'MaxWords=40, MinWords=15, ShortWord=3, MaxFragments=1'
    ) as trecho,
    ts_rank(c.tsv, plainto_tsquery('portuguese', p_query)) as score
  from public.ia_chunks c
  where c.tsv @@ plainto_tsquery('portuguese', p_query)
  order by score desc
  limit least(greatest(coalesce(p_limit, 4), 1), 10);
$$;

comment on function public.match_ia_chunks(text, int) is
  'Busca FTS portuguese nos chunks dos guias (tool guia_consulta do '
  'assistente). Devolve guia/secao/pagina pra citação + trecho ts_headline '
  '+ score ts_rank. p_limit clamp [1,10], default 4.';

revoke all on function public.match_ia_chunks(text, int) from public, anon;
grant execute on function public.match_ia_chunks(text, int) to authenticated;

commit;
