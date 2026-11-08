-- 0166 ia_eval_limpar + ia_eventos_limpar — limpezas coord independentes:
-- uma zera o histórico de evals (runs + itens via cascade), a outra zera os
-- indicadores do painel (ia_eventos inteiro). Separadas de propósito:
-- limpar runs sem limpar indicadores é um caso legítimo, e vice-versa.
-- ia_eventos é select-only (escrita só via RPC definer), então o delete de
-- qualquer linha dela mora num definer também. Gate de papel dentro das
-- duas, como em ia_eval_pegar_item.

begin;

create or replace function public.ia_eval_limpar(p_run uuid default null)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_runs int;
begin
  if public.my_role() <> 'coordenacao' then
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
  if public.my_role() <> 'coordenacao' then
    raise exception 'sem permissão';
  end if;
  delete from public.ia_eventos;
  get diagnostics v_eventos = row_count;
  return v_eventos;
end $$;

revoke all on function public.ia_eval_limpar(uuid) from public, anon;
grant execute on function public.ia_eval_limpar(uuid) to authenticated;
revoke all on function public.ia_eventos_limpar() from public, anon;
grant execute on function public.ia_eventos_limpar() to authenticated;

commit;
