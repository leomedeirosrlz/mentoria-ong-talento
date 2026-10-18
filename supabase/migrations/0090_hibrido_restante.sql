-- 0090 — híbrido DPP+especialista, o restante do banco (WP6b / REALIZA-148,149).
--
-- A 0087 migrou mural/solicitações/aceite pra has_papel, mas o resto do schema
-- seguia conferindo o papel PRIMÁRIO (profiles.role / my_role()). Pra quem tem
-- papel especialista secundário isso bloqueava grade/exceções (write), avisos e
-- materiais da audiência, avaliações da própria trilha, remanejamento e os
-- pings da negociação — o inverso do que a 0087 pretendia. Inclui ainda o fix
-- do `d.especialista_id` inexistente em abrir_chamado (bug de produção, quebra
-- pra QUALQUER não-mentorado com p_dupla_id) e a trilha no ramo mentor de
-- avaliacoes_select/emitir_link_instrumento (instrumento e avaliação integral
-- são da trilha DPP — o híbrido só os exerce nas duplas DPP dele).

begin;

-- ---------- 1) agenda do especialista (0073): grade/exceções por has_papel ----------

drop policy especialista_grade_insert on public.especialista_grade;
create policy especialista_grade_insert on public.especialista_grade
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy especialista_grade_update on public.especialista_grade;
create policy especialista_grade_update on public.especialista_grade
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy especialista_excecoes_insert on public.especialista_excecoes;
create policy especialista_excecoes_insert on public.especialista_excecoes
  for insert to authenticated
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

drop policy especialista_excecoes_update on public.especialista_excecoes;
create policy especialista_excecoes_update on public.especialista_excecoes
  for update to authenticated
  using (profile_id = public.my_profile_id() or public.my_role() = 'coordenacao')
  with check (
    (profile_id = public.my_profile_id()
      and public.has_papel('mentor_especialista'::public.app_role))
    or public.my_role() = 'coordenacao'
  );

-- ---------- 2) audiência por papel efetivo: comunicados + materiais ----------

drop policy comunicados_select on public.comunicados;
create policy comunicados_select on public.comunicados for select using (
  public.my_role() is not null and (
    audiencia = 'todos'
    or public.my_role() = 'coordenacao'
    or (audiencia = 'dpp'
      and public.has_papel('mentor_dpp'::public.app_role))
    or (audiencia = 'especialista'
      and public.has_papel('mentor_especialista'::public.app_role))
    or (audiencia = 'equipe'
      and public.has_papel('supervisor'::public.app_role))
  )
);

drop policy materiais_select on public.materiais;
create policy materiais_select on public.materiais for select using (
  public.my_role() is not null and (
    audiencia = 'todos'
    or public.my_role() = 'coordenacao'
    or (audiencia = 'dpp'
      and public.has_papel('mentor_dpp'::public.app_role))
    or (audiencia = 'especialista'
      and public.has_papel('mentor_especialista'::public.app_role))
  )
);

drop policy materiais_storage_select on storage.objects;
create policy materiais_storage_select on storage.objects for select
  using (
    bucket_id = 'materiais'
    and public.my_role() is not null
    and exists (
      select 1 from public.materiais m
      where m.path = name
        and (
          m.audiencia = 'todos'
          or public.my_role() = 'coordenacao'
          or (m.audiencia = 'dpp'
            and public.has_papel('mentor_dpp'::public.app_role))
          or (m.audiencia = 'especialista'
            and public.has_papel('mentor_especialista'::public.app_role))
        )
    )
  );

-- ---------- 3) avaliações: papéis efetivos + ramo mentor restrito à trilha DPP ----------
-- especialista não lê a avaliação integral da própria trilha esp (autocensura
-- do jovem) — só estrelas via view. Sem o guard de trilha, o híbrido com papel
-- DPP leria avaliacoes_encontro das trilhas esp dele pelo ramo mentor_dpp.

drop policy avaliacoes_select on public.avaliacoes_encontro;
create policy avaliacoes_select on avaliacoes_encontro
  for select to authenticated using (
    my_role() = 'coordenacao'
    or (public.has_papel('supervisor'::public.app_role) and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.supervisor_id = my_profile_id()))
    or (public.has_papel('mentor_dpp'::public.app_role)
      and avaliacao_visivel_mentor and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.mentor_id = my_profile_id()
        and d.trilha is distinct from 'especialista'))
    or (my_role() = 'mentorado' and exists (
      select 1 from jovem_duplas jd where jd.id = dupla_id))
  );

create or replace view especialista_avaliacoes as
  select a.id, a.dupla_id, a.encontro_id, a.estrelas, a.created_at,
         e.numero, e.realizado_em
    from avaliacoes_encontro a
    join duplas d on d.id = a.dupla_id
    join encontros e on e.id = a.encontro_id
   where public.has_papel('mentor_especialista'::public.app_role)
     and d.trilha = 'especialista'
     and d.mentor_id = public.my_profile_id();

