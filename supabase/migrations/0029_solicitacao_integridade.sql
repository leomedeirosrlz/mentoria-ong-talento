-- 0029: integridade das solicitações — dois gaps que a RLS não cobre:
-- 1) insert: mentorado_id podia divergir do mentorado da dupla_dpp_id
--    (a action deriva server-side, mas PostgREST direto aceitava qualquer um)
-- 2) update: o WITH CHECK da sol_update valida status/especialista_id, mas
--    não impede editar demanda/mentorado_id/dupla_dpp_id na mesma operação.
--    Regra: campos imutáveis só mudam pela coordenação (e o RPC definer, que
--    roda como owner e ignora RLS/trigger de guarda por bypass_rls? — não:
--    trigger BEFORE UPDATE dispara sempre; o RPC precisa passar nele também).
--    O aceite do RPC só toca status/especialista_id/dupla_id/respondida_em —
--    campos mutáveis por desenho; os demais ficam congelados pra não-coord.

create or replace function public.solicitacao_integridade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- a demanda nasce da dupla DPP: o mentorado é o daquela dupla, não um
    -- valor solto vindo do cliente
    if new.mentorado_id <> (select d.mentorado_id from public.duplas d where d.id = new.dupla_dpp_id) then
      raise exception 'mentorado_id diverge do mentorado da dupla';
    end if;
    return new;
  end if;

  -- UPDATE: campos de identidade e conteúdo são imutáveis pra quem não é
  -- coordenação — o aceite do especialista (direto ou via RPC) só pode tocar
  -- status/especialista_id/dupla_id/respondida_em
  if public.my_role() is not null and public.my_role() <> 'coordenacao' then
    if new.mentorado_id <> old.mentorado_id
       or new.dupla_dpp_id <> old.dupla_dpp_id
       or new.demanda <> old.demanda
       or new.created_by is distinct from old.created_by
       or new.especialista_desejado_id is distinct from old.especialista_desejado_id then
      raise exception 'campos da solicitação são imutáveis';
    end if;
  end if;
  return new;
end $$;

create trigger solicitacoes_integridade
  before insert or update on public.solicitacoes_especialista
  for each row execute function public.solicitacao_integridade();
