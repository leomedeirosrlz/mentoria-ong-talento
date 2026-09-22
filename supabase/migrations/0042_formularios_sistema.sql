-- 0042: formulários-oficiais do programa + wiring de domínio na engine de
-- formulários (0036).
--
-- `formularios.sistema` marca a definição oficial de um instrumento do guia
-- DPP — vocabulário fechado: 'anamnese' (Anamnese Social, respondida pelo
-- jovem antes da mentoria), 'avaliacao_360' (a avaliação formal de fim de
-- ciclo, enviada pela coordenação a mentor e mentorado) e
-- 'autoavaliacao_mentor' (as 5 perguntas do cap. 14). Um por instrumento:
-- índice único parcial.
--
-- Definição oficial é catálogo, não documento da coordenação — por isso a
-- proteção mora em TRIGGER e não em policy: RLS decide por row e não por
-- coluna; uma policy "sistema is null" impediria até encerrar/reativar a
-- coleta (ativo), que é operação legítima. O guard congela só a definição
-- (titulo/descricao/campos/versao/sistema), libera o estado operacional e
-- barra o delete. No INSERT, `my_role() is not null` separa o app (sessão
-- com papel) do contexto de migration/admin (sem JWT → null): form oficial
-- só nasce por SQL versionado.
--
-- Dois wirings novos no submit público (RPC definer, roda como owner —
-- updates/inserts cirúrgicos por desenho):
--   · resposta de form 'avaliacao_360' com link.dupla_id → carimba
--     encerramentos.checklist {avaliacao_360_enviada}. O WHERE
--     `decidido_por is null` é dupla proteção: encerramento decidido é
--     registro fechado E o trigger encerramentos_decisor leria o papel do
--     caller (ex.: mentor autenticado) como tentativa de forjar o decisor.
--   · toda resposta notifica a coordenação ('formulario_respondido') —
--     mentorado não tem login, o sino é como a equipe fica sabendo.

begin;

-- ---------- 1) coluna + guard ----------

alter table public.formularios
  add column sistema text
  check (sistema in ('anamnese', 'avaliacao_360', 'autoavaliacao_mentor'));

-- um oficial por instrumento — o seed e as queries assumem unicidade
create unique index formularios_sistema_uk
  on public.formularios (sistema) where sistema is not null;

create or replace function public.guard_formulario_sistema()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.sistema is not null then
      raise exception 'Formulário oficial do programa não pode ser excluído';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- sistema só entra via migration (sem JWT → my_role() null); um insert
    -- de app com sistema preenchido forjaria um "oficial" que não é
    if new.sistema is not null and public.my_role() is not null then
      raise exception 'Formulários oficiais do programa nascem por migração — crie um formulário comum';
    end if;
    return new;
  end if;

  -- UPDATE: definição congelada em rows de sistema; `ativo` e `updated_at`
  -- seguem livres (encerrar/reativar a coleta é decisão da coordenação)
  if old.sistema is not null and (
    new.titulo is distinct from old.titulo
    or new.descricao is distinct from old.descricao
    or new.campos is distinct from old.campos
    or new.sistema is distinct from old.sistema
    or new.versao is distinct from old.versao
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'A definição de um formulário oficial não pode ser editada';
  end if;
  -- e ninguém promove um form comum a oficial depois de criado
  if old.sistema is null and new.sistema is not null then
    raise exception 'Formulários oficiais do programa nascem por migração';
  end if;
  return new;
end $$;

drop trigger if exists formularios_sistema_guard on public.formularios;
create trigger formularios_sistema_guard
  before insert or update or delete on public.formularios
  for each row execute function public.guard_formulario_sistema();

-- ---------- 2) instrumentos oficiais (guia DPP) ----------
-- Estrutura derivada dos textos-fonte (docs/fontes): a Anamnese Social levanta
-- contexto de vida, estudo/trabalho, rede de apoio e expectativas do jovem;
-- a Avaliação 360º (cap. 12/16º encontro) cobre vínculo, evolução, PDM/Roda
-- da Vida, experiência com o programa e disponibilidade do mentor pro
-- próximo ciclo; a Autoavaliação é o roteiro do cap. 14. Ids estáveis pras
-- perguntas — respostas apontam pra eles.
-- `on conflict do nothing`: idempotente — reler a migration não duplica e
-- não sobrescreve um oficial que já exista.

