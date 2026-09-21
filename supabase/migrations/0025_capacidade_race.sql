-- 0025: capacidade do mentor verificada no banco. A checagem na action lia
-- o count antes do insert — dois pedidos simultâneos passavam juntos e
-- estouravam a capacidade. O trigger faz SELECT FOR UPDATE na row do
-- mentor em mentor_profiles: inserts concorrentes pra mesma pessoa
-- serializam ali, e o segundo já enxerga a dupla do primeiro.

create or replace function public.check_mentor_capacidade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  em_curso int;
begin
  -- serializa por mentor: quem chegar depois espera o primeiro commitar
  perform 1 from mentor_profiles where profile_id = NEW.mentor_id for update;

  select coalesce(
    (select capacidade from mentor_profiles where profile_id = NEW.mentor_id),
    1
  ) into cap;

  select count(*) into em_curso
  from duplas
  where mentor_id = NEW.mentor_id
    and status in ('ativa', 'pausada')
    and id <> NEW.id;

  if em_curso >= cap then
    raise exception 'capacidade do mentor excedida';
  end if;
  return NEW;
end;
$$;

drop trigger if exists duplas_capacidade on public.duplas;
create trigger duplas_capacidade
  before insert or update of mentor_id, status on public.duplas
  for each row
  when (NEW.status in ('ativa', 'pausada'))
  execute function public.check_mentor_capacidade();
