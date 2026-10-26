begin;

-- 0124 — REALIZA-216: desfecho de empregabilidade do jovem.
--
-- A plataforma media o processo (encontros, registros, instrumentos,
-- semáforo); aqui entra o resultado: o jovem estudando, trabalhando ou
-- empreendendo depois da mentoria. Um formulário oficial novo,
-- `sistema='desfecho'` ("Depois da mentoria"), respondido SÓ pelo jovem
-- em dois momentos:
--
--   * 'encerramento' — emitido sozinho quando a dupla DPP vira
--     'concluida' (qualquer caminho: fechamento automático do 0102 ou a
--     decisão manual da coordenação no rito de encerramento);
--   * '6m' — emitido pela coordenação em lote, 180+ dias depois da
--     conclusão, por e-mail e WhatsApp. NÃO é automático: é gesto humano
--     em cima da fila desfecho_elegiveis_6m().
--
-- Peças:
--   1) CHECK de formularios.sistema com 'desfecho' (superset vigente +
--      o novo sistema);
--   2) duplas.concluida_em — o relógio do 6m: carimbada no trigger de
--      transição (o update que vira 'concluida' é o único ponto comum a
--      todos os caminhos de fechamento);
--   3) seed do form oficial (3 perguntas do desenho — multi_select,
--      escala 1–5 e texto curto, tipos que a engine já suporta);
--   4) emitir_desfecho_core — interna, como emitir_instrumento_core:
--      um link vivo por (dupla, momento), resposta nunca re-emite;
--   5) trigger before update of status em duplas — carimba concluida_em
--      e emite o link 'encerramento' (trigger próprio, não extensão do
--      0102: menos invasivo que reabrir a função de fechamento e cobre
--      também a conclusão manual, que passa pelo mesmo update);
--   6) desfecho_elegiveis_6m — fila coord: concluídas há ≥180 dias sem
--      link 6m pendente nem respondido;
--   7) emitir_desfecho_6m_lote — molde da emitir_instrumento_lote (0114):
--      exceção explícita que aceita status='concluida' só pra este form;
--   8) desfecho_agregado — só contagens/médias com n mínimo 5 por
--      célula; entra na resposta do abrir_relatorio, pela mesma porta de
--      senha do /resumo. Nunca resposta individual nem texto livre.

-- ---------- 1) vocabulário de sistema + 'desfecho' ----------

alter table public.formularios
  drop constraint if exists formularios_sistema_check;
alter table public.formularios
  add constraint formularios_sistema_check check (
    sistema in (
      'anamnese', 'avaliacao_360', 'autoavaliacao_mentor',
      'visao', 'roda_vida', 'pdm', 'metas',
      'avaliacao_especialista',
      'intake_mentor', 'intake_mentorado',
      'desfecho'
    )
  );

-- ---------- 2) o relógio do 6 meses ----------

-- A dupla não tinha timestamp de conclusão: 0102 muda só status e o
-- encerramento formal (decisão da coordenação) pode vir dias depois —
-- a régua dos 180 dias é sobre a conclusão da jornada, não do rito.
alter table public.duplas
  add column if not exists concluida_em timestamptz;

comment on column public.duplas.concluida_em is
  'Carimbo da entrada em status=concluida (0124) — régua dos 180 dias do '
  'desfecho 6m. Gravado pelo trigger de transição; reabrir e reconcluir '
  're-carimba. Backfill: created_at da row de encerramentos (o rito '
  'abre no ato da conclusão).';

-- Backfill honesto: a row de encerramentos nasce no ato (0102 insere na
-- conclusão; o upsert do rito preserva o created_at original). Concluída
-- sem rito fica NULL — não entra na fila 6m até a coordenação olhar.
update public.duplas d
   set concluida_em = e.created_at
  from public.encerramentos e
 where e.dupla_id = d.id
   and d.status = 'concluida'
   and d.concluida_em is null;

-- ---------- 3) o formulário oficial ----------

