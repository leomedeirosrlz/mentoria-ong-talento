-- 0206 — autoemissão dos documentos devidos no login
--
-- CONTEXTO
-- Documentos de assinatura eram 100% manuais: a coordenação emitia cada
-- link pela ficha/lote (emitirUm, actions-assinaturas) e quem nunca foi
-- alvo do gesto ficava sem contrato até ela lembrar. Decisão: no login a
-- plataforma garante que todo documento devido do papel da pessoa está
-- emitido — a RPC roda no mount do shell ((app)/layout e (jovem)/layout)
-- e cobre 1º login, conta antiga com documento novo no catálogo e link
-- vencido, sem gesto da coordenação.
--
-- Devido por papel:
--   · mentorado (my_mentorado_id resolve a ficha): todo template ativo
--     com signatario='mentorado' — hoje termo-mentorando sempre e
--     autorizacao-responsavel quando data_nascimento (0034) indica menor
--     de 18. Sem a data a autorização não sai automática: a ficha segue
--     podendo receber a emissão manual da coordenação.
--   · demais papeis com profiles.voluntario (0142): os ativos com
--     signatario='profile' — hoje termo-voluntario.
-- A policy assinaturas_insert (0058) exige my_role()='coordenacao', então
-- a emissão própria só existe por definer — o mesmo caminho das demais
-- RPCs do fluxo (assinar_termo, regenerar_token_assinatura).
--
-- Idempotência no mesmo contrato do emitirUm: a row viva
-- (assinaturas_viva_uk, 0053 — pendente|assinado por alvo×template)
-- fecha a emissão; pendente com token morto ganha token novo na mesma
-- row (o "Reenviar" da ficha); expirado ressuscita como pendente com
-- token novo (expiração é acidente de prazo, não decisão); revogado NÃO
-- ressuscita — a revogação é gesto da coordenação. created_by null = self
-- (0033), token_expira_em +30d como na emissão manual.

begin;

-- helper interno: um documento por chamada — decide por alvo o que falta.
create or replace function public.garantir_documento_um(
  p_signatario text, p_alvo uuid, p_template uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_viva record;
begin
  -- já assinado: a obrigação está cumprida (qualquer row assinada vale —
  -- o histórico pode acumular revogadas/expiradas depois dela)
  if exists (
    select 1 from public.assinaturas a
     where a.template_id = p_template and a.status = 'assinado'
       and ((p_signatario = 'profile' and a.profile_id = p_alvo)
         or (p_signatario = 'mentorado' and a.mentorado_id = p_alvo))
  ) then
    return;
  end if;

  -- pendente: token vivo encerra; morto regenera na mesma row — o
  -- equivalente ao "Reenviar" da ficha, sem criar linha nova
  select a.id, a.token_expira_em into v_viva
    from public.assinaturas a
   where a.template_id = p_template and a.status = 'pendente'
     and ((p_signatario = 'profile' and a.profile_id = p_alvo)
       or (p_signatario = 'mentorado' and a.mentorado_id = p_alvo));
  if v_viva.id is not null then
    if v_viva.token_expira_em is not null
       and v_viva.token_expira_em <= now() then
      update public.assinaturas
         set token = gen_random_uuid(),
             token_expira_em = now() + interval '30 days'
       where id = v_viva.id;
    end if;
    return;
  end if;

  -- revogado é gesto da coordenação — não desfaz no login
  if exists (
    select 1 from public.assinaturas a
     where a.template_id = p_template and a.status = 'revogado'
       and ((p_signatario = 'profile' and a.profile_id = p_alvo)
         or (p_signatario = 'mentorado' and a.mentorado_id = p_alvo))
  ) then
    return;
  end if;

  -- expirado ressuscita na row mais recente (token novo + 30d) — a
  -- expiração é mecânica, o documento segue devido
  update public.assinaturas
     set status = 'pendente',
         token = gen_random_uuid(),
         token_expira_em = now() + interval '30 days'
   where id = (
     select a.id from public.assinaturas a
      where a.template_id = p_template and a.status = 'expirado'
        and ((p_signatario = 'profile' and a.profile_id = p_alvo)
          or (p_signatario = 'mentorado' and a.mentorado_id = p_alvo))
      order by a.created_at desc
      limit 1
   );
  if found then
    return;
  end if;

  -- nunca emitido: a pendência nasce já com link (o token é default).
  -- on conflict cobre a corrida de dois logins paralelos — o perdedor
  -- cai no do nothing e a row do vencedor é a viva única
  insert into public.assinaturas
    (template_id, profile_id, mentorado_id, token_expira_em)
  values (
    p_template,
    case when p_signatario = 'profile' then p_alvo end,
    case when p_signatario = 'mentorado' then p_alvo end,
    now() + interval '30 days'
  )
  on conflict do nothing;
end $$;

revoke all on function public.garantir_documento_um(text, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.garantir_documentos_devidos()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid := public.my_profile_id();
  v_role public.app_role := public.my_role();
  v_mentorado uuid;
  v_menor boolean := false;
  v_voluntario boolean;
  v_tpl record;
begin
  -- my_profile_id/my_role já filtram ativo (0003/0066): conta sem
  -- cadastro, sem papel ou desativada não deve nada
  if v_profile is null or v_role is null then
    return;
  end if;

  if v_role = 'mentorado' then
    v_mentorado := public.my_mentorado_id();
    if v_mentorado is null then
      return; -- papel sem ficha vinculada: não há alvo pra emitir
    end if;
    -- <18 hoje pela data da ficha; sem data, a autorização fica de fora
    -- (a emissão manual da coordenação cobre o caso)
    select m.data_nascimento is not null
           and m.data_nascimento > (current_date - interval '18 years')::date
      into v_menor
      from public.mentorados m
     where m.id = v_mentorado;
    for v_tpl in
      select t.id, t.slug
        from public.documento_templates t
       where t.ativo and t.signatario = 'mentorado'
         and (t.slug <> 'autorizacao-responsavel' or v_menor)
    loop
      -- um doc falho não derruba os outros nem o login (mesmo desenho
      -- do jornada_autoemit, 0099)
      begin
        perform public.garantir_documento_um('mentorado', v_mentorado, v_tpl.id);
      exception when others then
        raise warning 'garantir_documentos_devidos(mentorado %, %): %',
          v_mentorado, v_tpl.slug, sqlerrm;
      end;
    end loop;
    return;
  end if;

  -- staff: o termo do voluntário só se aplica a quem é voluntário (0142)
  select p.voluntario into v_voluntario
    from public.profiles p
   where p.id = v_profile;
  if not coalesce(v_voluntario, false) then
    return;
  end if;
  for v_tpl in
    select t.id, t.slug
      from public.documento_templates t
     where t.ativo and t.signatario = 'profile'
  loop
    begin
      perform public.garantir_documento_um('profile', v_profile, v_tpl.id);
    exception when others then
      raise warning 'garantir_documentos_devidos(profile %, %): %',
        v_profile, v_tpl.slug, sqlerrm;
    end;
  end loop;
end $$;

revoke all on function public.garantir_documentos_devidos() from public, anon;
grant execute on function public.garantir_documentos_devidos() to authenticated;

commit;
