-- 0195 — REALIZA-387: avaliação por terceiros com mistura livre.
--
-- The guide's 3 amigos + 3 familiares + 3 colegas was enforced by the
-- trigger: asking 9 specific people by vínculo proved too much friction.
-- New ruler: free mix up to 9 total, with "at least 3 people who know
-- the jovem well" living only in copy. The vínculo column stays as an
-- informational label (amigo/familiar/colega/outro), not a constraint.
--
-- Diff against the 0105 guard: the per-vínculo raise is gone and the
-- trigger is INSERT-only again (0105 added UPDATE OF vinculo solely to
-- police the per-vínculo cap on edits — without the cap the clause only
-- took the advisory lock to no-op). The total-of-9 cap and the advisory
-- lock stay: concurrent inserts of the same dupla are still serialized
-- and decided by the database, not the client.

begin;

create or replace function public.guard_terceiros_cap()
returns trigger language plpgsql set search_path to '' as $$
begin
  -- serialize inserts of the same dupla: two concurrent requests would
  -- read the same read-committed count(*) and both pass the cap
  -- (pg_advisory_xact_lock convention from 0102/0099)
  perform pg_advisory_xact_lock(hashtext('terceiros_cap:' || new.dupla_id::text));
  -- 0195: only the total stays capped — vínculo mix is a copy-level
  -- suggestion now, not a constraint
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

-- manual rollback: restore the per-vínculo "3 por vínculo" block from
-- 0105 in the function and recreate the trigger as
-- "before insert or update of vinculo" (see 0105).
