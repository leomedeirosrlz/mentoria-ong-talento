-- campos estruturados do registro semanal (form "Avaliacao de Encontro Semanal - Mentores")
alter table public.registros
  add column atividades text[] not null default '{}',
  add column avaliacao text check (avaliacao in ('excelente', 'boa', 'regular', 'baixa')),
  add column dificuldade text check (dificuldade in
    ('nenhuma', 'aprendizagem', 'participacao', 'comportamental', 'organizacao', 'outro')),
  add column dificuldade_detalhe text,
  add column proximo_passo text check (proximo_passo in
    ('continuar', 'reforcar', 'novo_feedback', 'acompanhar_de_perto', 'conversa_individual', 'outro')),
  add column proximo_passo_detalhe text;
