-- 0060: troca de e-mail self-service — o perfil segue a credencial.
--
-- A troca é o fluxo padrão do Supabase: updateUser({email}) dispara o link
-- de confirmação pro novo endereço e o e-mail em auth.users só muda quando
-- o link é clicado. Esta migration cobre as duas pontas que ficavam de fora:
--
-- 1) sync_profile_email — quando auth.users.email muda, profiles.email
--    acompanha via user_id (o pivô estável; e-mail é o que está mudando).
--    O unique(lower(email)) da 0059 é o backstop: se o novo e-mail já mora
--    em outro profile (pré-cadastro alheio, por exemplo), o update aqui
--    colide e a transação inteira do auth volta atrás — o e-mail antigo
--    segue valendo e nenhum cadastro é sequestrado.
--
-- 2) email_disponivel — pré-checagem pra UX: o cliente pergunta ANTES de
--    mandar o link, cobrindo profiles (inclui pré-cadastro sem user_id) e
--    auth.users. Sem isso o erro só aparecia no clique do link.
--
-- A coordenação continua podendo escrever profiles.email SÓ em row sem
-- user_id (o patch do cadastro guarda `!atual?.user_id`) — ou seja, o
-- trigger é o único caminho que toca e-mail de conta já vinculada.

begin;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = lower(btrim(new.email))
  where user_id = new.id
    and email is distinct from lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

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
    );
$$;

revoke all on function public.email_disponivel(text) from public;
grant execute on function public.email_disponivel(text) to authenticated;

commit;