insert into public.formularios (
  id, titulo, descricao, campos, sistema
) values (
  '5eed0001-0000-4000-8000-000000000010',
  'Depois da mentoria',
  'Conta pra gente como você está depois da jornada. Suas respostas servem para o Instituto medir se a mentoria ajuda e prestar contas a quem apoia o programa; publicamos só números agregados.',
  '[
    {"id":"situacao","tipo":"multi_select","label":"Hoje você está…","obrigatorio":true,"opcoes":["Estudando","Trabalhando com carteira (CLT)","Estágio","Jovem Aprendiz","Trabalhando sem carteira / bicos","Empreendendo","Procurando trabalho","Nenhuma das anteriores"],"descricao":"Pode marcar mais de uma opção"},
    {"id":"ajudou","tipo":"escala_1_5","label":"Quanto a mentoria ajudou nisso?","obrigatorio":true,"descricao":"1 = nada, 5 = muito"},
    {"id":"conquista","tipo":"texto","label":"Quer contar alguma conquista?","obrigatorio":false,"descricao":"Opcional"}
  ]'::jsonb,
  'desfecho'
)
on conflict (id) do nothing;

-- ---------- 4) emissão interna: um link vivo por (dupla, momento) ----------

-- Espelho do emitir_instrumento_core (0099) no recorte do desfecho: o
-- conjunto de regras é outro (aceita dupla concluída, momento vem do
-- chamador, destino é sempre o jovem), então fica numa função própria
-- em vez de alargar o core da jornada — que é justamente a fronteira
-- que segura o 360º/anamnese fora do caminho automático.
create or replace function public.emitir_desfecho_core(
  p_dupla_id uuid, p_momento text, p_created_by uuid,
  p_origem text default 'auto'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
begin
  if p_momento not in ('encerramento', '6m') then
    raise exception 'momento inválido';
  end if;

  -- serializa trigger × lote × re-clique: o reúso read-then-insert
  -- abaixo não se enxerga entre transações
  perform pg_advisory_xact_lock(
    hashtext('desfecho:' || p_dupla_id::text || ':' || p_momento));

  select d.id, d.mentorado_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  select f.id, f.ativo into v_form
    from formularios f
   where f.sistema = 'desfecho';
  if not found then
    raise exception 'formulário desfecho ainda não está cadastrado';
  end if;
  if not v_form.ativo then
    raise exception 'o formulário Depois da mentoria está encerrado';
  end if;

  -- resposta do momento já existe → nunca re-emite: a resposta é o
  -- produto, um link novo criaria segunda verdade no agregado
  if exists (
    select 1
      from formulario_links l
     where l.formulario_id = v_form.id
       and l.dupla_id = v_dupla.id
       and l.contexto ->> 'momento' = p_momento
       and l.usado_em is not null
  ) then
    return jsonb_build_object(
      'token', null, 'reutilizado', false, 'respondido', true);
  end if;

  -- link vivo do momento reusa (idempotente: re-rodar o lote não
  -- duplica nem gera token novo pra quem já tem um em aberto)
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and l.dupla_id = v_dupla.id
     and l.contexto ->> 'momento' = p_momento
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
   order by l.created_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'token', v_link.token, 'reutilizado', true);
  end if;

  insert into formulario_links (
    formulario_id, token, dest_mentorado_id, dupla_id, contexto,
    created_by
  ) values (
    v_form.id,
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    v_dupla.mentorado_id,
    v_dupla.id,
    jsonb_build_object('origem', p_origem, 'momento', p_momento),
    p_created_by
  )
  returning id, token into v_link;

  return jsonb_build_object(
    'token', v_link.token, 'reutilizado', false);
end $$;

revoke all on function public.emitir_desfecho_core(uuid, text, uuid, text)
  from public, anon, authenticated;

-- ---------- 5) transição pra 'concluida': carimbo + emissão ----------

