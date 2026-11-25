-- 0233 — corrige roteiro_salvar (escopo ausente no SELECT) (REALIZA-521)
-- A 0231 lia v_p.escopo sem trazer a coluna; toda chamada falhava com
-- "record v_p has no field escopo". Reemite a função com o SELECT correto.
begin;
create or replace function public.roteiro_salvar(
  p_plano uuid,
  p_numero smallint,
  p_conteudo jsonb,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p record;
  v_id uuid;
begin
  if p_via not in ('app','liza','job') then
    return jsonb_build_object('error', 'origem inválida');
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'array' then
    return jsonb_build_object('error', 'conteúdo inválido');
  end if;
  select p.id, p.dupla_id, p.status, p.versao, p.escopo
    into v_p from public.dupla_planos p where p.id = p_plano;
  if not found then return jsonb_build_object('error', 'plano não encontrado'); end if;
  if not public.pode_roteiro_plano(p_plano) then
    return jsonb_build_object('error', 'sem acesso ao plano');
  end if;
  if v_p.status not in ('aceito','ativo') then
    return jsonb_build_object('error', 'o plano precisa estar aceito');
  end if;
  if p_numero is null or not exists (
    select 1 from jsonb_array_elements_text(v_p.escopo->'numeros') n where n::int = p_numero
  ) then return jsonb_build_object('error', 'encontro fora do plano'); end if;

  insert into public.dupla_plano_roteiros
    (dupla_id, plano_id, numero, versao, plano_versao, conteudo, status,
     gerado_por, gerado_via, editado_por)
  values (v_p.dupla_id, p_plano, p_numero, 1, v_p.versao, p_conteudo, 'rascunho',
          public.my_profile_id(), p_via, public.my_profile_id())
  on conflict (plano_id, numero, versao) do update
    set conteudo = excluded.conteudo,
        editado_por = public.my_profile_id(),
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function public.roteiro_salvar(uuid, smallint, jsonb, text) from public, anon;
grant execute on function public.roteiro_salvar(uuid, smallint, jsonb, text) to authenticated;
commit;
