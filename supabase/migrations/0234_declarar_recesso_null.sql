-- 0234 — fecha bypass NULL no declarar_recesso (REALIZA-520)
-- `not (false or NULL)` é NULL e o IF é pulado; qualquer usuário logado
-- conseguia declarar recesso de qualquer dupla. Exige lado não-nulo.
begin;
create or replace function public.declarar_recesso(
  p_dupla uuid,
  p_evento uuid,
  p_usa boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_evento record;
begin
  select d.id, d.cronograma_id, d.status, d.trilha, d.mentor_id, d.mentorado_id
    into v_dupla
    from public.duplas d
   where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;

  if not (
    v_dupla.mentor_id = public.my_profile_id()
    or (public.my_mentorado_id() is not null
        and v_dupla.mentorado_id = public.my_mentorado_id())
  ) then
    return jsonb_build_object(
      'error', 'só a dupla pode declarar o recesso');
  end if;

  if v_dupla.status <> 'ativa' then
    return jsonb_build_object(
      'error', 'só dá pra declarar recesso de dupla ativa');
  end if;

  if v_dupla.trilha is distinct from 'dpp' then
    return jsonb_build_object(
      'error', 'recesso do cronograma só vale pra trilha DPP');
  end if;

  select e.id, e.tipo, e.cronograma_id, e.data
    into v_evento
    from public.ciclo_eventos e
   where e.id = p_evento;
  if not found or v_evento.tipo <> 'recesso' or v_evento.data is null then
    return jsonb_build_object(
      'error', 'esse evento não é um recesso do calendário');
  end if;
  if v_evento.cronograma_id is distinct from v_dupla.cronograma_id then
    return jsonb_build_object(
      'error', 'esse recesso não é do cronograma desta dupla');
  end if;

  insert into public.dupla_recessos
         (dupla_id, ciclo_evento_id, usa, declarado_por, declarado_em)
  values (p_dupla, p_evento, p_usa, public.my_profile_id(), now())
  on conflict (dupla_id, ciclo_evento_id)
  do update set usa = excluded.usa,
                declarado_por = excluded.declarado_por,
                declarado_em = excluded.declarado_em;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.declarar_recesso(uuid, uuid, boolean) from public, anon;
grant execute on function public.declarar_recesso(uuid, uuid, boolean) to authenticated;
commit;
