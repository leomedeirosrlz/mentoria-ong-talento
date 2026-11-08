-- 0166 ia_eval_limpar — limpeza coord de runs de eval + a telemetria dos
-- itens. ia_eventos é select-only (escrita só via RPC definer), então o
-- delete dos eventos correlacionados mora aqui: a cadeia inteira do item
-- (mensagem/tools/resposta dividem request_id) cai ANTES dos runs — depois
-- do cascade os request_ids órfãos não teriam mais como se achar.
-- p_run null = histórico inteiro ("Limpar tudo" da UI); com id = um run.

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
  delete from public.ia_eventos e
   where exists (
     select 1 from public.ia_eval_itens i
      where i.request_id = e.request_id
        and (p_run is null or i.run_id = p_run));
  delete from public.ia_eval_runs r
   where p_run is null or r.id = p_run;
  get diagnostics v_runs = row_count;
  return v_runs;
end $$;

revoke all on function public.ia_eval_limpar(uuid) from public, anon;
grant execute on function public.ia_eval_limpar(uuid) to authenticated;

commit;