-- Trigger próprio em duplas (não extensão do dupla_encerramento_auto do
-- 0102): o update de status é o único ponto comum a TODOS os caminhos —
-- o automático do último encontro, a decisão 'concluida' do rito e um
-- ajuste manual da coordenação. BEFORE pra carimbar concluida_em na
-- mesma escrita, sem segundo update.
create or replace function public.desfecho_emitir_encerramento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- toda entrada em 'concluida' re-carimba: uma dupla reaberta e
  -- reconcluída passa a contar os 180 dias da conclusão de verdade
  new.concluida_em := now();

  -- o desfecho é rito DPP — a trilha de especialista tem fechamento
  -- próprio (motivo + devolutiva), sem este form
  if new.trilha = 'dpp' then
    begin
      perform public.emitir_desfecho_core(
        new.id, 'encerramento', null, 'auto');
    exception when others then
      -- form ausente/encerrado não pode trancar o encerramento — a
      -- lacuna fica coberta pelo lote manual depois
      raise warning 'desfecho_emitir_encerramento(%): %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists duplas_desfecho_encerramento on public.duplas;
create trigger duplas_desfecho_encerramento
  before update of status on public.duplas
  for each row
  when (old.status is distinct from 'concluida' and new.status = 'concluida')
  execute function public.desfecho_emitir_encerramento();

-- ---------- 6) a fila dos 6 meses (coord-only) ----------

-- Concluídas DPP há ≥180 dias sem link '6m' pendente nem respondido.
-- O contato NÃO sai como valor (só flags tem_email): a action do lote
-- resolve e-mail/whatsapp no servidor, como na 0114 — o browser recebe
-- a fila sem credenciais.
create or replace function public.desfecho_elegiveis_6m()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(linha order by linha ->> 'jovem_nome')
      from (
        select jsonb_build_object(
          'dupla_id', d.id,
          'jovem_nome', coalesce(m.nome_social, m.nome),
          'mentor_nome', coalesce(p.nome_social, p.nome),
          'concluida_em', d.concluida_em,
          'jovem_tem_email',
            m.email is not null and btrim(m.email) <> '',
          'mentor_tem_email',
            p.email is not null and btrim(p.email) <> ''
        ) as linha
        from public.duplas d
        join public.mentorados m on m.id = d.mentorado_id
        join public.profiles p on p.id = d.mentor_id
       where d.status = 'concluida'
         and d.trilha = 'dpp'
         and d.concluida_em is not null
         and d.concluida_em <= now() - interval '180 days'
         and not exists (
           select 1
             from public.formulario_links l
             join public.formularios f on f.id = l.formulario_id
            where f.sistema = 'desfecho'
              and l.dupla_id = d.id
              and l.contexto ->> 'momento' = '6m'
              and (l.usado_em is not null
                   or l.expira_em is null
                   or l.expira_em > now())))
      q), '[]'::jsonb);
end $$;

revoke all on function public.desfecho_elegiveis_6m() from public, anon;
grant execute on function public.desfecho_elegiveis_6m() to authenticated;

-- ---------- 7) lote 6m — molde da emitir_instrumento_lote (0114) ----------

