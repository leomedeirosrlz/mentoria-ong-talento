-- 0044: link do PDM (Plano de Desenvolvimento do Mentorado) na dupla.
--
-- O PDM é o artefato central da jornada — o guia pede que a dupla o revise
-- nos encontros. A URL (Docs/Drive) fica na dupla e vira o botão "Abrir PDM"
-- na ficha e na home do mentor.
--
-- UPDATE em duplas é coord-only desde a 0004 (a policy de supervisor foi
-- derrubada e nenhuma de mentor existe), mas quem mantém o link do PDM no dia
-- a dia é o mentor da dupla. Em vez de abrir a coluna na policy (mentor
-- ganharia update em campos que não são dele), a escrita passa pela RPC
-- definir_pdm_url — definer, escopada e validada no banco.

begin;

alter table public.duplas
  add column if not exists pdm_url text;

-- só https quando preenchida (PDM mora em Docs/Drive; http:// ou scheme
-- exótico não entra). Vazio é normalizado pra null na RPC e na action.
alter table public.duplas drop constraint if exists duplas_pdm_url_check;
alter table public.duplas
  add constraint duplas_pdm_url_check
  check (pdm_url is null or pdm_url ~* '^https://\S+$');

comment on column public.duplas.pdm_url is
  'URL do PDM do mentorado (https). Mentor da dupla e coordenação editam via definir_pdm_url.';

-- Mentor da dupla (ativa/pausada) ou coordenação — qualquer status pra coord.
-- p_url null/vazio limpa o campo. IS DISTINCT FROM pelo mesmo motivo do
-- aceitar_solicitacao (0028): sem papel, my_role()/my_profile_id() voltam
-- null e "<> 'coordenacao'" avaliaria NULL — o guard não barraria.
create or replace function public.definir_pdm_url(p_dupla uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  v_url text := nullif(btrim(p_url), '');
begin
  select id, mentor_id, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if public.my_role() is distinct from 'coordenacao' then
    if d.mentor_id is distinct from public.my_profile_id() then
      raise exception 'Só o mentor da dupla pode definir o link do PDM';
    end if;
    if d.status not in ('ativa', 'pausada') then
      raise exception 'O link do PDM só pode ser editado com a dupla ativa ou pausada';
    end if;
  end if;
  if v_url is not null and v_url !~* '^https://\S+$' then
    raise exception 'O link do PDM precisa ser um endereço completo (https://)';
  end if;
  update public.duplas set pdm_url = v_url where id = p_dupla;
end
$$;

revoke all on function public.definir_pdm_url(uuid, text) from public, anon;
grant execute on function public.definir_pdm_url(uuid, text) to authenticated;

commit;
