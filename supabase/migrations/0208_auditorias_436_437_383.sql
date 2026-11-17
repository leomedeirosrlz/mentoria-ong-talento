-- 0208 — ajustes das auditorias independentes (435/436/437/383)
--
-- A) registrar_retroativo_mentorado (REALIZA-437, achado bloqueante da
--    auditoria): o INSERT cobria qualquer nº livre < último — passou a
--    exigir passo oficial JÁ VENCIDO (ciclo_eventos.data <= hoje). Criar
--    antes do prazo pularia o gating da jornada (0099 emite por
--    max(realizado)) e trancaria um realizado que o mentor não desfaz
--    (0043 barra saída; delete é coord, 0047). E a conversão de 'agendado'
--    aceitava data_hora FUTURA — bypass do guard data_hora <= now() da
--    0121. Agora espelha: só confirma o que já passou.
-- B) desfazer_retroativo_mentorado: trilha='dpp' no join (hardening) e
--    re-check de `not exists registros` no WHERE do delete — um registro
--    do mentor commitado na janela entre o check e o delete cairia na
--    cascata (TOCTOU; a edição da data já re-checava, o delete não).
-- C) garantir_documento_um/devidos (REALIZA-436, achados da auditoria):
--    * a linha terminal é a mais recente, não qualquer revogado do
--      histórico — emitir → revogar → reemissão manual que expira
--      ressuscita certo (a reemissão era o gesto mais recente);
--    * documento_path quita a autorização (régua docOkMentorado) — o
--      emissor parava de criar pendência-fantasma pro papel anexado;
--    * data_nascimento futura não conta como menor (faltava <= hoje,
--      mesmo bound do idade());
--    * foraDoPrograma (situacao <> 'ativo') não deve doc novo — a régua
--      de pendência e o lote já excluíam, o login alinhava.
-- D) abrir_relatorio (REALIZA-383, follow-up): o grade do /resumo
--    projeta role + papeis por profile — o montarLinhas aplica a mesma
--    régua soEspecialista do /pessoas e o só-especialista inscrito deixa
--    de aparecer "Sem dupla" no link público.

begin;

