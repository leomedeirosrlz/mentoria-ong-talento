-- 0236 — substituição atômica do plano no aceite (REALIZA-518)
--
-- O ajuste de recesso no aceite fechava a versão vigente numa RPC e propunha
-- a recalculada em outra. Se a segunda falhasse, a dupla ficava sem plano.
-- Esta RPC faz as duas coisas na MESMA transação: fecha a versão anterior
-- como contestada e delega a proposta nova ao plano_propor (que já valida
-- escopo, janela, recessos, versão e notificação). Qualquer erro no meio
-- desfaz o fechamento e devolve {error}, sem estado parcial.
begin;

create or replace function public.plano_substituir(
  p_plano uuid,
  p_dupla uuid,
  p_escopo jsonb,
  p_motivo text default null,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p public.dupla_planos%rowtype;
  v_d record;
  v_lado text;
  v_res jsonb;
begin
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;

  select * into v_p
    from public.dupla_planos p
   where p.id = p_plano
   for update;
  if not found or v_p.dupla_id is distinct from p_dupla then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;

  select d.mentor_id, d.mentorado_id into v_d
    from public.duplas d
   where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;

  v_lado := case
    when v_d.mentor_id = public.my_profile_id() then 'mentor'
    when public.my_mentorado_id() is not null
         and v_d.mentorado_id = public.my_mentorado_id() then 'mentorado'
  end;
  if v_lado is null then
    return jsonb_build_object('error', 'só a dupla pode substituir o plano');
  end if;
  if v_p.status not in ('proposto','aceito','ativo') then
    return jsonb_build_object('error', 'esse plano não está mais aberto');
  end if;

  -- mesma guarda da contestação: o combinado não é trocado depois de um
  -- encontro do escopo acontecer de fato
  if exists (
    select 1 from public.encontros e
     where e.dupla_id = p_dupla
       and e.status = 'realizado'
       and e.numero in (
         select n::int from jsonb_array_elements_text(v_p.escopo->'numeros') n)
       and e.realizado_em >= coalesce(v_p.aprovado_em, v_p.created_at)
  ) then
    return jsonb_build_object(
      'error', 'o plano já teve encontro acontecendo. Fale com a coordenação');
  end if;

  begin
    update public.dupla_planos
       set status = 'contestado',
           contestado_por = public.my_profile_id(),
           contestado_motivo = coalesce(
             nullif(btrim(p_motivo), ''),
             'O combinado foi ajustado no aceite — versão recalculada.'),
           contestado_em = now(),
           updated_at = now()
     where id = p_plano;

    insert into public.dupla_plano_eventos
      (plano_id, dupla_id, tipo, de, para, motivo, por, meta)
    values (p_plano, p_dupla, 'contestado', v_p.status, 'contestado',
            coalesce(nullif(btrim(p_motivo), ''),
                     'O combinado foi ajustado no aceite — versão recalculada.'),
            public.my_profile_id(),
            jsonb_build_object('lado', v_lado, 'substituicao', true));

    -- plano_propor valida a versão nova e minta a notificação de autoria.
    -- Se devolver erro (ou estourar), a exceção desfaz o fechamento acima.
    v_res := public.plano_propor(p_dupla, p_escopo, p_via);
    if v_res ? 'error' then
      raise exception using errcode = 'P0001', message = v_res->>'error';
    end if;

    return v_res || jsonb_build_object(
      'substituido', true,
      'plano_anterior', p_plano);
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('error', SQLERRM);
    when others then
      return jsonb_build_object(
        'error', 'não consegui substituir o plano agora');
  end;
end $$;

revoke all on function public.plano_substituir(uuid, uuid, jsonb, text, text)
  from public, anon;
grant execute on function public.plano_substituir(uuid, uuid, jsonb, text, text)
  to authenticated;

commit;
