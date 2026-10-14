-- 0078: onboarding do mentorado (REALIZA-114) — o jovem grava a própria
-- grade semanal (mentorados.disponibilidade, 0038). Sem ela o cruzamento
-- da agenda (REALIZA-24/25) não tem com o que cruzar: o primeiro acesso é
-- o momento de coletar, e o campo também fica editável no /jovem/perfil.
-- A escrita segue o padrão do set_contato_compartilhado (0076): a policy
-- de UPDATE em mentorados é coord-only (mentorados_coord, 0001), então o
-- self-update do jovem vai por RPC definer escopada a my_mentorado_id() —
-- nunca um update livre na tabela.
begin;

create or replace function public.set_disponibilidade_mentorado(p_grade jsonb)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_grade jsonb;
begin
  if public.my_role() <> 'mentorado' then
    raise exception 'Só o próprio jovem informa a própria disponibilidade';
  end if;
  -- o CHECK mentorados_disponibilidade_ok (0038) já trava no banco; aqui a
  -- validação volta como mensagem pt-BR em vez de violação de constraint
  if not public.disponibilidade_ok(p_grade) then
    raise exception 'Grade de disponibilidade inválida';
  end if;
  -- esqueleto vazio vale "não informado" (mesma régua do app): grava null,
  -- não {"dias":[],"periodos":[]}
  if p_grade is null
     or (coalesce(jsonb_array_length(p_grade -> 'dias'), 0) = 0
         and coalesce(jsonb_array_length(p_grade -> 'periodos'), 0) = 0) then
    v_grade := null;
  else
    v_grade := p_grade;
  end if;
  update public.mentorados
     set disponibilidade = v_grade
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.set_disponibilidade_mentorado(jsonb) from public, anon;
grant execute on function public.set_disponibilidade_mentorado(jsonb) to authenticated;

commit;
