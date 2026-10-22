-- 0105 — fixes da revisão multi-agent pós-0103/0104
--
-- Três buracos encontrados no review das telas (e não no validator):
--
--   1) o cap "3 por vínculo" da avaliação por terceiros só disparava em
--      INSERT — editar o `vinculo` de um convite pendente furava o 3+3+3.
--      O guard vira INSERT + UPDATE OF vinculo e desconta a própria row.
--
--   2) `reemitir_convite_terceiro`/`salvar_consolidado_terceiros`/policy de
--      update não checavam `dupla.status` — por chamada direta dava pra
--      reemitir convite e publicar síntese numa dupla já fechada (a UI
--      trava via jornadaViva; a insert policy já exigia dupla viva — o
--      buraco era só de API).
--
--   3) `rematch_dupla` encerrava a trilha "só de status" — pra especialista
--      isso produzia um estado impossível por qualquer outra via: sem
--      encerrada_em, sem motivo e sem a avaliação geral do guia (§13) pro
--      especialista que sai. A emissão vira helper `emitir_avaliacao_esp`
--      compartilhado pelos dois fechamentos. (DPP segue status-only —
--      duplas_encerramento_esp reserva os campos de fechamento à trilha.)

begin;

-- ---------- 1) cap por vínculo também em UPDATE ----------

create or replace function public.guard_terceiros_cap()
returns trigger language plpgsql set search_path to '' as $$
begin
  -- serializa writes da mesma dupla: dois requests concorrentes liriam o
  -- mesmo count(*) read-committed e os dois passariam do cap
  perform pg_advisory_xact_lock(hashtext('terceiros_cap:' || new.dupla_id::text));
  -- o 9 total só cabe no INSERT — em UPDATE a row já conta no universo
  if tg_op = 'INSERT' and (select count(*) from public.terceiros_contatos
       where dupla_id = new.dupla_id) >= 9 then
    raise exception 'o guia prevê até 9 pessoas indicadas por dupla (3 amigos + 3 familiares + 3 colegas)';
  end if;
  -- o 3+3+3 do guia cobre a troca de vínculo também — sem o UPDATE aqui a
  -- edição do select de vínculo furava a diversidade (a própria row sai
  -- da conta: trocar amigo→amigo não pode se contar)
  if (select count(*) from public.terceiros_contatos
       where dupla_id = new.dupla_id and vinculo = new.vinculo
         and id is distinct from new.id) >= 3 then
    raise exception 'o guia prevê até 3 pessoas por vínculo (amigos, familiares, colegas)';
  end if;
  return new;
end $$;

drop trigger if exists terceiros_contatos_cap on public.terceiros_contatos;
create trigger terceiros_contatos_cap
  before insert or update of vinculo on public.terceiros_contatos
  for each row execute function public.guard_terceiros_cap();

-- ---------- 2) dupla fechada = histórico, não se mexe ----------

-- a update policy alinha com a insert: convite pendente/expirado só é
-- editável enquanto a dupla vive (respondido já era intocável)
drop policy if exists terceiros_contatos_update on public.terceiros_contatos;
create policy terceiros_contatos_update on public.terceiros_contatos
  for update to authenticated using (
    status in ('pendente','expirado')
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id()))
    and exists (select 1 from duplas d
      where d.id = dupla_id and d.status in ('ativa','pausada')))
  with check (
    status in ('pendente','expirado')
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id()))
    and exists (select 1 from duplas d
      where d.id = dupla_id and d.status in ('ativa','pausada')));

-- idem no delete: cancelar convite pendente também é mexer na trilha
drop policy if exists terceiros_contatos_delete on public.terceiros_contatos;
create policy terceiros_contatos_delete on public.terceiros_contatos
  for delete to authenticated using (
    status = 'pendente'
    and (public.my_role() = 'coordenacao'
      or exists (select 1 from duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id()))
    and exists (select 1 from duplas d
      where d.id = dupla_id and d.status in ('ativa','pausada')));

