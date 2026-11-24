-- 0232 — jovem_plano devolve aprovado_em (janela de contestação)
-- A RPC do banco valida contestação por coalesce(aprovado_em, created_at);
-- o recorte do jovem precisa do mesmo carimbo para a tela não divergir.
begin;
create or replace function public.jovem_plano()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
  v_p record;
begin
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  select d.id into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  select p.* into v_p
    from dupla_planos p
   where p.dupla_id = v_dupla.id
   order by (p.status in ('proposto','aceito','ativo')) desc,
            p.created_at desc
   limit 1;
  if not found then
    return 'null'::jsonb;
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'status', v_p.status,
    'versao', v_p.versao,
    'ritmo', v_p.escopo->>'ritmo',
    'janela', v_p.escopo->'janela',
    'passos', v_p.escopo->'passos',
    'aprovado_lado', v_p.aprovado_lado,
    'proposto_por', v_p.proposto_por,
    'proposto_via', v_p.proposto_via,
    'aceito_mentor', v_p.aceito_mentor_em is not null,
    'aceito_mentorado', v_p.aceito_mentorado_em is not null,
    'proposto_em', v_p.created_at,
    'aprovado_em', v_p.aprovado_em,
    'expira_em', v_p.expira_em,
    'concluido_em', v_p.concluido_em,
    'passos_aplicados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', s.numero, 'data_nova', s.data_nova,
               'aplicado_em', s.aplicado_em) order by s.numero)
        from dupla_plano_passos s
       where s.plano_id = v_p.id), '[]'::jsonb)
  );
end $$;

revoke all on function public.jovem_plano() from public, anon;
grant execute on function public.jovem_plano() to authenticated;
commit;
