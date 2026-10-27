-- 0128: Anamnese Social e Autoavaliação do mentor saem do programa
-- (REALIZA-236, decisão do Thiago em 26/out: tirar dos dois lugares — do
-- catálogo E do rito de encerramento). A leitura do ciclo passa a ser a
-- avaliação 360º, que já pergunta a disponibilidade pro próximo ciclo.
--
-- Estado real em prod (verificado 26/out): `anamnese` ativo=false, 1 link,
-- 0 respostas; `autoavaliacao_mentor` ativo=false, 0 links, 0 respostas.
-- Nada a preservar → remoção limpa.
--
-- Esta migration é a fatia que pode entrar ANTES do deploy sem quebrar o
-- app que está no ar:
--   1. apaga as duas rows oficiais (o código antigo consulta por `sistema`
--      e degrada pra vazio — o atalho da ficha e a opção do dialog somem
--      sozinhos);
--   2. encolhe o CHECK de `formularios.sistema` — nenhum caminho de runtime
--      insere form oficial (o guard 0042 bloqueia INSERT de app com
--      `sistema` preenchido), então o vocabulário menor não é usado por
--      código antigo nem novo;
--   3. limpa a chave `autoavaliacao` de checklists já gravados (no-op em
--      prod: 0 rows).
--
-- FORA daqui, de propósito, a fatia "contract" — ela só pode rodar DEPOIS
-- do deploy desta PR, senão o app no ar quebra (ele lê/escreve essas
-- colunas e chama a RPC):
--   · drop function public.salvar_autoavaliacao(uuid, text, boolean);
--   · alter table public.encerramentos drop column autoavaliacao_mentor,
--     drop column disponivel_proximo_ciclo;
--   · recreation de public.encerramento_checklist_ok sem a chave
--     'autoavaliacao' (hoje o app antigo ainda grava essa chave no rito);
--   · alter table public.encerramentos alter column tipo set not null
--     (a row só nasce pendente no último encontro, 0102; nenhuma row fica
--     sem decisão por causa da autoavaliação) — exige apagar as rows
--     pendentes legadas, que em prod são 0.
begin;

-- 1) as duas rows oficiais + o que pende delas (link cascade; respostas
--    vêm por link_id, também cascade). O guard 0042 recusa DELETE de
--    form oficial por design — aqui a remoção é a própria decisão de
--    produto, então o trigger é suspenso só nesta transação.
alter table public.formularios disable trigger formularios_sistema_guard;

delete from public.formularios
 where sistema in ('anamnese', 'autoavaliacao_mentor');

alter table public.formularios enable trigger formularios_sistema_guard;

-- 2) vocabulário fechado sem os dois sistemas (definição vigente: 0124)
alter table public.formularios
  drop constraint if exists formularios_sistema_check;
alter table public.formularios
  add constraint formularios_sistema_check check (
    sistema in (
      'avaliacao_360',
      'visao', 'roda_vida', 'pdm', 'metas',
      'avaliacao_especialista',
      'intake_mentor', 'intake_mentorado',
      'desfecho'
    )
  );

-- 3) checklists antigos não guardam a chave aposentada (a função que
--    valida ainda a aceita até a 0129; só limpamos o dado)
update public.encerramentos
   set checklist = checklist - 'autoavaliacao'
 where checklist ? 'autoavaliacao';

commit;
