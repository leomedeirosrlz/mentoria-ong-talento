-- 0177: vínculo jovem↔conta deixa de depender só do 1º signup.
--
-- CONTEXTO (auditoria pós REALIZA-371)
-- handle_new_user (0174) só vincula no INSERT do auth.users. Três caminhos
-- reais deixavam o jovem trancado sem conserto pela UI:
--   · ficha recriada (excluída e cadastrada de novo) ou criada depois da
--     conta: a conta 'mentorado' fica órfã e nunca mais é religada;
--   · e-mail da ficha vinculada editado direto (import, script, SQL editor):
--     o próximo magic link com o e-mail novo cria conta sem papel;
--   · duas fichas com o mesmo e-mail (irmãos com e-mail da família,
--     reimport): a conta liga numa ficha arbitrária e a outra nunca loga.
--
-- O que muda:
-- 1) unique em lower(mentorados.email) — prod tem 0 duplicados hoje. O nome
--    *_email_key faz o erroAmigavel responder "Esse e-mail já está cadastrado."
-- 2) mentorados_email_guard: ficha vinculada só aceita e-mail igual ao do
--    profile — a troca é pelo auth (sync 0060 → profiles → 0176 → ficha).
-- 3) mentorados_relink_conta: ficha sem vínculo cujo e-mail é de um profile
--    com conta, sem ficha, e sem papel ou só com 'mentorado' liga nele e
--    recebe o papel se faltar. Staff (qualquer outro papel) nunca é ligado.
-- 4) Reparo: religa contas órfãs que já existam pelo mesmo critério.

begin;

create unique index if not exists mentorados_email_key
  on public.mentorados (lower(email))
  where email is not null;

create or replace function public.mentorados_email_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is not null
     and new.profile_id is not distinct from old.profile_id
     and new.email is distinct from (
       select p.email from public.profiles p where p.id = new.profile_id
     )
  then
    raise exception 'Essa pessoa já entrou na plataforma — o e-mail de acesso só muda pela conta dela.';
  end if;
  return new;
end;
$$;

drop trigger if exists mentorados_email_guard on public.mentorados;
create trigger mentorados_email_guard
  before update of email on public.mentorados
  for each row
  when (old.email is distinct from new.email)
  execute function public.mentorados_email_guard();

create or replace function public.mentorados_relink_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if new.profile_id is not null or new.email is null then
    return new;
  end if;
  select p.id into v_profile_id
    from public.profiles p
   where lower(p.email) = lower(new.email)
     and p.user_id is not null
     and not exists (
       select 1 from public.mentorados m
        where m.profile_id = p.id and m.id is distinct from new.id
     )
     and not exists (
       select 1 from public.profile_papeis pp
        where pp.profile_id = p.id and pp.papel <> 'mentorado'
     )
   limit 1;
  if v_profile_id is null then
    return new;
  end if;

  new.profile_id := v_profile_id;
  if not exists (
    select 1 from public.profile_papeis pp where pp.profile_id = v_profile_id
  ) then
    insert into public.profile_papeis (profile_id, papel, primario)
    values (v_profile_id, 'mentorado', true)
    on conflict do nothing;
  end if;
  -- projeta_role sai cedo em depth>1 (mesmo motivo da 0172/0174)
  update public.profiles set role = 'mentorado'
   where id = v_profile_id and role is null;
  return new;
end;
$$;

drop trigger if exists mentorados_relink_conta on public.mentorados;
create trigger mentorados_relink_conta
  before insert or update of email on public.mentorados
  for each row
  execute function public.mentorados_relink_conta();

-- reparo: dispara o relink nas fichas sem vínculo cujo e-mail tem conta
-- órfã elegível (no-op de e-mail, só pra rodar o trigger de update)
update public.mentorados m
   set email = m.email
 where m.profile_id is null
   and m.email is not null
   and exists (
     select 1 from public.profiles p
      where lower(p.email) = lower(m.email) and p.user_id is not null
   );

commit;
