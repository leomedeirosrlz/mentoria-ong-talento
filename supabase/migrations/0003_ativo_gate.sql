-- pessoa desativada perde o papel -> RLS bloqueia tudo; profiles_select segue
-- permitindo ler o proprio profile (user_id = auth.uid()) pra tela de "acesso desativado"
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() and ativo $$;
