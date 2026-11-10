-- 0173: profile do jovem nasce com nome real do cadastro de mentorado.
--
-- CONTEXTO
-- handle_new_user gera profiles.nome do prefixo do e-mail quando não vem
-- nome no user_metadata (o magic link não manda). Para jovem isso vira
-- "Thicosta4312 2" — o onboarding saúda pelo profile.nome e o nome real
-- (mentorados.nome/nome_social, preenchido pela coordenação) ficava
-- invisível. Afetou os 2 primeiros logins de jovem pós-0172.
--
-- O que muda:
-- 1) handle_new_user busca o cadastro de mentorado pelo e-mail ANTES do
--    insert do profile e usa mentorados.nome/nome_social como nome do
--    profile (coalesce: se não houver cadastro, segue a heurística de
--    e-mail de sempre). Só o caminho de INSERT — profile pré-cadastrado
--    (staff) já tem nome gerenciado pela coordenação.
-- 2) Reparo: realinha nome/nome_social dos profiles já vinculados a um
--    mentorado (mentorados.nome é a fonte canônica do nome do jovem).

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role public.app_role;
  v_mentorado_nome text;
  v_mentorado_social text;
begin
  -- nome real do jovem quando o e-mail casa com cadastro de mentorado —
  -- o magic link não manda nome no metadata e a heurística de e-mail
  -- produz "Thicosta4312 2". Lookup único: mentorados.email é normalizado
  -- (lower/btrim, 0059) e o match é o mesmo da allowlist/vínculo.
  select m.nome, m.nome_social
    into v_mentorado_nome, v_mentorado_social
    from public.mentorados m
   where lower(m.email) = lower(new.email)
   order by m.id
   limit 1;

  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null
  returning id, role into v_profile_id, v_role;
  if not found then
    insert into public.profiles (user_id, email, nome, nome_social)
    values (
      new.id,
      lower(btrim(new.email)),
      coalesce(
        v_mentorado_nome,
        nullif(public.nome_proprio(coalesce(
          new.raw_user_meta_data ->> 'nome',
          translate(split_part(new.email, '@', 1), '._-', '   ')
        )), ''),
        split_part(new.email, '@', 1)
      ),
      v_mentorado_social
    )
    returning id, role into v_profile_id, v_role;
  end if;
  if v_role is not null then
    insert into public.profile_papeis (profile_id, papel, primario)
    values (v_profile_id, v_role, true)
    on conflict do nothing;
  end if;

  -- vínculo permanente jovem↔conta (0066) + papel mentorado: só quando o
  -- e-mail casa com cadastro de mentorado — profile de staff nunca ganha
  -- vínculo/papel jovem por e-mail coincidente.
  if v_mentorado_nome is not null then
    update public.mentorados m
       set profile_id = v_profile_id
     where m.id = (
       select m2.id from public.mentorados m2
        where lower(m2.email) = lower(new.email)
          and m2.profile_id is null
        order by m2.id
        limit 1
     );

    if not exists (
      select 1 from public.profile_papeis pp where pp.profile_id = v_profile_id
    ) then
      insert into public.profile_papeis (profile_id, papel, primario)
      values (v_profile_id, 'mentorado', true)
      on conflict do nothing;
      update public.profiles set role = 'mentorado'
       where id = v_profile_id and role is null;
    end if;
  end if;

  return new;
end;
$$;

-- reparo: nome/nome_social dos profiles já vinculados a mentorado passam a
-- vir do cadastro do jovem (mentorados.nome é a fonte canônica)
update public.profiles p
   set nome = m.nome,
       nome_social = coalesce(m.nome_social, p.nome_social)
  from public.mentorados m
 where m.profile_id = p.id
   and (p.nome is distinct from m.nome
        or p.nome_social is distinct from coalesce(m.nome_social, p.nome_social));

commit;
