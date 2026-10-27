-- 0135 — catálogo de materiais fecha com o guia:
--   * roteiros 11–16 (a jornada tem 16 encontros e o material parava na
--     semana 10), extraídos do cap. 10 do Guia DPP;
--   * "Perguntas Eficazes", o documento complementar que o guia cita;
--   * os 4 templates do cap. 14 viram documentos nativos do app
--     (path "doc:<slug>" → /materiais/documento/<slug>) — eram linhas
--     mortas sem arquivo nem link; texto copiável, mesma linguagem dos PDFs.
begin;

-- roteiros das semanas 11 a 16 + documento Perguntas Eficazes
insert into public.materiais
  (titulo, descricao, tipo, audiencia, encontro_num, ordem, path)
values
  ('Roteiro Semana 11 — Rede de apoio e novos espaços',
   'Roteiro do 11º encontro: mapear a rede de apoio, abrir portas e apresentar a Roda da Vida.',
   'conteudo', 'dpp', 11, 13,
   'materiais/d6402303-7a25-432e-b3b4-046908c444de-roteiro-semana-11.pdf'),
  ('Roteiro Semana 12 — Leitura da Roda da Vida',
   'Roteiro do 12º encontro: ler a Roda quadrante por quadrante e abrir as metas das 16 áreas.',
   'conteudo', 'dpp', 12, 14,
   'materiais/e82d1ecb-4650-4728-b4c9-448479b3af20-roteiro-semana-12.pdf'),
  ('Roteiro Semana 13 — Metas das áreas prioritárias',
   'Roteiro do 13º encontro: revisar as metas da Roda e eleger as áreas prioritárias a detalhar.',
   'conteudo', 'dpp', 13, 15,
   'materiais/56cce3c4-7325-4895-9296-442157dae6ae-roteiro-semana-13.pdf'),
  ('Roteiro Semana 14 — Desdobramento e plano de continuidade',
   'Roteiro do 14º encontro: validar o mapa de submetas e montar o plano de continuidade.',
   'conteudo', 'dpp', 14, 16,
   'materiais/1a6bcf72-ebb3-40b5-902d-ad2d5e6fefa4-roteiro-semana-14.pdf'),
  ('Roteiro Semana 15 — Reflexão e reconhecimento',
   'Roteiro do 15º encontro: olhar a jornada, reconhecer conquistas e trocar feedback mútuo.',
   'conteudo', 'dpp', 15, 17,
   'materiais/9d23a061-e0bc-4e2e-b835-f875b0654acf-roteiro-semana-15.pdf'),
  ('Roteiro Semana 16 — Encerramento e celebração',
   'Roteiro do 16º encontro: celebrar o percurso, revisar PDM e Roda e responder a avaliação geral.',
   'conteudo', 'dpp', 16, 18,
   'materiais/f22fe899-7bcb-49c8-80cb-949295ded4e1-roteiro-semana-16.pdf'),
  ('Perguntas Eficazes',
   'Documento complementar do guia: o que são, o que evitar e o banco de perguntas por momento da conversa.',
   'conteudo', 'dpp', null, 25,
   'materiais/1a8277af-eb2b-4196-98e7-9fade2899a34-perguntas-eficazes.pdf')
-- idempotente: bancos que já receberam o catálogo por seed (staging de e2e)
-- pulam a duplicata em vez de abortar o push inteiro (o unique de path é
-- índice, não constraint — sem alvo no on conflict)
on conflict do nothing;

-- templates do cap. 14 → documentos nativos (o app renderiza em
-- /materiais/documento/<slug>; o storage não serve HTML renderizável)
update public.materiais
   set path = 'doc:mensagem-preparacao', ordem = 19
 where titulo = 'Mensagem de preparação do mentorado';
update public.materiais
   set path = 'doc:mensagem-indicadas', ordem = 20
 where titulo = 'Mensagem às pessoas indicadas';
update public.materiais
   set path = 'doc:mensagem-encaminhamento', ordem = 21
 where titulo = 'Mensagem de encaminhamento entre encontros';
update public.materiais
   set path = 'doc:checklist-competencias', ordem = 23
 where titulo = 'Checklist de competências do mentor';

-- renumeração do restante do catálogo depois dos roteiros novos
update public.materiais set ordem = 22 where titulo = 'Roda da Vida: roteiro de aplicação';
update public.materiais set ordem = 24 where titulo = 'Instrumento: Definindo Metas';
update public.materiais set ordem = 26 where titulo = 'Cronograma do programa — Turma 1';
update public.materiais set ordem = 27 where titulo = 'Cronograma do programa — Turma 2';
update public.materiais set ordem = 28 where titulo = 'Plataforma de mentoria';
update public.materiais set ordem = 29 where titulo = 'Formação EaD gratuita';

commit;
