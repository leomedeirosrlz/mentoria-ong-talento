-- 0162 ia_guias_catalogo — catálogo dos guias sem varrer ia_chunks.
--
-- catalogoGuias (src/lib/ia/guias.ts) lia `guia` de TODAS as linhas de
-- ia_chunks (~460) e deduplicava no app: além do tráfego à toa, o PostgREST
-- corta em max_rows (1000) e o catálogo ficaria truncado em silêncio quando
-- o corpus crescer. A view devolve uma linha por guia.
--
-- security_invoker: a view roda com o JWT do caller e herda a RLS e os
-- grants de ia_chunks (0136: authenticated lê tudo, anon nada) em vez de
-- virar um atalho com os privilégios do dono.

begin;

create or replace view public.ia_guias_catalogo
  with (security_invoker = true)
as
  select distinct guia from public.ia_chunks;

revoke all on public.ia_guias_catalogo from public, anon, authenticated;
grant select on public.ia_guias_catalogo to authenticated;

commit;
