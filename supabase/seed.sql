-- ===== calendario do ciclo 2026/2027 (fonte: cronograma Juventude Solidaria) =====
insert into public.ciclo_eventos (tipo, numero, data, titulo, fase, instrumentos) values
  ('formacao', null, '2026-09-03', 'Encontro inicial de formacao de mentores', null, '{}'),
  ('formacao', null, '2026-09-04', 'Encontro final de formacao de mentores', null, '{}'),
  ('encontro', 1,  '2026-09-08', 'Boas-vindas, historias de vida e abertura', 'Criar vinculo e construir o PDM', '{Perguntas Eficazes,Escuta Ativa,PDM,Roda da Vida (leitura inicial)}'),
  ('encontro', 2,  '2026-09-15', 'Avaliacao por terceiros e visao de futuro', 'Criar vinculo e construir o PDM', '{PDM,Construindo a sua Visao}'),
  ('encontro', 3,  '2026-09-22', 'Declaracao de Visao e metas SMART', 'Criar vinculo e construir o PDM', '{PDM,Modelo SMART}'),
  ('encontro', 4,  '2026-09-29', 'Fechamento da construcao do PDM', 'Criar vinculo e construir o PDM', '{PDM,Perguntas Eficazes}'),
  ('encontro', 5,  '2026-10-06', 'Acompanhamento das primeiras submetas', 'Colocar o plano em pratica', '{PDM,Feedback Construtivo}'),
  ('encontro', 6,  '2026-10-13', 'Superacao de obstaculos', 'Colocar o plano em pratica', '{PDM,Feedback Construtivo}'),
  ('encontro', 7,  '2026-10-20', 'Ajustes de prazos e desdobramentos', 'Colocar o plano em pratica', '{PDM,Feedback Construtivo}'),
  ('encontro', 8,  '2026-10-27', 'Revisao de meio de percurso', 'Consolidar a autonomia', '{PDM,Escuta Ativa}'),
  ('encontro', 9,  '2026-11-10', 'Transferencia gradual da conducao', 'Consolidar a autonomia', '{PDM,Escuta Ativa}'),
  ('encontro', 10, '2026-11-17', 'Trajetoria do mentor e rede de apoio', 'Aprofundar vinculo e aprendizado', '{Papel de modelo,Escuta Ativa}'),
  ('encontro', 11, '2026-11-24', 'Ampliacao de espacos e repertorio', 'Aprofundar vinculo e aprendizado', '{Papel de modelo,Escuta Ativa}'),
  ('encontro', 12, '2026-12-01', 'Roda da Vida: explicacao e leitura', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('encontro', 13, '2026-12-08', 'Roda da Vida: discussao por quadrante', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('encontro', 14, '2026-12-15', 'Roda da Vida: mapa de metas e submetas', 'Roda da Vida', '{Roda da Vida,Modelo SMART}'),
  ('recesso',  null, '2026-12-16', 'Recesso de fim de ano', null, '{}'),
  ('encontro', 15, '2027-01-05', 'Revisao do percurso', 'Encerrar e celebrar', '{Roda da Vida,Avaliacao 360}'),
  ('encontro', 16, '2027-01-12', 'Celebracao e encerramento simbolico', 'Encerrar e celebrar', '{Avaliacao 360,Autoavaliacao do mentor}'),
  ('marco',    null, '2027-01-15', 'Evento de encerramento do programa', null, '{}');

update public.ciclo_eventos set data_fim = '2027-01-04' where tipo = 'recesso';

-- ===== materiais =====
insert into public.materiais (titulo, descricao, tipo, url, audiencia, encontro_num, ordem) values
  ('Guia do Mentor DPP', 'Metodologia completa: jornada, 16 encontros, instrumentos e templates.', 'guia', null, 'dpp', null, 1),
  ('Guia do Mentor Especialista', 'Metodologia da mentoria com especialista: 5 encontros e cinco funcoes.', 'guia', null, 'especialista', null, 2),
  ('Mensagem de preparacao do mentorado', 'Modelo para enviar antes do 1o encontro: historia de vida, Roda da Vida e contatos para avaliacao.', 'template', null, 'dpp', 1, 10),
  ('Instrumento: Construindo a sua Visao', 'Tarefa individual entre o 1o e o 2o encontro; origina a Declaracao de Visao.', 'template', null, 'dpp', 1, 11),
  ('Mensagem as pessoas indicadas', 'Modelo de contato para a avaliacao por terceiros (duas perguntas).', 'template', null, 'dpp', 1, 12),
  ('Consolidacao da avaliacao por terceiros', 'Quadro para agrupar pontos fortes e de melhoria sem identificar quem respondeu.', 'template', null, 'dpp', 2, 13),
  ('Plano de Desenvolvimento do Mentorado (PDM)', 'Documento central da dupla: visao, metas SMART, indicadores e mapa de submetas.', 'template', null, 'dpp', 2, 14),
  ('Mensagem de encaminhamento entre encontros', 'Modelo curto para manter o vinculo e deixar a proxima tarefa clara.', 'template', null, 'dpp', null, 15),
  ('Roda da Vida: roteiro de aplicacao', 'Aplicacao em tres momentos a partir do 5o mes: explicacao, discussao e validacao.', 'template', null, 'dpp', 12, 16),
  ('Checklist de competencias do mentor', 'Autoavaliacao antes do ciclo e novamente no 16o encontro.', 'template', null, 'todos', null, 17),
  ('Autoavaliacao do mentor', 'Cinco perguntas de reflexao para o encerramento do ciclo.', 'template', null, 'todos', 16, 18),
  ('Plataforma de mentoria', 'Onde os encontros oficiais sao agendados e avaliados.', 'link', 'https://mentoria.realiza.vc', 'todos', null, 20),
  ('Formacao EaD gratuita', 'Trilha opcional com certificado para mentores.', 'link', 'https://ead.realiza.vc', 'todos', null, 21);

-- ===== demo (senha: senha123) =====
-- profiles primeiro: o trigger handle_new_user vincula user_id no insert do auth.users
insert into public.profiles (id, nome, email, whatsapp, role) values
  ('11111111-1111-1111-1111-111111111111', 'Thiago', 'ti@realiza.vc', '5511999990001', 'coordenacao'),
  ('22222222-2222-2222-2222-222222222222', 'Ana Ribeiro', 'ana@realiza.vc', '5511999990002', 'mentor_dpp'),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Menezes', 'carlos@realiza.vc', '5511999990003', 'supervisor');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, recovery_token, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'ti@realiza.vc', crypt('senha123', gen_salt('bf')), now(), now(), '', '', '{"provider":"email","providers":["email"]}', '{"nome":"Thiago"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'ana@realiza.vc', crypt('senha123', gen_salt('bf')), now(), now(), '', '', '{"provider":"email","providers":["email"]}', '{"nome":"Ana Ribeiro"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'carlos@realiza.vc', crypt('senha123', gen_salt('bf')), now(), now(), '', '', '{"provider":"email","providers":["email"]}', '{"nome":"Carlos Menezes"}', now(), now());

insert into public.mentor_profiles (profile_id, tipo, areas, capacidade, termo_ok, formacao_ok)
select id, 'dpp', '{}', 1, true, true from public.profiles where email = 'ana@realiza.vc';

insert into public.mentorados (nome, whatsapp, ong_origem) values
  ('Fernando Alves', '5511999990011', 'Juventude Solidaria'),
  ('Marina Duarte', '5511999990012', 'Juventude Solidaria');

insert into public.duplas (mentor_id, mentorado_id, supervisor_id, iniciada_em)
select p_mentor.id, m.id, p_sup.id, '2026-09-08'
from public.profiles p_mentor, public.mentorados m, public.profiles p_sup
where p_mentor.email = 'ana@realiza.vc'
  and m.nome = 'Fernando Alves'
  and p_sup.email = 'carlos@realiza.vc';

-- 1o encontro ja realizado e registrado; 2o agendado (demo do semaforo)
insert into public.encontros (dupla_id, numero, data_hora, status)
select d.id, 1, '2026-09-08 19:00-03'::timestamptz, 'realizado'::public.encontro_status from public.duplas d
union all
select d.id, 2, '2026-09-15 19:00-03'::timestamptz, 'agendado'::public.encontro_status from public.duplas d;

insert into public.registros (encontro_id, tema, ferramenta, reflexoes, observacoes)
select e.id,
       'Apresentacao e abertura do PDM',
       'Perguntas Eficazes',
       'Fernando contou a historia dele e ja tinha a Roda da Vida preenchida. Quer muito entrar em tecnologia.',
       'Boa conexao inicial. Ele trava quando fala de prazos.'
from public.encontros e where e.numero = 1;

insert into public.encaminhamentos (dupla_id, registro_id, descricao, responsavel, prazo)
select d.id, r.id, 'Fazer o instrumento Construindo a sua Visao e trazer a Declaracao de Visao', 'mentorado', '2026-09-15'
from public.duplas d, public.registros r;
