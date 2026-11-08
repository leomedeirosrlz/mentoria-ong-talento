-- 0166 ia_eval_limpar + ia_eventos_limpar — limpezas coord independentes:
-- uma zera o histórico de evals (runs + itens via cascade), a outra zera os
-- indicadores do painel (ia_eventos inteiro). Separadas de propósito:
-- limpar runs sem limpar indicadores é um caso legítimo, e vice-versa.
-- ia_eventos é select-only (escrita só via RPC definer), então o delete de
-- qualquer linha dela mora num definer também.
--
-- Dois detalhes vindos do staging:
--   - pg-safeupdate do PostgREST barra DELETE sem WHERE até dentro de
--     security definer → o "limpa tudo" usa WHERE true.
--   - `<>` com NULL passa (usuário sem papel cairia no else) → o gate usa
--     IS DISTINCT FROM, e ia_eval_pegar_item (0164) leva a mesma correção.

begin;

create or replace function public.ia_eval_limpar(p_run uuid default null)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_runs int;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'sem permissão';
  end if;
  delete from public.ia_eval_runs r
   where p_run is null or r.id = p_run;
  get diagnostics v_runs = row_count;
  return v_runs;
end $$;

create or replace function public.ia_eventos_limpar()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_eventos int;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'sem permissão';
  end if;
  delete from public.ia_eventos where true;
  get diagnostics v_eventos = row_count;
  return v_eventos;
end $$;

-- mesma assinatura/corpo de 0164, só o gate endurece (NULL não passa mais)
create or replace function public.ia_eval_pegar_item(p_run uuid)
returns public.ia_eval_itens
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.ia_eval_itens;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'sem permissão';
  end if;
  update public.ia_eval_itens i
     set status = 'rodando'
   where i.id = (
     select id from public.ia_eval_itens
      where run_id = p_run and status = 'pendente'
      order by id
      limit 1
      for update skip locked
   )
   returning * into v_item;
  if v_item.id is not null then
    update public.ia_eval_runs set status = 'rodando' where id = p_run;
  end if;
  return v_item;
end;
$$;

revoke all on function public.ia_eval_limpar(uuid) from public, anon;
grant execute on function public.ia_eval_limpar(uuid) to authenticated;
revoke all on function public.ia_eventos_limpar() from public, anon;
grant execute on function public.ia_eventos_limpar() to authenticated;

commit;
