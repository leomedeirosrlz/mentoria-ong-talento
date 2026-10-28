-- 0138 — fecha o catálogo de materiais com o Checklist de competências do
-- mentor e corrige duas linhas que faltavam em prod por drift de aplicação
-- (a migration foi registrada como aplicada sem o insert chegar ao banco; o
-- staging recebeu as duas pelo seed, por isso o e2e nunca acusou):
--   * "Checklist de competências do mentor" — o instrumento do cap. 14 que a
--     0135 já apontava no update (linha inexistente, no-op) e que a 0137 não
--     recriou no lugar da autoavaliação. Volta como documento nativo:
--     path "doc:checklist-competencias" → /materiais/documento/<slug>.
--   * "Feedback Construtivo" (0137) e "Plataforma de mentoria" (catálogo
--     original) — inserts condicionais: entram só onde a linha não existe,
--     então rodar de novo (ou num banco que já as tem) não duplica.
-- Sem renumeração: as ordens 23, 28 e 30 já são as dos vizinhos.
begin;

insert into public.materiais
  (titulo, descricao, tipo, audiencia, encontro_num, ordem, path)
values
  ('Checklist de competências do mentor',
   'As 10 competências do guia para marcar antes do ciclo e no 16º encontro.',
   'template', 'dpp', null, 30,
   'doc:checklist-competencias')
-- idempotente: bancos que já receberam a linha por seed (staging de e2e)
-- pulam a duplicata em vez de abortar o push inteiro (o unique de path é
-- índice, não constraint — sem alvo no on conflict)
on conflict do nothing;

insert into public.materiais
  (titulo, descricao, tipo, audiencia, encontro_num, ordem, path)
select
  'Feedback Construtivo',
  'Instrumento do guia: o modelo de fala e os cuidados para feedback sobre comportamento negativo.',
  'conteudo', 'todos', null, 23,
  'doc:feedback-construtivo'
where not exists (
  select 1 from public.materiais where titulo = 'Feedback Construtivo'
)
on conflict do nothing;

insert into public.materiais
  (titulo, descricao, tipo, url, audiencia, encontro_num, ordem, path)
select
  'Plataforma de mentoria',
  'Onde os encontros oficiais são agendados e avaliados.',
  'link', 'https://mentoria.realiza.vc', 'todos', null, 28,
  null
where not exists (
  select 1 from public.materiais where titulo = 'Plataforma de mentoria'
)
on conflict do nothing;

commit;
