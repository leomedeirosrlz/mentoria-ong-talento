-- 0178 — rematch herda a jornada de instrumentos: respondidos migram,
-- pendentes re-emitem com a régua certa, e o PDM vivo atravessa.
--
-- CONTEXTO
-- A 0170 zerou os efeitos da CÓPIA, mas o insert da dupla nova seguia
-- disparando duplas_jornada_autoemit (0099): a emissão rodava antes da
-- cópia (encCorrente=1) e o dedup é por dupla — visão, PDM e a roda
-- inicial re-mintavam pro mentorado que fica mesmo já respondidos na
-- dupla encerrada; na 1ª visita ao /jovem a auto-cura mintava metas por
-- cima (v_enc>=2 depois da cópia). O jovem recebia de novo formulário
-- já respondido e a estação "feito" virava "a fazer". Duas lacunas
-- adjacentes: os avaliacao_links não são copiados (o encontro copiado
-- sem avaliação ficava sem link pro "copiar link" da ficha) e o pdm
-- vivo ficava preso na dupla morta — o dialog de remanejo já prometia
-- "o link do PDM" como herança.
--
-- O que o remanejo faz agora:
--   * suprime a emissão do INSERT — só o trigger nomeado sai do ar:
--     duplas_capacidade é BEFORE INSERT e precisa validar a vaga do
--     mentor que chega;
--   * MOVE os links respondidos do jovem que fica pra dupla nova — a
--     resposta é da pessoa, não da dupla morta. No rematch de mentorado
--     o filtro por dest_mentorado_id vira no-op de propósito: a jovem
--     nova nunca respondeu nada e recebe os instrumentos dela;
--   * MOVE o pdm vivo (pdm_itens segue pelo pdm_id — um update basta);
--   * minta o avaliacao_links dos encontros copiados sem avaliação —
--     a cópia roda com os triggers de encontros desligados e sem a row
--     o "copiar link" morre. Só no rematch de mentor: encontro de uma
--     jovem que saiu não é da jovem nova avaliar;
--   * roda jornada_autoemit(nova) DEPOIS de tudo assentado — respondidos
--     movidos deduplicam, pendentes re-mintam com a régua final (metas
--     entra se v_enc>=2; roda respondida + enc>=12 emite a 'formal',
--     nunca uma 2ª 'inicial').
--
-- O que NÃO muda: o dedup segue por dupla — jovem re-ingressando em
-- ciclo novo (dupla sem remanejada_de) re-responde tudo, como sempre
-- foi. Links pendentes não movem: já expiraram no encerramento e a
-- sucessora minta os próprios.
--
-- A função é a 0170 + a supressão do autoemit + o bloco de jornada.
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

  -- 0178: a emissão da jornada no INSERT mintaria visao/pdm/roda com
  -- encCorrente=1 e o dedup por dupla cego pras respostas da encerrada.
  -- Ela roda no fim, com o estado final — só o trigger nomeado sai:
  -- duplas_capacidade é BEFORE INSERT e segue validando a vaga de quem
  -- chega (nada de DISABLE TRIGGER USER na duplas). DDL transacional:
  -- exceção no meio faz rollback do disable junto.
  alter table public.duplas disable trigger duplas_jornada_autoemit;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id
  )
  returning id into nova;

  alter table public.duplas enable trigger duplas_jornada_autoemit;

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

  -- 0178: a jornada do jovem que fica atravessa — os instrumentos já
  -- respondidos migram pra dupla nova (a resposta é da pessoa, não da
  -- dupla morta) e o dedup por dupla passa a enxergá-los na re-emissão
  -- abaixo. No rematch de mentorado o filtro por destinatário vira
  -- no-op de propósito: a jovem nova nunca respondeu e recebe os
  -- instrumentos dela. Pendente não move: expirou no encerramento —
  -- a sucessora minta o seu. Âncoras intactas: dest_mentorado_id e o
  -- contexto seguem na row, só o dupla_id muda (formulario_links_tem_ancora
  -- continua satisfeita — dupla_id novo não é nulo).
  update public.formulario_links l
     set dupla_id = nova
    from public.formularios f
   where f.id = l.formulario_id
     and f.sistema in ('visao', 'roda_vida', 'pdm', 'metas')
     and l.dupla_id = p_dupla_id
     and l.usado_em is not null
     and l.dest_mentorado_id = novo_mentorado;

  -- o PDM vivo é documento da jornada, não da dupla morta — o dialog de
  -- remanejo já prometia "o link do PDM" como herança. pdm_itens segue
  -- pelo pdm_id; o pdm_touch só recarimba o updated_at, que é verdade.
  update public.pdm
     set dupla_id = nova
   where dupla_id = p_dupla_id;

  -- a cópia roda com os triggers de encontros desligados, então o
  -- realizado copiado não mintou o avaliacao_links da 0071 — sem a row
  -- o "copiar link" da ficha morre e a jovem sem login não avalia.
  -- Insert direto: link sem notificação (o prompt do encontro foi o da
  -- época, na dupla antiga). Só no rematch de mentor: os encontros são
  -- da jovem que fica — avaliar sessão de quem saiu não é dela.
  if p_lado = 'mentor' then
    insert into public.avaliacao_links (
      token, encontro_id, dupla_id, expira_em
    )
    select gen_random_uuid()::text, e.id, nova,
           now() + interval '60 days'
      from public.encontros e
     where e.dupla_id = nova
       and e.status = 'realizado'
       and not exists (
         select 1 from public.avaliacoes_encontro a
          where a.encontro_id = e.id
       )
    on conflict (encontro_id) do nothing;
  end if;

  -- re-emissão com o estado final e a régua certa: respondidos migrados
  -- deduplicam; pendentes re-mintam (metas entra se v_enc>=2; roda
  -- respondida + enc>=12 emite a 'formal' — nunca uma 2ª 'inicial').
  perform public.jornada_autoemit(nova);

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

-- rollback: restaurar o corpo da 0170 (pg_get_functiondef pré-apply) —
-- links/pdm migrados e avaliacao_links mintados em remanejos já
-- executados ficam (são estado legítimo da jornada), a limpeza manual
-- é por dupla se preciso.
