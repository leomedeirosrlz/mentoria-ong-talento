-- 0240 — fecha o alerta auth_users_exposed (Supabase advisor)
--
-- `profiles_acesso` (0192) fazia join direto em auth.users numa view
-- security definer exposta ao PostgREST. O advisor critical
-- `auth_users_exposed` acusa qualquer view acessível que projete auth.users,
-- mesmo com o WHERE coord-only. A correção move o sinal para uma coluna
-- sincronizada em profiles:
--   1) profiles.ultimo_acesso_em (backfill de auth.users.last_sign_in_at);
--   2) trigger em auth.users que mantém a coluna em dia;
--   3) a view vira select simples de profiles, sem auth.users no grafo.
-- O contrato da view (id, ultimo_acesso_em) e o gate coord-only não mudam.
begin;

alter table public.profiles
  add column if not exists ultimo_acesso_em timestamptz;

comment on column public.profiles.ultimo_acesso_em is
  'Último login (auth.users.last_sign_in_at) sincronizado pela 0240 — sinal operacional coord-only, nunca dado de diretório.';

update public.profiles p
   set ultimo_acesso_em = u.last_sign_in_at
  from auth.users u
 where u.id = p.user_id
   and p.ultimo_acesso_em is distinct from u.last_sign_in_at;

create or replace function public.sync_profile_ultimo_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set ultimo_acesso_em = new.last_sign_in_at
   where user_id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_ultimo_acesso on auth.users;
create trigger on_auth_user_ultimo_acesso
  after insert or update of last_sign_in_at on auth.users
  for each row execute function public.sync_profile_ultimo_acesso();

create or replace view public.profiles_acesso as
select p.id, p.ultimo_acesso_em
  from public.profiles p
 where public.my_role() = 'coordenacao'::public.app_role;

comment on view public.profiles_acesso is
  'Ultimo acesso por profile (REALIZA-39/0240): profiles.ultimo_acesso_em sincronizado do auth.users; leitura coord-only — sinal operacional do status "nao acessou", nunca dado de diretorio. Sem auth.users no grafo da view.';

revoke all on public.profiles_acesso from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles_acesso from authenticated;
grant select on public.profiles_acesso to authenticated;

commit;
