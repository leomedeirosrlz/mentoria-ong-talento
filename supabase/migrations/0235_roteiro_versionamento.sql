-- 0235 — versiona roteiros publicados ao editar/regenerar (REALIZA-521)
-- Editar o rascunho da versão vigente atualiza a row; se já há publicado
-- (ou o plano mudou de versão), cria nova versão de rascunho e preserva
-- a publicada anterior, que só vira `substituido` ao publicar a nova.
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
  v_vers int;
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

  -- editar o rascunho da versão vigente; se já há publicado (ou o plano
  -- mudou de versão), cria nova versão de rascunho sem tocar a anterior.
  select r.id into v_id
    from public.dupla_plano_roteiros r
   where r.plano_id = p_plano and r.numero = p_numero
     and r.plano_versao = v_p.versao and r.status = 'rascunho'
   order by r.versao desc limit 1;
  if v_id is not null then
    update public.dupla_plano_roteiros
       set conteudo = p_conteudo,
           editado_por = public.my_profile_id(),
           updated_at = now()
     where id = v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'versao',
      (select versao from public.dupla_plano_roteiros where id = v_id));
  end if;

  select coalesce(max(r.versao), 0) + 1 into v_vers
    from public.dupla_plano_roteiros r
   where r.plano_id = p_plano and r.numero = p_numero;
  insert into public.dupla_plano_roteiros
    (dupla_id, plano_id, numero, versao, plano_versao, conteudo, status,
     gerado_por, gerado_via, editado_por)
  values (v_p.dupla_id, p_plano, p_numero, v_vers, v_p.versao, p_conteudo, 'rascunho',
          public.my_profile_id(), p_via, public.my_profile_id())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'versao', v_vers);
end $$;

revoke all on function public.roteiro_salvar(uuid, smallint, jsonb, text) from public, anon;
grant execute on function public.roteiro_salvar(uuid, smallint, jsonb, text) to authenticated;
commit;
