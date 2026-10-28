-- 0132: fase "contract" da saída da autoavaliação do mentor (REALIZA-236)
--
-- A 0128 fez a fatia expand: apagou as duas rows oficiais (anamnese,
-- autoavaliacao_mentor), encolheu o CHECK de `formularios.sistema` e limpou a
-- chave `autoavaliacao` dos checklists já gravados. Esta é a fatia que só
-- podia rodar DEPOIS do deploy daquele código:
--
--   1. drop function public.salvar_autoavaliacao(uuid, text, boolean);
--   2. drop column encerramentos.autoavaliacao_mentor;
--   3. drop column encerramentos.disponivel_proximo_ciclo;
--   4. recreation de encerramento_checklist_ok sem a chave 'autoavaliacao'.
--
-- Estado verificado em prod (27/out): `encerramentos` tem 0 rows, nenhum
-- registro em `profiles`/`registros` citava as colunas, e nenhum caminho do
-- app (src/ e scripts/) chama a RPC ou lê as colunas — o deploy da 0128 já
-- tirou o formulário, o bloco do rito e a action. As duas colunas existiam
-- só para o mecanismo aposentado; a disponibilidade pro próximo ciclo agora
-- é pergunta da avaliação final do mentor (`continua_proximo_ciclo`, 0130).
--
-- FORA daqui, de propósito: `alter column tipo set not null`.
-- `encerramentos_check` exige `(tipo is null) = (decidido_por is null)` —
-- NULL em `tipo` é o estado "encontros concluídos, decisão pendente", que a
-- row criada no último encontro (0102) usa de verdade. Tornar a coluna NOT
-- NULL exigiria apagar as rows pendentes, ou seja, destruir estado real de
-- qualquer ciclo em andamento no momento da aplicação. Fica como está.

begin;

-- 1) a RPC do mecanismo aposentado (grants caem junto com a função)
drop function if exists public.salvar_autoavaliacao(uuid, text, boolean);

-- 2) o texto da autoavaliação e a disponibilidade binária que ela gravava
--    (o check de tamanho da coluna cai junto)
alter table public.encerramentos
  drop column if exists autoavaliacao_mentor,
  drop column if exists disponivel_proximo_ciclo;

-- 3) dado antigo: a chave aposentada sai dos checklists antes de a função
--    de validação deixar de aceitá-la (no-op em prod, 0 rows)
update public.encerramentos
   set checklist = checklist - 'autoavaliacao'
 where checklist ? 'autoavaliacao';

-- 4) validador do checklist sem a chave 'autoavaliacao' (definição vigente
--    lida do banco em 27/out; diff de uma entrada na lista)
create or replace function public.encerramento_checklist_ok(c jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select not exists (
    select 1
      from jsonb_each(c) as k
     where k.key <> all (array[
             'feedback_final', 'feedback_mutuo', 'revisao_pdm',
             'avaliacao_360_enviada'])
        or jsonb_typeof(k.value) <> 'boolean'
  );
$function$;

commit;
