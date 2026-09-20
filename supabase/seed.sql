-- ===== calendário do ciclo 2026/2027 (fonte: cronograma Juventude Solidária) =====
insert into public.ciclo_eventos (tipo, numero, data, titulo, fase, instrumentos) values
  ('formacao', null, '2026-09-03', 'Encontro inicial de formação de mentores', null, '{}'),
  ('formacao', null, '2026-09-04', 'Encontro final de formação de mentores', null, '{}'),
  ('encontro', 1,  '2026-09-08', 'Boas-vindas, histórias de vida e abertura', 'Criar vínculo e construir o PDM', '{Perguntas Eficazes,Escuta Ativa,PDM,Roda da Vida (leitura inicial)}'),
  ('encontro', 2,  '2026-09-15', 'Avaliação por terceiros e visão de futuro', 'Criar vínculo e construir o PDM', '{PDM,Construindo a sua Visão}'),
  ('encontro', 3,  '2026-09-22', 'Declaração de Visão e metas SMART', 'Criar vínculo e construir o PDM', '{PDM,Modelo SMART}'),
  ('encontro', 4,  '2026-09-29', 'Fechamento da construção do PDM', 'Criar vínculo e construir o PDM', '{PDM,Perguntas Eficazes}'),
  ('encontro', 5,  '2026-10-06', 'Acompanhamento das primeiras submetas', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}'),
  ('encontro', 6,  '2026-10-13', 'Superação de obstáculos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}'),
  ('encontro', 7,  '2026-10-20', 'Ajustes de prazos e desdobramentos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}'),
  ('encontro', 8,  '2026-10-27', 'Revisão de meio de percurso', 'Consolidar a autonomia', '{PDM,Escuta Ativa}'),
  ('encontro', 9,  '2026-11-10', 'Transferência gradual da condução', 'Consolidar a autonomia', '{PDM,Escuta Ativa}'),
  ('encontro', 10, '2026-11-17', 'Trajetória do mentor e rede de apoio', 'Aprofundar vínculo e aprendizado', '{Papel de modelo,Escuta Ativa}'),
  ('encontro', 11, '2026-11-24', 'Ampliação de espaços e repertório', 'Aprofundar vínculo e aprendizado', '{Papel de modelo,Escuta Ativa}'),
  ('encontro', 12, '2026-12-01', 'Roda da Vida: explicação e leitura', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('encontro', 13, '2026-12-08', 'Roda da Vida: discussão por quadrante', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('encontro', 14, '2026-12-15', 'Roda da Vida: mapa de metas e submetas', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('recesso',  null, '2026-12-16', 'Recesso de fim de ano', null, '{}'),
  ('encontro', 15, '2027-01-05', 'Revisão do percurso', 'Encerrar e celebrar', '{Roda da Vida,Avaliação 360}'),
  ('encontro', 16, '2027-01-12', 'Celebração e encerramento simbólico', 'Encerrar e celebrar', '{Avaliação 360,Autoavaliação do mentor}'),
  ('marco',    null, '2027-01-15', 'Evento de encerramento do programa', null, '{}');

update public.ciclo_eventos set data_fim = '2027-01-04' where tipo = 'recesso';

-- ===== materiais =====
insert into public.materiais (titulo, descricao, tipo, url, audiencia, encontro_num, ordem) values
  ('Guia do Mentor DPP', 'Metodologia completa: jornada, 16 encontros, instrumentos e templates.', 'guia', null, 'dpp', null, 1),
  ('Guia do Mentor Especialista', 'Metodologia da mentoria com especialista: 5 encontros e cinco funções.', 'guia', null, 'especialista', null, 2),
  ('Mensagem de preparação do mentorado', 'Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.', 'template', null, 'dpp', 1, 10),
  ('Instrumento: Construindo a sua Visão', 'Tarefa individual entre o 1º e o 2º encontro; origina a Declaração de Visão.', 'template', null, 'dpp', 1, 11),
  ('Mensagem às pessoas indicadas', 'Modelo de contato para a avaliação por terceiros (duas perguntas).', 'template', null, 'dpp', 1, 12),
  ('Consolidação da avaliação por terceiros', 'Quadro para agrupar pontos fortes e de melhoria sem identificar quem respondeu.', 'template', null, 'dpp', 2, 13),
  ('Plano de Desenvolvimento do Mentorado (PDM)', 'Documento central da dupla: visão, metas SMART, indicadores e mapa de submetas.', 'template', null, 'dpp', 2, 14),
  ('Mensagem de encaminhamento entre encontros', 'Modelo curto para manter o vínculo e deixar a próxima tarefa clara.', 'template', null, 'dpp', null, 15),
  ('Roda da Vida: roteiro de aplicação', 'Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.', 'template', null, 'dpp', 12, 16),
  ('Checklist de competências do mentor', 'Autoavaliação antes do ciclo e novamente no 16º encontro.', 'template', null, 'todos', null, 17),
  ('Autoavaliação do mentor', 'Cinco perguntas de reflexão para o encerramento do ciclo.', 'template', null, 'todos', 16, 18),
  ('Plataforma de mentoria', 'Onde os encontros oficiais são agendados e avaliados.', 'link', 'https://mentoria.realiza.vc', 'todos', null, 20),
  ('Formação EaD gratuita', 'Trilha opcional com certificado para mentores.', 'link', 'https://ead.realiza.vc', 'todos', null, 21);

-- sem dados de pessoas/duplas: cadastro real acontece pela plataforma
-- (pessoas -> magic link; duplas pela coordenação)
