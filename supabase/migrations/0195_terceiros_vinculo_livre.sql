-- 0195 — REALIZA-387: avaliação por terceiros com mistura livre.
--
-- Os 3 amigos + 3 familiares + 3 colegas do guia eram garantidos pela
-- trigger: pedir 9 pessoas específicas por vínculo provou fricção
-- demais. Régua nova: mistura livre até 9 no total, com "pelo menos 3
-- pessoas que conhecem bem o(a) jovem" vivendo só na copy. A coluna
-- vínculo fica como rótulo informativo (amigo/familiar/colega/outro),
-- não como constraint.
--
-- Diff contra o guard da 0105: o raise por vínculo sai e a trigger
-- volta a ser INSERT-only (a 0105 adicionou UPDATE OF vinculo só pra
-- policiar o cap por vínculo nas edições — sem o cap, a cláusula só
-- tomava o advisory lock à toa). O cap de 9 no total e o advisory lock
-- ficam: inserts concorrentes da mesma dupla seguem serializados e
-- decididos pelo banco, não pelo client.

begin;

create or replace function public.guard_terceiros_cap()
returns trigger language plpgsql set search_path to '' as $$
begin
  -- serializa inserts da mesma dupla: duas requests concorrentes liam
  -- o mesmo count(*) do read-committed e as duas passariam no cap
  -- (convenção pg_advisory_xact_lock da 0102/0099)
  perform pg_advisory_xact_lock(hashtext('terceiros_cap:' || new.dupla_id::text));
  -- 0195: só o total segue capado — a mistura de vínculos agora é
  -- sugestão de copy, não constraint
  if (select count(*) from public.terceiros_contatos
       where dupla_id = new.dupla_id) >= 9 then
    raise exception 'o guia prevê até 9 pessoas indicadas por dupla';
  end if;
  return new;
end $$;

drop trigger if exists terceiros_contatos_cap on public.terceiros_contatos;
create trigger terceiros_contatos_cap
  before insert on public.terceiros_contatos
  for each row execute function public.guard_terceiros_cap();

commit;

-- rollback manual: restaurar na função o bloco por vínculo da 0105
-- ("3 por vínculo") e recriar a trigger como
-- "before insert or update of vinculo" (ver 0105).
