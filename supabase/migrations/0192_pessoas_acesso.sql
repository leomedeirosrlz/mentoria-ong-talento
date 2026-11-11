-- 0192: último acesso por pessoa — "não acessou" do /pessoas (REALIZA-39).
--
-- CONTEXTO
-- O vocabulário de status da página distingue "convidado" (conta criada,
-- onboarding pendente) de "não acessou" (onboarded, mas nunca voltou).
-- O sinal real é auth.users.last_sign_in_at — inacessível ao PostgREST
-- (schema auth não é exposto) e não replicado em profiles.
--
-- Desenho escolhido: view security definer (roda como owner — ignora
-- grants/RLS da base, como profiles_contato/profiles_pessoal) em vez de
-- coluna replicada + trigger: nada duplicado, sem write path novo e o
-- sinal é sempre o do auth. O WHERE é o gate — só coordenação lê linhas;
-- pros demais a view devolve zero (o app nem dispara fora da coordenação).
-- Último acesso é sinal operacional, não dado de diretório.
--
-- profiles.id é a chave: a conta do jovem mora no profile vinculado
-- (mentorados.profile_id → profiles.user_id), então a mesma view cobre
-- staff e jovem-com-login.

begin;

create or replace view public.profiles_acesso as
select
  p.id,
  u.last_sign_in_at as ultimo_acesso_em
from public.profiles p
join auth.users u on u.id = p.user_id
where public.my_role() = 'coordenacao'::app_role;

comment on view public.profiles_acesso is
  'Ultimo acesso por profile (REALIZA-39): auth.users.last_sign_in_at projetado por view definer; leitura coord-only — sinal operacional do status "nao acessou", nunca dado de diretorio.';

revoke all on public.profiles_acesso from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles_acesso from authenticated;
grant select on public.profiles_acesso to authenticated;

-- completa a 0142: `voluntario` entrou sem grant — todo `p.voluntario ===
-- false` do app (layout, /perfil, badges do /pessoas e agora o status
-- "termo pendente" da REALIZA-39) lia undefined e tratava a pessoa como
-- voluntária. É flag operacional no mesmo nível de role/ativo — vai no
-- grant público por coluna, como elas.
grant select (voluntario) on public.profiles to authenticated;

commit;
