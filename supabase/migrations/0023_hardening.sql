-- 0023: hardening pós-auditoria de segurança
--
-- As actions validam, mas as policies são `for all` — um mentor autenticado
-- via PostgREST bypassa as invariantes. CHECKs fecham no banco o que a UI
-- assumia; triggers fixam autoria (trilha de auditoria era forjável).

-- A1: link de encontro renderizado como href — javascript:/data: viravam
-- XSS armazenado clicável pra coordenação. Só http(s) entra.
alter table public.encontros
  add constraint encontros_link_http check (link is null or link ~ '^https?://'),
  add constraint encontros_numero_faixa check (numero between 1 and 16);

alter table public.materiais
  add constraint materiais_url_http check (url is null or url ~ '^https?://');

-- caps de texto — campos livres sem char_length aceitavam MBs por row
alter table public.registros
  add constraint registros_caps check (
    char_length(coalesce(tema, '')) <= 500
    and char_length(coalesce(reflexoes, '')) <= 20000
    and char_length(coalesce(observacoes, '')) <= 20000
    and char_length(coalesce(ferramenta, '')) <= 500
    and char_length(coalesce(dificuldade_detalhe, '')) <= 2000
    and char_length(coalesce(proximo_passo, '')) <= 500
    and char_length(coalesce(proximo_passo_detalhe, '')) <= 2000
  );

alter table public.encontros
  add constraint encontros_caps check (
    char_length(coalesce(motivo_reagendamento, '')) <= 1000
  );

alter table public.mentorados
  add constraint mentorados_caps check (
    char_length(coalesce(notas, '')) <= 10000
  );

-- A2 (LGPD): supervisor lia TODOS os mentorados (nome, contato, anamnese,
-- documentos). A política de privacidade promete "dados das duplas que
-- supervisionam" — agora a policy entrega exatamente isso.
drop policy if exists mentorados_select on public.mentorados;

create policy mentorados_select on public.mentorados for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1
      from public.duplas d
      where d.mentorado_id = mentorados.id
        and (
          d.mentor_id = public.my_profile_id()
          or d.supervisor_id = public.my_profile_id()
        )
    )
  );

-- M5: autoria imutável e sempre do autor real. INSERT sem autor carimba
-- my_profile_id(); com autor ≠ eu → erro (forjar é violação, não ambiguidade).
-- UPDATE não pode reatribuir. Escreve via service role/seed (sem JWT de
-- profile) segue livre — my_profile_id() é null fora do app.
create or replace function public.guard_autoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text := tg_argv[0];
  novo uuid := (to_jsonb(new) ->> col)::uuid;
begin
  if tg_op = 'INSERT' then
    if novo is null then
      new := jsonb_populate_record(
        new, jsonb_build_object(col, public.my_profile_id())
      );
    elsif public.my_profile_id() is not null
      and novo <> public.my_profile_id()
    then
      raise exception 'autoria forjada';
    end if;
    return new;
  end if;
  if (to_jsonb(old) ->> col) is distinct from (to_jsonb(new) ->> col) then
    raise exception 'autoria imutavel';
  end if;
  return new;
end;
$$;

create trigger guard_autoria_pessoa_notas
  before insert or update on public.pessoa_notas
  for each row execute function public.guard_autoria('created_by');

create trigger guard_autoria_interacoes
  before insert or update on public.interacoes
  for each row execute function public.guard_autoria('autor_id');

create trigger guard_autoria_encontros
  before insert or update on public.encontros
  for each row execute function public.guard_autoria('created_by');

create trigger guard_autoria_registros
  before insert or update on public.registros
  for each row execute function public.guard_autoria('created_by');

create trigger guard_autoria_encontro_notas
  before insert or update on public.encontro_notas
  for each row execute function public.guard_autoria('created_by');

-- B1: self-update de profiles sem allowlist — dava pra reescrever email,
-- role (já barrado pela policy), user_id e documento_path da própria row.
-- Coord editando OUTRA pessoa não é afetado (a guarda só olha a própria row).
create or replace function public.guard_profiles_self_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_profile_id() = old.id and (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.ativo is distinct from old.ativo
    or new.user_id is distinct from old.user_id
    or new.documento_path is distinct from old.documento_path
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'campo protegido do perfil';
  end if;
  return new;
end;
$$;

create trigger profiles_self_columns
  before update on public.profiles
  for each row execute function public.guard_profiles_self_columns();