-- ---------- 4) notificacoes_insert (0072): pings da trilha esp por has_papel ----------
-- O destinatário de 'demanda_especialista' e o AUTOR de 'especialista_aceitou'
-- /'trilha_encerrada' pediam o papel primário — híbrido não recebia o ping
-- direcionado nem avisava a coord/o autor do pedido ao aceitar/encerrar.
-- has_papel(profile, papel) já confere ativo por dentro — o exists em
-- profiles some junto (e não depende mais do invoker enxergar a row).

drop policy notificacoes_insert on notificacoes;
create policy notificacoes_insert on notificacoes for insert with check (
  my_role() = 'coordenacao'
  or (created_by = my_profile_id() and (
    -- ramo agenda: mentor↔mentorado do mesmo par (qualquer trilha)
    (tipo in ('encontro_marcado','encontro_alterado','encontro_desfeito')
      and par_de_mim(notificacoes.profile_id))
    or (tipo = 'pedido_apoio'
      and exists (select 1 from profiles p
        where p.id = notificacoes.profile_id
          and p.role in ('coordenacao','supervisor')))
    or (tipo = 'pedido_apoio' and my_role() = 'mentorado'
      and exists (select 1 from jovem_contatos jc where jc.id = notificacoes.profile_id))
    or (tipo = 'demanda_especialista'
      and public.has_papel(notificacoes.profile_id, 'mentor_especialista'::public.app_role))
    or (tipo in ('solicitacao_registrada','solicitacao_cancelada')
      and exists (select 1 from profiles p
        where p.id = notificacoes.profile_id and p.role = 'coordenacao'))
    or (tipo = 'especialista_aceitou'
      and public.has_papel('mentor_especialista'::public.app_role)
      and (exists (select 1 from profiles p
             where p.id = notificacoes.profile_id and p.role = 'coordenacao')
        or exists (select 1 from solicitacoes_especialista s
             where s.created_by = notificacoes.profile_id
               and s.especialista_id = my_profile_id())))
    or (tipo = 'trilha_encerrada'
      and public.has_papel('mentor_especialista'::public.app_role)
      and (exists (select 1 from profiles p
             where p.id = notificacoes.profile_id and p.role = 'coordenacao')
        or exists (select 1 from solicitacoes_especialista s
             where s.created_by = notificacoes.profile_id
               and s.especialista_id = my_profile_id())))
    or (tipo = 'supervisao_registrada' and my_role() = 'supervisor'
      and exists (select 1 from supervisoes s
        where s.supervisor_id = my_profile_id()
          and s.mentor_id = notificacoes.profile_id))
  ))
);

-- ---------- 5) rematch_dupla (0064): papel do novo mentor por has_papel ----------

create or replace function public.rematch_dupla(
  p_dupla_id uuid,
  p_lado text,
  p_novo_id uuid,
  p_motivo text default null,
  p_registrar_nota boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  antiga public.duplas%rowtype;
  nova uuid;
  novo_mentor uuid;
  novo_mentorado uuid;
  papel_esperado text;
  nota_saida text;
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
    -- com o papel da trilha como secundário passa a ser candidato válido
    if not public.has_papel(p_novo_id, papel_esperado::public.app_role) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
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

  update public.duplas set status = 'encerrada' where id = p_dupla_id;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de, pdm_url
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id,
    -- PDM é do mentorado: viaja só quando ele permanece
    case when p_lado = 'mentor' then antiga.pdm_url else null end
  )
  returning id into nova;

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
$$;

revoke all on function public.rematch_dupla(uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.rematch_dupla(uuid, text, uuid, text, boolean) to authenticated;

-- ---------- 6) abrir_chamado (0084): d.especialista_id não existe (REALIZA-148) ----------
-- Na trilha esp o especialista é duplas.mentor_id — a coluna citada nunca
-- existiu e o parse quebrava a função pra qualquer não-mentorado com
-- p_dupla_id. Corpo verbatim da 0084, só o predicado corrigido.

