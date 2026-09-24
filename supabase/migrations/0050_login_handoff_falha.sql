-- handoff também sinaliza falha: quando o link chega queimado/expirado, a aba
-- do e-mail marca o nonce como falho e a aba que pediu mostra o estado certo
-- em vez de esperar pra sempre
alter table public.login_handoffs
  add column failed boolean not null default false;

create or replace function public.falhar_login_handoff(p_nonce uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_handoffs (nonce, access_token, refresh_token, failed)
    values (p_nonce, '', '', true)
    on conflict (nonce) do nothing;
end $$;

grant execute on function public.falhar_login_handoff(uuid) to anon, authenticated;

create or replace function public.pegar_login_handoff(p_nonce uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
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
