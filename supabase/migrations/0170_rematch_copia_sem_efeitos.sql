-- 0170 — rematch copia histórico SEM disparar efeitos de atividade nova.
--
-- A 0169 copiou encontros/registros/avaliações, mas a cópia roda INSERTs
-- reais: guard_autoria (0023) via BEFORE INSERT e os AFTER INSERT de
-- notificação/auto-encerramento/chamados disparavam como se fosse
-- atividade nova. Reproduzido em staging: rematch de dupla com histórico
-- aborta com 'autoria forjada' (created_by do mentor ≠ my_profile_id() do
-- coordenador) — e, se passasse, a dupla nova podia nascer 'concluida'
-- com notificações espúrias quando a anterior tinha o último passo.
--
-- Correção: a seção de cópia desliga os triggers de usuário das tabelas
-- envolvidas (ALTER TABLE ... DISABLE TRIGGER USER — DDL transacional:
-- qualquer exceção faz rollback e os triggers nunca ficam desligados).
-- A cópia é migração de dados, não atividade: nenhum efeito colateral
-- deve disparar — sem notificação de agenda/prompt de avaliação, sem
-- auto-encerramento, sem sync de chamados (esses ficam na dupla
-- encerrada, como já decidido), sem jornada_autoemit (a dupla nova emite
-- os próprios instrumentos nos eventos futuros dela).
--
-- Também copia o que a 0169 deixou pra trás e é continuidade de jornada:
-- encontro_notas (plano do mentor por nº, chave dupla_id+numero) e
-- registro_anexos — esses últimos são MOVIDOS pro
-- registro novo (path é unique global e o objeto de storage é o mesmo;
-- duplicar a row violaria o unique, então o anexo segue o registro).
--
-- A função é a 0169 + a janela de triggers + as cópias novas.
begin;

