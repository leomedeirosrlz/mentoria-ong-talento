-- 0243 — agenda livre do jovem: legado agendável e motivo por minuto civil.
--
-- NÃO APLICADA pelo agente. Dois desalinhos da 0072:
-- 1. rows legadas 'remarcado'/'cancelado' caíam no update filtrado por
--    status='agendado' e travavam a confirmação, embora o read path do app
--    já trate essas rows como agendáveis;
-- 2. a remarcação comparava timestamptz cru. O seletor edita por minuto
--    civil, então uma row gravada com segundos pedía motivo mesmo sem a
--    pessoa mudar dia/horário visível. A comparação agora é do par civil
--    (data + hora:minuto) em America/Sao_Paulo — a mesma régua da UI e da
--    action do mentor.

begin;

create or replace function public.agendar_encontro_mentorado(
  p_dupla uuid, p_numero int, p_data_hora timestamptz,
  p_link text default null, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_d duplas%rowtype;
  v_existente encontros%rowtype;
  v_max int;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error','Só o mentorado agenda por aqui.');
  end if;
  select * into v_d from duplas d
   where d.id = p_dupla and d.trilha = 'dpp' and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = d.id);
  if not found then
    return jsonb_build_object('error','Dupla não encontrada ou não está ativa.');
  end if;
  if v_d.cronograma_id is null then
    return jsonb_build_object('error','Essa dupla está sem cronograma — a coordenação vincula um.');
  end if;

  select max(ev.numero) into v_max from ciclo_eventos ev
   where ev.tipo = 'encontro' and ev.cronograma_id = v_d.cronograma_id;
  if p_numero is null or p_numero < 1 or p_numero > coalesce(v_max,16) then
    return jsonb_build_object('error','Escolha um encontro da lista.');
  end if;
  if p_data_hora is null or p_data_hora <= now() then
    return jsonb_build_object('error','Agendamento é sempre pra frente — escolha uma data futura.');
  end if;
  if p_link is not null and p_link !~ '^https?://' then
    return jsonb_build_object('error','Confira o link: precisa ser um endereço completo (https://…).');
  end if;

  select * into v_existente from encontros e
   where e.dupla_id = p_dupla and e.numero = p_numero;
  if v_existente.status = 'realizado' then
    return jsonb_build_object('error','Esse encontro já foi realizado.');
  end if;
  if v_existente.status = 'nao_aconteceu' then
    return jsonb_build_object('error','Esse encontro foi marcado como não realizado — converse com seu mentor pra remarcar.');
  end if;

  -- remarcação de verdade = o par civil visível mudou (dia + hora:minuto).
  -- Segundos/milissegundos herdados de rows antigas não podem cobrar motivo
  -- quando a pessoa salva a mesma data que a tela mostra.
  if v_existente.id is not null
     and to_char(v_existente.data_hora at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')
         is distinct from
         to_char(p_data_hora at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') then
    if p_motivo is null or char_length(trim(p_motivo)) < 2 then
      return jsonb_build_object('error','Conte o motivo do reagendamento.');
    end if;
  elsif p_motivo is not null and char_length(trim(p_motivo)) > 1000 then
    return jsonb_build_object('error','Motivo muito longo (máx. 1000 caracteres).');
  end if;

  if v_existente.id is not null then
    update encontros set
      data_hora = p_data_hora,
      link = p_link,
      status = 'agendado',
      motivo_reagendamento = coalesce(trim(p_motivo), motivo_reagendamento)
    where id = v_existente.id and status in ('agendado','remarcado','cancelado');
    if not found then
      return jsonb_build_object('error','Esse encontro não está mais agendado.');
    end if;
  else
    insert into encontros (dupla_id, numero, data_hora, link, status, origem,
                           motivo_reagendamento, created_by)
    values (p_dupla, p_numero, p_data_hora, p_link, 'agendado', 'plataforma',
            nullif(trim(p_motivo),''), my_profile_id());
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.agendar_encontro_mentorado(uuid, integer, timestamptz, text, text) from public, anon;
grant execute on function public.agendar_encontro_mentorado(uuid, integer, timestamptz, text, text) to authenticated;

commit;
