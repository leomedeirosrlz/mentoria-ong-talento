-- 0130 · Avaliação final da mentoria, lado a lado (REALIZA-230)
--
-- A "avaliação 360º" do 0042 era UM formulário com 10 perguntas servido
-- igualmente ao mentor e ao mentorado. Os formulários oficiais do fim de
-- ciclo que o Leo mandou são DOIS instrumentos distintos:
--
--   · mentor  — 11 perguntas de processo/estrutura/suporte + o espaço dele
--     para falar do mentorado e do processo (Modelo "MENTOR - Formulário de
--     Avaliação Final da Mentoria");
--   · mentorado — 18 perguntas em seções (expectativas, processo, mentor,
--     impacto, críticas, depoimento) do Google Form "Formulário de
--     Avaliação Final da Mentoria" (form/1dPR32zgQNS4rKGizNmcY-…).
--
-- Decisão de desenho: dois sistemas novos, e o `avaliacao_360` fica
-- ARQUIVADO (`ativo=false`, definição intacta) como histórico legível.
-- Nenhuma resposta foi reinterpretada — a checagem em prod no dia mostrava
-- 0 links e 0 respostas do 360 (o instrumento nunca foi usado), então não
-- há dado antigo para preservar; e manter duas rows de sistema com
-- definições diferentes na mesma chave `avaliacao_360` apagaria a
-- separação por lado que os formulários têm.
--
-- As três funções que citavam o 360 por nome foram re-emitidas com o
-- mínimo de mudança (definição colhida do banco, não redigitada):
--
--   · submeter_resposta_formulario — o carimbo do checklist de encerramento
--     passa a valer para as duas vias novas (qualquer uma das duas
--     respostas marca "avaliação final enviada", como antes);
--   · jovem_jornada — a estação do encontro 16 passa a ler a entrega do
--     MENTORADO no sistema novo, mantendo a CHAVE `avaliacao_360` no
--     payload (é o que a jornada e o painel já consomem);
--   · painel_instrumentos_jornada — mesma troca de sistema, mesma chave.
--
-- O lado do mentor não entra na jornada nem no painel: a estação é a
-- entrega do jovem. A resposta dele fica na fila de respostas do
-- formulário (/formularios/<id>) e na ficha da dupla.

alter table public.formularios drop constraint formularios_sistema_check;

alter table public.formularios add constraint formularios_sistema_check
  check (sistema is null or sistema in (
    'avaliacao_360', 'visao', 'roda_vida', 'pdm', 'metas',
    'avaliacao_especialista', 'intake_mentor', 'intake_mentorado',
    'desfecho', 'avaliacao_final_mentor', 'avaliacao_final_mentorado'
  ));

-- o 360 fica como histórico: inativo, sem edição, fora da régua
update public.formularios set ativo = false where sistema = 'avaliacao_360';

-- ---------- seed: Avaliação final da mentoria · mentorado ----------
insert into public.formularios (id, titulo, descricao, campos, sistema)
values (
  '5eed0002-0000-4000-8000-000000000001',
  'Avaliação final da mentoria · mentorado',
  'O fechamento da jornada pelo lado do jovem: expectativas, processo, o mentor, o impacto percebido e o depoimento. A coordenação envia o link no encerramento da dupla.',
  '[
    {"id":"sec_expectativas","tipo":"secao","label":"Atingimento das expectativas","obrigatorio":false},
    {"id":"expectativa_atendida","tipo":"escala_1_5","label":"Em uma escala de 1 a 5, o quanto a mentoria atendeu às suas expectativas?","obrigatorio":true},
    {"id":"expectativas","tipo":"multi_select","label":"O que você esperava alcançar na mentoria?","obrigatorio":true,"opcoes":["Desenvolvimento profissional","Melhorar habilidades técnicas","Aumentar networking","Obter insights sobre o mercado"],"permite_outro":true},
    {"id":"sec_processo","tipo":"secao","label":"Avaliação do processo de mentoria","obrigatorio":false},
    {"id":"estrutura_programa","tipo":"select","label":"Como você avalia a estrutura do programa de mentoria?","obrigatorio":true,"opcoes":["Excelente","Boa","Regular","Ruim","Péssima"]},
    {"id":"aspectos_uteis","tipo":"multi_select","label":"Quais aspectos da mentoria você considerou mais úteis?","obrigatorio":true,"opcoes":["Sessões individuais com o mentor","Materiais de apoio fornecidos","Exercícios práticos","Feedback recebido","Troca de experiências com outros mentorados"]},
    {"id":"melhorar_opcoes","tipo":"multi_select","label":"O que poderia ser melhorado na mentoria?","obrigatorio":true,"opcoes":["Frequência dos encontros","Maior clareza nos objetivos da mentoria","Melhor comunicação com o mentor","Inclusão de conteúdos mais práticos"],"permite_outro":true},
    {"id":"sec_mentor","tipo":"secao","label":"Avaliação do mentor","obrigatorio":false},
    {"id":"avaliacao_mentor","tipo":"select","label":"Como você avalia a comunicação e o suporte do seu mentor?","obrigatorio":true,"opcoes":["Excelente","Boa","Regular","Ruim","Péssima"]},
    {"id":"mentor_ajudou","tipo":"select","label":"O mentor ajudou a esclarecer suas dúvidas e a desenvolver suas habilidades?","obrigatorio":true,"opcoes":["Sim","Parcialmente","Não"]},
    {"id":"recomendaria_mentor","tipo":"select","label":"Você recomendaria este mentor para outros mentorados?","obrigatorio":true,"opcoes":["Sim","Não"]},
    {"id":"sec_impacto","tipo":"secao","label":"Impacto e mudanças realizadas","obrigatorio":false},
    {"id":"mudancas_realizadas","tipo":"sim_nao","label":"Você realizou mudanças na sua vida profissional ou pessoal por causa da mentoria?","obrigatorio":true},
    {"id":"quais_mudancas","tipo":"multi_select","label":"Se sim, quais mudanças você realizou?","obrigatorio":true,"opcoes":["Mudei minha forma de buscar emprego ou oportunidades","Aprimorei minhas habilidades profissionais","Consegui um novo emprego ou promoção","Ampliei meu networking"],"permite_outro":true,"visible_if":{"campo":"mudancas_realizadas","em":["sim"]}},
    {"id":"mais_preparado","tipo":"select","label":"Você se sente mais preparado para enfrentar desafios depois da mentoria?","obrigatorio":true,"opcoes":["Sim","Parcialmente","Não"]},
    {"id":"sec_criticas","tipo":"secao","label":"Críticas e sugestões","obrigatorio":false},
    {"id":"melhorias_programa","tipo":"multi_select","label":"Quais pontos podem ser melhorados no programa de mentoria?","obrigatorio":true,"opcoes":["Melhor estruturação dos encontros","Maior diversidade de mentores","Mais materiais complementares","Melhor acompanhamento do progresso"],"permite_outro":true},
    {"id":"sec_depoimento","tipo":"secao","label":"Depoimento final","obrigatorio":false},
    {"id":"depoimento_texto","tipo":"texto_longo","label":"Você gostaria de deixar um depoimento sobre sua experiência?","obrigatorio":true},
    {"id":"depoimento","tipo":"select","label":"Podemos divulgar seu depoimento em nossos materiais de comunicação?","obrigatorio":true,"opcoes":["Sim, com meu nome","Sim, mas de forma anônima","Não"]}
  ]'::jsonb,
  'avaliacao_final_mentorado'
);

