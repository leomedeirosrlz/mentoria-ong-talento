-- 0133 · Avaliação final do mentor: opções 1:1 com o Google Form vivo
--
-- A 0130 montou o lado do mentor pelo xlsx porque o Google Form respondia
-- 401. Lido ao vivo via Forms API (forms.body.readonly), duas listas
-- divergem das opções oficiais:
--
--   · Q8 (suporte do Realiza.vc): "Ótimo./Bom./Regular./Ruim./Péssimo."
--     e não a escala Excelente…Péssima da Q1;
--   · consentimento de divulgação: "Sim, com o meu nome." / "Sim, porém
--     de forma anônima." / "Não." — redação oficial, não a variante do
--     form do mentorado ("mas de forma anônima").
--
-- O que NÃO muda: `continua_proximo_ciclo` (pergunta da plataforma —
-- decisão registrada na 0130) e `comentarios_mentorado`/`experiencia_processo`
-- (a seção "espaço reservado mentor" existe no form vivo do MENTORADO e foi
-- movida pra cá, na voz de quem responde). 0 respostas em prod — troca de
-- definição, não reinterpretação de dado.
--
-- O guard 0042 congela `campos` em rows de sistema por design — a correção
-- da definição oficial é a própria decisão aqui, então o trigger é suspenso
-- só nesta transação (mesmo padrão das 0109/0118/0128).

begin;

alter table public.formularios disable trigger formularios_sistema_guard;

update public.formularios
set campos = '[
    {"id":"sec_processo","tipo":"secao","label":"Avaliação do processo de mentoria","obrigatorio":false},
    {"id":"estrutura_programa","tipo":"select","label":"Como você avalia a estrutura do programa de mentoria?","obrigatorio":true,"opcoes":["Excelente","Boa","Regular","Ruim","Péssima"]},
    {"id":"melhorar_processo","tipo":"texto_longo","label":"Você acha que tem algo que poderia ser melhorado no processo de mentoria?","obrigatorio":true},
    {"id":"dificuldade_material","tipo":"texto_longo","label":"Seu mentorado teve dificuldades ligadas a questões materiais para participar da mentoria (acesso a computadores, internet, local com privacidade)? Se sim, especifique.","obrigatorio":true},
    {"id":"dificuldade_agenda","tipo":"texto_longo","label":"Você teve dificuldades de agendar horários ou realizar os encontros com seu mentorado? Se sim, descreva os principais motivos.","obrigatorio":true},
    {"id":"dificuldade_metodologia","tipo":"texto_longo","label":"Você sentiu dificuldade em realizar alguma parte específica da metodologia com seu mentorado? Se sim, conte a respeito.","obrigatorio":true},
    {"id":"instrumentos_problematicos","tipo":"texto_longo","label":"Algum dos instrumentos ou atividades da metodologia se mostrou problemático, ou foi difícil fazer o mentorado chegar a uma resposta a contento? Se sim, conte mais.","obrigatorio":true},
    {"id":"melhorias_metodologia","tipo":"texto_longo","label":"Tem algum outro aspecto da metodologia que não funcionou bem ou que pode ser aprimorado?","obrigatorio":true},
    {"id":"sec_suporte","tipo":"secao","label":"Suporte do Realiza.vc","obrigatorio":false},
    {"id":"avaliacao_suporte","tipo":"select","label":"Como você avalia o suporte recebido do Realiza.vc ao longo do ciclo de mentoring?","obrigatorio":true,"opcoes":["Ótimo","Bom","Regular","Ruim","Péssimo"]},
    {"id":"sugestao_suporte","tipo":"texto_longo","label":"Tem algum suporte ou atividade que você considera importante o Realiza disponibilizar ou aprimorar?","obrigatorio":true},
    {"id":"sec_mentoria","tipo":"secao","label":"A mentoria","obrigatorio":false},
    {"id":"dificuldades_mentoria","tipo":"texto_longo","label":"Quais foram as principais dificuldades e desafios enfrentados na mentoria?","obrigatorio":true},
    {"id":"consideracoes","tipo":"texto_longo","label":"Espaço livre para considerações e sugestões sobre a metodologia, o programa, o instituto — o que desejar.","obrigatorio":false},
    {"id":"sec_continuidade","tipo":"secao","label":"Próximo ciclo","obrigatorio":false},
    {"id":"continua_proximo_ciclo","tipo":"sim_nao","label":"Você quer continuar como mentor ou mentora no próximo ciclo?","obrigatorio":true},
    {"id":"sec_espaco_mentor","tipo":"secao","label":"Espaço do mentor","obrigatorio":false},
    {"id":"comentarios_mentorado","tipo":"texto_longo","label":"Compartilhe seus comentários sobre o mentorado.","obrigatorio":false},
    {"id":"experiencia_processo","tipo":"texto_longo","label":"Compartilhe sua experiência com o processo, críticas e sugestões.","obrigatorio":false},
    {"id":"sec_depoimento","tipo":"secao","label":"Depoimento","obrigatorio":false},
    {"id":"depoimento","tipo":"select","label":"Podemos divulgar seu depoimento em nossos materiais de comunicação?","obrigatorio":true,"opcoes":["Sim, com o meu nome.","Sim, porém de forma anônima.","Não."]}
  ]'::jsonb
where id = '5eed0002-0000-4000-8000-000000000002'
  and sistema = 'avaliacao_final_mentor';

alter table public.formularios enable trigger formularios_sistema_guard;

commit;
