begin;

-- 0121 — o jovem também confirma que o encontro aconteceu.
--
-- Até aqui só o registro do mentor movia um encontro pra 'realizado' — e é
-- 'realizado' que destrava a jornada inteira: o link de avaliação do jovem
-- (0071), o próximo instrumento (0099, encontro corrente = maior realizado
-- + 1) e o material do encontro seguinte no acervo. Mentor atrasado no
-- registro = jovem parado esperando. Agora qualquer ponta libera: o jovem
-- marca "Aconteceu" num encontro agendado que já passou, o status vira
-- 'realizado' e todos os triggers existentes seguem iguais (link de
-- avaliação, auto-emissão, reta final). O registro do mentor continua
-- devido — o semáforo já lê "realizado sem registro" — e o mentor recebe
-- um lembrete pra contar como foi.
--
-- Fronteiras:
--   * espelha marcar_nao_aconteceu_mentorado (0072): só o mentorado, só a
--     dupla dele ativa, só agendado e já passado.
--   * o último encontro da trilha (16º DPP, 5ª sessão especialista) NÃO:
--     realizado nele conclui a dupla (0102) — fechar a jornada segue sendo
--     registro do mentor.
--   * realizado_em = a data marcada (o jovem confirma o encontro que estava
--     na agenda, não "agora").

create or replace function public.marcar_aconteceu_mentorado(p_encontro uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_e encontros%rowtype;
  v_d record;
  v_nome text;
  v_ultimo int := 16;
begin
  if my_role() <> 'mentorado' then
    return jsonb_build_object('error', 'Só o mentorado confirma por aqui.');
  end if;
  select e.* into v_e from encontros e
   join duplas d on d.id = e.dupla_id
   where e.id = p_encontro and d.status = 'ativa'
     and exists (select 1 from jovem_duplas jd where jd.id = e.dupla_id);
  if not found then
    return jsonb_build_object('error', 'Encontro não encontrado ou dupla inativa.');
  end if;
  if v_e.data_hora > now() then
    return jsonb_build_object('error', 'Esse encontro ainda não aconteceu.');
  end if;

  select d.trilha, d.mentor_id, m.nome, m.nome_social into v_d
    from duplas d join mentorados m on m.id = d.mentorado_id
   where d.id = v_e.dupla_id;
  if v_d.trilha = 'especialista' then
    v_ultimo := 5;
  end if;
  if v_e.numero >= v_ultimo then
    return jsonb_build_object('error',
      'O último encontro é registrado pelo seu mentor.');
  end if;

  update encontros
     set status = 'realizado',
         realizado_em = coalesce(realizado_em, data_hora)
   where id = p_encontro and status = 'agendado';
  if not found then
    return jsonb_build_object('error', 'Esse encontro não está mais agendado.');
  end if;

  -- o mentor fica sabendo e registra como foi (o registro segue devido)
  v_nome := split_part(coalesce(nullif(v_d.nome_social, ''), v_d.nome), ' ', 1);
  if v_d.mentor_id is not null then
    insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    values (
      v_d.mentor_id, 'lembrete',
      format('%s confirmou o %sº encontro', v_nome, v_e.numero),
      format('%s marcou que o encontro de %s aconteceu. Conte como foi no registro.',
        v_nome,
        to_char(v_e.data_hora at time zone 'America/Sao_Paulo', 'DD/MM')),
      format('/duplas/%s#registrar-%s', v_e.dupla_id, v_e.id),
      my_profile_id()
    );
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.marcar_aconteceu_mentorado(uuid) from public, anon;
grant execute on function public.marcar_aconteceu_mentorado(uuid) to authenticated;

commit;
