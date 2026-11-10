-- 0176: e-mail do jovem vinculado tem fonte única + availability olha mentorados.
--
-- CONTEXTO (achados das auditorias REALIZA-371+)
-- Com mentorados.profile_id populado pela primeira vez, o e-mail do jovem
-- vive em 3 lugares: auth.users (login), profiles.email (sync via 0060) e
-- mentorados.email (contato/convite). Sem propagação, divergem — e a
-- divergência gera conta fantasma no próximo signup (allowlist aceita
-- mentorados.email, handle_new_user não acha profile_id livre).
--
-- O que muda:
-- 1) profiles_email_sync_mentorado: update em profiles.email reflete em
--    mentorados.email das fichas vinculadas (profile_id = profile.id) —
--    auth→profiles→mentorados fecha a cadeia pros caminhos self-service
--    (trocarEmail) e admin.
-- 2) email_disponivel passa a considerar mentorados.email: impede que a
--    troca de e-mail de alguém caia no cadastro de OUTRO jovem (a conta
--    resultante roubaria o magic link dele). A própria ficha vinculada ao
--    usuário não conta.

begin;

create or replace function public.email_disponivel(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_email is not null
    and btrim(p_email) <> ''
    and not exists (
      select 1 from public.profiles
      where lower(email) = lower(btrim(p_email))
        and user_id is distinct from auth.uid()
    )
    and not exists (
      select 1 from auth.users
      where lower(email) = lower(btrim(p_email))
        and id is distinct from auth.uid()
    )
    and not exists (
      select 1 from public.mentorados m
      where lower(m.email) = lower(btrim(p_email))
        and m.profile_id is distinct from (
          select p.id from public.profiles p where p.user_id = auth.uid()
        )
    );
$$;

revoke all on function public.email_disponivel(text) from public;
grant execute on function public.email_disponivel(text) to authenticated;

create or replace function public.sync_mentorado_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mentorados
     set email = lower(btrim(new.email))
   where profile_id = new.id
     and email is distinct from lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists profiles_email_sync_mentorado on public.profiles;
create trigger profiles_email_sync_mentorado
  after update of email on public.profiles
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_mentorado_email();

commit;
