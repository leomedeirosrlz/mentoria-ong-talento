-- 0172: papel 'mentorado' não projetava profiles.role no signup do jovem.
--
-- CONTEXTO
-- A 0171 inseria o papel em profile_papeis de dentro do handle_new_user —
-- que é trigger do auth.users. profile_papeis_projeta_role (0085) sai cedo
-- quando pg_trigger_depth() > 1 pra evitar recursão profiles↔papeis, então
-- a projeção role←papel nunca rodava: profiles.role ficava null e o jovem
-- caía na tela "sem papel" mesmo com profile_papeis correto e
-- mentorados.profile_id vinculado. Afetou todo signup de jovem pós-0171
-- (2 perfis em prod: um teste + um jovem real).
--
-- O que muda:
-- 1) handle_new_user: o vínculo/papel 'mentorado' agora só acontece quando
--    o e-mail casa com cadastro em mentorados (antes era "profile sem
--    papel nenhum" — um profile de staff quebrado poderia ganhar papel
--    jovem). E a projeção é escrita direto em profiles.role, porque o
--    trigger de projeção não alcança depth>1. profiles_self_columns só
--    guarda self-update e my_profile_id() é null no contexto do auth.
-- 2) Reparo one-off: realinha profiles.role com o papel primário em todo
--    perfil que divergiu (os 2 casos do bug + qualquer drift futuro).

begin;

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

  -- vínculo permanente jovem↔conta (0066) + papel mentorado: só quando o
  -- e-mail casa com cadastro de mentorado — profile de staff nunca ganha
  -- vínculo/papel jovem por e-mail coincidente.
  if exists (
    select 1 from public.mentorados m2
     where lower(m2.email) = lower(new.email)
  ) then
    -- profile_id só preenche quando null; e-mail repetido em dois cadastros
    -- liga o primeiro (o unique de profile_id barraria o segundo).
    update public.mentorados m
       set profile_id = v_profile_id
     where m.id = (
       select m2.id from public.mentorados m2
        where lower(m2.email) = lower(new.email)
          and m2.profile_id is null
        order by m2.id
        limit 1
     );

    -- papel só quando o profile não tem papel nenhum (staff/ex-mentorado
    -- promovido já tem). A projeção profiles.role é escrita direto: o
    -- trigger profile_papeis_projeta_role sai cedo em depth>1 e este
    -- insert acontece dentro do trigger do auth.users.
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

-- reparo: perfis que ganharam papel dentro de trigger ficaram com role
-- null — realinha com o primário (mesma escrita que projeta_role faria)
update public.profiles p
   set role = pp.papel
  from public.profile_papeis pp
 where pp.profile_id = p.id
   and pp.primario
   and p.role is distinct from pp.papel;

commit;
