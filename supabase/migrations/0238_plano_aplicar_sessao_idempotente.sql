-- 0238 — idempotência forte de plano_aplicar_sessao (REALIZA-519)
--
-- A 0227 mintava um sessao_id novo em toda chamada; o app contornava com
-- uma leitura antes da RPC. Esta versão repete a checagem dentro da
-- transação, depois do SELECT ... FOR UPDATE do plano: retry/duplo clique
-- na mesma data devolve a sessão existente (idempotente:true) e sessão
-- parcial é recusada, sem órfãs. Sem DDL.
begin;

-- 0238 — aplica uma sessão fundida do plano, idempotente no banco (REALIZA-519)
--
-- `plano_aplicar_passo` aplica um passo; esta RPC aplica um grupo de passos
-- como UMA sessão: mesma data_hora, mesmo sessao_id e mesma duracao_min em
-- todas as rows de `encontros`, atomicamente. A ordem é explícita e o
-- registro/avaliação usam a row de menor número como âncora (0226).
begin;

create or replace function public.plano_aplicar_sessao(
  p_plano uuid,
  p_numeros smallint[],
  p_data_hora timestamptz,
  p_duracao_min smallint default 120,
  p_link text default null,
  p_motivo text default null,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p public.dupla_planos%rowtype;
  v_d record;
  v_e record;
  v_num smallint;
  v_sessao uuid := gen_random_uuid();
  v_ini date;
  v_fim date;
  v_ids jsonb := '[]'::jsonb;
  v_count int;
  v_sessoes int;
  v_sess uuid;
  v_mesma_data boolean;
  v_todos_sessao boolean;
  v_ids_existentes jsonb;
begin
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;
  if p_numeros is null or cardinality(p_numeros) = 0 then
    return jsonb_build_object('error', 'escolha ao menos um encontro da sessão');
  end if;
  if cardinality(p_numeros) <> (select count(distinct n) from unnest(p_numeros) n) then
    return jsonb_build_object('error', 'a sessão tem encontros repetidos');
  end if;
  if p_duracao_min not in (30,45,60,90,120) then
    return jsonb_build_object('error', 'duração fora do catálogo da agenda');
  end if;

  select * into v_p from public.dupla_planos p where p.id = p_plano for update;
  if not found then
    return jsonb_build_object('error', 'plano não encontrado');
  end if;
  select d.mentor_id, d.mentorado_id, d.status
    into v_d from public.duplas d where d.id = v_p.dupla_id;
  if not (v_d.mentor_id = public.my_profile_id()
          or v_d.mentorado_id = public.my_mentorado_id()) then
    return jsonb_build_object('error', 'só a dupla aplica os passos do plano');
  end if;
  if v_p.status not in ('aceito','ativo') then
    return jsonb_build_object('error', 'o plano precisa estar aceito pra aplicar a sessão');
  end if;
  if v_d.status <> 'ativa' then
    return jsonb_build_object('error', 'a dupla não está mais ativa');
  end if;
  if p_data_hora is null or p_data_hora <= now() then
    return jsonb_build_object('error', 'a sessão precisa ser marcada no futuro');
  end if;
  v_ini := (v_p.escopo->'janela'->>'inicio')::date;
  v_fim := (v_p.escopo->'janela'->>'fim')::date;
  if p_data_hora::date < v_ini or p_data_hora::date > v_fim then
    return jsonb_build_object('error', 'a data precisa ficar dentro da janela do plano');
  end if;
  if p_link is not null and p_link !~ '^https?://' then
    return jsonb_build_object('error', 'confira o link: precisa ser um endereço completo (https://…)');
  end if;

  -- Idempotência forte no banco (0238): o select ... for update acima já
  -- serializa chamadas do mesmo plano. Se todos os números já estão na
  -- MESMA sessão e na MESMA data, é retry/duplo clique: devolve a sessão
  -- existente em vez de mintar outro sessao_id e deixar a anterior órfã.
  -- Sessão parcial (um número já em outra sessão, outro solto) é recusada:
  -- juntar agora quebraria a âncora/cobertura da sessão antiga.
  select count(*),
         count(distinct e.sessao_id),
         min(e.sessao_id::text)::uuid,
         bool_and(e.data_hora = p_data_hora),
         bool_and(e.sessao_id is not null),
         jsonb_agg(e.id order by e.numero)
    into v_count, v_sessoes, v_sess, v_mesma_data, v_todos_sessao,
         v_ids_existentes
    from public.encontros e
   where e.dupla_id = v_p.dupla_id
     and e.numero = any (p_numeros);

  if v_count = cardinality(p_numeros) and v_sessoes = 1 and v_todos_sessao then
    if v_mesma_data then
      return jsonb_build_object('ok', true, 'sessao_id', v_sess,
                                'encontros', v_ids_existentes,
                                'idempotente', true);
    end if;
    return jsonb_build_object(
      'error', 'essa sessão já está marcada. Pra mudar a data, remarque pelo encontro.');
  end if;
  if v_sessoes > 0 then
    return jsonb_build_object(
      'error', 'um dos encontros já está em outra sessão. Remarque pelo encontro.');
  end if;

  -- todos os números precisam estar no escopo e ainda não realizados
  foreach v_num in array p_numeros loop
    if not exists (
      select 1 from jsonb_array_elements_text(v_p.escopo->'numeros') n
       where n::int = v_num) then
      return jsonb_build_object('error', 'esse encontro não faz parte do plano');
    end if;
    select * into v_e from public.encontros e
     where e.dupla_id = v_p.dupla_id and e.numero = v_num;
    if v_e.status = 'realizado' then
      return jsonb_build_object('error', 'um dos encontros da sessão já foi realizado');
    end if;
  end loop;

  -- ids antigos para o ledger e para o motivo de reagendamento
  foreach v_num in array p_numeros loop
    select * into v_e from public.encontros e
     where e.dupla_id = v_p.dupla_id and e.numero = v_num;
    if v_e.id is not null then
      if v_e.data_hora is distinct from p_data_hora
         and (p_motivo is null or char_length(btrim(p_motivo)) < 2) then
        return jsonb_build_object('error', 'conte o motivo do reagendamento da sessão');
      end if;
      update public.encontros
         set data_hora = p_data_hora,
             duracao_min = p_duracao_min,
             sessao_id = v_sessao,
             link = p_link,
             status = 'agendado',
             motivo_reagendamento = coalesce(nullif(btrim(p_motivo), ''), motivo_reagendamento)
       where id = v_e.id and status in ('agendado','nao_aconteceu','remarcado','cancelado');
      if not found then
        return jsonb_build_object('error', 'um dos encontros não está mais agendável');
      end if;
    else
      insert into public.encontros
        (dupla_id, numero, data_hora, duracao_min, sessao_id, link, status,
         origem, motivo_reagendamento, created_by)
      values (v_p.dupla_id, v_num, p_data_hora, p_duracao_min, v_sessao,
              p_link, 'agendado', 'plataforma', nullif(btrim(p_motivo), ''),
              public.my_profile_id())
      returning id into v_e.id;
    end if;

    insert into public.dupla_plano_passos
      (plano_id, dupla_id, numero, encontro_id, data_anterior, data_nova,
       motivo, aplicado_por, aplicado_via)
    values (p_plano, v_p.dupla_id, v_num, v_e.id, v_e.data_hora, p_data_hora,
            nullif(btrim(p_motivo), ''), public.my_profile_id(), p_via)
    on conflict (plano_id, numero) do nothing;

    v_ids := v_ids || jsonb_build_array(v_e.id);
  end loop;

  if v_p.status = 'aceito' then
    update public.dupla_planos set status = 'ativo', updated_at = now()
     where id = p_plano;
  end if;
  insert into public.dupla_plano_eventos
    (plano_id, dupla_id, tipo, de, para, motivo, por, meta)
  values (p_plano, v_p.dupla_id, 'sessao_aplicada', null, 'ativo',
          nullif(btrim(p_motivo), ''), public.my_profile_id(),
          jsonb_build_object('numeros', p_numeros, 'data', p_data_hora,
                             'duracao_min', p_duracao_min, 'sessao_id', v_sessao,
                             'via', p_via));

  return jsonb_build_object('ok', true, 'sessao_id', v_sessao, 'encontros', v_ids);
end $$;

revoke all on function public.plano_aplicar_sessao(uuid, smallint[], timestamptz, smallint, text, text, text) from public, anon;
grant execute on function public.plano_aplicar_sessao(uuid, smallint[], timestamptz, smallint, text, text, text) to authenticated;

commit;
