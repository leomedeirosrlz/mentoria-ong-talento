begin;

-- 0207 — retroativo do jovem (REALIZA-437): "o encontro já aconteceu mas
-- não está na lista pra eu avaliar". Até aqui só o mentor registrava o
-- passado (registrarEncontroRetroativo, born-realizado origem 'externo') —
-- encontro combinado por fora ficava invisível pro jovem e inavaliável.
--
-- Decisão de status: nasce 'realizado' direto, não 'agendado' no passado.
-- O que o jovem precisa é avaliar — e submeter_avaliacao (0071) só aceita
-- realizado; criar agendado vencido obrigaria um segundo gesto ("Aconteceu")
-- pra um fato que ele acabou de declarar. Born-realizado é também o mesmo
-- formato do retroativo do mentor e o destino do marcar_aconteceu (0121):
-- "aconteceu, mentor ainda não registrou" é um estado que o semáforo já lê
-- como "realizado sem registro". O trigger da 0071 minta o link de
-- avaliação no insert, a 0099 auto-emite a jornada e o registro do mentor
-- segue devido — ele é avisado por 'lembrete' (mesma peça da 0121).
--
-- Upsert por (dupla,numero), mesmo molde da agendar_encontro_mentorado:
--   * sem row           → insert born-realizado
--   * agendado/remarcado → confirma com a data declarada (estava marcado
--     pra sexta, aconteceu terça — a trilha da data fica no log da 0153)
--   * realizado DELE sem registro → edição do retroativo: corrige a data
--     enquanto o mentor não contou como foi (depois disso é fato — a
--     correção é com o mentor/coord). Não é remarcação: sem motivo.
--   * realizado de outro / nao_aconteceu → erro apontando o caminho.
--
-- Guardas herdadas: só DPP ativa da própria pessoa (espelho da 0072 —
-- na trilha especialista quem agenda é o especialista), teto pelo
-- cronograma da dupla e o ÚLTIMO encontro fora (ele conclui a dupla na
-- 0102 — fechar a jornada segue sendo registro do mentor, igual à 0121).
-- Piso = iniciada_em (mesma régua da action do mentor).
--
-- desfazer_retroativo_mentorado: o arrependimento do mesmo gesto — apaga
-- o realizado que ELE criou enquanto o mentor não registrou. avaliacoes_
-- encontro e avaliacao_links têm FK NO ACTION pra encontros: a avaliação
-- é do próprio jovem e cai junto do "não aconteceu" que ele desfaz;
-- encontro_remarcacoes/registro_lembretes/registro_tentativas cascateiam
-- sozinhos. O sino do mentor dispara pelo trigger (encontro_desfeito).

-- ---------- registrar/editar ----------

