-- 0045: allowlist de signup — só entra quem a coordenação pré-cadastrou.
--
-- CONTEXTO
-- O provisionamento da plataforma é por pré-cadastro: a coordenação cria a
-- row em `profiles` (com e-mail) e o trigger `handle_new_user` (0001) vincula
-- `user_id` no primeiro login. Sem este guard, qualquer e-mail conseguia
-- abrir conta por magic link e caía na tela "cadastro recebido" — conta
-- órfã, sem papel, sujando auth.users.
--
-- DECISÃO SOBRE admin.createUser / service_role
-- Dentro de um trigger em auth.users NÃO dá pra distinguir signup público de
-- admin.createUser com segurança: os dois caminhos passam pelo GoTrue, que
-- escreve no banco sempre como o papel `supabase_auth_admin`, sem
-- request.jwt.claims (isso é canal do PostgREST, o GoTrue não passa por lá).
-- O mesmo vale pro "invite" do dashboard. Portanto a allowlist vale para
-- TODO insert que venha do GoTrue — signup público E admin.createUser
-- exigem profile pré-cadastrado (match por e-mail, case-insensitive).
--
-- Isso é consistente com o modelo do app: um auth.user sem profile
-- correspondente não tem papel e não passa da tela "cadastro recebido".
-- Provisionar via admin API continua possível — basta criar a row em
-- profiles antes (é o fluxo que já existe). Criação administrativa FORA do
-- GoTrue bypassa a allowlist: inserts via SQL editor, migrações, seeds e
-- conexões diretas como postgres/supabase_admin/service_role não são
-- signup de usuário final.
--
-- Efeito colateral coerente: handle_new_user passa a comparar e-mail com
-- lower() — a allowlist admite "Ana@x.com" porque "ana@x.com" está
-- pré-cadastrado, e o vínculo precisa casar do mesmo jeito.

begin;

create or replace function public.guard_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- bypass administrativo: o insert só é signup quando vem do GoTrue
  -- (supabase_auth_admin) ou de chamada PostgREST (authenticator roda SET
  -- ROLE pro papel do JWT — session_user segue sendo authenticator).
  -- Migrações, SQL editor e service_role direto passam fora da allowlist.
  if session_user not in ('supabase_auth_admin', 'authenticator', 'anon', 'authenticated') then
    return new;
  end if;
  if exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(new.email)
  ) then
    return new;
  end if;
  raise exception 'Este e-mail não está na lista de cadastrados do programa — fale com a coordenação.';
end
$$;

drop trigger if exists on_auth_user_allowlist on auth.users;
create trigger on_auth_user_allowlist
  before insert on auth.users
  for each row execute function public.guard_signup_allowlist();

-- vínculo do 1º login casa com a allowlist: mesma comparação lower()
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  if not found then
    insert into public.profiles (user_id, email, nome)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  end if;
  return new;
end;
$$;

commit;
