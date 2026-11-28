-- 0242 — motivo auditável do retroativo tardio (QA 1125b item 25).
--
-- NÃO APLICADA pelo agente. Ordem de deploy: migration antes do código.
-- Sem coluna própria em encontros, o motivo do jovem não persistia e o do
-- mentor abusava de motivo_reagendamento. A RPC ganha o 4º argumento com
-- default; drop/recreate e grant acontecem na mesma transação.

begin;

alter table public.encontros
  add column motivo_retroativo text,
  add column retroativo_tardio boolean not null default false;

alter table public.encontros
  add constraint encontros_motivo_retroativo_len
  check (motivo_retroativo is null or char_length(motivo_retroativo) <= 1000);

comment on column public.encontros.motivo_retroativo is
  'Motivo informado quando o registro retroativo acontece depois de 7 dias do vencimento oficial.';
comment on column public.encontros.retroativo_tardio is
  'true quando o encontro foi registrado depois de 7 dias do vencimento oficial do passo.';

drop function public.registrar_retroativo_mentorado(uuid, integer, timestamptz);

create function public.registrar_retroativo_mentorado(
  p_dupla uuid, p_numero int, p_data_hora timestamptz,
  p_motivo_tardio text default null
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_d duplas%rowtype;
  v_existente encontros%rowtype;
  v_max int;
  v_piso date;
  v_id uuid;
  v_nome text;
  v_oficial date;
  v_tardio boolean;
  v_motivo text;
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

  -- passo oficial vencido é o portão; depois de 7 dias do vencimento o
  -- registro é tardio e exige motivo auditável. A correção de um
  -- retroativo já criado entra no update abaixo sem reescrever esse motivo.
  select ev.data into v_oficial
    from ciclo_eventos ev
   where ev.cronograma_id = v_d.cronograma_id
     and ev.tipo = 'encontro' and ev.numero = p_numero;
  if v_oficial is null or v_oficial > current_date then
    return jsonb_build_object('error','Esse encontro ainda não chegou na data oficial do guia.');
  end if;
  v_tardio := current_date - v_oficial > 7;
  v_motivo := nullif(btrim(coalesce(p_motivo_tardio, '')), '');
  if p_motivo_tardio is not null and char_length(p_motivo_tardio) > 1000 then
    return jsonb_build_object('error','Motivo muito longo (máx. 1000 caracteres).');
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
  if v_tardio and (v_motivo is null or char_length(v_motivo) < 2) then
    return jsonb_build_object('error','Já passaram mais de 7 dias. Conte por que esse registro está sendo feito agora.');
  end if;

  if v_existente.status = 'nao_aconteceu' then
    -- desfazer o "não aconteceu" é do mentor (combinado do NaoAconteceuJovem)
    return jsonb_build_object('error','Esse encontro foi marcado como não realizado. Se aconteceu de verdade, seu mentor desfaz na ficha.');
  end if;

  if v_existente.id is not null then
    -- mesma régua do marcar_aconteceu (0121): "aconteceu" só depois da
    -- hora marcada — um agendado futuro não vira fato retroativo por aqui
    if v_existente.data_hora > now() then
      return jsonb_build_object('error','Esse encontro ainda está marcado pro futuro. Se aconteceu antes, seu mentor registra como foi na ficha.');
    end if;
    -- remarcado/cancelado são legados, mas a row ainda é agendável
    update encontros set
      status = 'realizado',
      data_hora = p_data_hora,
      realizado_em = p_data_hora,
      motivo_retroativo = case when v_tardio then v_motivo else null end,
      retroativo_tardio = v_tardio
     where id = v_existente.id and status in ('agendado','remarcado','cancelado')
       and data_hora <= now();
    if not found then
      return jsonb_build_object('error','Esse encontro não está disponível pra esse registro.');
    end if;
    v_id := v_existente.id;
  else
    insert into encontros (dupla_id, numero, data_hora, realizado_em,
                           status, origem, motivo_retroativo,
                           retroativo_tardio, created_by)
    values (p_dupla, p_numero, p_data_hora, p_data_hora,
            'realizado', 'externo',
            case when v_tardio then v_motivo else null end,
            v_tardio, my_profile_id())
    returning id into v_id;
  end if;

  -- o mentor fica sabendo e registra como foi (o registro segue devido)
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

revoke all on function public.registrar_retroativo_mentorado(uuid, integer, timestamptz, text) from public, anon;
grant execute on function public.registrar_retroativo_mentorado(uuid, integer, timestamptz, text) to authenticated;

commit;
