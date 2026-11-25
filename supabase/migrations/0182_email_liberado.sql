-- 0182: email_liberado — consulta anônima da allowlist de login.
--
-- CONTEXTO
-- Quando o signup OTP falha com o 500 genérico do GoTrue ("database error
-- saving new user" SEM a frase do trigger), o /login não sabia dizer se o
-- e-mail não estava na allowlist ou se a infra tropeçou (SMTP, pooler,
-- trigger quebrado). O mapeamento antigo acusava "e-mail não cadastrado"
-- nos dois casos — a pessoa cadastrada ouvia que não existia no pior
-- momento (indisponibilidade real). Com esta RPC anon o cliente confere a
-- allowlist de verdade: fora dela → "não cadastrado"; nela → "instável,
-- tente de novo".
--
-- Mesma regra do guard_signup_allowlist (0045/0171): e-mail presente em
-- profiles OU mentorados, comparação lower(). É leak de existência de
-- conta — aceito de propósito: a tela de login já respondia "e-mail não
-- cadastrado" pra allowlist-miss antes, a RPC só torna o diagnóstico
-- correto (e o magic link em si já delata a mesma coisa ao não chegar).
-- Precedente de shape: email_disponivel (0176), mas aquela exige sessão —
-- aqui o caller ainda está deslogado, daí grant pra anon.

begin;

create or replace function public.email_liberado(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_email is not null
    and btrim(p_email) <> ''
    and (
      exists (
        select 1 from public.profiles
        where lower(email) = lower(btrim(p_email))
      )
      or exists (
        select 1 from public.mentorados m
        where lower(m.email) = lower(btrim(p_email))
      )
    );
$$;

revoke all on function public.email_liberado(text) from public;
grant execute on function public.email_liberado(text) to anon, authenticated;

commit;
