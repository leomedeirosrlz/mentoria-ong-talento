-- 0174: vínculo jovem↔conta só para profile sem papel — fecha a brecha da
-- 0171-0173 em que um profile de STAFF com e-mail coincidente com
-- mentorados.email herdava mentorados.profile_id (trancando o jovem real
-- fora: a ficha ficava ocupada e o próximo signup não achava cadastro
-- livre) e podia ter o nome sobrescrito pelo da ficha de jovem.
--
-- O que muda no handle_new_user:
-- 1) O lookup do mentorado passa a ser UM só (id+nome+social), preferindo
--    ficha sem vínculo — antes o nome vinha da 1ª linha por id e o link
--    da 1ª sem vínculo; com e-mails duplicados podiam apontar pessoas
--    diferentes.
-- 2) Todo o bloco jovem (link + papel + role) só roda quando o profile
--    não tem papel nenhum — profile de staff/ex-mentorado promovido nunca
--    recebe vínculo de jovem. O papel 'mentorado' só é concedido depois
--    de confirmar que a ficha ficou apontando pra ESTE profile
--    (profile_id = v_profile_id), cobrindo o caso da ficha já estar
--    vinculada a ele.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role public.app_role;
  v_mentorado_id uuid;
  v_mentorado_nome text;
  v_mentorado_social text;
begin
  -- ficha de jovem do e-mail, preferindo a ainda sem vínculo — o match é o
  -- mesmo da allowlist (lower, case-insensitive). Nome real do cadastro
  -- evita a heurística de e-mail ("Thicosta4312 2") no profile novo.
  select m.id, m.nome, m.nome_social
    into v_mentorado_id, v_mentorado_nome, v_mentorado_social
    from public.mentorados m
   where lower(m.email) = lower(new.email)
   order by (m.profile_id is null) desc, m.id
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

  -- vínculo permanente jovem↔conta (0066) + papel mentorado: SÓ quando o
  -- profile não tem papel nenhum. Profile de staff nunca ganha vínculo nem
  -- papel jovem por e-mail coincidente — sem isso a ficha do jovem ficava
  -- ocupada pelo profile errado e o jovem real não achava cadastro livre.
  if v_mentorado_id is not null
     and not exists (
       select 1 from public.profile_papeis pp where pp.profile_id = v_profile_id
     )
  then
    update public.mentorados
       set profile_id = v_profile_id
     where id = v_mentorado_id and profile_id is null;
    -- papel só quando a ficha ficou (ou já estava) apontando pra este
    -- profile — ficha ocupada por outra conta não vira papel aqui.
    if exists (
      select 1 from public.mentorados
       where id = v_mentorado_id and profile_id = v_profile_id
    ) then
      insert into public.profile_papeis (profile_id, papel, primario)
      values (v_profile_id, 'mentorado', true)
      on conflict do nothing;
      -- projeta_role não roda em depth>1 (este insert vem do trigger do
      -- auth.users): a projeção role←papel é escrita direto.
      update public.profiles set role = 'mentorado'
       where id = v_profile_id and role is null;
    end if;
  end if;

  return new;
end;
$$;

commit;
