-- REALIZA-107 fase B — papel 'mentorado' + vínculo de identidade.
--
-- Por que separada da fase A e da C: `ALTER TYPE ADD VALUE` não pode ser
-- REFERENCIADO dentro da mesma transação (PG 55P04). Este arquivo adiciona o
-- valor mas nunca o usa — as policies/RPCs que o mencionam entram na fase C.
--
-- Irreversível por natureza: valor de enum não sai sem recriar o tipo.
-- Rollback operacional = feature-off (ninguém recebe o papel; nenhuma policy
-- concede nada a ele ainda — a fase A garantiu a exclusão por omissão).

begin;

-- 1) o papel.
alter type public.app_role add value if not exists 'mentorado';

-- 2) vínculo estável: mentorados.id continua a identidade de participação
-- (histórico de duplas/encontros/forms já pendura nele — nada se recolhe);
-- profile_id liga essa identidade à conta quando ela existir. Nullable:
-- jovem sem login segue funcionando por links tokenizados. unique: uma conta,
-- um mentorado. Sem on delete set null — apagar profile vinculado bloqueia
-- (preservação > conveniência; perfil se desativa com ativo=false).
alter table public.mentorados
  add column profile_id uuid unique references public.profiles(id);

-- 3) resolvedor de identidade do mentorado logado.
-- Identidade ≠ autorização: devolve o mentorados.id do usuário autenticado,
-- cabe a cada policy/RPC combinar com my_role()='mentorado' (ex-mentorado que
-- vira mentor mantém o vínculo mas perde o acesso — o papel revoga, o vínculo
-- é permanente). `ativo` vem embutido via my_profile_id() (definer, `and ativo`
-- — verificado em prod 2026-10). Espelha my_profile_id()/my_role(): sql stable
-- security definer + search_path fixo + grant pros mesmos roles.
create or replace function public.my_mentorado_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id from public.mentorados m
  where m.profile_id = public.my_profile_id()
$$;

grant execute on function public.my_mentorado_id() to anon, authenticated, service_role;

commit;
