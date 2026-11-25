-- BACKLOG: e-mail pra coordenação quando o mentor marca "preciso de apoio"
-- no registro (o pedido esperava a infra do Resend — liberada em nov/2026).
-- O trigger registros_apoio_chamado_sync (0084) abre o chamado dentro da
-- transação do registro, sem passar por action: o id/numero e a lista de
-- destinatários do e-mail redundante não chegavam ao app. Esta RPC devolve
-- o mesmo contrato do abrir_chamado escopado ao chamado do registro, pra
-- salvarRegistro disparar o envio (Resend mora fora do banco).

create or replace function public.chamado_do_registro(p_registro_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare
  v_role text := public.my_role();
  v_autor uuid := public.my_profile_id();
  v_c record;
  v_dests jsonb;
begin
  if v_autor is null or v_role is null then
    raise exception 'sem sessão ativa';
  end if;

  select c.id, c.numero, c.dupla_id, c.autor_id, c.assunto
    into v_c
    from chamados c
   where c.registro_id = p_registro_id
     and c.status <> 'resolvido'
   limit 1;

  if v_c.id is null then
    return jsonb_build_object('id', null, 'numero', null,
      'destinatarios', '[]'::jsonb);
  end if;

  -- só quem abriu (autor do registro) ou a equipe lê os destinatários —
  -- e-mail alheio não vaza pela RPC
  if v_c.autor_id <> v_autor
     and v_role not in ('coordenacao', 'supervisor') then
    raise exception 'sem permissão';
  end if;

  -- mesma régua do abrir_chamado: coord ativa + supervisor da dupla
  select jsonb_agg(jsonb_build_object(
           'profile_id', p.id, 'email', p.email, 'nome', p.nome))
    into v_dests
    from profiles p
   where p.ativo and (
     p.role = 'coordenacao'
     or p.id = (select d.supervisor_id from duplas d
                 where d.id = v_c.dupla_id));

  return jsonb_build_object('id', v_c.id, 'numero', v_c.numero,
    'assunto', v_c.assunto,
    'destinatarios', coalesce(v_dests, '[]'::jsonb));
end $$;

revoke all on function chamado_do_registro(uuid) from public, anon;
grant execute on function chamado_do_registro(uuid) to authenticated;
