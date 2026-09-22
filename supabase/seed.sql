-- ===== calendário do ciclo 2026/2027 (fonte: cronograma oficial do ciclo — "Mentoria · Plataforma Juventude Solidária") =====
-- Duração total 30/07/2026 → 15/01/2027 (~5 meses e meio): pré-ciclo (inscrições
-- → triagem → matching → formação/abertura), mentoria ativa de 4 meses e 1
-- semana com 16 encontros às terças — semanal em 13 dos 15 intervalos, com 15
-- dias entre o 8º e o 9º encontro (tempo de prática das submetas) — e o recesso
-- de fim de ano na virada da Fase 5 (Roda da Vida) para a Fase 6 (Encerrar).
insert into public.ciclo_eventos (tipo, numero, data, titulo, fase, instrumentos, data_fim) values
  ('marco',    null, '2026-07-30', 'Inscrições e seleção', null, '{}', '2026-08-19'),
  ('marco',    null, '2026-08-20', 'Triagem e preparação do matching', null, '{}', '2026-08-25'),
  ('marco',    null, '2026-08-26', 'Matching das duplas', null, '{}', '2026-09-02'),
  ('formacao', null, '2026-09-03', 'Encontro inicial de formação de mentores', null, '{}', null),
  ('formacao', null, '2026-09-04', 'Encontro final de formação de mentores', null, '{}', null),
  ('marco',    null, '2026-09-04', 'Encontro de abertura com a coordenação', null, '{}', null),
  ('encontro', 1,  '2026-09-08', 'Boas-vindas, histórias de vida e abertura', 'Criar vínculo e construir o PDM', '{Perguntas Eficazes,Escuta Ativa,PDM,Roda da Vida (leitura inicial)}', null),
  ('encontro', 2,  '2026-09-15', 'Avaliação por terceiros e visão de futuro', 'Criar vínculo e construir o PDM', '{PDM,Construindo a sua Visão}', null),
  ('encontro', 3,  '2026-09-22', 'Declaração de Visão e metas SMART', 'Criar vínculo e construir o PDM', '{PDM,Modelo SMART}', null),
  ('encontro', 4,  '2026-09-29', 'Fechamento da construção do PDM', 'Criar vínculo e construir o PDM', '{PDM,Perguntas Eficazes}', null),
  ('encontro', 5,  '2026-10-06', 'Acompanhamento das primeiras submetas', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null),
  ('encontro', 6,  '2026-10-13', 'Superação de obstáculos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null),
  ('encontro', 7,  '2026-10-20', 'Ajustes de prazos e desdobramentos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null),
  ('encontro', 8,  '2026-10-27', 'Monitoramento e responsabilidade', 'Consolidar a autonomia', '{PDM,Escuta Ativa}', null),
  ('encontro', 9,  '2026-11-10', 'Revisão de meio de percurso', 'Consolidar a autonomia', '{PDM,Escuta Ativa}', null),
  ('encontro', 10, '2026-11-17', 'O mentor como espelho', 'Aprofundar o vínculo e o aprendizado', '{Papel de modelo,Escuta Ativa}', null),
  ('encontro', 11, '2026-11-24', 'Rede de apoio e novos espaços', 'Aprofundar o vínculo e o aprendizado', '{Papel de modelo,Escuta Ativa}', null),
  ('encontro', 12, '2026-12-01', 'Aplicação e leitura da Roda da Vida', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null),
  ('encontro', 13, '2026-12-08', 'Metas das áreas prioritárias', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null),
  ('encontro', 14, '2026-12-15', 'Desdobramento e plano de continuidade', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null),
  ('recesso',  null, '2026-12-16', 'Recesso de fim de ano', null, '{}', '2027-01-04'),
  ('encontro', 15, '2027-01-05', 'Reflexão e reconhecimento', 'Encerrar e celebrar', '{PDM,Roda da Vida}', null),
  ('encontro', 16, '2027-01-12', 'Encerramento e celebração', 'Encerrar e celebrar', '{Avaliação 360º,Autoavaliação do mentor}', null),
  ('marco',    null, '2027-01-15', 'Evento de encerramento do programa', null, '{}', null);

-- ===== materiais =====
insert into public.materiais (titulo, descricao, tipo, url, audiencia, encontro_num, ordem) values
  ('Guia do Mentor DPP', 'Metodologia completa: jornada, 16 encontros, instrumentos e templates.', 'guia', null, 'dpp', null, 1),
  ('Guia do Mentor Especialista', 'Metodologia da mentoria com especialista: 5 encontros e cinco funções.', 'guia', null, 'especialista', null, 2),
  ('Perguntas Eficazes', 'Instrumento de referência do guia: exemplos de perguntas abertas e de foco para conduzir cada encontro.', 'conteudo', null, 'dpp', null, 9),
  ('Mensagem de preparação do mentorado', 'Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.', 'template', null, 'dpp', 1, 10),
  ('Instrumento: Construindo a sua Visão', 'Tarefa individual entre o 1º e o 2º encontro; origina a Declaração de Visão.', 'template', null, 'dpp', 1, 11),
  ('Mensagem às pessoas indicadas', 'Modelo de contato para a avaliação por terceiros (duas perguntas).', 'template', null, 'dpp', 1, 12),
  ('Consolidação da avaliação por terceiros', 'Quadro para agrupar pontos fortes e de melhoria sem identificar quem respondeu.', 'template', null, 'dpp', 2, 13),
  ('Plano de Desenvolvimento do Mentorado (PDM)', 'Documento central da dupla: visão, metas SMART, indicadores e mapa de submetas.', 'template', null, 'dpp', 2, 14),
  ('Mensagem de encaminhamento entre encontros', 'Modelo curto para manter o vínculo e deixar a próxima tarefa clara.', 'template', null, 'dpp', null, 15),
  ('Roda da Vida: roteiro de aplicação', 'Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.', 'template', null, 'dpp', 12, 16),
  ('Checklist de competências do mentor', 'Autoavaliação antes do ciclo e novamente no 16º encontro.', 'template', null, 'todos', null, 17),
  ('Autoavaliação do mentor', 'Cinco perguntas de reflexão para o encerramento do ciclo.', 'template', null, 'todos', 16, 18),
  ('Avaliação 360º', 'Único formulário de avaliação do programa — preenchido no 16º encontro, consolida o fechamento do ciclo.', 'template', null, 'dpp', 16, 19),
  ('Plataforma de mentoria', 'Onde os encontros oficiais são agendados e avaliados.', 'link', 'https://mentoria.realiza.vc', 'todos', null, 20),
  ('Formação EaD gratuita', 'Trilha opcional com certificado para mentores.', 'link', 'https://ead.realiza.vc', 'todos', null, 21);

-- sem dados de pessoas/duplas: cadastro real acontece pela plataforma
-- (pessoas -> magic link; duplas pela coordenação)
