-- 0165 ia_chunks: material + secao_anchor — citação do guia nativo com
-- âncora estável (a "ponta de citação" da Liza).
--
-- Cada chunk passa a carregar o slug do documento nativo do corpus
-- (`material`, o `material` do front-matter de docs/rag/*.md, já parseado
-- pelo ingest mas sem coluna pra morar) e a âncora da seção
-- (`secao_anchor`, a mesma slugify de src/lib/materiais/corpus-anchor.ts
-- que a página /materiais/documento/<slug> usa nos ##/###). Com os dois a
-- fonte citada linka /materiais/documento/<material>#<secao_anchor> em vez
-- de cair na lista da biblioteca.
--
-- SEM backfill aqui de propósito: o write path da ingestão já é
-- delete+insert por guia (scripts/ingerir-guias.mjs) — re-rodar
-- `pnpm ingerir:guias --apply` re-escreve o corpus inteiro com as colunas
-- preenchidas, com a mesma atomicidade de sempre. Até lá as linhas antigas
-- ficam NULL e o app calcula a âncora na hora a partir de `secao`
-- (src/lib/ia/guias.ts) — a RPC match_ia_chunks não muda (a leitura dos
-- metadados é pela select direta de textosChunksIa, já por guia+pagina).
--
-- ia_guias_catalogo (0162) faz `select distinct guia` — não é `select *`,
-- então as colunas novas não exigem recreate da view.

begin;

alter table public.ia_chunks
  add column if not exists material text
    check (material is null or char_length(material) between 1 and 80),
  add column if not exists secao_anchor text
    check (secao_anchor is null or char_length(secao_anchor) between 1 and 200);

comment on column public.ia_chunks.material is
  'Slug do documento nativo (/materiais/documento/<slug>) que originou o '
  'chunk — `material` do front-matter do doc de corpus; base do href da '
  'citação quando o material vive na plataforma.';
comment on column public.ia_chunks.secao_anchor is
  'Âncora estável da seção do chunk (slugify de corpus-anchor.ts aplicada '
  'a `secao`) — sufixo #<âncora> do link de citação pro documento nativo.';

commit;
