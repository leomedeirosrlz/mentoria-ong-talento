-- endurecimento pos-auditoria de seguranca (set/2026)

-- 1) inativo perde ownership: my_profile_id() = null -> todas as policies de posse falham
-- (my_role() ja foi endurecido em 0003; sem isso, mentor desativado seguia lendo/escrevendo/apagando)
create or replace function public.my_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.profiles where user_id = auth.uid() and ativo $$;

-- 2) supervisor e somente-leitura em duplas (a policy de update nao tinha with check:
-- supervisor podia reescrever mentor_id/mentorado_id/status das supervisionadas)
drop policy duplas_supervisor_update on public.duplas;

-- 3) so coordenacao limpa pedido de apoio; mentor pode sinalizar, nao limpar
create or replace function public.guard_registro_apoio()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.precisa_apoio = false and old.precisa_apoio = true
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'apenas a coordenacao resolve pedidos de apoio';
  end if;
  return new;
end $$;

create trigger registros_guard_apoio
  before update on public.registros
  for each row execute function public.guard_registro_apoio();

-- 4) mentor edita 'areas' no proprio perfil, mas validacoes (termo/formacao/capacidade/tipo)
-- so mudam pela coordenacao — senao o mentor se auto-certificava
create or replace function public.guard_mentor_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.my_role() is distinct from 'coordenacao'
     and (new.termo_ok is distinct from old.termo_ok
          or new.formacao_ok is distinct from old.formacao_ok
          or new.capacidade is distinct from old.capacidade
          or new.tipo is distinct from old.tipo) then
    raise exception 'campos de validacao so podem ser alterados pela coordenacao';
  end if;
  return new;
end $$;

create trigger mentor_profiles_guard
  before update on public.mentor_profiles
  for each row execute function public.guard_mentor_profile();

-- 5) audiencia de materiais aplicada no banco (antes era filtro so no client:
-- qualquer papel lia materiais de coordenacao via API)
drop policy materiais_select on public.materiais;
create policy materiais_select on public.materiais for select using (
  audiencia = 'todos'
  or public.my_role() = 'coordenacao'
  or (audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
  or (audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
);
