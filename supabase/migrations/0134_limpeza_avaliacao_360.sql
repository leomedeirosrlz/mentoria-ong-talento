-- 0134 · Limpeza do catálogo oficial (decisão do Leo em 27/out)
--
-- A régua de formulários oficiais fecha em seis: os 4 instrumentos da
-- jornada + o intake de cada lado + o par de avaliação geral 360º. Saem:
--
--   · 'avaliacao_360' — o form único arquivado na 0130 (0 links,
--     0 respostas em prod — nunca foi usado). O carimbo do checklist de
--     encerramento já é das vias novas desde a 0130;
--   · 'avaliacao_especialista' — avaliação da trilha-esp (0 links em
--     prod). A RPC encerrar_trilha_especialista emite o link só `if
--     v_form is not null` — sem a row, a trilha fecha igual, sem a
--     avaliação;
--   · 'desfecho' — o "Depois da mentoria" (0 links). A fila do lote 6m
--     fica vazia e a ficha não mostra mais a entrega.
--
-- O vocabulário do CHECK fica — os valores aposentados seguem válidos
-- pra código dorminte que os referencia literalmente (queries-desfecho,
-- avaliacao_esp_da_dupla); a remoção do vocabulário vem junto da remoção
-- do código, não agora.
--
-- Antes disso, os links das duas avaliações finais: foram gerados à
-- mão na rodada 230 antes do alinhamento de catálogo — 27+28 links, 0
-- respostas. Apagam e a emissão volta a ser do fluxo normal (jornada/
-- coordenação) quando a coleta abrir.
--
-- E o par assume o nome oficial que o Leo usa: "Avaliação Geral - 360º",
-- um por lado da dupla. O conteúdo já está 1:1 com os Google Forms do
-- Drive (0130 + 0133) — é rename, não re-import.
--
-- O guard 0042 recusa DELETE/UPDATE de oficial por design — a limpeza é
-- a própria decisão, trigger suspenso só nesta transação (padrão das
-- 0109/0118/0128/0133).

begin;

-- links prematuros (55 em prod; no-op onde não existirem)
delete from public.formulario_links
 where formulario_id in (
   '5eed0002-0000-4000-8000-000000000001',
   '5eed0002-0000-4000-8000-000000000002');

alter table public.formularios disable trigger formularios_sistema_guard;

delete from public.formularios
 where sistema in ('avaliacao_360', 'avaliacao_especialista', 'desfecho');

update public.formularios
   set titulo = 'Avaliação Geral de Mentores - 360º'
 where sistema = 'avaliacao_final_mentor';

update public.formularios
   set titulo = 'Avaliação Geral de Mentorados - 360º'
 where sistema = 'avaliacao_final_mentorado';

alter table public.formularios enable trigger formularios_sistema_guard;

commit;