create or replace function public.registrar_retroativo_mentorado(
  p_dupla uuid, p_numero int, p_data_hora timestamptz
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_d duplas%rowtype;
  v_existente encontros%rowtype;
  v_max int;
  v_piso date;
  v_id uuid;
  v_nome text;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error','Só o mentorado registra por aqui.');
  end if;
  select * into v_d from duplas d
   where d.id = p_dupla and d.trilha = 'dpp' and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = d.id);
  if not found then
    return jsonb_build_object('error','Dupla não encontrada ou não está ativa.');
  end if;
  if v_d.cronograma_id is null then
    return jsonb_build_object('error','Essa dupla está sem cronograma. A coordenação vincula um.');
  end if;

  select max(ev.numero) into v_max from ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if p_numero is null or p_numero < 1 or p_numero > coalesce(v_max,16) then
    return jsonb_build_object('error','Escolha um encontro da lista.');
  end if;
  -- o último do ciclo conclui a dupla (0102) — fechar a jornada segue
  -- sendo registro do mentor (mesma fronteira do marcar_aconteceu, 0121)
  if p_numero >= coalesce(v_max,16) then
    return jsonb_build_object('error','O último encontro é registrado pelo seu mentor.');
  end if;
  if p_data_hora is null or p_data_hora > now() then
    return jsonb_build_object('error','A data precisa ser de quando o encontro já aconteceu.');
  end if;
  -- piso = início da mentoria (iniciada_em; sem ela, 1º evento do
  -- cronograma) — mesma régua do registrarEncontroRetroativo do mentor
  select coalesce(v_d.iniciada_em, min(ev.data)) into v_piso
    from ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if v_piso is not null
     and p_data_hora < (v_piso::text || 'T00:00:00-03:00')::timestamptz then
    return jsonb_build_object('error','A data não pode ser antes do início da mentoria.');
  end if;

  select * into v_existente from encontros e
   where e.dupla_id = p_dupla and e.numero = p_numero;

  if v_existente.status = 'realizado' then
    -- edição: só o fato que ele mesmo criou, só enquanto o mentor não
    -- registrou (o registro sela o encontro — depois disso a correção
    -- é com o lado adulto)
    if v_existente.created_by is distinct from my_profile_id() then
      return jsonb_build_object('error','Esse encontro já foi realizado.');
    end if;
    if exists (select 1 from registros r where r.encontro_id = v_existente.id) then
      return jsonb_build_object('error','Seu mentor já registrou esse encontro. Fala com ele pra corrigir.');
    end if;
    update encontros set data_hora = p_data_hora, realizado_em = p_data_hora
     where id = v_existente.id
       and status = 'realizado'
       and created_by = my_profile_id()
       and not exists (select 1 from registros r
         where r.encontro_id = v_existente.id);
    if not found then
      return jsonb_build_object('error','Esse encontro não está mais editável.');
    end if;
    return jsonb_build_object('ok', true, 'encontro_id', v_existente.id);
  end if;
  if v_existente.status = 'nao_aconteceu' then
    -- desfazer o "não aconteceu" é do mentor (combinado do NaoAconteceuJovem)
    return jsonb_build_object('error','Esse encontro foi marcado como não realizado. Se aconteceu de verdade, seu mentor desfaz na ficha.');
  end if;

  if v_existente.id is not null then
    -- estava agendado (futuro ou vencido): aconteceu quando o jovem diz.
    -- remarcado é legado, mas a row ainda é agendável (mesma leitura das
    -- actions); realizado de mais ninguém já saiu acima
    update encontros set
      status = 'realizado',
      data_hora = p_data_hora,
      realizado_em = p_data_hora
     where id = v_existente.id and status in ('agendado','remarcado');
    if not found then
      return jsonb_build_object('error','Esse encontro não está disponível pra esse registro.');
    end if;
    v_id := v_existente.id;
  else
    insert into encontros (dupla_id, numero, data_hora, realizado_em,
                           status, origem, created_by)
    values (p_dupla, p_numero, p_data_hora, p_data_hora,
            'realizado', 'externo', my_profile_id())
    returning id into v_id;
  end if;

  -- o mentor fica sabendo e registra como foi (o registro segue devido) —
  -- mesma lembrança da 0121, apontando o form da ficha
  select split_part(coalesce(nullif(m.nome_social,''), m.nome), ' ', 1)
    into v_nome
    from mentorados m where m.id = v_d.mentorado_id;
  if v_d.mentor_id is not null then
    insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    values (
      v_d.mentor_id, 'lembrete',
      format('%s registrou o %sº encontro', v_nome, p_numero),
      format('%s marcou que o encontro de %s aconteceu. Conte como foi no registro.',
        v_nome,
        to_char(p_data_hora at time zone 'America/Sao_Paulo', 'DD/MM')),
      format('/duplas/%s#registrar-%s', p_dupla, v_id),
      my_profile_id());
  end if;

  return jsonb_build_object('ok', true, 'encontro_id', v_id);
end $$;

revoke all on function public.registrar_retroativo_mentorado(uuid,int,timestamptz)
  from public, anon;
grant execute on function public.registrar_retroativo_mentorado(uuid,int,timestamptz)
  to authenticated;

-- ---------- desfazer ----------

create or replace function public.desfazer_retroativo_mentorado(p_encontro uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_e encontros%rowtype;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error','Só o mentorado desfaz por aqui.');
  end if;
  select e.* into v_e from encontros e
   join duplas d on d.id = e.dupla_id
   where e.id = p_encontro and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = e.dupla_id);
  if not found then
    return jsonb_build_object('error','Encontro não encontrado ou dupla inativa.');
  end if;
  if v_e.status <> 'realizado' then
    return jsonb_build_object('error','Esse encontro não é um registro retroativo.');
  end if;
  if v_e.created_by is distinct from my_profile_id() then
    return jsonb_build_object('error','Só o registro que você criou pode ser desfeito por aqui.');
  end if;
  if exists (select 1 from registros r where r.encontro_id = p_encontro) then
    return jsonb_build_object('error','Seu mentor já registrou esse encontro. Fala com ele pra corrigir.');
  end if;

  -- filhos com FK NO ACTION (0071): a avaliação é do próprio jovem e cai
  -- junto do registro que ele desfaz; links pendentes morrem com ela
  delete from avaliacoes_encontro where encontro_id = p_encontro;
  delete from avaliacao_links where encontro_id = p_encontro;
  delete from encontros
   where id = p_encontro and status = 'realizado'
     and created_by = my_profile_id();
  if not found then
    return jsonb_build_object('error','Esse encontro não está mais editável.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.desfazer_retroativo_mentorado(uuid)
  from public, anon;
grant execute on function public.desfazer_retroativo_mentorado(uuid)
  to authenticated;

commit;