-- Exceção explícita do desenho: este é o único form emitido pra dupla
-- 'concluida' — a régua de "dupla viva" dos outros instrumentos aqui é
-- invertida (dupla_nao_concluida é o motivo de skip, não
-- dupla_encerrada). Responde uma linha por dupla pedida com os dados
-- server-side do jovem + mentor pra action mandar e-mail (o relatório
-- com contato nunca sai pra browser; a action devolve só os whatsapps
-- das linhas não-enviadas, idem 0114).
create or replace function public.emitir_desfecho_6m_lote(p_dupla_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_dupla_id uuid;
  v_dupla record;
  v_emit jsonb;
  v_link_id uuid;
  v_linha jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  if not public.has_papel('coordenacao'::public.app_role) then
    raise exception 'sem permissão pra emitir desfecho em lote';
  end if;
  -- mesmo cap anti-clique-gigante do lote de instrumentos (0114)
  if coalesce(array_length(p_dupla_ids, 1), 0) > 100 then
    raise exception 'lote acima do limite de 100 duplas por chamada';
  end if;
  if coalesce(array_length(p_dupla_ids, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  for v_dupla_id in
    select distinct u.id from unnest(p_dupla_ids) as u(id)
  loop
    -- select-into sem linha NÃO zera a variável — sem o reset ela
    -- carrega a dupla anterior (mesma armadilha da 0114)
    v_linha := null;
    v_link_id := null;
    select d.id, d.status, d.trilha, d.mentor_id, d.mentorado_id
      into v_dupla
      from public.duplas d
     where d.id = v_dupla_id;

    if not found then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'dupla_nao_encontrada');
      continue;
    end if;

    if v_dupla.trilha <> 'dpp' then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'trilha_especialista');
      continue;
    end if;

    -- a exceção é ESTREITA: concluída passa, todo o resto não — uma
    -- dupla ativa não recebe o 6 meses nem a encerrada recebe follow-up
    if v_dupla.status <> 'concluida' then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'dupla_nao_concluida');
      continue;
    end if;

    begin
      v_emit := public.emitir_desfecho_core(
        v_dupla_id, '6m', public.my_profile_id(), 'lote');
    exception when others then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'emit_falhou', 'erro', sqlerrm);
      continue;
    end;

    -- já respondida nunca re-emite (o core devolve respondido=true)
    if coalesce((v_emit ->> 'respondido')::boolean, false) then
      v_out := v_out || jsonb_build_object(
        'dupla_id', v_dupla_id, 'ok', false,
        'motivo', 'ja_respondido');
      continue;
    end if;

    -- ref_id do log de e-mail é o link, nunca o token (bearer no log
    -- seria credencial em repouso — convenção da 0114)
    select l.id into v_link_id
      from public.formulario_links l
     where l.token = v_emit ->> 'token';

    select jsonb_build_object(
        'dupla_id', v_dupla_id,
        'ok', true,
        'link_id', v_link_id,
        'token', v_emit ->> 'token',
        'reutilizado', coalesce((v_emit ->> 'reutilizado')::boolean, false),
        'jovem', jsonb_build_object(
          'nome', m.nome,
          'email', m.email,
          'whatsapp', m.whatsapp),
        'mentor', jsonb_build_object(
          'nome', p.nome,
          'email', p.email,
          'whatsapp', p.whatsapp)
      )
      into v_linha
      from public.mentorados m
      cross join public.profiles p
     where m.id = v_dupla.mentorado_id
       and p.id = v_dupla.mentor_id;

    v_out := v_out || coalesce(v_linha, jsonb_build_object(
      'dupla_id', v_dupla_id, 'ok', false,
      'motivo', 'emit_falhou', 'erro', 'destinatários incompletos'));
  end loop;

  return v_out;
end $$;

revoke all on function public.emitir_desfecho_6m_lote(uuid[])
  from public, anon;
grant execute on function public.emitir_desfecho_6m_lote(uuid[])
  to authenticated;

-- ---------- 8) o agregado: só números, n mínimo 5 por célula ----------

