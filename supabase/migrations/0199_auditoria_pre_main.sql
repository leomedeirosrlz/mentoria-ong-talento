-- 0199 — correções da auditoria pré-main.
--
-- a) Reuso de link entre momentos: o filtro de link vivo da
--    emitir_instrumento_core casava só por destinatário+form — emitir a
--    marcação 'final' reutilizava um link vivo do 'inicio' (o momento do
--    contexto era ignorado) e a revisitação nascia grudada no rótulo
--    errado. O filtro agora exige o mesmo momento (`is not distinct
--    from` cobre links antigos sem a chave e chamadas com momento null).
--    emitir_link_instrumento vai junto, verbatim — prod tem drift e a
--    migration garante a forma vigente das duas pontas da emissão.
-- b) chamados_contexto (0187): a view nascia com os grants default de
--    PUBLIC — revoga alinhando ao padrão das demais views do repo (o
--    grant pra authenticated dado na 0187 segue valendo).

begin;

-- a) emitir_instrumento_core — mesmo corpo da 0190; no filtro de reuse
-- de link vivo entra a condição de momento.
create or replace function public.emitir_instrumento_core(
  p_dupla_id uuid, p_sistema text, p_created_by uuid,
  p_origem text, p_destino text, p_momento text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
  v_rodadas int;
  v_momento text;
  v_dest_profile uuid;
  v_dest_mentorado uuid;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas', 'competencias_mentor') then
    raise exception 'instrumento inválido';
  end if;

  -- um link por (dupla, instrumento): serializa a corrida entre o trigger
  -- do encontro, a auto-cura do jovem_jornada e o clique manual do mentor
  perform pg_advisory_xact_lock(hashtext(p_dupla_id::text || ':' || p_sistema));

  select d.id, d.mentor_id, d.mentorado_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  select f.id, f.ativo into v_form
    from formularios f
   where f.sistema = p_sistema;
  if not found then
    raise exception 'instrumento oficial ainda não está cadastrado';
  end if;
  if not v_form.ativo then
    raise exception 'este instrumento está encerrado — reative em Formulários';
  end if;

  -- destinatário: o checklist é do mentor (autoavaliação — a jovem nunca
  -- responde nem lê); os 4 de jornada seguem endereçados ao mentorado.
  -- null cai no mesmo 'auto' — caller que não opina não escolhe errado.
  if p_destino is null or p_destino = 'auto' then
    p_destino := case p_sistema
      when 'competencias_mentor' then 'mentor'
      else 'mentorado' end;
  end if;
  if p_destino = 'mentor' then
    v_dest_profile := v_dupla.mentor_id;
  elsif p_destino = 'mentorado' then
    v_dest_mentorado := v_dupla.mentorado_id;
  else
    raise exception 'destinatário inválido';
  end if;

  -- momento da aplicação: p_momento explícito vence (o rito de fechamento
  -- pede 'final' mesmo sem a marcação de início); sem ele, a régua são as
  -- RESPONDIDAS — 0 → marcação de abertura, ≥1 → a do fim. Mesma regra da
  -- roda (0099), vocabulário por sistema.
  v_momento := p_momento;
  if p_sistema = 'roda_vida' then
    if v_momento not in ('inicial', 'formal') then v_momento := null; end if;
    if v_momento is null then
      select count(*) into v_rodadas
        from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = 'roda_vida'
         and x.dupla_id = v_dupla.id
         and x.usado_em is not null;
      v_momento := case when v_rodadas = 0 then 'inicial' else 'formal' end;
    end if;
  elsif p_sistema = 'competencias_mentor' then
    if v_momento not in ('inicio', 'final') then v_momento := null; end if;
    if v_momento is null then
      select count(*) into v_rodadas
        from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = 'competencias_mentor'
         and x.dupla_id = v_dupla.id
         and x.usado_em is not null;
      v_momento := case when v_rodadas = 0 then 'inicio' else 'final' end;
    end if;
  end if;

  -- reusa link pendente vigente pro mesmo destinatário+form+momento (um
  -- link vivo por destinatário por marcação — sem o match de momento, a
  -- emissão da 'final' furtava o link vivo do 'inicio'). Escopo da
  -- dupla: link dela ou órfão; um link vivo apontando pra OUTRA dupla
  -- não é furtado.
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and (v_dest_mentorado is not null and l.dest_mentorado_id = v_dest_mentorado
          or v_dest_profile is not null and l.dest_profile_id = v_dest_profile)
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.dupla_id = v_dupla.id or l.dupla_id is null)
     and (l.contexto->>'momento') is not distinct from v_momento
   order by l.created_at desc
   limit 1;
  if found then
    update formulario_links
       set dupla_id = v_dupla.id,
           contexto = contexto
             || jsonb_build_object('origem', p_origem)
             || case
                  when v_momento is not null
                       and contexto ->> 'momento' is null
                    then jsonb_build_object('momento', v_momento)
                  else '{}'::jsonb end
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from p_origem
            or (v_momento is not null and contexto ->> 'momento' is null));
    return jsonb_build_object('token', v_link.token, 'reutilizado', true);
  end if;

  insert into formulario_links (
    formulario_id, token, dest_mentorado_id, dest_profile_id,
    dupla_id, contexto, created_by
  ) values (
    v_form.id,
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    v_dest_mentorado,
    v_dest_profile,
    v_dupla.id,
    jsonb_build_object('origem', p_origem)
      || case
           when v_momento is not null
             then jsonb_build_object('momento', v_momento)
           else '{}'::jsonb end,
    p_created_by
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

-- interna, como na 0190: nem authenticated executa direto
revoke all on function public.emitir_instrumento_core(uuid, text, uuid, text, text, text)
  from public, anon, authenticated;

-- gate da emissão manual — verbatim da 0190 (re-aplicada: drift em prod)
create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text, p_momento text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas', 'competencias_mentor') then
    raise exception 'instrumento inválido';
  end if;

  select d.id, d.mentor_id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação ou o mentor DPP da dupla (mesma régua
  -- da 0097 — autorização antes dos diferenciais de trilha/status pra não
  -- vazar a classificação da dupla)
  if (
    public.my_role() = 'coordenacao'
    or (
      public.has_papel('mentor_dpp'::public.app_role)
      and v_dupla.mentor_id = public.my_profile_id()
    )
  ) is not true then
    raise exception 'sem permissão pra enviar instrumento desta dupla';
  end if;
  if v_dupla.trilha = 'especialista' then
    raise exception 'trilha de especialista não usa os instrumentos da jornada DPP';
  elsif v_dupla.status not in ('ativa', 'pausada') then
    raise exception 'jornada encerrada — instrumento é ferramenta de dupla viva';
  end if;

  return public.emitir_instrumento_core(
    p_dupla_id, p_sistema, public.my_profile_id(), 'instrumentos',
    'auto', p_momento
  );
end $$;

revoke all on function public.emitir_link_instrumento(uuid, text, text)
  from public, anon;
grant execute on function public.emitir_link_instrumento(uuid, text, text)
  to authenticated;

-- b) chamados_contexto: fecha a superfície — view criada na 0187 ficou
-- com os privilégios default de PUBLIC/anon (o grant pra authenticated
-- dela segue).
revoke all on public.chamados_contexto from public, anon;

-- c) sobrecarga velha de prod vira wrapper, não drop: jornada_autoemit
-- (0190) e emitir_instrumento_lote (0114 — fora da janela de replay)
-- seguem chamando a 4 args. O corpo manual de prod é o original pré-
-- -0190 — sem convergir ele viraria comportamento antigo em código novo.
-- O wrapper delega pra 6 args com 'auto'/null — mesma forma da 0190.
create or replace function public.emitir_instrumento_core(
  p_dupla_id uuid, p_sistema text, p_created_by uuid,
  p_origem text default 'instrumentos'
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return public.emitir_instrumento_core(
    p_dupla_id, p_sistema, p_created_by, p_origem, 'auto', null
  );
end $$;

revoke all on function public.emitir_instrumento_core(uuid, text, uuid, text)
  from public, anon, authenticated;

commit;