insert into public.formularios (id, titulo, descricao, campos, sistema) values
(
  '5eed0001-0000-4000-8000-000000000001',
  'Anamnese Social',
  'Ficha de conhecimento do(a) jovem, respondida antes do início da mentoria — quem você é, como é sua vida e o que espera do programa. Ajuda a coordenação no pareamento e orienta o trabalho do(a) mentor(a).',
  '[
    {"id":"quem_mora","tipo":"texto_longo","label":"Quem mora com você? Como é a convivência em casa?","obrigatorio":true},
    {"id":"territorio","tipo":"texto","label":"Em que bairro ou comunidade você mora?","obrigatorio":true},
    {"id":"estuda","tipo":"sim_nao","label":"Você está estudando atualmente?","obrigatorio":true},
    {"id":"trabalha","tipo":"sim_nao","label":"Você está trabalhando atualmente?","obrigatorio":true},
    {"id":"onde_estuda_trabalha","tipo":"texto","label":"Onde você estuda ou trabalha? (escola, curso, emprego)","obrigatorio":false},
    {"id":"rotina","tipo":"texto_longo","label":"Como é um dia comum na sua semana?","obrigatorio":false},
    {"id":"rede_apoio","tipo":"multi_select","label":"Quem são as pessoas que te apoiam hoje?","obrigatorio":true,"opcoes":["Família","Amigos","Professores","Pessoas da ONG ou projeto social","Líderes religiosos ou comunitários","Outros"]},
    {"id":"gosta","tipo":"texto_longo","label":"O que você mais gosta de fazer? (hobbies, esportes, programas)","obrigatorio":false},
    {"id":"te_descreveriam","tipo":"texto_longo","label":"Se seus amigos ou familiares fossem te descrever, o que diriam?","obrigatorio":false},
    {"id":"expectativas","tipo":"texto_longo","label":"O que você espera da mentoria? O que quer conquistar com ela?","obrigatorio":true},
    {"id":"pref_genero_mentor","tipo":"select","label":"Você tem preferência sobre o gênero da pessoa que vai te mentorar?","obrigatorio":true,"opcoes":["Sem preferência","Mulher","Homem"]},
    {"id":"algo_mais","tipo":"texto_longo","label":"Tem algo mais que a gente deveria saber sobre você?","obrigatorio":false}
  ]'::jsonb,
  'anamnese'
),
(
  '5eed0001-0000-4000-8000-000000000002',
  'Avaliação 360º',
  'A avaliação formal de encerramento do ciclo, respondida por mentor(a) e mentorado(a): o vínculo construído, a evolução do(a) jovem, os resultados do PDM e da Roda da Vida e a experiência com o programa.',
  '[
    {"id":"vinculo","tipo":"escala_1_5","label":"Como você avalia o vínculo construído entre vocês ao longo da jornada?","obrigatorio":true},
    {"id":"evolucao_jovem","tipo":"escala_1_5","label":"Quanto o(a) jovem evoluiu nos objetivos pessoais e profissionais durante o ciclo?","obrigatorio":true},
    {"id":"pdm_roda","tipo":"escala_1_5","label":"Que diferença o PDM e a Roda da Vida fizeram no desenvolvimento?","obrigatorio":true},
    {"id":"regularidade","tipo":"sim_nao","label":"Os encontros aconteceram com a regularidade combinada?","obrigatorio":true},
    {"id":"experiencia_programa","tipo":"escala_1_5","label":"Como foi a sua experiência com o Programa de Mentoria Social?","obrigatorio":true},
    {"id":"apoio_coordenacao","tipo":"escala_1_5","label":"Como você avalia o apoio da coordenação durante a jornada?","obrigatorio":false},
    {"id":"o_que_leva","tipo":"texto_longo","label":"O que você leva dessa jornada? (aprendizados, conquistas, marcas)","obrigatorio":true},
    {"id":"melhorar","tipo":"texto_longo","label":"O que o programa poderia melhorar?","obrigatorio":false},
    {"id":"disponivel_proximo_ciclo","tipo":"sim_nao","label":"Se você é o(a) mentor(a): segue disponível pro próximo ciclo?","obrigatorio":false},
    {"id":"capacidade_proximo_ciclo","tipo":"texto","label":"Se você é o(a) mentor(a): quantos jovens consegue acompanhar no próximo ciclo?","obrigatorio":false}
  ]'::jsonb,
  'avaliacao_360'
),
(
  '5eed0001-0000-4000-8000-000000000003',
  'Autoavaliação do mentor',
  'A reflexão de fim de ciclo do guia (cap. 14), respondida pelo(a) mentor(a) no encerramento da jornada.',
  '[
    {"id":"funcionou","tipo":"texto_longo","label":"O que eu fiz nesta mentoria que funcionou bem e quero repetir?","obrigatorio":true},
    {"id":"falei_mais","tipo":"texto_longo","label":"Em que momentos eu falei mais do que escutei?","obrigatorio":true},
    {"id":"competencias","tipo":"texto_longo","label":"Que competência do checklist evoluiu ao longo do ciclo? Qual ainda preciso desenvolver?","obrigatorio":true},
    {"id":"aprendi","tipo":"texto_longo","label":"O que aprendi com este(a) jovem?","obrigatorio":true},
    {"id":"faria_diferente","tipo":"texto_longo","label":"O que eu faria diferente em um próximo ciclo?","obrigatorio":true}
  ]'::jsonb,
  'autoavaliacao_mentor'
)
on conflict do nothing;

