-- ===== acentos pt-BR nos dados de domínio (ciclo_eventos + materiais) =====
-- idempotente: UPDATEs chaveados por campos técnicos estáveis (numero/data/ordem);
-- re-rodar reescreve os mesmos valores. arrays via array_replace (no-op se o
-- elemento sem acento não existir).

-- ----- ciclo_eventos: titulo -----
update public.ciclo_eventos set titulo = 'Encontro inicial de formação de mentores'
  where tipo = 'formacao' and data = '2026-09-03';
update public.ciclo_eventos set titulo = 'Encontro final de formação de mentores'
  where tipo = 'formacao' and data = '2026-09-04';
update public.ciclo_eventos set titulo = 'Boas-vindas, histórias de vida e abertura'
  where tipo = 'encontro' and numero = 1;
update public.ciclo_eventos set titulo = 'Avaliação por terceiros e visão de futuro'
  where tipo = 'encontro' and numero = 2;
update public.ciclo_eventos set titulo = 'Declaração de Visão e metas SMART'
  where tipo = 'encontro' and numero = 3;
update public.ciclo_eventos set titulo = 'Fechamento da construção do PDM'
  where tipo = 'encontro' and numero = 4;
update public.ciclo_eventos set titulo = 'Superação de obstáculos'
  where tipo = 'encontro' and numero = 6;
update public.ciclo_eventos set titulo = 'Revisão de meio de percurso'
  where tipo = 'encontro' and numero = 8;
update public.ciclo_eventos set titulo = 'Transferência gradual da condução'
  where tipo = 'encontro' and numero = 9;
update public.ciclo_eventos set titulo = 'Trajetória do mentor e rede de apoio'
  where tipo = 'encontro' and numero = 10;
update public.ciclo_eventos set titulo = 'Ampliação de espaços e repertório'
  where tipo = 'encontro' and numero = 11;
update public.ciclo_eventos set titulo = 'Roda da Vida: explicação e leitura'
  where tipo = 'encontro' and numero = 12;
update public.ciclo_eventos set titulo = 'Roda da Vida: discussão por quadrante'
  where tipo = 'encontro' and numero = 13;
update public.ciclo_eventos set titulo = 'Revisão do percurso'
  where tipo = 'encontro' and numero = 15;
update public.ciclo_eventos set titulo = 'Celebração e encerramento simbólico'
  where tipo = 'encontro' and numero = 16;
-- encontros 5, 7, 14 e os marcos/recesso já estavam corretos

-- ----- ciclo_eventos: fase -----
update public.ciclo_eventos set fase = 'Criar vínculo e construir o PDM'
  where fase = 'Criar vinculo e construir o PDM';
update public.ciclo_eventos set fase = 'Colocar o plano em prática'
  where fase = 'Colocar o plano em pratica';
update public.ciclo_eventos set fase = 'Aprofundar vínculo e aprendizado'
  where fase = 'Aprofundar vinculo e aprendizado';

-- ----- ciclo_eventos: instrumentos (elementos do array) -----
update public.ciclo_eventos
  set instrumentos = array_replace(instrumentos, 'Construindo a sua Visao', 'Construindo a sua Visão')
  where 'Construindo a sua Visao' = any(instrumentos);
update public.ciclo_eventos
  set instrumentos = array_replace(instrumentos, 'Avaliacao 360', 'Avaliação 360')
  where 'Avaliacao 360' = any(instrumentos);
update public.ciclo_eventos
  set instrumentos = array_replace(instrumentos, 'Autoavaliacao do mentor', 'Autoavaliação do mentor')
  where 'Autoavaliacao do mentor' = any(instrumentos);

-- ----- materiais: titulo + descricao (chave: ordem, única e estável) -----
update public.materiais
  set descricao = 'Metodologia da mentoria com especialista: 5 encontros e cinco funções.'
  where ordem = 2;
update public.materiais
  set titulo = 'Mensagem de preparação do mentorado',
      descricao = 'Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.'
  where ordem = 10;
update public.materiais
  set titulo = 'Instrumento: Construindo a sua Visão',
      descricao = 'Tarefa individual entre o 1º e o 2º encontro; origina a Declaração de Visão.'
  where ordem = 11;
update public.materiais
  set titulo = 'Mensagem às pessoas indicadas',
      descricao = 'Modelo de contato para a avaliação por terceiros (duas perguntas).'
  where ordem = 12;
update public.materiais
  set titulo = 'Consolidação da avaliação por terceiros'
  where ordem = 13;
update public.materiais
  set descricao = 'Documento central da dupla: visão, metas SMART, indicadores e mapa de submetas.'
  where ordem = 14;
update public.materiais
  set descricao = 'Modelo curto para manter o vínculo e deixar a próxima tarefa clara.'
  where ordem = 15;
update public.materiais
  set titulo = 'Roda da Vida: roteiro de aplicação',
      descricao = 'Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.'
  where ordem = 16;
update public.materiais
  set titulo = 'Checklist de competências do mentor',
      descricao = 'Autoavaliação antes do ciclo e novamente no 16º encontro.'
  where ordem = 17;
update public.materiais
  set titulo = 'Autoavaliação do mentor',
      descricao = 'Cinco perguntas de reflexão para o encerramento do ciclo.'
  where ordem = 18;
update public.materiais
  set descricao = 'Onde os encontros oficiais são agendados e avaliados.'
  where ordem = 20;
update public.materiais
  set titulo = 'Formação EaD gratuita'
  where ordem = 21;

-- ----- registros.atividades: normaliza opções do form semanal (ver ATIVIDADES_ENCONTRO) -----
update public.registros
  set atividades = array_replace(atividades, 'Orientacao individual', 'Orientação individual')
  where 'Orientacao individual' = any(atividades);
update public.registros
  set atividades = array_replace(atividades, 'Atividade pratica', 'Atividade prática')
  where 'Atividade pratica' = any(atividades);
update public.registros
  set atividades = array_replace(atividades, 'Desenvolvimento de competencia', 'Desenvolvimento de competência')
  where 'Desenvolvimento de competencia' = any(atividades);
update public.registros
  set atividades = array_replace(atividades, 'Identificacao de dificuldades', 'Identificação de dificuldades')
  where 'Identificacao de dificuldades' = any(atividades);
update public.registros
  set atividades = array_replace(atividades, 'Orientacao profissional', 'Orientação profissional')
  where 'Orientacao profissional' = any(atividades);