-- verbatim da 0103 + guard de dupla viva
create or replace function public.reemitir_convite_terceiro(p_contato_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  -- expiração lazy antes de decidir: um 'pendente' já vencido tem que cair
  -- no ramo de rotação — devolver o token morto apagaria o link na hora
  update public.terceiros_contatos set status = 'expirado'
   where id = p_contato_id and status = 'pendente' and expira_em < now();

  -- for update: dois reemites concorrentes não mintam dois tokens
  select c.id, c.dupla_id, c.status, c.token into v_c
    from public.terceiros_contatos c where c.id = p_contato_id
    for update;
  if not found then
    raise exception 'convite não encontrado';
  end if;
  if public.my_role() is distinct from 'coordenacao'
     and not exists (select 1 from duplas d
       where d.id = v_c.dupla_id and d.mentor_id = public.my_profile_id()) then
    raise exception 'convite não encontrado';
  end if;
  -- 0105: dupla fechada é histórico — nem reemissão nem "reaproveitar a row"
  if not exists (select 1 from duplas d
       where d.id = v_c.dupla_id and d.status in ('ativa','pausada')) then
    raise exception 'a dupla está encerrada — os convites ficam como histórico';
  end if;
  if v_c.status = 'pendente' then
    return jsonb_build_object('token', v_c.token, 'reutilizado', true);
  end if;
  if v_c.status = 'respondido' then
    raise exception 'esta pessoa já respondeu';
  end if;
  update public.terceiros_contatos
     set token = translate(encode(extensions.gen_random_bytes(24),'base64'),'+/=','-_'),
         expira_em = now() + interval '30 days',
         status = 'pendente', respondido_em = null
   where id = v_c.id
  returning token into v_c.token;
  return jsonb_build_object('token', v_c.token, 'reutilizado', false);
end $$;
revoke execute on function public.reemitir_convite_terceiro(uuid) from public, anon;
grant execute on function public.reemitir_convite_terceiro(uuid) to authenticated;

-- verbatim da 0103 + guard de dupla viva
create or replace function public.salvar_consolidado_terceiros(
  p_dupla_id uuid, p_consolidado text, p_publicar boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  -- mesmo gate da insert policy: a avaliação por terceiros é instrumento DPP
  -- — sem isso um mentor_especialista publicava consolidado na própria dupla
  -- e a select policy do jovem (via jovem_duplas, sem filtro de trilha)
  -- deixava o mentorando da trilha especialista ler
  if public.my_role() is distinct from 'coordenacao'
     and not exists (select 1 from duplas d
       where d.id = p_dupla_id and d.mentor_id = public.my_profile_id()
             and d.trilha = 'dpp') then
    raise exception 'dupla não encontrada';
  end if;
  -- 'concluida' segue viva aqui: o rito do ciclo ainda está aberto
  -- (precedente salvar_autoavaliacao) e a síntese tardia é o último
  -- passo do instrumento — a jovem continua lendo o card
  if not exists (select 1 from duplas d
       where d.id = p_dupla_id and d.trilha = 'dpp'
             and d.status in ('ativa','pausada','concluida')) then
    raise exception 'dupla não encontrada';
  end if;
  if p_publicar and (p_consolidado is null
      or char_length(btrim(p_consolidado)) = 0) then
    raise exception 'escreva a consolidação antes de publicar';
  end if;
  insert into public.terceiros_consolidacao
         (dupla_id, consolidado, publicado_em, escrito_por, updated_at)
  values (p_dupla_id, nullif(btrim(p_consolidado), ''),
          case when p_publicar then now() else null end,
          public.my_profile_id(), now())
  on conflict (dupla_id) do update set
    consolidado = excluded.consolidado,
    -- publicar marca; despublicar limpa; re-publicar preserva o 1º carimbo
    publicado_em = case
      when p_publicar then coalesce(terceiros_consolidacao.publicado_em, now())
      else null end,
    escrito_por = public.my_profile_id(),
    updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.salvar_consolidado_terceiros(uuid, text, boolean)
  from public, anon;
grant execute on function public.salvar_consolidado_terceiros(uuid, text, boolean)
  to authenticated;

-- o lado público ainda respondia em dupla morta: um link pendente de dupla
-- 'encerrada' gravava resposta que ninguém pode mais consolidar (o RPC
-- acima barra) e pingava mentor+coord de uma trilha enterrada. por_token
-- finge 'expirado' (estado que a página já sabe renderizar) e o submit
-- recusa de vez — dado sem destino não entra.
create or replace function public.terceiro_por_token(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  select c.id, c.status, c.expira_em, c.nome as convidado_nome,
         d.status as dupla_status,
         coalesce(m.nome_social, m.nome) as jovem_nome
    into v_c
    from public.terceiros_contatos c
    join duplas d on d.id = c.dupla_id
    join mentorados m on m.id = d.mentorado_id
   where c.token = p_token;
  if not found then
    return null;
  end if;
  if v_c.status = 'pendente' and v_c.expira_em < now() then
    update public.terceiros_contatos set status = 'expirado' where id = v_c.id;
    v_c.status := 'expirado';
  end if;
  return jsonb_build_object(
    'status', case when v_c.status = 'pendente' and v_c.dupla_status = 'encerrada'
                   then 'expirado' else v_c.status end,
    'convidado', jsonb_build_object('nome', v_c.convidado_nome),
    'alvo', jsonb_build_object('jovem_nome', v_c.jovem_nome));
end $$;
grant execute on function public.terceiro_por_token(text) to anon, authenticated;

create or replace function public.submeter_resposta_terceiro(
  p_token text, p_pontos_fortes text, p_a_melhorar text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_c record;
begin
  if p_pontos_fortes is null or char_length(btrim(p_pontos_fortes)) = 0
     or char_length(p_pontos_fortes) > 4000 then
    raise exception 'responda os pontos fortes (até 4000 caracteres)';
  end if;
  if p_a_melhorar is null or char_length(btrim(p_a_melhorar)) = 0
     or char_length(p_a_melhorar) > 4000 then
    raise exception 'responda os aspectos a melhorar (até 4000 caracteres)';
  end if;

  -- expiração lazy antes do gate (mesmo molde do 0071)
  update public.terceiros_contatos set status = 'expirado'
   where token = p_token and status = 'pendente' and expira_em < now();

  -- 0105: convite de dupla encerrada morre junto — a resposta não teria
  -- destino (a síntese não publica mais) e notificaria uma trilha enterrada
  if exists (select 1 from public.terceiros_contatos c
               join public.duplas d on d.id = c.dupla_id
              where c.token = p_token and d.status = 'encerrada') then
    raise exception 'este link não está mais disponível';
  end if;

  -- gate atômico: só um submit vence a corrida
  update public.terceiros_contatos
     set status = 'respondido', respondido_em = now()
   where token = p_token and status = 'pendente'
  returning id, dupla_id, nome into v_c;
  if not found then
    raise exception 'este link já foi usado ou expirou';
  end if;

  insert into public.terceiros_respostas (contato_id, pontos_fortes, a_melhorar)
  values (v_c.id, btrim(p_pontos_fortes), btrim(p_a_melhorar));

  -- quem respondeu é externo: avisa o mentor (dono da consolidação) + coord.
  -- created_by null — não há usuário autenticado por trás do submit público.
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select dest.id, 'terceiro_respondeu', 'Resposta de avaliação por terceiros',
           v_c.nome || ' respondeu sobre ' ||
             (select coalesce(m.nome_social, m.nome) from duplas d
                join mentorados m on m.id = d.mentorado_id
               where d.id = v_c.dupla_id) || '.',
           '/duplas/' || v_c.dupla_id, null
      from (
        select d.mentor_id as id from duplas d
         where d.id = v_c.dupla_id and d.mentor_id is not null
        union
        select p.id from profiles p
         where p.role = 'coordenacao' and p.ativo
      ) dest;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.submeter_resposta_terceiro(text, text, text)
  from public;
grant execute on function public.submeter_resposta_terceiro(text, text, text)
  to anon, authenticated;

-- ---------- 3) avaliação esp: emissão compartilhada + rematch com rito ----------

-- helper interno: a emissão do link §13 era inline na RPC de encerrar; o
-- rematch também fecha a trilha e o especialista que sai tem o mesmo
-- dever de avaliar. Definer, sem grant direto — só as RPCs de fechamento
-- o chamam (o caller é sempre uma função security definer do owner).
create or replace function public.emitir_avaliacao_esp(p_dupla uuid, p_mentor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_form  uuid;
  v_token text;
begin
  select f.id into v_form
    from public.formularios f
   where f.sistema = 'avaliacao_especialista'
     and f.ativo;
  if v_form is null then
    return;
  end if;
  -- dedup por (form, dest, dupla): quem já avaliou (ou já tem link vivo)
  -- não recebe outra — encerrar→reabrir→encerrar e rematch dividem a
  -- mesma chave
  if exists (
    select 1 from public.formulario_links l
     where l.formulario_id = v_form
       and l.dest_profile_id = p_mentor
       and l.dupla_id = p_dupla
  ) then
    return;
  end if;
  insert into public.formulario_links
    (formulario_id, token, dest_profile_id, dupla_id, contexto, created_by)
  values (
    v_form,
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    p_mentor,
    p_dupla,
    jsonb_build_object('origem', 'auto', 'trilha', 'especialista'),
    public.my_profile_id()
  )
  returning token into v_token;

  insert into public.notificacoes
    (profile_id, tipo, titulo, corpo, href, created_by)
  values (
    p_mentor,
    'avaliacao_pendente',
    'Avaliação geral da trilha',
    'Trilha encerrada — conte em 2 minutos como foi a mentoria especialista e o suporte da coordenação.',
    '/f/' || v_token,
    public.my_profile_id()
  );
end $$;
revoke all on function public.emitir_avaliacao_esp(uuid, uuid) from public, anon, authenticated;

-- verbatim da 0104 com o bloco de emissão trocado pelo helper
create or replace function public.encerrar_trilha_especialista(
  p_dupla uuid,
  p_tipo text,
  p_motivo text,
  p_devolutiva text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  n int;
begin
  select id, mentor_id, trilha, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if d.trilha is distinct from 'especialista' then
    raise exception 'Essa ação é só pra trilha de especialista';
  end if;
  -- IS DISTINCT FROM: my_role()/my_profile_id() voltam null sem papel, e
  -- "null <> 'coordenacao'" avaliaria NULL — sem a forma is-distinct o
  -- guard não barraria (mesmo cuidado do aceitar_solicitacao, 0028)
  if d.mentor_id is distinct from public.my_profile_id()
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só o especialista da dupla ou a coordenação podem encerrar a trilha';
  end if;
  if p_tipo not in ('concluida', 'encerrada') then
    raise exception 'Escolha entre concluir e encerrar a trilha';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 300 then
    raise exception 'O motivo do encerramento precisa de 3 a 300 caracteres';
  end if;
  if p_devolutiva is null or char_length(btrim(p_devolutiva)) not between 10 and 4000 then
    raise exception 'A devolutiva pro PDM precisa de 10 a 4.000 caracteres';
  end if;

  update public.duplas
     set status = p_tipo::public.dupla_status,
         encerrada_em = now(),
         motivo_encerramento = btrim(p_motivo),
         devolutiva_pdm = btrim(p_devolutiva)
   where id = p_dupla
     and status in ('ativa', 'pausada');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Essa trilha já está encerrada';
  end if;

  -- avaliação geral (guia-esp §13) no mesmo commit do fechamento
  perform public.emitir_avaliacao_esp(p_dupla, d.mentor_id);
end
$$;

revoke all on function public.encerrar_trilha_especialista(uuid, text, text, text) from public, anon;
grant execute on function public.encerrar_trilha_especialista(uuid, text, text, text) to authenticated;

-- verbatim da 0101 + fechamento com carimbo: encerrada_em sempre, motivo
-- sistêmico e link §13 quando a trilha é de especialista (o rito de
-- encerrar pede devolutiva escrita; o rematch não tem esse campo — a
-- avaliação geral segue independente)
create or replace function public.rematch_dupla(
  p_dupla_id uuid, p_lado text, p_novo_id uuid,
  p_motivo text default null, p_registrar_nota boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $function$
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
    -- Escopo (0101): especialista é pool GLOBAL — o papel em qualquer
    -- escopo habilita; mentor_dpp segue restrito à turma da dupla.
    if not public.has_papel(
      p_novo_id, papel_esperado::public.app_role,
      case when papel_esperado = 'mentor_especialista' then null
           else antiga.turma end
    ) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
    end if;
    -- 0101: mesmo guard de autoatribuição do sol_efetivar — a trilha de
    -- especialista exige um SEGUNDO adulto; quem já é mentor DPP da jovem
    -- não pode assumir a trilha de especialista dela via rematch (o caminho
    -- cross-turma facilitou chegar aqui, então o guard mora no RPC).
    if papel_esperado = 'mentor_especialista' and exists (
      select 1 from public.duplas d
       where d.mentorado_id = antiga.mentorado_id
         and d.mentor_id = p_novo_id
         and d.trilha is distinct from 'especialista'
         and d.status in ('ativa', 'pausada')
    ) then
      raise exception 'O mentor DPP da jovem não pode assumir também a trilha de especialista';
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

  -- 0105: fechamento "só de status" deixava a trilha de especialista sem
  -- encerrada_em, sem motivo e sem o link da avaliação geral — estado que
  -- nenhuma outra via produz. O check duplas_encerramento_esp (0102)
  -- proíbe esses campos em trilha DPP de propósito (o rito DPP mora em
  -- encerramentos), então o carimbo vale só pra especialista: motivo
  -- sistêmico + emissão do §13 pro especialista que sai.
  if antiga.trilha = 'especialista' then
    update public.duplas
       set status = 'encerrada',
           encerrada_em = now(),
           -- o check motivo_encerramento_cap corta em 300 e p_motivo chega a
           -- ~430 chars via motivoRemanejo — trunca em vez de estourar 23514
           motivo_encerramento = left(
             'Remanejamento — ' ||
             case p_lado when 'mentorado' then 'jovem' else 'especialista' end ||
             ' substituído(a)' ||
             coalesce(': ' || nullif(btrim(p_motivo), ''), ''),
             300)
     where id = p_dupla_id;
    perform public.emitir_avaliacao_esp(p_dupla_id, antiga.mentor_id);
  else
    update public.duplas set status = 'encerrada' where id = p_dupla_id;
  end if;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id
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

revoke all on function public.rematch_dupla(uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.rematch_dupla(uuid, text, uuid, text, boolean) to authenticated;

-- a coord via o estado da avaliação sem caminho de volta pras respostas —
-- devolve o formulario_id pra ela linkar /formularios/[id] (o token segue
-- exclusivo do especialista)
create or replace function public.avaliacao_esp_da_dupla(p_dupla uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dupla   public.duplas%rowtype;
  v_token   text;
  v_usado   timestamptz;
  v_form    uuid;
begin
  select * into v_dupla from public.duplas where id = p_dupla;
  if not found or v_dupla.trilha <> 'especialista' then
    return null;
  end if;
  if public.my_profile_id() is distinct from v_dupla.mentor_id
     and public.my_role() is distinct from 'coordenacao' then
    return null;
  end if;

  select l.token, l.usado_em, l.formulario_id
    into v_token, v_usado, v_form
    from public.formulario_links l
    join public.formularios f on f.id = l.formulario_id
   where f.sistema = 'avaliacao_especialista' and l.dupla_id = p_dupla
   order by l.created_at desc
   limit 1;
  if v_token is null then
    return null;
  end if;

  return jsonb_build_object(
    'respondido', v_usado is not null,
    'respondido_em', v_usado,
    'formulario_id', v_form,
    'token', case when public.my_profile_id() = v_dupla.mentor_id
                  then v_token end
  );
end;
$$;

revoke all on function public.avaliacao_esp_da_dupla(uuid) from public, anon;
grant execute on function public.avaliacao_esp_da_dupla(uuid) to authenticated;

commit;
