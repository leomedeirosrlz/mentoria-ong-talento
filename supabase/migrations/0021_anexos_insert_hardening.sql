-- Endurece o INSERT de evidência (audit do diff 0020):
-- 1. created_by tem que ser o próprio autor — antes dava pra atribuir o anexo
--    a outra pessoa (só cosmético/auditoria, mas gratuito de fechar)
-- 2. path preso ao prefixo `<registro_id>/` — convenção que o client segue e
--    a policy de storage assume; um path fora dela criaria row órfã
-- 3. dupla tem que estar ativa — a UI e as actions já gateiam em status, a
--    policy não conferia (mentor podia anexar via API em dupla pausada)
-- UPDATE segue sem policy de propósito: rows de anexo são imutáveis.

drop policy registro_anexos_mentor_insert on public.registro_anexos;

create policy registro_anexos_mentor_insert on public.registro_anexos
  for insert with check (
    created_by = public.my_profile_id()
    and path like (registro_id::text || '/%')
    and exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id
        and d.mentor_id = public.my_profile_id()
        and d.status = 'ativa'
    )
  );