-- Retrato por momento ('encerramento' | '6m'): n, média de "quanto a
-- mentoria ajudou", % "estudando ou trabalhando" (qualquer das 6
-- situações positivas marcadas) e quebra % por situação. Abaixo do
-- mínimo a célula sai só com n + suficiente=false — média de 2
-- respondentes e quebra de 3 são leitura de indivíduo, não de
-- programa. p_cronograma=null é o programa inteiro.
create or replace function public.desfecho_agregado(
  p_cronograma uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_min constant int := 5;
  v_enc jsonb;
  v_6m jsonb;
  v_n int;
  v_media numeric;
  v_pos int;
  v_opcoes jsonb;
begin
  -- bloco por momento, uma passada por vez — evita CASE aninhado em
  -- IF (o splitter do CLI quebra com 'end' ambíguo)
  select count(*)::int,
         avg((r.respostas ->> 'ajudou')::numeric),
         count(*) filter (
           where r.respostas -> 'situacao' ?| array[
             'Estudando', 'Trabalhando com carteira (CLT)', 'Estágio',
             'Jovem Aprendiz', 'Trabalhando sem carteira / bicos',
             'Empreendendo'])::int
    into v_n, v_media, v_pos
    from public.formulario_respostas r
    join public.formulario_links l on l.id = r.link_id
    join public.formularios f on f.id = l.formulario_id
    join public.duplas d on d.id = l.dupla_id
   where f.sistema = 'desfecho'
     and l.contexto ->> 'momento' = 'encerramento'
     and (p_cronograma is null or d.cronograma_id = p_cronograma);

  v_n := coalesce(v_n, 0);
  if v_n >= v_min then
    select jsonb_agg(jsonb_build_object(
             'opcao', s.opcao,
             'n', s.n,
             'pct', round(s.n * 100.0 / v_n, 1))
             order by s.n desc, s.opcao)
      into v_opcoes
      from (
        select o.opcao, count(*)::int as n
          from public.formulario_respostas r
          join public.formulario_links l on l.id = r.link_id
          join public.formularios f on f.id = l.formulario_id
          join public.duplas d on d.id = l.dupla_id
          cross join lateral jsonb_array_elements_text(
            r.respostas -> 'situacao') as o(opcao)
         where f.sistema = 'desfecho'
           and l.contexto ->> 'momento' = 'encerramento'
           and (p_cronograma is null or d.cronograma_id = p_cronograma)
         group by o.opcao) s;
    v_enc := jsonb_build_object(
      'n', v_n, 'suficiente', true,
      'media_ajudou', round(v_media, 2),
      'pct_estudando_trabalhando', round(v_pos * 100.0 / v_n, 1),
      'opcoes', coalesce(v_opcoes, '[]'::jsonb));
  else
    v_enc := jsonb_build_object('n', v_n, 'suficiente', false);
  end if;

  select count(*)::int,
         avg((r.respostas ->> 'ajudou')::numeric),
         count(*) filter (
           where r.respostas -> 'situacao' ?| array[
             'Estudando', 'Trabalhando com carteira (CLT)', 'Estágio',
             'Jovem Aprendiz', 'Trabalhando sem carteira / bicos',
             'Empreendendo'])::int
    into v_n, v_media, v_pos
    from public.formulario_respostas r
    join public.formulario_links l on l.id = r.link_id
    join public.formularios f on f.id = l.formulario_id
    join public.duplas d on d.id = l.dupla_id
   where f.sistema = 'desfecho'
     and l.contexto ->> 'momento' = '6m'
     and (p_cronograma is null or d.cronograma_id = p_cronograma);

  v_n := coalesce(v_n, 0);
  if v_n >= v_min then
    select jsonb_agg(jsonb_build_object(
             'opcao', s.opcao,
             'n', s.n,
             'pct', round(s.n * 100.0 / v_n, 1))
             order by s.n desc, s.opcao)
      into v_opcoes
      from (
        select o.opcao, count(*)::int as n
          from public.formulario_respostas r
          join public.formulario_links l on l.id = r.link_id
          join public.formularios f on f.id = l.formulario_id
          join public.duplas d on d.id = l.dupla_id
          cross join lateral jsonb_array_elements_text(
            r.respostas -> 'situacao') as o(opcao)
         where f.sistema = 'desfecho'
           and l.contexto ->> 'momento' = '6m'
           and (p_cronograma is null or d.cronograma_id = p_cronograma)
         group by o.opcao) s;
    v_6m := jsonb_build_object(
      'n', v_n, 'suficiente', true,
      'media_ajudou', round(v_media, 2),
      'pct_estudando_trabalhando', round(v_pos * 100.0 / v_n, 1),
      'opcoes', coalesce(v_opcoes, '[]'::jsonb));
  else
    v_6m := jsonb_build_object('n', v_n, 'suficiente', false);
  end if;

  return jsonb_build_object('encerramento', v_enc, '6m', v_6m);
end $$;

revoke all on function public.desfecho_agregado(uuid) from public, anon, authenticated;
-- só a abrir_relatorio (definer) chama: o /resumo com senha é a porta única
-- do agregado — nenhum papel lê direto por REST

-- ---------- 9) o agregado entra na resposta do /resumo ----------

