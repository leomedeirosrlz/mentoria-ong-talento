-- 0168 atualizar_ia_chunks_df: o `delete from public.ia_chunks_df` sem
-- WHERE da 0161 é barrado pelo safeupdate do Supabase — a RPC falhava com
-- "DELETE requires a WHERE clause" no fim de todo `ingerir:guias --apply`,
-- deixando o df defasado sem erro visível no insert.
--
-- `where true` preserva a semântica (limpa a tabela inteira) e satisfaz o
-- guard. Delete e não truncate pelo motivo original da 0161: o truncate
-- pegaria ACCESS EXCLUSIVE e travaria buscas concorrentes.
--
-- Termina chamando a função: quem aplica a migration já sai com o df
-- consistente com o corpus vigente (staging e prod).

begin;

create or replace function public.atualizar_ia_chunks_df()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_linhas int;
begin
  -- `where true` pelo safeupdate do Supabase: delete sem WHERE é barrado
  -- mesmo via security definer; a cláusula é tautológica de propósito —
  -- a intenção é limpar a tabela toda
  delete from public.ia_chunks_df where true;

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

-- df sai do apply já consistente com o corpus — sem passo manual
select public.atualizar_ia_chunks_df();

commit;
