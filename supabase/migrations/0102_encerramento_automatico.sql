begin;

-- 0102 — encerramento automático no último encontro + aviso de reta final
-- (REALIZA-155)
--
-- 1) Trigger novo par na entrada em 'realizado' (mesma disciplina da 0099 —
--    salvarRegistro regrava o mesmo status a cada edição e o WHEN filtra).
--    Cobre TODOS os caminhos de escrita: form do mentor, retroativo e o
--    import semanal do 0082 — não depende de camada app.
-- 2) Ao cruzar "faltam 2" encontros efetivos → 'dupla_reta_final' pra
--    coordenação ativa + supervisor da dupla (fire-once por destinatário:
--    realizado é imutável desde a 0043, o restante só desce).
-- 3) Ao registrar o ÚLTIMO encontro do cronograma → duplas.status =
--    'concluida' + row `encerramentos` pendente (tipo/decidido_por null —
--    o rito segue atestação da coordenação, o que preserva o carimbo de 360
--    tardio do 0080 e o CHECK tipo↔decisor) + aviso pra equipe e mentor.
--
-- Decisões de fronteira:
--   * 'concluida', não 'encerrada': o status distingue jornada completa de
--     interrupção; encerrada segue só pelo fluxo manual (desistência).
--   * "último encontro efetivo" = new.numero = max(numero) dos passos
--     'encontro' do cronograma dela — não 'feitos = total': buraco no meio
--     não pode segurar o fechamento quando o passo final de fato aconteceu.
--   * pausada também conclui: retroativo/import podem pousar o último
--     encontro nela. Encerrada/concluida/especialista morrem no guard.
--   * `realiza.no_notify` (0082) NÃO é honrado aqui de propósito: o import
--     da semana 16 é exatamente onde o fechamento precisa avisar.
--   * mentor é notificado mesmo sendo o ator do registro — a conclusão é
--     efeito colateral que ele precisa conhecer.

-- ---------- tipo novo de notificação ----------

alter table public.notificacoes
  drop constraint notificacoes_tipo_check;
alter table public.notificacoes
  add constraint notificacoes_tipo_check
  check (tipo = any (array[
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada', 'especialista_aceitou',
    'solicitacao_cancelada', 'trilha_encerrada', 'supervisao_registrada',
    'formulario_respondido', 'avaliacao_pendente', 'apoio_jovem',
    'encontro_marcado', 'encontro_alterado', 'encontro_desfeito',
    'solicitacao_triagem', 'solicitacao_recusada', 'solicitacao_proposta',
    'chamado_aberto', 'chamado_atribuido', 'chamado_atualizacao',
    'chamado_resposta_autor', 'chamado_resolvido', 'chamado_reaberto',
    'chamado_mencao', 'sugestao_especialista', 'devolutiva_especialista',
    'lembrete', 'dupla_reta_final'
  ]));

-- ---------- a função ----------

create or replace function public.dupla_encerramento_auto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
  v_janela int[];   -- números dos encontros efetivos (pós-início da dupla)
  v_ultimo int;
  v_feitos int;
  v_href text;
  v_mentorado text;
