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
-- path 'doc:<slug>' = documento nativo renderizado em /materiais/documento/<slug>
-- (não passa pelo storage): o catálogo inteiro é nativo — os dois guias,
-- os 16 roteiros, Perguntas Eficazes, os cronogramas por turma e os
-- instrumentos de corpus apontam pra página própria em vez do PDF. Os
-- flips equivalentes em prod chegaram pelas migrations 0185 e 0194
-- (UPDATE nos paths das mesmas linhas).
insert into public.materiais (titulo, descricao, tipo, url, audiencia, encontro_num, ordem, path) values
  ('Guia do Mentor DPP', 'Metodologia completa: jornada, 16 encontros, instrumentos e templates. PDM e Roda da Vida são respondidos na ficha da dupla, aba Instrumentos.', 'guia', null, 'dpp', null, 1, 'doc:guia-mentor-dpp'),
  ('Guia do Mentor Especialista', 'Metodologia da mentoria com especialista: 5 encontros e cinco funções.', 'guia', null, 'especialista', null, 2, 'doc:guia-mentor-especialista'),
  ('Roteiro Semana 1 — Boas-vindas e histórias de vida', null, 'conteudo', null, 'dpp', 1, 3, 'doc:roteiro-encontro-01'),
  ('Roteiro Semana 2 — Avaliação por terceiros e visão de futuro', null, 'conteudo', null, 'dpp', 2, 4, 'doc:roteiro-encontro-02'),
  ('Roteiro Semana 3 — Metas e checagem SMART', null, 'conteudo', null, 'dpp', 3, 5, 'doc:roteiro-encontro-03'),
  ('Roteiro Semana 4 — Submetas e compromisso', null, 'conteudo', null, 'dpp', 4, 6, 'doc:roteiro-encontro-04'),
  ('Roteiro Semana 5 — Primeiros resultados', null, 'conteudo', null, 'dpp', 5, 7, 'doc:roteiro-encontro-05'),
  ('Roteiro Semana 6 — Superando barreiras', null, 'conteudo', null, 'dpp', 6, 8, 'doc:roteiro-encontro-06'),
  ('Roteiro Semana 7 — Ajustes no plano', null, 'conteudo', null, 'dpp', 7, 9, 'doc:roteiro-encontro-07'),
  ('Roteiro Semana 8 — Monitoramento e responsabilidade', null, 'conteudo', null, 'dpp', 8, 10, 'doc:roteiro-encontro-08'),
  ('Roteiro Semana 9 — Revisão de meio de percurso', null, 'conteudo', null, 'dpp', 9, 11, 'doc:roteiro-encontro-09'),
  ('Roteiro Semana 10 — O mentor como espelho', null, 'conteudo', null, 'dpp', 10, 12, 'doc:roteiro-encontro-10'),
  ('Roteiro Semana 11 — Rede de apoio e novos espaços', 'Roteiro do 11º encontro: mapear a rede de apoio, abrir portas e apresentar a Roda da Vida.', 'conteudo', null, 'dpp', 11, 13, 'doc:roteiro-encontro-11'),
  ('Roteiro Semana 12 — Leitura da Roda da Vida', 'Roteiro do 12º encontro: ler a Roda quadrante por quadrante e abrir as metas das 16 áreas.', 'conteudo', null, 'dpp', 12, 14, 'doc:roteiro-encontro-12'),
  ('Roteiro Semana 13 — Metas das áreas prioritárias', 'Roteiro do 13º encontro: revisar as metas da Roda e eleger as áreas prioritárias a detalhar.', 'conteudo', null, 'dpp', 13, 15, 'doc:roteiro-encontro-13'),
  ('Roteiro Semana 14 — Desdobramento e plano de continuidade', 'Roteiro do 14º encontro: validar o mapa de submetas e montar o plano de continuidade.', 'conteudo', null, 'dpp', 14, 16, 'doc:roteiro-encontro-14'),
  ('Roteiro Semana 15 — Reflexão e reconhecimento', 'Roteiro do 15º encontro: olhar a jornada, reconhecer conquistas e trocar feedback mútuo.', 'conteudo', null, 'dpp', 15, 17, 'doc:roteiro-encontro-15'),
  ('Roteiro Semana 16 — Encerramento e celebração', 'Roteiro do 16º encontro: celebrar o percurso, revisar PDM e Roda e responder a avaliação geral.', 'conteudo', null, 'dpp', 16, 18, 'doc:roteiro-encontro-16'),
  ('Mensagem de preparação do mentorado', 'Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.', 'template', null, 'dpp', 1, 19, 'doc:mensagem-preparacao'),
  ('Mensagem às pessoas indicadas', 'Modelo de contato para a avaliação por terceiros (duas perguntas).', 'template', null, 'dpp', 1, 20, 'doc:mensagem-indicadas'),
  ('Mensagem de encaminhamento entre encontros', 'Modelo curto para manter o vínculo e deixar a próxima tarefa clara.', 'template', null, 'dpp', null, 21, 'doc:mensagem-encaminhamento'),
  ('Roda da Vida (instrumento)', 'Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.', 'template', null, 'dpp', 12, 22, 'doc:instrumento-roda-da-vida'),
  ('Feedback Construtivo', 'Instrumento do guia: o modelo de fala e os cuidados para feedback sobre comportamento negativo.', 'conteudo', null, 'todos', null, 23, 'doc:feedback-construtivo'),
  ('Instrumento: Definindo Metas', 'Metas SMART do mentorado — instrumento de preenchimento entre encontros.', 'template', null, 'dpp', null, 24, 'doc:instrumento-definindo-minhas-metas'),
  ('Perguntas Eficazes', 'Documento complementar do guia: o que são, o que evitar e o banco de perguntas por momento da conversa.', 'conteudo', null, 'dpp', null, 25, 'doc:perguntas-eficazes'),
  ('Cronograma do programa — Turma 1', null, 'conteudo', null, 'dpp', null, 26, 'doc:ciclo-cronograma'),
  ('Cronograma do programa — Turma 2', null, 'conteudo', null, 'dpp', null, 27, 'doc:ciclo-turma2-cronograma'),
  ('Plataforma de mentoria', 'Onde os encontros oficiais são agendados e avaliados.', 'link', 'https://mentoria.realiza.vc', 'todos', null, 28, null),
  ('Formação EaD gratuita', 'Trilha opcional com certificado para mentores.', 'link', 'https://ead.realiza.vc', 'todos', null, 29, null),
  ('Checklist de competências do mentor', 'As 10 competências do guia para marcar antes do ciclo e no 16º encontro.', 'template', null, 'dpp', null, 30, 'doc:checklist-competencias')