create or replace function public.abrir_chamado(
  p_categoria text, p_assunto text, p_mensagem text,
  p_descricao_outro text default null, p_dupla_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_role text := public.my_role();
  v_autor uuid := public.my_profile_id();
  v_mentorado uuid := public.my_mentorado_id();
  v_id uuid; v_numero text; v_dests jsonb;
begin
  if v_autor is null or v_role is null then
    raise exception 'sem sessão ativa';
  end if;
  if p_categoria is null or p_categoria not in
     ('agenda','metodologia','plataforma','urgencia','outro') then
    raise exception 'categoria inválida';
  end if;
  if p_categoria = 'outro' and
     (p_descricao_outro is null or char_length(btrim(p_descricao_outro)) < 2) then
    raise exception 'descreva em poucas palavras o assunto do chamado';
  end if;
  if p_assunto is null or char_length(p_assunto) < 2
     or char_length(p_assunto) > 200 then
    raise exception 'assunto precisa ter entre 2 e 200 caracteres';
  end if;
  if p_mensagem is not null and char_length(p_mensagem) > 5000 then
    raise exception 'mensagem passa de 5000 caracteres';
  end if;
  if v_role = 'mentorado' then
    -- o jovem não escolhe dupla no formulário; a dupla ativa dele entra como
    -- contexto pra equipe saber de quem se trata (não dá acesso ao mentor)
    if p_dupla_id is null then
      select d.id into p_dupla_id from duplas d
       where d.mentorado_id = v_mentorado and d.status = 'ativa'
       order by d.iniciada_em desc nulls last limit 1;
    elsif not exists (select 1 from duplas d
      where d.id = p_dupla_id and d.mentorado_id = v_mentorado) then
      raise exception 'dupla não encontrada';
    end if;
  elsif p_dupla_id is not null then
    -- mentor/especialista só abre chamado atrelado a dupla própria; equipe livre.
    -- Na trilha esp o especialista é d.mentor_id — mesmo vínculo, uma coluna só.
    if v_role in ('mentor_dpp','mentor_especialista') and not exists
       (select 1 from duplas d where d.id = p_dupla_id
          and d.mentor_id = v_autor) then
      raise exception 'dupla não encontrada';
    end if;
  end if;

  insert into chamados
    (autor_id, autor_mentorado_id, dupla_id, categoria, descricao_outro,
     assunto, mensagem, origem)
  values (v_autor,
    case when v_role = 'mentorado' then v_mentorado end,
    p_dupla_id, p_categoria, nullif(btrim(p_descricao_outro), ''),
    btrim(p_assunto), nullif(p_mensagem, ''), 'manual')
  returning id, numero into v_id, v_numero;

  perform chamado_evento(v_id,
    'Chamado aberto por ' ||
    coalesce((select nome from profiles where id = v_autor), 'autor') || '.');
  perform chamado_notifica_equipe(v_id, 'chamado_aberto',
    'Chamado ' || v_numero || ' aberto',
    'Categoria ' || p_categoria || ': ' || btrim(p_assunto));

  -- urgência e chamado do jovem viram e-mail redundante pro staff
  if p_categoria = 'urgencia' or v_role = 'mentorado' then
    select jsonb_agg(jsonb_build_object(
             'profile_id', p.id, 'email', p.email, 'nome', p.nome))
      into v_dests
      from profiles p
     where p.ativo and (
       p.role = 'coordenacao'
       or (p_categoria <> 'plataforma' and p.id =
           (select d.supervisor_id from duplas d where d.id = p_dupla_id)));
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero,
    'destinatarios', coalesce(v_dests, '[]'::jsonb));
end $$;
grant execute on function abrir_chamado(text, text, text, text, uuid)
  to authenticated;

-- ---------- 7) emitir_link_instrumento (0080): papel efetivo + trilha DPP ----------
-- O emissor-mentor pedia o papel primário mentor_dpp — o híbrido esp-primário
-- que mentora uma dupla DPP não emitia instrumento. E a trilha entra na
-- guarda: instrumento oficial é ferramenta da trilha DPP — na trilha esp dele
-- (onde ele atua como especialista) não se emite visão/roda/PDM.

create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;

  select d.id, d.mentor_id, d.mentorado_id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação (qualquer dupla) ou o mentor DPP da dupla
  -- (jornada viva — instrumento é ferramenta de encontro da trilha DPP)
  if not (
    public.my_role() = 'coordenacao'
    or (
      public.has_papel('mentor_dpp'::public.app_role)
      and v_dupla.trilha is distinct from 'especialista'
      and v_dupla.mentor_id = public.my_profile_id()
      and v_dupla.status in ('ativa', 'pausada')
    )
  ) then
    raise exception 'sem permissão pra enviar instrumento desta dupla';
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

  -- reusa link pendente vigente pro mesmo mentorado+form (um link vivo por
  -- destinatário por instrumento, como na action de emissão). Escopo da
  -- dupla: link dela ou órfão (dupla_id null — emitido por Formulários sem
  -- contexto); um link vivo apontando pra OUTRA dupla não é furtado.
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and l.dest_mentorado_id = v_dupla.mentorado_id
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.dupla_id = v_dupla.id or l.dupla_id is null)
   order by l.created_at desc
   limit 1;
  if found then
    -- link órfão de dupla (destinatário certo, dupla preenchida depois)
    -- passa a apontar pra esta — a resposta ganha o contexto certo
    update formulario_links
       set dupla_id = v_dupla.id,
           contexto = contexto || '{"origem":"instrumentos"}'::jsonb
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from 'instrumentos');
    return jsonb_build_object('token', v_link.token, 'reutilizado', true);
  end if;

  insert into formulario_links (
    formulario_id, token, dest_mentorado_id, dupla_id, contexto, created_by
  ) values (
    v_form.id,
    -- 24 bytes → 32 chars base64url, mesmo fator de posse da action
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    v_dupla.mentorado_id,
    v_dupla.id,
    '{"origem":"instrumentos"}'::jsonb,
    public.my_profile_id()
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

revoke all on function public.emitir_link_instrumento(uuid, text)
  from public, anon;
grant execute on function public.emitir_link_instrumento(uuid, text)
  to authenticated;

commit;
