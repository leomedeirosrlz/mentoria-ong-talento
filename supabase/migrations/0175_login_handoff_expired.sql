-- 0175: pegar_login_handoff distingue nonce expirado de "ainda não".
--
-- CONTEXTO
-- O handoff do magic link cross-device tem TTL de 10min a partir do
-- PUBLICAR (quando a aba do e-mail abre /auth/link). Se a aba que pediu
-- o link estiver dormindo/fechada e voltar depois do TTL, todo poll
-- devolvia null — igual a "ninguém clicou ainda" — e a tela ficava em
-- "entra sozinha" pra sempre, sem erro nem saída óbvia. O JWT da sessão
-- já existia no outro aparelho; os tokens do handoff é que morreram.
--
-- O que muda: se a row DESTE nonce existe mas está expirada, a RPC
-- devolve {"expired": true} (e remove a row) em vez de null. Row
-- inexistente ou válida segue o comportamento de sempre. O frontend
-- passa a mostrar o card de link expirado com CTA de reenviar.

begin;

create or replace function public.pegar_login_handoff(p_nonce uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_expired boolean;
begin
  -- o nonce DESTE pedido antes da limpeza global: expirado tem que ser
  -- distinguível de "a aba do e-mail ainda não abriu o link"
  select expires_at < now() into v_expired
    from public.login_handoffs
   where nonce = p_nonce;
  if v_expired then
    delete from public.login_handoffs where nonce = p_nonce;
    return jsonb_build_object('expired', true);
  end if;

  delete from public.login_handoffs where expires_at < now();
  delete from public.login_handoffs where nonce = p_nonce
    returning access_token, refresh_token, failed into r;
  if not found then return null; end if;
  if r.failed then
    return jsonb_build_object('failed', true);
  end if;
  return jsonb_build_object(
    'access_token', r.access_token,
    'refresh_token', r.refresh_token
  );
end $$;

commit;
