-- 0043: encontro 'realizado' é fato, não estado — não sai pra outro status.
--
-- Até aqui a regra morava só nas actions (agendarEncontro já recusa remarcar
-- realizado em JS). A RLS de encontros é larga o suficiente (mentor da dupla
-- escreve) pra que um update direto desfizesse um encontro realizado e
-- apagasse o "realizado" — e a trilha de auditoria junto.
--
-- O guard barra apenas SAÍDA de 'realizado'. Entrada em 'realizado' segue
-- livre (salvarRegistro, retroativo, correção de órfãos) e as transições
-- legítimas continuam: agendado → nao_aconteceu → agendado
-- (desfazerNaoAconteceu), agendado → cancelado (encerrar dupla) etc.
-- Reparo excepcional de dado passa por SQL com o trigger desabilitado
-- (alter table public.encontros disable trigger encontros_status_guard).

begin;

create or replace function public.guard_encontro_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'realizado' and new.status is distinct from 'realizado' then
    raise exception 'encontro realizado não pode mudar de status';
  end if;
  return new;
end
$$;

drop trigger if exists encontros_status_guard on public.encontros;
-- WHEN restringe a mudanças de status — update de link/data sem mexer no
-- status não dispara o trigger
create trigger encontros_status_guard
  before update on public.encontros
  for each row
  when (old.status is distinct from new.status)
  execute function public.guard_encontro_status();

commit;