-- ---------- 3) RPCs públicas ----------

-- `sistema` entra no JSON do form — a tela pública sela o instrumento
-- oficial sem query de tabela (anon não tem grant de tabela, só de RPC)
create or replace function public.formulario_por_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_nome text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo, f.descricao, f.campos, f.ativo, f.versao,
         f.sistema
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(p.nome, m.nome) into v_nome
    from formulario_links fl
    left join profiles p on p.id = fl.dest_profile_id
    left join mentorados m on m.id = fl.dest_mentorado_id
    where fl.id = l.id;

  return jsonb_build_object(
    'status', case
      when l.usado_em is not null then 'respondido'
      when not l.ativo then 'inativo'
      when l.expira_em is not null and l.expira_em < now() then 'expirado'
      else 'pendente' end,
    'expira_em', l.expira_em,
    'respondido_em', l.usado_em,
    'destinatario', v_nome,
    'formulario', jsonb_build_object(
      'id', l.f_id,
      'titulo', l.titulo,
      'descricao', l.descricao,
      'campos', l.campos,
      'versao', l.versao,
      'sistema', l.sistema
    )
  );
end $$;

-- Submit: mesma RPC da 0036 (validação, idempotência via usado_em,
-- sanitização) + dois efeitos novos depois do insert da resposta. O select
-- inicial ganha as colunas que o wiring precisa (dupla, destinatário,
-- sistema/título).

create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
  v_nome text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
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

  -- idempotente: já respondido devolve a resposta existente
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas);

  update formulario_links set usado_em = now()
    where id = l.id and usado_em is null;
  if not found then
    -- perdeu a corrida: a resposta do vencedor já está gravada (ou vai
    -- estar no commit dele — o unique de link_id protege o pior caso)
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;

  -- wiring 360º: a resposta do instrumento oficial carimba o checklist do
  -- encerramento da dupla. Só UPDATE, nunca INSERT — a row nasce pela
  -- autoavaliação do mentor ou pela decisão da coordenação. `decidido_por
  -- is null` evita reescrever registro fechado e o falso-positivo do
  -- trigger encerramentos_decisor quando o respondente é um mentor logado
  -- (my_profile_id() lê o JWT do caller mesmo dentro do definer).
  if l.f_sistema = 'avaliacao_360' and l.dupla_id is not null then
    update encerramentos
       set checklist = checklist || '{"avaliacao_360_enviada":true}'::jsonb
     where dupla_id = l.dupla_id
       and decidido_por is null;
  end if;

  -- toda resposta avisa a coordenação — mentorado não tem login, o sino é
  -- como a equipe fica sabendo. O insert roda como owner da função, então a
  -- policy notificacoes_insert (escopo por papel do destinatário) não se
  -- aplica a este caminho; o CHECK de tipo cobre o vocabulário.
  v_nome := coalesce(
    (select nome from profiles where id = l.dest_profile_id),
    (select nome from mentorados where id = l.dest_mentorado_id)
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
end $$;

-- grants inalterados (create or replace preserva) — reafirmados por clareza
revoke all on function public.submeter_resposta_formulario(text, jsonb)
  from public;
grant execute on function public.submeter_resposta_formulario(text, jsonb)
  to anon, authenticated;

-- ---------- 4) novo tipo de notificação ----------
-- 0041 reescreve este CHECK — esta migration precisa reaplicá-lo com a lista
-- completa (supervisao_registrada + formulario_respondido) pra não perder
-- nenhum dos dois tipos.

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada',
    'especialista_aceitou', 'solicitacao_cancelada', 'trilha_encerrada',
    'supervisao_registrada', 'formulario_respondido'
  ));

commit;