-- ---------- seed: Avaliação final da mentoria · mentor ----------
-- as duas últimas perguntas do mentorado ("espaço do mentor") moram aqui,
-- na voz de quem responde; e a continuidade no próximo ciclo entra como
-- pergunta explícita — depois da 0128 é o único lugar que captura esse dado.
insert into public.formularios (id, titulo, descricao, campos, sistema)
values (
  '5eed0002-0000-4000-8000-000000000002',
  'Avaliação final da mentoria · mentor',
  'O fechamento da jornada pelo lado de quem mentora: estrutura e processo, dificuldades, suporte do Realiza.vc, continuidade e depoimento.',
  '[
    {"id":"sec_processo","tipo":"secao","label":"Avaliação do processo de mentoria","obrigatorio":false},
    {"id":"estrutura_programa","tipo":"select","label":"Como você avalia a estrutura do programa de mentoria?","obrigatorio":true,"opcoes":["Excelente","Boa","Regular","Ruim","Péssima"]},
    {"id":"melhorar_processo","tipo":"texto_longo","label":"Você acha que tem algo que poderia ser melhorado no processo de mentoria?","obrigatorio":true},
    {"id":"dificuldade_material","tipo":"texto_longo","label":"Seu mentorado teve dificuldades ligadas a questões materiais para participar da mentoria (acesso a computadores, internet, local com privacidade)? Se sim, especifique.","obrigatorio":true},
    {"id":"dificuldade_agenda","tipo":"texto_longo","label":"Você teve dificuldades de agendar horários ou realizar os encontros com seu mentorado? Se sim, descreva os principais motivos.","obrigatorio":true},
    {"id":"dificuldade_metodologia","tipo":"texto_longo","label":"Você sentiu dificuldade em realizar alguma parte específica da metodologia com seu mentorado? Se sim, conte a respeito.","obrigatorio":true},
    {"id":"instrumentos_problematicos","tipo":"texto_longo","label":"Algum dos instrumentos ou atividades da metodologia se mostrou problemático, ou foi difícil fazer o mentorado chegar a uma resposta a contento? Se sim, conte mais.","obrigatorio":true},
    {"id":"melhorias_metodologia","tipo":"texto_longo","label":"Tem algum outro aspecto da metodologia que não funcionou bem ou que pode ser aprimorado?","obrigatorio":true},
    {"id":"sec_suporte","tipo":"secao","label":"Suporte do Realiza.vc","obrigatorio":false},
    {"id":"avaliacao_suporte","tipo":"select","label":"Como você avalia o suporte recebido do Realiza.vc ao longo do ciclo?","obrigatorio":true,"opcoes":["Excelente","Boa","Regular","Ruim","Péssima"]},
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
    {"id":"depoimento","tipo":"select","label":"Podemos divulgar seu depoimento em nossos materiais de comunicação?","obrigatorio":true,"opcoes":["Sim, com meu nome","Sim, mas de forma anônima","Não"]}
  ]'::jsonb,
  'avaliacao_final_mentor'
);

