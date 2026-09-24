-- Handoff do magic link: o link pode abrir em outro navegador/app de e-mail
-- (ou outro dispositivo), onde a aba que pediu nunca veria os cookies. O
-- pedido gera um nonce que viaja no link; a aba que abre devolve os tokens
-- aqui, e a aba original os resgata — "o link só autentica a sessão que
-- pediu", mesmo cross-device. O nonce uuid (128 bits) é a credencial: trafega
-- no mesmo canal do próprio link, então não enfraquece o modelo.
create table public.login_handoffs (
  nonce uuid primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

alter table public.login_handoffs enable row level security;
-- sem policies: acesso só via as duas RPCs abaixo
revoke all on public.login_handoffs from public, anon, authenticated;

-- a aba que abriu o link publica os tokens pro nonce. Anônima de propósito:
-- exigir sessão aqui consumiria o refresh_token de uso único — ele pertence
-- à aba original, não à do e-mail.
create or replace function public.registrar_login_handoff(
  p_nonce uuid,
  p_access text,
  p_refresh text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_handoffs (nonce, access_token, refresh_token)
    values (p_nonce, p_access, p_refresh)
    on conflict (nonce) do nothing;
end $$;

-- a aba que pediu o link resgata — uso único (delete) + validade curta
create or replace function public.pegar_login_handoff(p_nonce uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  delete from public.login_handoffs where expires_at < now();
  delete from public.login_handoffs where nonce = p_nonce
    returning access_token, refresh_token into r;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'access_token', r.access_token,
    'refresh_token', r.refresh_token
  );
end $$;

grant execute on function public.registrar_login_handoff(uuid, text, text)
  to anon, authenticated;
grant execute on function public.pegar_login_handoff(uuid)
  to anon, authenticated;
