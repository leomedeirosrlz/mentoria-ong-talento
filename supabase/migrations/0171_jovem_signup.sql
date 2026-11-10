-- 0171: jovem (mentorado) consegue fazer o 1º login — allowlist + vínculo.
--
-- CONTEXTO (REALIZA-371)
-- A allowlist da 0045 só olhava public.profiles, mas o cadastro manual de
-- jovem grava só em public.mentorados (createMentorado não cria profile).
-- Resultado em prod: 38 mentorados com e-mail, 0 com profile_id — todo
-- jovem tomava "e-mail não cadastrado" no magic link. E mesmo que a
-- allowlist admitisse, handle_new_user criava um profile sem papel e sem
-- ligar mentorados.profile_id: my_mentorado_id() voltava null e o /jovem
-- abria vazio.
--
-- O que muda:
-- 1) guard_signup_allowlist passa a aceitar e-mail presente em profiles
--    OU mentorados (mesma comparação lower(), case-insensitive).
-- 2) handle_new_user, depois de resolver o profile (update por e-mail ou
--    insert novo), liga mentorados.profile_id do 1º cadastro sem vínculo
--    e concede o papel 'mentorado' em profile_papeis — fonte de verdade
--    dos papéis (0085); profiles.role projeta via trigger. O papel só entra
--    quando o profile não tem papel nenhum: profile de staff (ou de
--    ex-mentorado já promovido, que mantém mentorados.profile_id mas tem
--    papel de mentor) nunca ganha 'mentorado' por e-mail coincidente.

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
  ) or exists (
    select 1 from public.mentorados m
    where lower(m.email) = lower(new.email)
  ) then
    return new;
  end if;
  raise exception 'Este e-mail não está na lista de cadastrados do programa — fale com a coordenação.';
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role public.app_role;
begin
  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null
  returning id, role into v_profile_id, v_role;
  if not found then
    insert into public.profiles (user_id, email, nome)
    values (
      new.id,
      lower(btrim(new.email)),
      coalesce(
        nullif(public.nome_proprio(coalesce(
          new.raw_user_meta_data ->> 'nome',
          translate(split_part(new.email, '@', 1), '._-', '   ')
        )), ''),
        split_part(new.email, '@', 1)
      )
    )
    returning id, role into v_profile_id, v_role;
  end if;
  if v_role is not null then
    insert into public.profile_papeis (profile_id, papel, primario)
    values (v_profile_id, v_role, true)
    on conflict do nothing;
  end if;

  -- vínculo permanente jovem↔conta (0066): o e-mail do cadastro de jovem
  -- liga o profile ao mentorados.id — a identidade de participação. Só
  -- preenche profile_id nulo; e-mail repetido em dois cadastros liga o
  -- primeiro (o unique de profile_id impediria o segundo de qualquer forma).
  update public.mentorados m
     set profile_id = v_profile_id
   where m.id = (
     select m2.id from public.mentorados m2
      where lower(m2.email) = lower(new.email)
        and m2.profile_id is null
      order by m2.id
      limit 1
   );

  -- papel 'mentorado' só quando o profile não tem papel nenhum — profile de
  -- staff nunca ganha o papel jovem por e-mail coincidente.
  if not exists (
    select 1 from public.profile_papeis pp where pp.profile_id = v_profile_id
  ) then
    insert into public.profile_papeis (profile_id, papel, primario)
    values (v_profile_id, 'mentorado', true)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

commit;