-- ---------- funções re-emitidas (definição colhida do banco) ----------

CREATE OR REPLACE FUNCTION public.submeter_resposta_formulario(p_token text, p_respostas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
  v_nome text;
  v_total int;
  v_dia int;
begin
  select fl.id, fl.usado_em, fl.expira_em, fl.multi_uso,
         fl.dupla_id, fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo as f_titulo, f.sistema as f_sistema,
         f.ativo as f_ativo, f.campos
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- gate de identidade (0070): autenticado não responde link de outra pessoa
  if auth.uid() is not null
     and ((l.dest_profile_id is not null
           and l.dest_profile_id is distinct from public.my_profile_id())
       or (l.dest_mentorado_id is not null
           and l.dest_mentorado_id is distinct from public.my_mentorado_id())) then
    raise exception 'este link é de outra pessoa';
  end if;

  -- idempotente: já respondido devolve a resposta existente. Link de
  -- intake nunca carimba usado_em, então nunca cai aqui — o guard de
  -- baixo confirma.
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r
     where r.link_id = l.id
     order by r.respondido_em desc
     limit 1;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  -- tetos do link reutilizável (0115): 500 respostas no total e 50 por
  -- dia (anti-spam do link público divulgado). A contagem roda sob
  -- advisory lock por link — sem ele dois submits concorrentes liam o
  -- mesmo total e os dois passavam por cima do teto
  if l.multi_uso then
    perform pg_advisory_xact_lock(
      hashtext('form-intake:' || l.id::text)::bigint);
    select count(*) into v_total
      from formulario_respostas where link_id = l.id;
    if v_total >= 500 then
      raise exception 'Este link atingiu o limite de respostas.';
    end if;
    select count(*) into v_dia
      from formulario_respostas
     where link_id = l.id
       and respondido_em >=
           (date_trunc('day', now() at time zone 'America/Sao_Paulo')
              at time zone 'America/Sao_Paulo');
    if v_dia >= 50 then
      raise exception 'Recebemos muitas inscrições hoje. Tente enviar de novo amanhã.';
    end if;
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas, l.id);

  -- link manual: carimba usado_em e trava o reuso (o gate `and usado_em
  -- is null` mantém a idempotência sob concorrência). Link de intake:
  -- nada de carimbo — a resposta_unica_guard ignora multi_uso e a tabela
  -- aceita N linhas por link
  if not l.multi_uso then
    update formulario_links
       set usado_em = now(),
           respondido_por_profile_id = public.my_profile_id()
     where id = l.id and usado_em is null;
    if not found then
      select r.id into v_id from formulario_respostas r
       where r.link_id = l.id;
      return v_id;
    end if;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;

  -- wiring 360º (0042, restaurado): a resposta do instrumento oficial
  -- carimba o checklist do encerramento da dupla. Só UPDATE, nunca INSERT —
  -- a row nasce pela autoavaliação do mentor ou pela decisão da coordenação.
  -- `decidido_por is null` evita reescrever registro fechado e o falso-
  -- positivo do trigger encerramentos_decisor quando o respondente é um
  -- mentor logado (my_profile_id() lê o JWT do caller mesmo no definer).
  if l.f_sistema in ('avaliacao_final_mentor', 'avaliacao_final_mentorado')
     and l.dupla_id is not null then
    update encerramentos
       set checklist = checklist || '{"avaliacao_360_enviada":true}'::jsonb
     where dupla_id = l.dupla_id
       and decidido_por is null;
  end if;

  -- projeção no PDM vivo (0109): visao/metas/pdm alimentam o documento
  -- relacional da dupla além do snapshot jsonb (que fica intacto). Bloco
  -- protegido: a projeção é re-jogável e nunca pode derrubar a entrega —
  -- mapa com >20 linhas, teto de metas ou dado legado estranho viram
  -- warning no log, não resposta perdida.
  if l.f_sistema in ('visao', 'metas', 'pdm') and l.dupla_id is not null then
    begin
      perform public.pdm_projeta_resposta(l.dupla_id, l.f_sistema, v_limpo);
    exception when others then
      raise warning 'pdm: projeção da resposta % (% na dupla %) falhou: %',
        v_id, l.f_sistema, l.dupla_id, sqlerrm;
    end;
  end if;

  -- toda resposta avisa a coordenação (0042, restaurado) — mentorado não
  -- tem login, o sino é como a equipe fica sabendo. No link de intake o
  -- nome sai da própria resposta (nome_civil) pra notificação já chegar
  -- contextualizada. O insert roda como owner da função, então a policy
  -- notificacoes_insert não se aplica a este caminho; o CHECK de tipo
  -- cobre o vocabulário.
  v_nome := coalesce(
    (select nome from profiles where id = l.dest_profile_id),
    (select nome from mentorados where id = l.dest_mentorado_id),
    case when l.multi_uso then nullif(v_limpo ->> 'nome_civil', '') end
  );
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  select c.id,
         'formulario_respondido',
         'Resposta de formulário',
         case
           when v_nome is not null
             then v_nome || ' respondeu "' || l.f_titulo || '"'
           else 'Chegou uma resposta de "' || l.f_titulo || '"'
         end,
         '/formularios/' || l.f_id,
         l.dest_profile_id
    from profiles c
   where c.role = 'coordenacao' and c.ativo
     -- quem respondeu não se notifica (coord testando o próprio form)
     and c.id is distinct from l.dest_profile_id;

  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.jovem_jornada()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ment uuid;
  v_dupla record;