-- abrir_relatorio re-emitida VERBATIM da 0110 + o bloco 'desfecho' no
-- fim: mesmo portão de senha, mesmo log, mesma allowlist — a chave nova
-- carrega só números agregados já filtrados pelo n mínimo.
create or replace function public.abrir_relatorio(
  p_slug text,
  p_senha text,
  p_ip_hash text,
  p_ua text
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_link record;
  v_cfg jsonb;
  v_tipo text;
  v_turma text;
  v_cron uuid;
  v_cron_des uuid;
  v_doc text;
  v_st text;
  v_contato boolean;
  v_dados jsonb;
  v_profiles jsonb;
  v_mentorados jsonb;
  v_audit_fail boolean := false;
  v_n_ip bigint;
  v_n_slug bigint;
  v_min_ip timestamptz;
  v_min_slug timestamptz;
  v_retry timestamptz;
begin
  -- serializa tentativas por slug: a contagem do limite e o insert do log
  -- enxergam a mesma verdade sob concorrência (lock morre com a transação)
  if p_slug is not null then
    perform pg_advisory_xact_lock(hashtext('resumo:' || p_slug));
  end if;

  -- poda lazy de retenção (13 meses, decisão _decisoes.md — molde
  -- login_handoffs 0049): a RPC mais chamada carrega a manutenção
  begin
    delete from public.resumo_acessos
     where acessado_em < now() - interval '13 months';
  exception when others then
    v_audit_fail := true;
  end;

  select l.id, l.slug, l.titulo, l.senha_hash, l.config,
         l.expira_em, l.revogado_em
    into v_link
    from public.relatorio_links l
   where l.slug = p_slug;

  if not found then
    -- slug inexistente não vira linha: o log não é sensor de enumeração
    return jsonb_build_object('ok', false, 'motivo', 'sem_link');
  end if;

  -- gates de estado antes de qualquer custo de senha
  if v_link.revogado_em is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'revogado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'revogado', 'audit_fail', v_audit_fail);
  end if;
  if v_link.expira_em is not null and v_link.expira_em <= now() then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'expirado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'expirado', 'audit_fail', v_audit_fail);
  end if;

  -- rate-limit, dois eixos (o lock acima serializa contagem + insert):
  --   a) (slug, ip_hash): 5 falhas/15min — o ip_hash é fornecido pelo app,
  --      que o deriva de header confiável; via REST direto o argumento é
  --      forjável — por isso ele NÃO é o bound de segurança…
  --   b) slug global: 50 falhas/24h — este é o bound de verdade (sdr R1):
  --      nem mil IPs falsos passam dele.
  begin
    select count(*) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           count(*) filter (
             where a.acessado_em > now() - interval '24 hours'),
           min(a.acessado_em) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           min(a.acessado_em) filter (
             where a.acessado_em > now() - interval '24 hours')
      into v_n_ip, v_n_slug, v_min_ip, v_min_slug
      from public.resumo_acessos a
     where a.slug = p_slug and not a.ok;
  exception when others then
    -- fail-open por decisão: auditoria quebrada não pode transformar o
    -- relatório público inteiro em indisponível; audit_fail avisa o Sentry
    v_audit_fail := true;
    v_n_ip := 0;
    v_n_slug := 0;
  end;

  v_retry := null;
  if coalesce(v_n_ip, 0) >= 5 then
    v_retry := v_min_ip + interval '15 minutes';
  end if;
  if coalesce(v_n_slug, 0) >= 50 then
    v_retry := greatest(
      coalesce(v_retry, v_min_slug + interval '24 hours'),
      v_min_slug + interval '24 hours');
  end if;
  if v_retry is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'limite');
    return jsonb_build_object(
      'ok', false, 'motivo', 'limite',
      'retry_em', v_retry, 'audit_fail', v_audit_fail);
  end if;

  -- senha: bcrypt compara sem expor timing — IS DISTINCT FROM porque crypt
  -- devolve NULL com hash corrompido e NULL <> x avaliaria NULL (o IF
  -- trataria como falso e abriria o link). O sleep iguala a latência do
  -- erro à faixa do sucesso (o crypt de verdade custa ~80ms)
  if v_link.senha_hash is not null then
    if p_senha is null
       or extensions.crypt(p_senha, v_link.senha_hash)
          is distinct from v_link.senha_hash then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'senha');
      perform pg_sleep(0.3);
      return jsonb_build_object(
        'ok', false, 'motivo', 'senha', 'audit_fail', v_audit_fail);
    end if;
  end if;

  -- allowlist de tipos na leitura TAMBÉM: config 'respostas' forjado por
  -- SQL direto (bypass da RPC de criação) morre aqui, não na serialização
  v_cfg := v_link.config;
  v_tipo := v_cfg->>'tipo';
  if v_tipo is null or v_tipo not in ('grade', 'ciclo', 'assinaturas') then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
    return jsonb_build_object(
      'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
  end if;

  v_turma := nullif(v_cfg->>'turma', '');
  -- comparação textual, não cast: 'yes'::boolean explodiria a RPC com
  -- config forjado — '= ''true''' degrada pra false, que é o seguro
  v_contato := (v_cfg->>'expor_contato') = 'true';

  -- ---------------------------------------------------------- grade
  if v_tipo = 'grade' then
    -- participantes = mentores + auxiliares das duplas do recorte + a fila
    -- de espera da turma (turma_inscricoes, 0111). Sem select *: id, nome e
    -- cidade/uf são o que as linhas consomem; contato só entra no opt-in.
    if v_contato then
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf, p2.email, p2.whatsapp
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf, m2.email, m2.whatsapp
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    else
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    end if;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.mentor_id, d2.mentorado_id,
                 d2.supervisor_id, d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
        ) d), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'inscricoes', coalesce((
        select jsonb_agg(to_jsonb(i)) from (
          select i2.papel_esperado, i2.profile_id, i2.mentorado_id
            from public.turma_inscricoes i2
           where i2.status = 'aguardando' and i2.turma = v_turma
        ) i), '[]'::jsonb)
    ) into v_dados;

  -- ---------------------------------------------------------- ciclo
  elsif v_tipo = 'ciclo' then
    -- cronograma_id: uuid válido ou nada — um forjado não pode alargar o
    -- recorte nem explodir a RPC no cast
    if v_cfg->>'cronograma_id' is not null
       and (v_cfg->>'cronograma_id') !~
           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_cron := nullif(v_cfg->>'cronograma_id', '')::uuid;

    -- nomes só: o relatório de ciclo não tem coluna de contato, então
    -- email/whatsapp não atravessam nem com expor_contato forjado
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome from public.profiles p2
         where p2.id in (
           select d.mentor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
           union
           select d.supervisor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
              and d.supervisor_id is not null)
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select d.mentorado_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron))
      ) m;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.trilha, d2.cronograma_id,
                 d2.mentor_id, d2.mentorado_id, d2.supervisor_id,
                 d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
             and (v_cron is null or d2.cronograma_id = v_cron)
        ) d), '[]'::jsonb),
      'encontros', coalesce((
        select jsonb_agg(to_jsonb(e)) from (
          select e2.id, e2.dupla_id, e2.numero, e2.data_hora,
                 e2.realizado_em, e2.status, e2.motivo_reagendamento,
                 e2.duracao_min
            from public.encontros e2
           where e2.dupla_id in (
             select d3.id from public.duplas d3
              where (v_turma is null or d3.turma = v_turma)
                and (v_cron is null or d3.cronograma_id = v_cron))
        ) e), '[]'::jsonb),
      'registros', coalesce((
        select jsonb_agg(to_jsonb(r)) from (
          select r2.encontro_id, r2.created_at, r2.avaliacao,
                 -- texto livre (opção "outro" do form semanal) morre na
                 -- fronteira: só os valores do catálogo saem do banco —
                 -- ATIVIDADES_ENCONTRO de src/lib/ciclo.ts, duplicado de
                 -- propósito porque a fronteira é aqui, não na serialização
                 (select coalesce(array_agg(a), '{}'::text[])
                    from unnest(r2.atividades) a
                   where a = any (array[
                     'Conversa de acompanhamento',
                     'Orientação individual',
                     'Atividade prática',
                     'Desenvolvimento de competência',
                     'Acompanhamento de atividade/tarefa',
                     'Identificação de dificuldades',
                     'Orientação profissional'])) as atividades
            from public.registros r2
           where r2.encontro_id in (
             select e3.id from public.encontros e3
              join public.duplas d3 on d3.id = e3.dupla_id
             where (v_turma is null or d3.turma = v_turma)
               and (v_cron is null or d3.cronograma_id = v_cron))
        ) r), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'cronogramas', coalesce((
        select jsonb_agg(to_jsonb(c)) from (
          select c2.id, c2.nome from public.cronogramas c2
           where c2.id in (
             select d4.cronograma_id from public.duplas d4
              where (v_turma is null or d4.turma = v_turma)
                and (v_cron is null or d4.cronograma_id = v_cron)
                and d4.cronograma_id is not null)
        ) c), '[]'::jsonb)
    ) into v_dados;

  -- ------------------------------------------------------- assinaturas
  else
    if v_cfg->>'status_assinatura' is not null
       and (v_cfg->>'status_assinatura') not in
           ('pendente','assinado','revogado','expirado') then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_doc := nullif(v_cfg->>'documento', '');
    v_st := nullif(v_cfg->>'status_assinatura', '');

    -- O que NÃO sai: dados_snapshot (CPF/RG/endereço), assinatura_texto,
    -- ip/user_agent, hash_documento, token — a linha pública é nome +
    -- documento + status + datas, como o CSV interno menos a evidência.
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome, p2.role from public.profiles p2
         where p2.id in (
           select a.profile_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.profile_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st)
           union
           select a.created_by from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.created_by is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select a.mentorado_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.mentorado_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) m;

    select jsonb_build_object(
      'assinaturas', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
          select a2.id, a2.profile_id, a2.mentorado_id, a2.status,
                 a2.assinado_em, a2.created_at, a2.token_expira_em,
                 a2.created_by,
                 jsonb_build_object(
                   'slug', t.slug, 'titulo', t.titulo,
                   'versao', t.versao, 'signatario', t.signatario
                 ) as template
            from public.assinaturas a2
            join public.documento_templates t on t.id = a2.template_id
           where (v_doc is null or t.slug = v_doc)
             and (v_st is null or a2.status = v_st)
        ) a), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados
    ) into v_dados;
  end if;

  -- desfecho (0124): o agregado sai pela MESMA porta — quem abriu o
  -- relatório vê os números do recorte. Escopo: o cronograma do config
  -- (tipo ciclo) ou o resolvido pela turma; recorte sem turma lê o
  -- programa inteiro; turma sem cronograma omite a chave (mostrar o
  -- global num recorte que não cobriu o programa inteiro confundiria).
  v_cron_des := v_cron;
  if v_cron_des is null and v_turma is not null then
    select c.id into v_cron_des
      from public.cronogramas c
     where c.turma = v_turma
     limit 1;
  end if;
  if v_turma is null or v_cron_des is not null then
    v_dados := v_dados || jsonb_build_object(
      'desfecho', public.desfecho_agregado(v_cron_des));
  end if;

  -- sucesso: a linha guarda o config servido (auditoria do "o que estava
  -- compartilhado"), não a URL — que não carrega recorte nenhum mais
  v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
    p_slug, v_link.id, p_ip_hash, p_ua, v_link.config, true, null);

  return jsonb_build_object(
    'ok', true,
    'config', v_cfg,
    'dados', v_dados,
    'audit_fail', v_audit_fail);
end;
$$;

comment on function public.abrir_relatorio(text, text, text, text) is
  'Abertura do link público (170): estado → limite (5/15min por ip_hash + '
  '50/24h por slug) → bcrypt → allowlist de dados por tipo. Loga toda '
  'tentativa em resumo_acessos (best-effort, flag audit_fail). p_ip_hash '
  'é argumento do chamador — forjável via REST; o cap por slug é o bound. '
  '0124: dados.desfecho carrega o agregado do recorte, só números.';

revoke all on function public.abrir_relatorio(text, text, text, text)
  from public;
grant execute on function public.abrir_relatorio(text, text, text, text)
  to anon, authenticated;

commit;
