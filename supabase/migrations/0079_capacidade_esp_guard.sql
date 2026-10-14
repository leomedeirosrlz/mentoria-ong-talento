-- 0079: o guard do mentor_profiles ainda não cobria `capacidade_especialista`
-- (a coluna nasceu na 0073, depois do guard da 0004/0040/0052). Sem ela na
-- lista de campos de validação, o mentor_especialista podia dar UPDATE na
-- própria ficha (policy mentor_profiles_self_update) e se auto-conceder
-- vagas de trilha — furando justamente a garantia que a capacidade dá
-- (REALIZA-116: o trigger do banco é a guarda final, coord-only).
begin;

create or replace function public.guard_mentor_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and ((new.termo_ok is distinct from old.termo_ok
           and current_setting('realiza.assinatura_sync', true) is distinct from '1')
          or new.capacidade is distinct from old.capacidade
          or new.capacidade_especialista is distinct from old.capacidade_especialista
          or new.tipo is distinct from old.tipo
          or (new.formacao_ok is distinct from old.formacao_ok
              and current_setting('realiza.formacao_sync', true) is distinct from '1')) then
    raise exception 'campos de validacao so podem ser alterados pela coordenacao';
  end if;
  return new;
end $$;

commit;
