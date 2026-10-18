-- 0091 — follow-up do WP6b (revisão multi-agent do PR #61)
--
-- A 0090 cobriu o eixo mentor_dpp+especialista; a revisão achou a MESMA
-- classe de bug nos gates de equipe: papel `coordenacao`/`supervisor`
-- (e `mentorado`) também podem existir só como secundários em
-- profile_papeis — quem assim for ficava sem agir/ser destino. Como
-- has_papel ⊇ role primário (e ainda filtra ativo), todos os swaps são
-- extensão estrita: ninguém que hoje tem permissão a perde.
--
--   1. rematch_dupla: validação de papel passa a respeitar o escopo da
--      turma da dupla (has_papel por-linha com escopo — papel válido só
--      em outra turma não habilita o remanejo).
--   2. notificacoes_insert: destinatários e gates de autor por papel
--      efetivo (coord/supervisor/mentorado secundários incluídos).
--   3. chamado_notifica_equipe, eh_equipe, chamado_visivel_equipe,
--      supervisoes_insert, documentos_storage_select_curriculo,
--      pessoa_notas_insert, comunicados_*, materiais_*: my_role()/p.role
--      → has_papel.
--   4. abrir_chamado: revoke de PUBLIC/anon antes do grant (paridade
--      com as vizinhas — a 0084/0090 só davam grant).

-- ─── 1. rematch_dupla — papel esperado com escopo da turma ───────────

create or replace function public.rematch_dupla(p_dupla_id uuid, p_lado text, p_novo_id uuid, p_motivo text DEFAULT NULL::text, p_registrar_nota boolean DEFAULT true)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    -- com o papel da trilha como secundário passa a ser candidato válido.
    -- O escopo da turma da dupla também vale: papel restrito a OUTRA
    -- turma não habilita o remanejo (0091).
    if not public.has_papel(p_novo_id, papel_esperado::public.app_role, antiga.turma) then
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
$function$;

-- ─── 2. notificacoes_insert — destinos e autores por papel efetivo ────

drop policy notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes
for insert with check (
  public.has_papel('coordenacao'::public.app_role)
  or (
    created_by = public.my_profile_id()
    and (
      (tipo in ('encontro_marcado','encontro_alterado','encontro_desfeito')
       and public.par_de_mim(profile_id))
      or (tipo = 'pedido_apoio' and exists (
            select 1 from public.profiles p
            where p.id = notificacoes.profile_id
              and (public.has_papel(p.id, 'coordenacao'::public.app_role)
                   or public.has_papel(p.id, 'supervisor'::public.app_role))))
      or (tipo = 'pedido_apoio'
          and public.has_papel('mentorado'::public.app_role)
          and exists (select 1 from public.jovem_contatos jc
                      where jc.id = notificacoes.profile_id))
      or (tipo = 'demanda_especialista'
          and public.has_papel(profile_id, 'mentor_especialista'::public.app_role))
      or (tipo in ('solicitacao_registrada','solicitacao_cancelada') and exists (
            select 1 from public.profiles p
            where p.id = notificacoes.profile_id
              and public.has_papel(p.id, 'coordenacao'::public.app_role)))
      or (tipo = 'especialista_aceitou'
          and public.has_papel('mentor_especialista'::public.app_role)
          and (exists (select 1 from public.profiles p
                       where p.id = notificacoes.profile_id
                         and public.has_papel(p.id, 'coordenacao'::public.app_role))
               or exists (select 1 from public.solicitacoes_especialista s
                          where s.created_by = notificacoes.profile_id
                            and s.especialista_id = public.my_profile_id())))
      or (tipo = 'trilha_encerrada'
          and public.has_papel('mentor_especialista'::public.app_role)
          and (exists (select 1 from public.profiles p
                       where p.id = notificacoes.profile_id
                         and public.has_papel(p.id, 'coordenacao'::public.app_role))
               or exists (select 1 from public.solicitacoes_especialista s
                          where s.created_by = notificacoes.profile_id
                            and s.especialista_id = public.my_profile_id())))
      or (tipo = 'supervisao_registrada'
          and public.has_papel('supervisor'::public.app_role)
          and exists (select 1 from public.supervisoes s
                      where s.supervisor_id = public.my_profile_id()
                        and s.mentor_id = notificacoes.profile_id))
    )
  )
);

-- ─── 3a. chamado_notifica_equipe — coord efetivo recebe o ping ────────

create or replace function public.chamado_notifica_equipe(p_chamado uuid, p_tipo text, p_titulo text, p_corpo text, p_autor uuid DEFAULT NULL::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.chamados%rowtype;
begin
  select * into v from chamados where id = p_chamado;
  if not found then return; end if;
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  select p.id, p_tipo, p_titulo, p_corpo,
         '/chamados?c=' || v.id, coalesce(p_autor, public.my_profile_id())
    from profiles p
   where p.ativo and public.has_papel(p.id, 'coordenacao'::public.app_role)
     and p.id is distinct from coalesce(p_autor, public.my_profile_id())
  union all
  select d.supervisor_id, p_tipo, p_titulo, p_corpo,
         '/chamados?c=' || v.id, coalesce(p_autor, public.my_profile_id())
    from duplas d
   where d.id = v.dupla_id and d.supervisor_id is not null
     and v.categoria <> 'plataforma'  -- plataforma não é do auxiliar
     and d.supervisor_id is distinct from coalesce(p_autor, public.my_profile_id());
end $function$;

-- ─── 3b. eh_equipe / chamado_visivel_equipe — papel efetivo ───────────

create or replace function public.eh_equipe()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select public.has_papel('coordenacao'::public.app_role)
      or public.has_papel('supervisor'::public.app_role)
$function$;

create or replace function public.chamado_visivel_equipe(p_chamado chamados)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select public.has_papel('coordenacao'::public.app_role)
      or (public.has_papel('supervisor'::public.app_role)
          and p_chamado.categoria <> 'plataforma');
$function$;

-- ─── 3c. supervisoes_insert — supervisor/coord efetivo ────────────────

drop policy supervisoes_insert on public.supervisoes;
create policy supervisoes_insert on public.supervisoes
for insert with check (
  public.has_papel('coordenacao'::public.app_role)
  or (
    public.has_papel('supervisor'::public.app_role)
    and supervisor_id = public.my_profile_id()
    and exists (
      select 1 from public.duplas d
      where d.supervisor_id = public.my_profile_id()
        and d.mentor_id = supervisoes.mentor_id)
    and (
      dupla_id is null
      or exists (
        select 1 from public.duplas d
        where d.id = supervisoes.dupla_id
          and d.supervisor_id = public.my_profile_id()
          and d.mentor_id = supervisoes.mentor_id)
    )
  )
);

-- ─── 3d. documentos_storage_select_curriculo — supervisor efetivo ─────

drop policy documentos_storage_select_curriculo on storage.objects;
create policy documentos_storage_select_curriculo on storage.objects
for select using (
  bucket_id = 'documentos'
  and public.has_papel('supervisor'::public.app_role)
  and exists (
    select 1 from public.mentorados_curriculo mc
    where mc.curriculo_path = objects.name)
);

-- ─── 3e. pessoa_notas_insert — ramo staff por papel efetivo ───────────

drop policy pessoa_notas_insert on public.pessoa_notas;
create policy pessoa_notas_insert on public.pessoa_notas
for insert with check (
  (public.has_papel('coordenacao'::public.app_role)
   or public.has_papel('supervisor'::public.app_role))
  or (
    mentorado_id is not null
    and exists (
      select 1 from public.duplas d
      where d.mentorado_id = pessoa_notas.mentorado_id
        and d.mentor_id = public.my_profile_id())
  )
);

-- ─── 3f. comunicados / materiais — gates de coord por papel efetivo ───

drop policy comunicados_select on public.comunicados;
create policy comunicados_select on public.comunicados
for select using (
  public.my_role() is not null
  and (audiencia = 'todos'
       or public.has_papel('coordenacao'::public.app_role)
       or (audiencia = 'dpp' and public.has_papel('mentor_dpp'::public.app_role))
       or (audiencia = 'especialista' and public.has_papel('mentor_especialista'::public.app_role))
       or (audiencia = 'equipe' and public.has_papel('supervisor'::public.app_role)))
);

drop policy comunicados_insert on public.comunicados;
create policy comunicados_insert on public.comunicados
for insert with check (
  public.has_papel('coordenacao'::public.app_role)
  and created_by = public.my_profile_id()
);

drop policy comunicados_delete on public.comunicados;
create policy comunicados_delete on public.comunicados
for delete using (public.has_papel('coordenacao'::public.app_role));

drop policy materiais_select on public.materiais;
create policy materiais_select on public.materiais
for select using (
  public.my_role() is not null
  and (audiencia = 'todos'
       or public.has_papel('coordenacao'::public.app_role)
       or (audiencia = 'dpp' and public.has_papel('mentor_dpp'::public.app_role))
       or (audiencia = 'especialista' and public.has_papel('mentor_especialista'::public.app_role)))
);

drop policy materiais_coord on public.materiais;
create policy materiais_coord on public.materiais
for all using (public.has_papel('coordenacao'::public.app_role))
with check (public.has_papel('coordenacao'::public.app_role));

-- ─── 4. abrir_chamado — revoke de PUBLIC/anon (paridade das vizinhas) ──

revoke all on function public.abrir_chamado(text, text, text, text, uuid) from public, anon;
grant execute on function public.abrir_chamado(text, text, text, text, uuid) to authenticated;
