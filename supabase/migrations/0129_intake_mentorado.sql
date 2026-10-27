-- 0129 · Intake de mentorados nativo (REALIZA-229)
--
-- A via de mentores nasceu na 0115 (link multi-uso, tipos 'arquivo' e
-- 'grid_disponibilidade', carimbo de promoção). O enum 'intake_mentorado'
-- já está no CHECK desde então, mas nunca houve formulário do lado do
-- jovem — este arquivo fecha a via:
--
--   · formulario_respostas.promovido_mentorado_id — o carimbo da 0115 é FK
--     pra profiles e mentorado mora em mentorados. Promover uma resposta de
--     mentorado gravava uuid de mentorados numa FK de profiles → erro 23503,
--     e o finisher desfazia o insert. A coluna espelha o carimbo da outra
--     via e é o guard de "promovido uma vez só" (o plano da REALIZA-69 já
--     previa a coluna polimórfica; a via irmã ficou como está pra não
--     reescrever o histórico de mentores).
--   · seed do formulário oficial "Matching de Mentorados"
--     (sistema='intake_mentorado', UUID 5eed0001-…-0a) — perguntas
--     espelhadas do Google Form de origem (Modelo Mentorados_ dados para o
--     matching), com os ids que o prefill de src/lib/forms/intake.ts
--     consome. Sem grade de horários e sem documentos civis: o formulário
--     do jovem não pede nenhum dos dois (a grade é preenchida na ficha, na
--     hora do matching).
--
-- O link de inscrição não é semeado: a coordenação emite em
-- /formularios/<id> (criarLinkIntake, origem='intake' + multi_uso), igual
-- ao de mentores.

alter table public.formulario_respostas
  add column if not exists promovido_mentorado_id uuid
    references public.mentorados(id);

comment on column public.formulario_respostas.promovido_mentorado_id is
  'Carimbo da promoção: a resposta de intake virou o cadastro deste mentorado. Espelha promovido_profile_id (0115) na via de mentores.';

insert into public.formularios (id, titulo, descricao, campos, sistema)
values (
  '5eed0001-0000-4000-8000-00000000000a',
  'Matching de Mentorados',
  'Inscrição de mentorados do Programa de Mentoria Realiza. Os dados ficam na plataforma; a coordenação lê as inscrições e cadastra quem for selecionado.',
  '[
    {"id":"sec_dados","tipo":"secao","label":"Dados pessoais","obrigatorio":false},
    {"id":"nome_civil","tipo":"texto","label":"Nome completo civil","obrigatorio":true},
    {"id":"nome_social","tipo":"texto","label":"Nome social","obrigatorio":false},
    {"id":"nascimento","tipo":"data","label":"Data de nascimento","obrigatorio":true},
    {"id":"genero","tipo":"select","label":"Gênero","obrigatorio":true,"opcoes":["Cisgênero feminino","Cisgênero masculino","Transgênero","Não binário","Prefiro não informar"]},
    {"id":"cor_raca","tipo":"select","label":"Cor/raça","obrigatorio":true,"opcoes":["Negra","Branca","Amarela","Parda","Indígena"],"permite_outro":true},
    {"id":"cidade","tipo":"texto","label":"Estado/município de residência","obrigatorio":true},
    {"id":"sec_sobre","tipo":"secao","label":"Sobre você","obrigatorio":false},
    {"id":"hobbies","tipo":"texto_longo","label":"Hobbies","obrigatorio":true,"descricao":"Conte um pouco sobre eles"},
    {"id":"gostos","tipo":"texto_longo","label":"Coisas de que você mais gosta","obrigatorio":true},
    {"id":"esportes","tipo":"texto_longo","label":"Esportes","obrigatorio":true,"descricao":"Assistir ou também praticar"},
    {"id":"auto_descricao","tipo":"texto_longo","label":"Auto-descrição em um parágrafo","obrigatorio":true,"descricao":"Suas características mais marcantes"},
    {"id":"terceiros","tipo":"texto_longo","label":"Como amigos e familiares lhe descreveriam?","obrigatorio":true},
    {"id":"sec_contato","tipo":"secao","label":"Dados de contato","obrigatorio":false},
    {"id":"email","tipo":"texto","label":"E-mail","obrigatorio":true,"formato":"email"},
    {"id":"telefone","tipo":"texto","label":"Telefone","obrigatorio":true,"formato":"telefone"},
    {"id":"sec_mentoria","tipo":"secao","label":"A mentoria","obrigatorio":false},
    {"id":"objetivos","tipo":"texto_longo","label":"Objetivos e expectativa com o programa","obrigatorio":true},
    {"id":"pref_genero_mentor","tipo":"select","label":"Preferência de gênero do mentor","obrigatorio":true,"opcoes":["Mentor homem","Mentor mulher","Sem preferência"]},
    {"id":"curriculo","tipo":"arquivo","label":"Currículo","obrigatorio":true,"max_mb":10}
  ]'::jsonb,
  'intake_mentorado'
)
on conflict (id) do nothing;
