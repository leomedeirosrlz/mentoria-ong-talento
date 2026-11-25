-- 0181: registrar_login_handoff resgata o tombstone `failed`.
--
-- CONTEXTO
-- A corrida real do handoff: a aba do e-mail pode chamar
-- falhar_login_handoff ANTES de um registrar tardio — ex.: o primeiro
-- registrar morreu num erro transitório (rede, cold start do PostgREST), a
-- página marcou o nonce como falho e a pessoa clicou de novo no link. Com
-- `on conflict do nothing` o tombstone ganhava pra sempre: o segundo
-- publish era engolido e a aba que pediu recebia {failed} mesmo com o link
-- válido na mão — link bom morrendo por uma falha temporária.
--
-- O que muda: o insert vira `do update` com `where failed` — tokens sempre
-- vencem tombstone. O WHERE é o guard nos dois sentidos:
--   - registrar tardio resgata uma row failed (o caso acima);
--   - um segundo registrar NÃO sobrescreve tokens bons já publicados (sem o
--     where, dois cliques no e-mail — o segundo com link reemitido e
--     tokens novos — roubariam a row e a aba que pediu entraria com a
--     sessão do clique errado).
-- falhar continua `do nothing` (nunca apaga tokens válidos) e pegar não
-- muda: a ordem final vence — tokens > tombstone > nada.

begin;

create or replace function public.registrar_login_handoff(
  p_nonce uuid,
  p_access text,
  p_refresh text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.login_handoffs where expires_at < now();
  insert into public.login_handoffs (nonce, access_token, refresh_token)
    values (p_nonce, p_access, p_refresh)
    on conflict (nonce) do update set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      failed = false,
      expires_at = excluded.expires_at
    where public.login_handoffs.failed;
end $$;

commit;
