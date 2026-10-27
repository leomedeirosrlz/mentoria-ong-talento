-- ===== calendário do ciclo 2026/2027 (fonte: cronograma oficial do ciclo — "Mentoria · Plataforma Juventude Solidária") =====
-- Duração total 30/07/2026 → 15/01/2027 (~5 meses e meio): pré-ciclo (inscrições
-- → triagem → matching → formação/abertura), mentoria ativa de 4 meses e 1
-- semana com 16 encontros às terças — semanal em 13 dos 15 intervalos, com 15
-- dias entre o 8º e o 9º encontro (tempo de prática das submetas) — e o recesso
-- de fim de ano na virada da Fase 5 (Roda da Vida) para a Fase 6 (Encerrar).
--
-- Modelo 0062: o cronograma oficial tem 4 seções e `ciclo_eventos` espelha:
--   1. preparação — etapa_preparacao (datada, ou "Concluída" sem data quando a
--      ONG parceira entrega a etapa pronta — o CHECK só libera data null pra
--      etapa concluída)
--   2. mentoria ativa — encontro (único tipo que entra no denominador do
--      semáforo) + recesso
--   3. encerramento — evento_encerramento
--   4. observações operacionais — coluna observacao
-- `ordem` é a sequência do PDF, explícita (não derivada de data): etapas vêm
-- antes dos encontros mesmo sem data.
with cron as (
  insert into public.cronogramas (nome, turma, inicio_em, fim_em, encontros_esperados)
  values ('Calendário oficial', '2026/2027', '2026-07-30', '2027-01-15', 16)
  returning id
)
insert into public.ciclo_eventos (cronograma_id, tipo, numero, data, titulo, fase, instrumentos, data_fim, status, observacao, ordem)
select cron.id, v.tipo, v.numero::smallint, v.data::date, v.titulo, v.fase,
       v.instrumentos::text[], v.data_fim::date, v.status, v.observacao, v.ordem::smallint
  from cron cross join (values
  -- seção 1 — preparação (as 5 etapas do PDF; "Encontro de abertura com a
  -- coordenação" é o fecho do onboarding de mentorados). As sessões de
  -- formação seguem 'formacao' — são as que recebem chamada; a etapa
  -- "onboarding de mentores" é o marco operacional que as embrulha, então
  -- na `ordem` elas caem dentro da janela dela.
  ('etapa_preparacao', null, '2026-07-30', 'Inscrições', null, '{}', '2026-08-19', 'pendente', null, 1),
  ('etapa_preparacao', null, '2026-08-20', 'Triagem e matching', null, '{}', '2026-09-02', 'pendente', null, 2),
  ('etapa_preparacao', null, '2026-09-03', 'Onboarding de mentores', null, '{}', '2026-09-04', 'pendente', null, 3),
  ('formacao', null, '2026-09-03', 'Encontro inicial de formação de mentores', null, '{}', null, 'pendente', null, 4),
  ('formacao', null, '2026-09-04', 'Encontro final de formação de mentores', null, '{}', null, 'pendente', null, 5),
  ('etapa_preparacao', null, '2026-09-04', 'Onboarding de mentorados', null, '{}', null, 'pendente', 'Encontro de abertura com a coordenação', 6),
  ('etapa_preparacao', null, '2026-09-08', 'Início', null, '{}', null, 'pendente', null, 7),
  -- seção 2 — mentoria ativa
  ('encontro', 1,  '2026-09-08', 'Boas-vindas, histórias de vida e abertura', 'Criar vínculo e construir o PDM', '{Perguntas Eficazes,Escuta Ativa,PDM,Roda da Vida (leitura inicial)}', null, 'pendente', 'Reposição na mesma semana', 8),
  ('encontro', 2,  '2026-09-15', 'Avaliação por terceiros e visão de futuro', 'Criar vínculo e construir o PDM', '{PDM,Construindo a sua Visão}', null, 'pendente', null, 9),
  ('encontro', 3,  '2026-09-22', 'Declaração de Visão e metas SMART', 'Criar vínculo e construir o PDM', '{PDM,Modelo SMART}', null, 'pendente', null, 10),
  ('encontro', 4,  '2026-09-29', 'Fechamento da construção do PDM', 'Criar vínculo e construir o PDM', '{PDM,Perguntas Eficazes}', null, 'pendente', null, 11),
  ('encontro', 5,  '2026-10-06', 'Acompanhamento das primeiras submetas', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null, 'pendente', null, 12),
  ('encontro', 6,  '2026-10-13', 'Superação de obstáculos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null, 'pendente', null, 13),
  ('encontro', 7,  '2026-10-20', 'Ajustes de prazos e desdobramentos', 'Colocar o plano em prática', '{PDM,Feedback Construtivo}', null, 'pendente', null, 14),
  ('encontro', 8,  '2026-10-27', 'Monitoramento e responsabilidade', 'Consolidar a autonomia', '{PDM,Escuta Ativa}', null, 'pendente', null, 15),
  ('encontro', 9,  '2026-11-10', 'Revisão de meio de percurso', 'Consolidar a autonomia', '{PDM,Escuta Ativa}', null, 'pendente', '15 dias desde o 8º encontro — tempo de prática das submetas', 16),
  ('encontro', 10, '2026-11-17', 'O mentor como espelho', 'Aprofundar o vínculo e o aprendizado', '{Papel de modelo,Escuta Ativa}', null, 'pendente', null, 17),
  ('encontro', 11, '2026-11-24', 'Rede de apoio e novos espaços', 'Aprofundar o vínculo e o aprendizado', '{Papel de modelo,Escuta Ativa}', null, 'pendente', null, 18),
  ('encontro', 12, '2026-12-01', 'Aplicação e leitura da Roda da Vida', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null, 'pendente', null, 19),
  ('encontro', 13, '2026-12-08', 'Metas das áreas prioritárias', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null, 'pendente', 'Feriado municipal — confirmar local', 20),
  ('encontro', 14, '2026-12-15', 'Desdobramento e plano de continuidade', 'Roda da Vida', '{Roda da Vida,Modelo SMART}', null, 'pendente', null, 21),
  ('recesso',  null, '2026-12-16', 'Recesso de fim de ano', null, '{}', '2027-01-04', 'pendente', 'Sem encontros — retomada na 1ª terça de janeiro', 22),
  ('encontro', 15, '2027-01-05', 'Reflexão e reconhecimento', 'Encerrar e celebrar', '{PDM,Roda da Vida}', null, 'pendente', null, 23),
  ('encontro', 16, '2027-01-12', 'Encerramento e celebração', 'Encerrar e celebrar', '{Avaliação final}', null, 'pendente', null, 24),
  -- seção 3 — encerramento
  ('evento_encerramento', null, '2027-01-15', 'Evento de encerramento do programa', null, '{}', null, 'pendente', null, 25)
) v(tipo, numero, data, titulo, fase, instrumentos, data_fim, status, observacao, ordem);

-- ===== materiais =====
insert into public.materiais (titulo, descricao, tipo, url, audiencia, encontro_num, ordem, path) values
  ('Guia do Mentor DPP', 'Metodologia completa: jornada, 16 encontros, instrumentos e templates.', 'guia', null, 'dpp', null, 1, 'materiais/5dc4d7d1-e69d-410c-b0b0-f8a80dcc906b-Guia-do-Mentor-de-Desenvolvimento-Pessoal-e-Profissional---Realiza.vc-Equipe-Executiva-1-.pdf'),
  ('Guia do Mentor Especialista', 'Metodologia da mentoria com especialista: 5 encontros e cinco funções.', 'guia', null, 'especialista', null, 2, 'materiais/7a83fe5a-5128-47c3-9c4c-c2eeb5ae0288-Guia-do-Mentor-Especialista---Realiza.vc-Equipe-Executiva-1-.pdf'),
  ('Roteiro Semana 1 — Boas-vindas e histórias de vida', null, 'conteudo', null, 'dpp', 1, 3, 'materiais/7d586a09-3842-4efe-84df-671d414cd19c-roteiro-semana-1.pdf'),
  ('Roteiro Semana 2 — Avaliação por terceiros e visão de futuro', null, 'conteudo', null, 'dpp', 2, 4, 'materiais/79ce91dc-1a9a-4651-936b-0855efbcf2d8-roteiro-semana-2.pdf'),
  ('Roteiro Semana 3 — Metas e checagem SMART', null, 'conteudo', null, 'dpp', 3, 5, 'materiais/c85f59d3-d1a7-413e-b8d0-62f8e367a260-roteiro-semana-3.pdf'),
  ('Roteiro Semana 4 — Submetas e compromisso', null, 'conteudo', null, 'dpp', 4, 6, 'materiais/898a0774-c7b8-44cb-ad6c-3d9f65ad3a5f-roteiro-semana-4.pdf'),
  ('Roteiro Semana 5 — Primeiros resultados', null, 'conteudo', null, 'dpp', 5, 7, 'materiais/e6beb712-5d18-4774-9e11-df334aeb341b-roteiro-semana-5.pdf'),
  ('Roteiro Semana 6 — Superando barreiras', null, 'conteudo', null, 'dpp', 6, 8, 'materiais/e268ac53-2325-45a7-8d6c-e0886e8e6684-roteiro-semana-6.pdf'),
  ('Roteiro Semana 7 — Ajustes no plano', null, 'conteudo', null, 'dpp', 7, 9, 'materiais/03d08a31-144c-45f4-bafc-8716c22a3b7d-roteiro-semana-7.pdf'),
  ('Roteiro Semana 8 — Monitoramento e responsabilidade', null, 'conteudo', null, 'dpp', 8, 10, 'materiais/6589d364-02ed-4247-93ad-3cd9da8c8b32-roteiro-semana-8.pdf'),
  ('Roteiro Semana 9 — Revisão de meio de percurso', null, 'conteudo', null, 'dpp', 9, 11, 'materiais/fb0710c1-f1ac-4dfb-8a74-56c54ff2fddf-roteiro-semana-9.pdf'),
  ('Roteiro Semana 10 — O mentor como espelho', null, 'conteudo', null, 'dpp', 10, 12, 'materiais/7f8253ee-c430-4980-81eb-2357aad207d5-roteiro-semana-10.pdf'),
  ('Roteiro Semana 11 — Rede de apoio e novos espaços', 'Roteiro do 11º encontro: mapear a rede de apoio, abrir portas e apresentar a Roda da Vida.', 'conteudo', null, 'dpp', 11, 13, 'materiais/d6402303-7a25-432e-b3b4-046908c444de-roteiro-semana-11.pdf'),
  ('Roteiro Semana 12 — Leitura da Roda da Vida', 'Roteiro do 12º encontro: ler a Roda quadrante por quadrante e abrir as metas das 16 áreas.', 'conteudo', null, 'dpp', 12, 14, 'materiais/e82d1ecb-4650-4728-b4c9-448479b3af20-roteiro-semana-12.pdf'),
  ('Roteiro Semana 13 — Metas das áreas prioritárias', 'Roteiro do 13º encontro: revisar as metas da Roda e eleger as áreas prioritárias a detalhar.', 'conteudo', null, 'dpp', 13, 15, 'materiais/56cce3c4-7325-4895-9296-442157dae6ae-roteiro-semana-13.pdf'),
  ('Roteiro Semana 14 — Desdobramento e plano de continuidade', 'Roteiro do 14º encontro: validar o mapa de submetas e montar o plano de continuidade.', 'conteudo', null, 'dpp', 14, 16, 'materiais/1a6bcf72-ebb3-40b5-902d-ad2d5e6fefa4-roteiro-semana-14.pdf'),
  ('Roteiro Semana 15 — Reflexão e reconhecimento', 'Roteiro do 15º encontro: olhar a jornada, reconhecer conquistas e trocar feedback mútuo.', 'conteudo', null, 'dpp', 15, 17, 'materiais/9d23a061-e0bc-4e2e-b835-f875b0654acf-roteiro-semana-15.pdf'),
  ('Roteiro Semana 16 — Encerramento e celebração', 'Roteiro do 16º encontro: celebrar o percurso, revisar PDM e Roda e responder a avaliação geral.', 'conteudo', null, 'dpp', 16, 18, 'materiais/f22fe899-7bcb-49c8-80cb-949295ded4e1-roteiro-semana-16.pdf'),
  ('Mensagem de preparação do mentorado', 'Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.', 'template', null, 'dpp', 1, 19, 'doc:mensagem-preparacao'),
  ('Mensagem às pessoas indicadas', 'Modelo de contato para a avaliação por terceiros (duas perguntas).', 'template', null, 'dpp', 1, 20, 'doc:mensagem-indicadas'),
  ('Mensagem de encaminhamento entre encontros', 'Modelo curto para manter o vínculo e deixar a próxima tarefa clara.', 'template', null, 'dpp', null, 21, 'doc:mensagem-encaminhamento'),
  ('Roda da Vida: roteiro de aplicação', 'Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.', 'template', null, 'dpp', 12, 22, 'materiais/f34e462a-9e3f-4ab8-b68d-8d59abcff2c2-Roda-da-Vida---Realiza.vc.pdf'),
  ('Checklist de competências do mentor', 'Autoavaliação antes do ciclo e novamente no 16º encontro.', 'template', null, 'todos', null, 23, 'doc:checklist-competencias'),
  ('Instrumento: Definindo Metas', 'Metas SMART do mentorado — instrumento de preenchimento entre encontros.', 'template', null, 'dpp', null, 24, 'materiais/4bcba588-fff0-4a14-b9a9-b5d8598cfc21-definindo-metas.pdf'),
  ('Perguntas Eficazes', 'Documento complementar do guia: o que são, o que evitar e o banco de perguntas por momento da conversa.', 'conteudo', null, 'dpp', null, 25, 'materiais/1a8277af-eb2b-4196-98e7-9fade2899a34-perguntas-eficazes.pdf'),
  ('Cronograma do programa — Turma 1', null, 'conteudo', null, 'dpp', null, 26, 'materiais/84c8a989-48f0-4497-8b28-58754a2ca02e-cronograma-turma-1.pdf'),
  ('Cronograma do programa — Turma 2', null, 'conteudo', null, 'dpp', null, 27, 'materiais/6eabec09-3d3f-42ba-9407-8077e9373b6c-cronograma-turma-2.pdf'),
  ('Plataforma de mentoria', 'Onde os encontros oficiais são agendados e avaliados.', 'link', 'https://mentoria.realiza.vc', 'todos', null, 28, null),
  ('Formação EaD gratuita', 'Trilha opcional com certificado para mentores.', 'link', 'https://ead.realiza.vc', 'todos', null, 29, null);

-- sem dados de pessoas/duplas: cadastro real acontece pela plataforma
-- (pessoas -> magic link; duplas pela coordenação)