create or replace function public.rematch_dupla(
  p_dupla_id uuid, p_lado text, p_novo_id uuid,
  p_motivo text default null, p_registrar_nota boolean default true,
  p_devolutiva text default null
) returns uuid
language plpgsql security definer set search_path = '' as $function$
declare
  antiga public.duplas%rowtype;
  nova uuid;
  novo_mentor uuid;
  novo_mentorado uuid;
  papel_esperado text;
  nota_saida text;
  enc record;
  reg record;
  novo_enc uuid;
  novo_reg uuid;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação remaneja duplas';
  end if;
  if p_lado not in ('mentor', 'mentorado') then
    raise exception 'Lado inválido — use mentor ou mentorado';
  end if;

  select * into antiga from public.duplas where id = p_dupla_id for update;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if antiga.status not in ('ativa', 'pausada') then
    raise exception 'Só dupla ativa ou pausada pode ser remanejada';
  end if;

  novo_mentor    := case when p_lado = 'mentor'    then p_novo_id else antiga.mentor_id end;
  novo_mentorado := case when p_lado = 'mentorado' then p_novo_id else antiga.mentorado_id end;

  if p_lado = 'mentor' then
    papel_esperado := case when antiga.trilha = 'especialista'
                           then 'mentor_especialista' else 'mentor_dpp' end;
    -- has_papel confere o papel efetivo E o ativo (join profiles) — híbrido
    -- com o papel da trilha como secundário passa a ser candidato válido.
    -- Escopo (0101): especialista é pool GLOBAL — o papel em qualquer
    -- escopo habilita; mentor_dpp segue restrito à turma da dupla.
    if not public.has_papel(
      p_novo_id, papel_esperado::public.app_role,
      case when papel_esperado = 'mentor_especialista' then null
           else antiga.turma end
    ) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
    end if;
    -- 0101: mesmo guard de autoatribuição do sol_efetivar — a trilha de
    -- especialista exige um SEGUNDO adulto; quem já é mentor DPP da jovem
    -- não pode assumir a trilha de especialista dela via rematch (o caminho
    -- cross-turma facilitou chegar aqui, então o guard mora no RPC).
    if papel_esperado = 'mentor_especialista' and exists (
      select 1 from public.duplas d
       where d.mentorado_id = antiga.mentorado_id
         and d.mentor_id = p_novo_id
         and d.trilha is distinct from 'especialista'
         and d.status in ('ativa', 'pausada')
    ) then
      raise exception 'O mentor DPP da jovem não pode assumir também a trilha de especialista';
    end if;
  else
    if not exists (select 1 from public.mentorados where id = p_novo_id) then
      raise exception 'Mentorado não encontrado';
    end if;
    if exists (
      select 1 from public.duplas
      where mentorado_id = p_novo_id
        and trilha = antiga.trilha
        and status in ('ativa', 'pausada')
    ) then
      raise exception 'Esse mentorado já está em dupla nessa trilha';
    end if;
  end if;

  -- 0117: a validação fica depois dos guards de escopo (a ordem dos erros
  -- é a mesma de sempre) e antes do primeiro write — rematch esp sem a
  -- devolutiva aborta inteiro, não "fecha e avisa". Mesma faixa do rito de
  -- encerramento (duplas_devolutiva_pdm_cap é o backstop declarativo).
  if antiga.trilha = 'especialista' then
    if p_devolutiva is null
       or char_length(btrim(p_devolutiva)) not between 10 and 4000 then
      raise exception 'O rematch de uma trilha de especialista exige a devolutiva pro PDM de quem sai (10 a 4.000 caracteres)';
    end if;
  elsif nullif(btrim(p_devolutiva), '') is not null then
    -- dpp não tem o campo (duplas_encerramento_esp) — erro explícito evita
    -- "gravei e sumiu": o texto ia pro limbo e o chamador nem saberia
    raise exception 'A devolutiva pro PDM só existe na trilha de especialista';
  end if;

  -- 0105: fechamento "só de status" deixava a trilha de especialista sem
  -- encerrada_em, sem motivo e sem o link da avaliação geral — estado que
  -- nenhuma outra via produz. O check duplas_encerramento_esp (0102)
  -- proíbe esses campos em trilha DPP de propósito (o rito DPP mora em
  -- encerramentos), então o carimbo vale só pra especialista: motivo
  -- sistêmico + emissão do §13 pro especialista que sai.
  -- 0117: a devolutiva pro PDM fecha o rito na mesma transação.
  if antiga.trilha = 'especialista' then
    update public.duplas
       set status = 'encerrada',
           encerrada_em = now(),
           -- o check motivo_encerramento_cap corta em 300 e p_motivo chega a
           -- ~430 chars via motivoRemanejo — trunca em vez de estourar 23514
           motivo_encerramento = left(
             'Remanejamento — ' ||
             case p_lado when 'mentorado' then 'jovem' else 'especialista' end ||
             ' substituído(a)' ||
             coalesce(': ' || nullif(btrim(p_motivo), ''), ''),
             300),
           devolutiva_pdm = btrim(p_devolutiva)
     where id = p_dupla_id;
    perform public.emitir_avaliacao_esp(p_dupla_id, antiga.mentor_id);
  else
    update public.duplas set status = 'encerrada' where id = p_dupla_id;
  end if;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id
  )
  returning id into nova;

  -- 0170: a cópia é migração de dados, não atividade nova — desliga os
  -- triggers de usuário das tabelas-alvo pra nenhum efeito colateral
  -- disparar (autoria forjada, auto-encerramento, notificações de agenda/
  -- avaliação, sync de chamados, jornada_autoemit). DDL transacional:
  -- exceção no meio faz rollback do disable junto.
  alter table public.encontros disable trigger user;
  alter table public.registros disable trigger user;
  alter table public.avaliacoes_encontro disable trigger user;
  alter table public.encontro_notas disable trigger user;
  alter table public.registro_anexos disable trigger user;

  -- 0169: a dupla nova continua de onde a anterior parou — copia os
  -- encontros realizados com registro e avaliação do jovem, re-apontando
  -- pras linhas novas. Sem isso a dupla nascia devendo o ciclo inteiro
  -- (catch-up via iniciada_em) e virava risco em dias por dívida alheia.
  for enc in
    select * from public.encontros
     where dupla_id = p_dupla_id and status = 'realizado'
     order by numero
  loop
    insert into public.encontros (
      dupla_id, numero, status, data_hora, duracao_min, origem, link,
      realizado_em, motivo_reagendamento, created_by
    ) values (
      nova, enc.numero, 'realizado', enc.data_hora, enc.duracao_min,
      enc.origem, enc.link, enc.realizado_em, enc.motivo_reagendamento,
      enc.created_by
    )
    returning id into novo_enc;

    -- por linha (e não insert..select) pra capturar o id novo: os anexos
    -- do registro são MOVIDOS pra ele — path é unique global e o objeto
    -- de storage é o mesmo, então a row de metadados segue o registro em
    -- vez de duplicar (a dupla encerrada fica só com o texto do registro)
    for reg in
      select * from public.registros where encontro_id = enc.id
    loop
      insert into public.registros (
        encontro_id, tema, ferramenta, reflexoes, observacoes, atividades,
        avaliacao, dificuldade, dificuldade_detalhe, precisa_apoio,
        proximo_passo, proximo_passo_detalhe, created_by, created_at,
        updated_at
      ) values (
        novo_enc, reg.tema, reg.ferramenta, reg.reflexoes, reg.observacoes,
        reg.atividades, reg.avaliacao, reg.dificuldade, reg.dificuldade_detalhe,
        reg.precisa_apoio, reg.proximo_passo, reg.proximo_passo_detalhe,
        reg.created_by, reg.created_at, reg.updated_at
      )
      returning id into novo_reg;

      update public.registro_anexos
         set registro_id = novo_reg
       where registro_id = reg.id;
    end loop;

    insert into public.avaliacoes_encontro (
      dupla_id, encontro_id, estrelas, sentimento, temas, comentario,
      pedir_apoio, avancei, avaliacao_visivel_mentor,
      respondido_por_profile_id, created_at
    )
    select
      nova, novo_enc, estrelas, sentimento, temas, comentario,
      pedir_apoio, avancei, avaliacao_visivel_mentor,
      respondido_por_profile_id, created_at
      from public.avaliacoes_encontro
     where encontro_id = enc.id;
  end loop;

  -- 0170: plano do mentor por passo (nota de aula) é continuidade de
  -- jornada — segue a dupla nova em qualquer nº, não só
  -- nos realizados (o mentor que chega precisa ver o plano inteiro)
  insert into public.encontro_notas (
    dupla_id, numero, texto, created_by, created_at, updated_at
  )
  select nova, numero, texto, created_by, created_at, updated_at
    from public.encontro_notas
   where dupla_id = p_dupla_id;

  alter table public.encontros enable trigger user;
  alter table public.registros enable trigger user;
  alter table public.avaliacoes_encontro enable trigger user;
  alter table public.encontro_notas enable trigger user;
  alter table public.registro_anexos enable trigger user;

  if p_registrar_nota and nullif(btrim(p_motivo), '') is not null then
    nota_saida := 'Saiu da dupla em ' || to_char(current_date, 'DD/MM/YYYY') ||
                  ' (remanejamento): ' || btrim(p_motivo);
    insert into public.pessoa_notas (profile_id, mentorado_id, texto, created_by)
    values (
      case when p_lado = 'mentor' then antiga.mentor_id else null end,
      case when p_lado = 'mentorado' then antiga.mentorado_id else null end,
      nota_saida,
      public.my_profile_id()
    );
  end if;

  return nova;
end;
$function$;

-- grants e revokes já estão certos na 0117 (mesma assinatura) — create or
-- replace preserva os privilégios do objeto existente.
commit;

-- rollback: restaurar o corpo da 0169 (pg_get_functiondef pré-apply).
