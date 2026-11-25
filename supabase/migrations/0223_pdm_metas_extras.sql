begin;

-- 0223 — PDM cascateado: submetas sob a meta + metas extras (REALIZA-512)
--
-- O form do PDM nasceu na 0080 com o "Mapa de submetas" num capítulo à
-- parte e metas 2–3 opcionais. A spec 011 pede o documento na ordem em
-- que a dupla o lê: cada submetas_N dentro da ficha da meta N, 3 metas
-- obrigatórias e até 5 extras no mesmo instrumento (teto 8 no form).
--
-- O que muda (só o template do oficial 'pdm', mesmo escape hatch da
-- 0118 — guard desabilita, campos literal, reabilita):
--   1) submetas_N sai do capítulo s_submetas e entra logo depois de
--      prazo_N — o renderer aninha pela convenção meta_N/submetas_N; a
--      seção s_submetas sai do template (forms editados que ainda a
--      tenham renderizam como capítulo de campos órfãos, sem duplicar).
--   2) meta_2/is_2/prazo_2 e meta_3/is_3/prazo_3 viram obrigatórias — as
--      "3 metas" do guia: meta sem IS e prazo não virava plano.
--   3) meta_4..8 + is_4..8 + prazo_4..8 + submetas_4..8 opcionais — o
--      "Nova meta" precisa dos ids declarados: formularios_limpa_respostas
--      itera o template e descarta chave fora dele.
--
-- Projeção inalterada: pdm_projeta_resposta (0211) já lê meta_N/is_N/
-- prazo_N/submetas_N em loop 1..10 — o envelope cobre as 8 metas do form
-- (o doc vivo aceita 10 por escrita manual). Respostas antigas intactas:
-- os ids 1..3 não mudam de nome nem de tipo, e o rascunho do form segue
-- casando id a id.

alter table public.formularios disable trigger formularios_sistema_guard;

update public.formularios
   set campos = '[
    {"id":"s_visao","tipo":"secao","label":"Visão e metas","obrigatorio":false,"descricao":"O norte da mentoria: a Declaração de Visão e as metas principais. Cada meta leva um indicador de sucesso (IS) e um prazo (P). Pra cada meta, pergunte \"o que eu preciso fazer pra conseguir isso?\": as respostas são as submetas do desdobramento, uma por linha. As 3 primeiras metas são obrigatórias; \"Nova meta\" abre espaço pra mais, até 8 no total."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Declaração de Visão","obrigatorio":true},
    {"id":"meta_1","tipo":"texto","label":"Meta 1","obrigatorio":true},
    {"id":"is_1","tipo":"texto","label":"Indicador de sucesso (IS) da meta 1","obrigatorio":true},
    {"id":"prazo_1","tipo":"data","label":"Prazo (P) da meta 1","obrigatorio":true},
    {"id":"submetas_1","tipo":"texto_longo","label":"Desdobramento da meta 1 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_2","tipo":"texto","label":"Meta 2","obrigatorio":true},
    {"id":"is_2","tipo":"texto","label":"Indicador de sucesso (IS) da meta 2","obrigatorio":true},
    {"id":"prazo_2","tipo":"data","label":"Prazo (P) da meta 2","obrigatorio":true},
    {"id":"submetas_2","tipo":"texto_longo","label":"Desdobramento da meta 2 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_3","tipo":"texto","label":"Meta 3","obrigatorio":true},
    {"id":"is_3","tipo":"texto","label":"Indicador de sucesso (IS) da meta 3","obrigatorio":true},
    {"id":"prazo_3","tipo":"data","label":"Prazo (P) da meta 3","obrigatorio":true},
    {"id":"submetas_3","tipo":"texto_longo","label":"Desdobramento da meta 3 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_4","tipo":"texto","label":"Meta 4","obrigatorio":false},
    {"id":"is_4","tipo":"texto","label":"Indicador de sucesso (IS) da meta 4","obrigatorio":false},
    {"id":"prazo_4","tipo":"data","label":"Prazo (P) da meta 4","obrigatorio":false},
    {"id":"submetas_4","tipo":"texto_longo","label":"Desdobramento da meta 4 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_5","tipo":"texto","label":"Meta 5","obrigatorio":false},
    {"id":"is_5","tipo":"texto","label":"Indicador de sucesso (IS) da meta 5","obrigatorio":false},
    {"id":"prazo_5","tipo":"data","label":"Prazo (P) da meta 5","obrigatorio":false},
    {"id":"submetas_5","tipo":"texto_longo","label":"Desdobramento da meta 5 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_6","tipo":"texto","label":"Meta 6","obrigatorio":false},
    {"id":"is_6","tipo":"texto","label":"Indicador de sucesso (IS) da meta 6","obrigatorio":false},
    {"id":"prazo_6","tipo":"data","label":"Prazo (P) da meta 6","obrigatorio":false},
    {"id":"submetas_6","tipo":"texto_longo","label":"Desdobramento da meta 6 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_7","tipo":"texto","label":"Meta 7","obrigatorio":false},
    {"id":"is_7","tipo":"texto","label":"Indicador de sucesso (IS) da meta 7","obrigatorio":false},
    {"id":"prazo_7","tipo":"data","label":"Prazo (P) da meta 7","obrigatorio":false},
    {"id":"submetas_7","tipo":"texto_longo","label":"Desdobramento da meta 7 (uma submeta por linha)","obrigatorio":false},
    {"id":"meta_8","tipo":"texto","label":"Meta 8","obrigatorio":false},
    {"id":"is_8","tipo":"texto","label":"Indicador de sucesso (IS) da meta 8","obrigatorio":false},
    {"id":"prazo_8","tipo":"data","label":"Prazo (P) da meta 8","obrigatorio":false},
    {"id":"submetas_8","tipo":"texto_longo","label":"Desdobramento da meta 8 (uma submeta por linha)","obrigatorio":false}
  ]'::jsonb,
      descricao = 'O documento central da mentoria (guia DPP §6): a Declaração de Visão com as metas principais, de 3 a 8 no mesmo plano — cada uma com indicador de sucesso (IS), prazo (P) e desdobramento em submetas sob a meta.',
      versao = versao + 1,
      updated_at = now()
 where sistema = 'pdm';

alter table public.formularios enable trigger formularios_sistema_guard;

commit;