begin
  -- mesmo gate da view jovem_duplas (0067): papel mentorado + id próprio
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  -- a dupla DPP mais recente (reemparelhamento cria outra linha; trilhas
  -- de especialista não carregam a jornada do guia)
  select d.id, d.mentor_id, d.mentorado_id, d.cronograma_id
    into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   -- dupla viva primeiro; depois a mais recente. desc aqui seria NULLS
   -- FIRST — uma encerrada sem iniciada_em ganharia da ativa (0090/0092
   -- já usam nulls last pelo mesmo motivo)
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    -- jovem sem dupla: a página cai na biblioteca plana (comportamento atual)
    return null;
  end if;

  -- REALIZA-152: garante que toda janela aberta já tem link — a emissão
  -- deixa de depender do gesto manual do mentor/coord
  perform public.jornada_autoemit(v_dupla.id);

  return jsonb_build_object(
    'dupla_id', v_dupla.id,
    'cronograma', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', e.numero,
               'data', e.data,
               'tipo', e.tipo,
               'fase', e.fase,
               'instrumentos', e.instrumentos
             ) order by e.data)
        from ciclo_eventos e
       where e.cronograma_id = v_dupla.cronograma_id
    ), '[]'::jsonb),
    -- reusa a RPC da ficha: o gate interno revalida mentorado_id e o
    -- payload já traz contexto/created_at desde esta migration
    'instrumentos', public.instrumentos_da_dupla(v_dupla.id),
    'avaliacao_360', coalesce((
      select jsonb_agg(jsonb_build_object(
               'link_id', l.id,
               'token', l.token,
               'status', case
                 when l.usado_em is not null then 'respondido'
                 when l.expira_em is not null and l.expira_em < now()
                   then 'expirado'
                 else 'pendente' end,
               'respondido_em', r.respondido_em,
               'respostas', r.respostas,
               -- mesma whitelist de contexto (chaves de máquina apenas)
               'contexto', coalesce((
                 select jsonb_object_agg(cx.key, cx.value)
                   from jsonb_each(l.contexto) as cx(key, value)
                  where cx.key in ('origem','momento','encontro','dupla_id')
               ), '{}'::jsonb),
               'created_at', l.created_at,
               'expira_em', l.expira_em
             ) order by l.created_at)
        from formulario_links l
        join formularios f on f.id = l.formulario_id
        left join formulario_respostas r on r.link_id = l.id
       where f.sistema = 'avaliacao_final_mentorado'
         -- só o link da própria jovem: o 360º do mentor/terceiros da
         -- mesma dupla nunca aparece aqui
         and l.dest_mentorado_id = v_ment
         and (l.dupla_id = v_dupla.id or l.dupla_id is null)
    ), '[]'::jsonb)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.painel_instrumentos_jornada()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (
    public.my_role() = 'coordenacao'
    or public.has_papel('supervisor'::public.app_role)
  ) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'dupla_id', d.id,
        'turma', d.turma,
        'cronograma_id', d.cronograma_id,
        'mentor_id', d.mentor_id,
        'mentor_nome', coalesce(pm.nome_social, pm.nome),
        'mentorado_id', d.mentorado_id,
        'jovem_nome', coalesce(m.nome_social, m.nome),
        'entregas', coalesce((
          select jsonb_object_agg(x.sistema, x.entregas)
            from (
              select f.sistema,
                     jsonb_agg(jsonb_build_object(
                       'status', case
                         when l.usado_em is not null then 'respondido'
                         when l.expira_em is not null and l.expira_em < now()
                           then 'expirado'
                         else 'pendente' end,
                       'created_at', l.created_at,
                       'destino', case
                         when l.dest_mentorado_id is not null then 'mentorado'
                         else 'mentor' end,
                       -- momento (inicial×formal) via a mesma whitelist —
                       -- sem contexto o painel diverge da jornada no corte
                       'contexto', coalesce((
                         select jsonb_object_agg(cx.key, cx.value)
                           from jsonb_each(l.contexto) as cx(key, value)
                          where cx.key in ('origem','momento','encontro','dupla_id')
                       ), '{}'::jsonb)
                     ) order by l.created_at) as entregas
                from formularios f
                join formulario_links l
                  on l.formulario_id = f.id
                 and l.dupla_id = d.id
                 and (l.dest_mentorado_id = d.mentorado_id
                      or l.dest_profile_id = d.mentor_id)
               where f.sistema in ('visao','metas','pdm','roda_vida','avaliacao_final_mentorado')
               group by f.sistema
            ) x
        ), '{}'::jsonb),
        'avaliacoes_encontro', (
          select jsonb_build_object(
            'feitas', count(a.id),
            'realizados', count(e.id),
            -- posição real da dupla (não a da coorte): dupla tardia tem
            -- janela ainda aberta mesmo com a turma lá na frente
            'max_numero', max(e.numero)
          )
            from encontros e
            left join avaliacoes_encontro a on a.encontro_id = e.id
           where e.dupla_id = d.id
             and e.status = 'realizado'
        )
      )
      order by d.turma, coalesce(m.nome_social, m.nome)
    )
      from duplas d
      join profiles pm on pm.id = d.mentor_id
      join mentorados m on m.id = d.mentorado_id
     where d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
       and (
         public.my_role() = 'coordenacao'
         or public.supervisiona_dupla(d.id)
       )
  ), '[]'::jsonb);
end $function$;