-- ---------- A/B: retroativo do jovem ----------

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
    -- mesma régua do marcar_aconteceu (0121): "aconteceu" só depois da
    -- hora marcada — um agendado futuro não vira fato retroativo por
    -- aqui (antes, a hora livre do jovem bypassava o guard da 0121)
    if v_existente.data_hora > now() then
      return jsonb_build_object('error','Esse encontro ainda está marcado pro futuro. Se aconteceu antes, seu mentor confirma na ficha.');
    end if;
    -- remarcado é legado, mas a row ainda é agendável (mesma leitura das
    -- actions); realizado de mais ninguém já saiu acima
    update encontros set
      status = 'realizado',
      data_hora = p_data_hora,
      realizado_em = p_data_hora
     where id = v_existente.id and status in ('agendado','remarcado')
       and data_hora <= now();
    if not found then
      return jsonb_build_object('error','Esse encontro não está disponível pra esse registro.');
    end if;
    v_id := v_existente.id;
  else
    -- sem row: só passo oficial já vencido — criar antes da data oficial
    -- pularia o gating da jornada (0099 emite por max(realizado)) e
    -- trancaria um realizado irreversível pro mentor (0043/0047)
    if not exists (select 1 from ciclo_eventos ev
                    where ev.cronograma_id = v_d.cronograma_id
                      and ev.tipo = 'encontro' and ev.numero = p_numero
                      and ev.data <= current_date) then
      return jsonb_build_object('error','Esse encontro ainda não chegou na data oficial do guia.');
    end if;
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
   where e.id = p_encontro and d.status = 'ativa' and d.trilha = 'dpp'
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
  -- TOCTOU: o check de cima não segura a janela até o delete — re-checa
  -- no WHERE pra um registro do mentor recém-commitado não cair na cascata
  delete from encontros
   where id = p_encontro and status = 'realizado'
     and created_by = my_profile_id()
     and not exists (select 1 from registros r
       where r.encontro_id = p_encontro);
  if not found then
    return jsonb_build_object('error','Esse encontro não está mais editável.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.registrar_retroativo_mentorado(uuid,int,timestamptz)
  from public, anon;
grant execute on function public.registrar_retroativo_mentorado(uuid,int,timestamptz)
  to authenticated;
revoke all on function public.desfazer_retroativo_mentorado(uuid)
  from public, anon;
grant execute on function public.desfazer_retroativo_mentorado(uuid)
  to authenticated;

-- ---------- C: autoemissão no login — achados R1/R2/R3 ----------

create or replace function public.garantir_documento_um(
  p_signatario text, p_alvo uuid, p_template uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_viva record;
  v_terminal record;
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

  -- a LINHA TERMINAL decide: o gesto mais recente manda. revogado em
  -- qualquer ponto do histórico não congela uma reemissão posterior que
  -- expirou (emitir → revogar → reemissão expirada ressuscita, porque a
  -- reemissão foi a última palavra da coordenação); revogado por último
  -- não volta — a revogação é decisão, não acidente
  select a.id, a.status into v_terminal
    from public.assinaturas a
   where a.template_id = p_template and a.status in ('revogado','expirado')
     and ((p_signatario = 'profile' and a.profile_id = p_alvo)
       or (p_signatario = 'mentorado' and a.mentorado_id = p_alvo))
   order by a.created_at desc
   limit 1;
  if v_terminal.status = 'revogado' then
    return;
  end if;
  if v_terminal.status = 'expirado' then
    update public.assinaturas
       set status = 'pendente',
           token = gen_random_uuid(),
           token_expira_em = now() + interval '30 days'
     where id = v_terminal.id;
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
  v_autorizacao_ok boolean := false;
  v_fora boolean := false;
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
    -- quem saiu do programa (desistente/concluído — foraDoPrograma da
    -- régua TS) não acumula doc novo: pendência e lote já o excluíam
    select m.data_nascimento is not null
           and m.data_nascimento <= current_date
           and m.data_nascimento > (current_date - interval '18 years')::date,
           m.documento_path is not null,
           m.situacao is not null and m.situacao <> 'ativo'
      into v_menor, v_autorizacao_ok, v_fora
      from public.mentorados m
     where m.id = v_mentorado;
    if v_fora then
      return;
    end if;
    -- <18 hoje pela data da ficha (data futura não conta — mesmo bound
    -- do idade()); documento_path é o papel assinado por fora e já quita
    -- a autorização (régua docOkMentorado) — emitir de novo criaria
    -- pendência-fantasma. Sem data a autorização fica de fora.
    for v_tpl in
      select t.id, t.slug
        from public.documento_templates t
       where t.ativo and t.signatario = 'mentorado'
         and (t.slug <> 'autorizacao-responsavel'
              or (v_menor and not v_autorizacao_ok))
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

-- ---------- D: abrir_relatorio projeta role + papeis no grade ----------

CREATE OR REPLACE FUNCTION public.abrir_relatorio(p_slug text, p_senha text, p_ip_hash text, p_ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link record;
  v_cfg jsonb;
  v_tipo text;
  v_turma text;
  v_cron uuid;
  v_cron_des uuid;
  v_doc text;
  v_st text;
  v_contato boolean;
  v_dados jsonb;
  v_profiles jsonb;
  v_mentorados jsonb;
  v_audit_fail boolean := false;
  v_n_ip bigint;
  v_n_slug bigint;
  v_min_ip timestamptz;
  v_min_slug timestamptz;
  v_retry timestamptz;
begin
  -- serializa tentativas por slug: a contagem do limite e o insert do log
  -- enxergam a mesma verdade sob concorrência (lock morre com a transação)
  if p_slug is not null then
    perform pg_advisory_xact_lock(hashtext('resumo:' || p_slug));
  end if;

  -- poda lazy de retenção (13 meses, decisão _decisoes.md — molde
  -- login_handoffs 0049): a RPC mais chamada carrega a manutenção
  begin
    delete from public.resumo_acessos
     where acessado_em < now() - interval '13 months';
  exception when others then
    v_audit_fail := true;
  end;

  select l.id, l.slug, l.titulo, l.senha_hash, l.config,
         l.expira_em, l.revogado_em
    into v_link
    from public.relatorio_links l
   where l.slug = p_slug;

  if not found then
    -- slug inexistente não vira linha: o log não é sensor de enumeração
    return jsonb_build_object('ok', false, 'motivo', 'sem_link');
  end if;

  -- gates de estado antes de qualquer custo de senha
  if v_link.revogado_em is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'revogado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'revogado', 'audit_fail', v_audit_fail);
  end if;
  if v_link.expira_em is not null and v_link.expira_em <= now() then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'expirado');
    return jsonb_build_object(
      'ok', false, 'motivo', 'expirado', 'audit_fail', v_audit_fail);
  end if;

  -- rate-limit, dois eixos (o lock acima serializa contagem + insert):
  --   a) (slug, ip_hash): 5 falhas/15min — o ip_hash é fornecido pelo app,
  --      que o deriva de header confiável; via REST direto o argumento é
  --      forjável — por isso ele NÃO é o bound de segurança…
  --   b) slug global: 50 falhas/24h — este é o bound de verdade (sdr R1):
  --      nem mil IPs falsos passam dele.
  begin
    select count(*) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           count(*) filter (
             where a.acessado_em > now() - interval '24 hours'),
           min(a.acessado_em) filter (
             where a.ip_hash = p_ip_hash
               and a.acessado_em > now() - interval '15 minutes'),
           min(a.acessado_em) filter (
             where a.acessado_em > now() - interval '24 hours')
      into v_n_ip, v_n_slug, v_min_ip, v_min_slug
      from public.resumo_acessos a
     where a.slug = p_slug and not a.ok;
  exception when others then
    -- fail-open por decisão: auditoria quebrada não pode transformar o
    -- relatório público inteiro em indisponível; audit_fail avisa o Sentry
    v_audit_fail := true;
    v_n_ip := 0;
    v_n_slug := 0;
  end;

  v_retry := null;
  if coalesce(v_n_ip, 0) >= 5 then
    v_retry := v_min_ip + interval '15 minutes';
  end if;
  if coalesce(v_n_slug, 0) >= 50 then
    v_retry := greatest(
      coalesce(v_retry, v_min_slug + interval '24 hours'),
      v_min_slug + interval '24 hours');
  end if;
  if v_retry is not null then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'limite');
    return jsonb_build_object(
      'ok', false, 'motivo', 'limite',
      'retry_em', v_retry, 'audit_fail', v_audit_fail);
  end if;

  -- senha: bcrypt compara sem expor timing — IS DISTINCT FROM porque crypt
  -- devolve NULL com hash corrompido e NULL <> x avaliaria NULL (o IF
  -- trataria como falso e abriria o link). O sleep iguala a latência do
  -- erro à faixa do sucesso (o crypt de verdade custa ~80ms)
  if v_link.senha_hash is not null then
    if p_senha is null
       or extensions.crypt(p_senha, v_link.senha_hash)
          is distinct from v_link.senha_hash then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'senha');
      perform pg_sleep(0.3);
      return jsonb_build_object(
        'ok', false, 'motivo', 'senha', 'audit_fail', v_audit_fail);
    end if;
  end if;

  -- allowlist de tipos na leitura TAMBÉM: config 'respostas' forjado por
  -- SQL direto (bypass da RPC de criação) morre aqui, não na serialização
  v_cfg := v_link.config;
  v_tipo := v_cfg->>'tipo';
  if v_tipo is null or v_tipo not in ('grade', 'ciclo', 'assinaturas') then
    v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
      p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
    return jsonb_build_object(
      'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
  end if;

  v_turma := nullif(v_cfg->>'turma', '');
  -- comparação textual, não cast: 'yes'::boolean explodiria a RPC com
  -- config forjado — '= ''true''' degrada pra false, que é o seguro
  v_contato := (v_cfg->>'expor_contato') = 'true';

  -- ---------------------------------------------------------- grade
  if v_tipo = 'grade' then
    -- participantes = mentores + auxiliares das duplas do recorte + a fila
    -- de espera da turma (turma_inscricoes, 0111). Sem select *: id, nome e
    -- cidade/uf são o que as linhas consomem; contato só entra no opt-in.
    if v_contato then
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf, p2.email, p2.whatsapp,
                 p2.role,
                 (select array_agg(g.papel) from public.profile_papeis g
                   where g.profile_id = p2.id) as papeis
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf, m2.email, m2.whatsapp
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    else
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
        from (
          select p2.id, p2.nome, p2.cidade, p2.uf, p2.role,
                 (select array_agg(g.papel) from public.profile_papeis g
                   where g.profile_id = p2.id) as papeis
            from public.profiles p2
           where p2.id in (
             select d.mentor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select d.supervisor_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
                and d.supervisor_id is not null
             union
             select i.profile_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.profile_id is not null)
        ) p;
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
        from (
          select m2.id, m2.nome, m2.cidade, m2.uf
            from public.mentorados m2
           where m2.id in (
             select d.mentorado_id from public.duplas d
              where (v_turma is null or d.turma = v_turma)
             union
             select i.mentorado_id from public.turma_inscricoes i
              where i.status = 'aguardando' and i.turma = v_turma
                and i.mentorado_id is not null)
        ) m;
    end if;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.mentor_id, d2.mentorado_id,
                 d2.supervisor_id, d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
        ) d), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'inscricoes', coalesce((
        select jsonb_agg(to_jsonb(i)) from (
          select i2.papel_esperado, i2.profile_id, i2.mentorado_id
            from public.turma_inscricoes i2
           where i2.status = 'aguardando' and i2.turma = v_turma
        ) i), '[]'::jsonb)
    ) into v_dados;

  -- ---------------------------------------------------------- ciclo
  elsif v_tipo = 'ciclo' then
    -- cronograma_id: uuid válido ou nada — um forjado não pode alargar o
    -- recorte nem explodir a RPC no cast
    if v_cfg->>'cronograma_id' is not null
       and (v_cfg->>'cronograma_id') !~
           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_cron := nullif(v_cfg->>'cronograma_id', '')::uuid;

    -- nomes só: o relatório de ciclo não tem coluna de contato, então
    -- email/whatsapp não atravessam nem com expor_contato forjado
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome from public.profiles p2
         where p2.id in (
           select d.mentor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
           union
           select d.supervisor_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron)
              and d.supervisor_id is not null)
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select d.mentorado_id from public.duplas d
            where (v_turma is null or d.turma = v_turma)
              and (v_cron is null or d.cronograma_id = v_cron))
      ) m;

    select jsonb_build_object(
      'duplas', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.iniciada_em) from (
          select d2.id, d2.turma, d2.trilha, d2.cronograma_id,
                 d2.mentor_id, d2.mentorado_id, d2.supervisor_id,
                 d2.status, d2.iniciada_em, d2.demanda
            from public.duplas d2
           where (v_turma is null or d2.turma = v_turma)
             and (v_cron is null or d2.cronograma_id = v_cron)
        ) d), '[]'::jsonb),
      'encontros', coalesce((
        select jsonb_agg(to_jsonb(e)) from (
          select e2.id, e2.dupla_id, e2.numero, e2.data_hora,
                 e2.realizado_em, e2.status, e2.motivo_reagendamento,
                 e2.duracao_min
            from public.encontros e2
           where e2.dupla_id in (
             select d3.id from public.duplas d3
              where (v_turma is null or d3.turma = v_turma)
                and (v_cron is null or d3.cronograma_id = v_cron))
        ) e), '[]'::jsonb),
      'registros', coalesce((
        select jsonb_agg(to_jsonb(r)) from (
          select r2.encontro_id, r2.created_at, r2.avaliacao,
                 -- texto livre (opção "outro" do form semanal) morre na
                 -- fronteira: só os valores do catálogo saem do banco —
                 -- ATIVIDADES_ENCONTRO de src/lib/ciclo.ts, duplicado de
                 -- propósito porque a fronteira é aqui, não na serialização
                 (select coalesce(array_agg(a), '{}'::text[])
                    from unnest(r2.atividades) a
                   where a = any (array[
                     'Conversa de acompanhamento',
                     'Orientação individual',
                     'Atividade prática',
                     'Desenvolvimento de competência',
                     'Acompanhamento de atividade/tarefa',
                     'Identificação de dificuldades',
                     'Orientação profissional'])) as atividades
            from public.registros r2
           where r2.encontro_id in (
             select e3.id from public.encontros e3
              join public.duplas d3 on d3.id = e3.dupla_id
             where (v_turma is null or d3.turma = v_turma)
               and (v_cron is null or d3.cronograma_id = v_cron))
        ) r), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados,
      'cronogramas', coalesce((
        select jsonb_agg(to_jsonb(c)) from (
          select c2.id, c2.nome from public.cronogramas c2
           where c2.id in (
             select d4.cronograma_id from public.duplas d4
              where (v_turma is null or d4.turma = v_turma)
                and (v_cron is null or d4.cronograma_id = v_cron)
                and d4.cronograma_id is not null)
        ) c), '[]'::jsonb)
    ) into v_dados;

  -- ------------------------------------------------------- assinaturas
  else
    if v_cfg->>'status_assinatura' is not null
       and (v_cfg->>'status_assinatura') not in
           ('pendente','assinado','revogado','expirado') then
      v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
        p_slug, v_link.id, p_ip_hash, p_ua, '{}'::jsonb, false, 'config');
      return jsonb_build_object(
        'ok', false, 'motivo', 'config', 'audit_fail', v_audit_fail);
    end if;
    v_doc := nullif(v_cfg->>'documento', '');
    v_st := nullif(v_cfg->>'status_assinatura', '');

    -- O que NÃO sai: dados_snapshot (CPF/RG/endereço), assinatura_texto,
    -- ip/user_agent, hash_documento, token — a linha pública é nome +
    -- documento + status + datas, como o CSV interno menos a evidência.
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_profiles
      from (
        select p2.id, p2.nome, p2.role from public.profiles p2
         where p2.id in (
           select a.profile_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.profile_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st)
           union
           select a.created_by from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.created_by is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) p;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_mentorados
      from (
        select m2.id, m2.nome from public.mentorados m2
         where m2.id in (
           select a.mentorado_id from public.assinaturas a
            join public.documento_templates t on t.id = a.template_id
           where a.mentorado_id is not null
             and (v_doc is null or t.slug = v_doc)
             and (v_st is null or a.status = v_st))
      ) m;

    select jsonb_build_object(
      'assinaturas', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
          select a2.id, a2.profile_id, a2.mentorado_id, a2.status,
                 a2.assinado_em, a2.created_at, a2.token_expira_em,
                 a2.created_by,
                 jsonb_build_object(
                   'slug', t.slug, 'titulo', t.titulo,
                   'versao', t.versao, 'signatario', t.signatario
                 ) as template
            from public.assinaturas a2
            join public.documento_templates t on t.id = a2.template_id
           where (v_doc is null or t.slug = v_doc)
             and (v_st is null or a2.status = v_st)
        ) a), '[]'::jsonb),
      'profiles', v_profiles,
      'mentorados', v_mentorados
    ) into v_dados;
  end if;

  -- desfecho (0124): o agregado sai pela MESMA porta — quem abriu o
  -- relatório vê os números do recorte. Escopo: o cronograma do config
  -- (tipo ciclo) ou o resolvido pela turma; recorte sem turma lê o
  -- programa inteiro; turma sem cronograma omite a chave (mostrar o
  -- global num recorte que não cobriu o programa inteiro confundiria).
  v_cron_des := v_cron;
  if v_cron_des is null and v_turma is not null then
    select c.id into v_cron_des
      from public.cronogramas c
     where c.turma = v_turma
     limit 1;
  end if;
  if v_turma is null or v_cron_des is not null then
    v_dados := v_dados || jsonb_build_object(
      'desfecho', public.desfecho_agregado(v_cron_des));
  end if;

  -- sucesso: a linha guarda o config servido (auditoria do "o que estava
  -- compartilhado"), não a URL — que não carrega recorte nenhum mais
  v_audit_fail := v_audit_fail or not public.resumo_log_acesso(
    p_slug, v_link.id, p_ip_hash, p_ua, v_link.config, true, null);

  return jsonb_build_object(
    'ok', true,
    'config', v_cfg,
    'dados', v_dados,
    'audit_fail', v_audit_fail);
end;
$function$;

-- fim 0208