begin
  if new.numero is null then
    return new;
  end if;

  select id, trilha, status, cronograma_id, iniciada_em, mentor_id,
         supervisor_id, mentorado_id
    into d
    from public.duplas
   where id = new.dupla_id;

  if d.id is null
     or d.trilha is distinct from 'dpp'
     or d.status not in ('ativa', 'pausada')
     or d.cronograma_id is null then
    return new;
  end if;

  -- janela efetiva = passos 'encontro' do cronograma a partir do início da
  -- dupla (mesma poda de jornadaDaDupla em ciclo.ts: o que veio antes dela
  -- entrar não conta). Dupla que começa no enc. 7 tem ~10 passos, não 16.
  select array_agg(e.numero order by e.numero)
    into v_janela
    from public.ciclo_eventos e
   where e.cronograma_id = d.cronograma_id
     and e.tipo = 'encontro'
     and e.numero is not null
     and (d.iniciada_em is null or e.data is null or e.data >= d.iniciada_em);

  if v_janela is null then
    return new;
  end if;
  v_ultimo := v_janela[array_length(v_janela, 1)];

  select count(distinct en.numero) into v_feitos
    from public.encontros en
   where en.dupla_id = d.id
     and en.status = 'realizado'
     and en.numero = any (v_janela);

  v_href := '/duplas/' || d.id;
  select nome into v_mentorado from public.mentorados where id = d.mentorado_id;

  -- último encontro do cronograma → a jornada terminou de fato. Avaliado
  -- ANTES do aviso de reta final: o último caindo com 2 buracos no meio
  -- tem restante=2 e é o último ao mesmo tempo — fechar é o que importa
  -- (avisar "faltam 2" ali seria mentira: os 2 que faltam já passaram).
  if new.numero = v_ultimo then
    update public.duplas set status = 'concluida'
     where id = d.id and status in ('ativa', 'pausada');

    -- a row do rito nasce pendente (ou preserva a que o mentor abriu com a
    -- autoavaliação): decidido_por segue sendo a coordenação
    insert into public.encerramentos (dupla_id) values (d.id)
      on conflict (dupla_id) do nothing;

    -- equipe: o fechamento automático pede o rito — copy carrega a ação
    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_formada',
           'Dupla concluiu a jornada',
           'Último encontro de ' || coalesce(v_mentorado, 'a dupla')
             || ' registrado — falta o checklist de encerramento na ficha.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null;

    -- mentor: paridade com o fluxo manual — sem filtro de ator, a conclusão
    -- é efeito do registro dele e ele precisa saber
    if d.mentor_id is not null then
      insert into public.notificacoes
        (profile_id, tipo, titulo, corpo, href, created_by)
      values (d.mentor_id, 'dupla_formada',
        'Sua dupla concluiu a jornada',
        'O último encontro com ' || coalesce(v_mentorado, 'seu mentorado')
          || ' foi registrado. O resumo segue na ficha da dupla.',
        v_href, public.my_profile_id());
    end if;

    return new;
  end if;

  -- faltam 2 → um aviso por destinatário, uma vez por dupla. O advisory
  -- lock por dupla serializa transições concorrentes (import + registro do
  -- mentor na mesma janela) — convenção da 0099/0094 — e o dedup no
  -- tipo+href torna o aviso fire-once (o restante só desce: realizado é
  -- imutável e o número identifica o passo).
  if array_length(v_janela, 1) - v_feitos = 2 then
    perform pg_advisory_xact_lock(hashtext('reta_final:' || d.id::text));

    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_reta_final',
           'Dupla na reta final',
           coalesce(v_mentorado, 'A dupla')
             || ' e o mentor têm 2 encontros pela frente — dá pra adiantar o encerramento.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null
       and not exists (
         select 1 from public.notificacoes n
          where n.profile_id = p.id
            and n.tipo = 'dupla_reta_final'
            and n.href = v_href
       );
  end if;

  return new;
end $$;

-- entrada em 'realizado' — insert (retroativo/import nasce realizado) e
-- update de status (agendado→realizado, nao_aconteceu→desfeito→realizado)
drop trigger if exists encontros_encerramento_auto on public.encontros;
create trigger encontros_encerramento_auto
  after insert on public.encontros
  for each row when (new.status = 'realizado')
  execute function public.dupla_encerramento_auto();

drop trigger if exists encontros_encerramento_auto_upd on public.encontros;
create trigger encontros_encerramento_auto_upd
  after update of status on public.encontros
  for each row
  when (old.status is distinct from 'realizado' and new.status = 'realizado')
  execute function public.dupla_encerramento_auto();

-- ---------- pós-fechamento: a autoavaliação do mentor continua aberta ----------
--
-- O fechamento automático cria 'concluida' com a decisão PENDENTE — a parte
-- do mentor no rito (autoavaliação) ainda tem caminho. O update interno já
-- trava em decidido_por preenchido, então a guarda de status só precisava
-- não barrar 'concluida'. 'encerrada' (fechamento manual decidido) continua
-- fora: lá a decisão já existe.

create or replace function public.salvar_autoavaliacao(p_dupla uuid, p_texto text, p_disponivel boolean)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  d record;
  n int;
begin
  select id, mentor_id, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if d.mentor_id is distinct from public.my_profile_id() then
    raise exception 'Só o mentor da dupla pode enviar a autoavaliação';
  end if;
  -- 'concluida' entra junto: fechamento automático deixa a decisão pendente
  -- e a autoavaliação é peça do rito — o decidido_por continua sendo a trava
  if d.status not in ('ativa', 'pausada', 'concluida') then
    raise exception 'A dupla já está fechada';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) not between 10 and 4000 then
    raise exception 'A autoavaliação precisa de 10 a 4.000 caracteres';
  end if;

  insert into public.encerramentos (dupla_id, autoavaliacao_mentor, disponivel_proximo_ciclo)
  values (p_dupla, nullif(btrim(p_texto), ''), p_disponivel)
  on conflict (dupla_id) do update set
    autoavaliacao_mentor = excluded.autoavaliacao_mentor,
    disponivel_proximo_ciclo = excluded.disponivel_proximo_ciclo
  where encerramentos.decidido_por is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'O encerramento já foi registrado — a autoavaliação não pode mais mudar';
  end if;
end
$function$;
commit;