on conflict do nothing;

-- 0139: audiência granular derivada do legado — o seed nasce com a coluna
-- no default ('todos'); o mapeamento é o mesmo da migration
update public.materiais set audiencias = case audiencia
  when 'dpp' then array['mentor_dpp']
  when 'especialista' then array['mentor_especialista']
  when 'coordenacao' then array['coordenacao']
  else array['todos'] end
where audiencia <> 'todos' and audiencias = array['todos'];

-- 0167: material de mentor serve o supervisor; Feedback Construtivo sem o
-- jovem; Formação EaD pra mentores e mentorados (mesmo corpo da migration)
update public.materiais set audiencias = array_append(audiencias, 'supervisor')
where audiencias && array['mentor_dpp', 'mentor_especialista']
  and not ('supervisor' = any (audiencias)) and not ('todos' = any (audiencias));
update public.materiais
  set audiencias = array['coordenacao', 'supervisor', 'mentor_dpp', 'mentor_especialista'], audiencia = 'dpp'
where titulo = 'Feedback Construtivo' and audiencias = array['todos'];
update public.materiais
  set audiencias = array['mentor_dpp', 'mentor_especialista', 'mentorado'], audiencia = 'dpp'
where titulo = 'Formação EaD gratuita' and audiencias = array['todos'];

-- 0140: desfecho auditável — colunas desfecho/desfecho_motivo/desfecho_obs/
-- desfecho_em/desfecho_por já existem (migration). Backfill coerente com o
-- status legado, pra que o histórico antigo não suma. Duplas ainda em curso
-- (ativa/pausada) ficam com desfecho null. `dupla_eventos` é criada pela
-- migration e permanece vazia no seed (append-only em runtime).
update public.duplas
   set desfecho = 'concluida',
       desfecho_em = coalesce(concluida_em, encerrada_em, now()),
       desfecho_obs = motivo_encerramento
 where status = 'concluida' and desfecho is null;

update public.duplas
   set desfecho = 'outro',
       desfecho_motivo = coalesce(motivo_encerramento, 'legado'),
       desfecho_em = coalesce(encerrada_em, now()),
       desfecho_obs = motivo_encerramento
 where status = 'encerrada' and desfecho is null;

-- sem dados de pessoas/duplas: cadastro real acontece pela plataforma
-- (pessoas -> magic link; duplas pela coordenação)
