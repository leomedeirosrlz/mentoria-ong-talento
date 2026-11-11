begin;

-- 0190 — REALIZA-359: checklist de competências do mentor + retrospectiva.
--
-- O guia fecha o ciclo com a autoavaliação do mentor sobre as 10
-- competências da escuta ativa (docs/rag/checklist-competencias.md). Vira
-- o 5º instrumento oficial da dupla — mesmo motor dos outros 4 — com duas
-- diferenças que a migration formaliza:
--
--   * o DESTINATÁRIO é o mentor (dest_profile_id), não o mentorado: o
--     emitir_instrumento_core ganha p_destino e o reuse passa a casar
--     pela coluna certa por sistema;
--   * os momentos são 'inicio' × 'final' (marcação da formação ×
--     revisitação do fechamento), paralelos ao inicial × formal da roda.
--
-- Emissão: a marcação de início sai no autoemit da formação da dupla; a
-- final sai quando a janela do fim abre (encontro 15 realizado — v_enc
-- chega a 16). O gesto manual na linha de instrumentos da ficha chama a
-- mesma RPC — o momento deriva das respondidas (1 → 'final') ou vem por
-- p_momento explícito. Pendente expira no encerramento/remanejo, como os
-- demais. A jovem NUNCA vê este instrumento: jovem_jornada tira o item do
-- payload (a retrospectiva dela não mostra o checklist) e
-- instrumentos_da_dupla esconde a linha inteira quando o caller é o
-- mentorado da dupla (chamada direta da RPC não vaza nem metadado).

-- ---------- 1) vocabulário + seed ----------

alter table public.formularios drop constraint formularios_sistema_check;

alter table public.formularios add constraint formularios_sistema_check
  check (sistema is null or sistema in (
    'avaliacao_360', 'visao', 'roda_vida', 'pdm', 'metas',
    'avaliacao_especialista', 'intake_mentor', 'intake_mentorado',
    'desfecho', 'avaliacao_final_mentor', 'avaliacao_final_mentorado',
    'competencias_mentor'
  ));

-- as 10 competências do guia do mentor (docs/rag/checklist-competencias.md)
-- — ids estáveis comp_1..comp_10 pra comparação início × fim; select com
-- as duas colunas verbatim do guia ("Já faço bem" × "Preciso desenvolver")
-- + o campo livre do instrumento ("o que quero desenvolver").
insert into public.formularios (id, titulo, descricao, campos, sistema)
values (
  '5eed0002-0000-4000-8000-000000000090',
  'Checklist de competências do mentor',
  'Autoavaliação do mentor sobre as 10 competências do guia: marca uma vez no início da jornada e revisita no fechamento — o antes × depois aparece na retrospectiva.',
  '[
    {"id":"sec_intro","tipo":"secao","label":"Como você se avalia hoje?","obrigatorio":false,"descricao":"Marque “Já faço bem” nas competências que já fazem parte do seu jeito de escutar e “Preciso desenvolver” nas que você quer trabalhar nesta mentoria. Sem nota certa — é um retrato seu, não uma prova."},
    {"id":"comp_1","tipo":"select","label":"Escutar sem interromper e sem antecipar conclusões","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_2","tipo":"select","label":"Fazer perguntas abertas em vez de dar respostas prontas","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_3","tipo":"select","label":"Sustentar o silêncio quando o outro está pensando","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_4","tipo":"select","label":"Dar feedback focado no comportamento, não na pessoa","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_5","tipo":"select","label":"Reconhecer e nomear progressos concretos","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_6","tipo":"select","label":"Admitir quando não sei algo","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_7","tipo":"select","label":"Manter postura não julgadora diante de escolhas diferentes das minhas","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_8","tipo":"select","label":"Cumprir combinados e avisar com antecedência quando preciso remarcar","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_9","tipo":"select","label":"Separar o meu projeto de vida do projeto do(a) jovem","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"comp_10","tipo":"select","label":"Perceber quando uma questão extrapola o meu papel e acionar apoio","obrigatorio":true,"opcoes":["Já faço bem","Preciso desenvolver"]},
    {"id":"desenvolver","tipo":"texto_longo","label":"O que você quer desenvolver nos próximos meses?","obrigatorio":false}
  ]'::jsonb,
  'competencias_mentor'
)
on conflict (id) do nothing;

-- ---------- 2) emitir_instrumento_core — destinatário + momento ----------
--
-- p_destino ('mentorado'|'mentor'|'auto'): 'auto' resolve pelo sistema —
-- competencias_mentor responde o mentor; os demais seguem pro mentorado.
-- p_momento: override explícito (a action do fechamento pede 'final');
-- null deriva das respondidas, como a roda sempre fez (0 → 1ª marcação,
-- ≥1 → a do fim). A assinatura nova é a canônica — SEM defaults nos dois
-- últimos args: com defaults, toda chamada de 4 args ficaria ambígua
-- entre as duas assinaturas; a antiga segue como wrapper explícito (a
-- 0114, instrumentos_jornada_em_lote, ainda a chama).

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

  -- reusa link pendente vigente pro mesmo destinatário+form (um link vivo
  -- por destinatário por instrumento). Escopo da dupla: link dela ou
  -- órfão; um link vivo apontando pra OUTRA dupla não é furtado.
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and (v_dest_mentorado is not null and l.dest_mentorado_id = v_dest_mentorado
          or v_dest_profile is not null and l.dest_profile_id = v_dest_profile)
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.dupla_id = v_dupla.id or l.dupla_id is null)
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

revoke all on function public.emitir_instrumento_core(uuid, text, uuid, text, text, text)
  from public, anon, authenticated;

-- wrapper da assinatura antiga — callable interno da 0114 segue intacto
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

-- ---------- 3) emitir_link_instrumento — gate + core ----------

-- drop da assinatura antiga: com o default, uma sobrecarga de 3 args
-- deixaria toda chamada de 2 args ambígua
drop function if exists public.emitir_link_instrumento(uuid, text);

create function public.emitir_link_instrumento(
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

-- callable do app (mesma regra da assinatura que saiu: PUBLIC sai — função
-- nova nasce com EXECUTE pra todo mundo; só authenticated chama)
revoke all on function public.emitir_link_instrumento(uuid, text, text)
  from public, anon;
grant execute on function public.emitir_link_instrumento(uuid, text, text)
  to authenticated;

-- ---------- 4) jornada_autoemit — o checklist nas duas pontas ----------

create or replace function public.jornada_autoemit(p_dupla_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_enc int;
  v_rodadas int;
  v_sistema text;
begin
  select d.id, d.status, d.trilha, d.cronograma_id, d.iniciada_em
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found
     or v_dupla.trilha = 'especialista'
     or v_dupla.status not in ('ativa', 'pausada') then
    return;
  end if;

  -- encontro corrente = o mais avançado de dois pinos, teto 16 (0123):
  --  (a) maior realizado + 1; (b) encontros oficiais já passados há mais
  --  de 7 dias desde iniciada_em + 1 (rede de segurança do registro
  --  atrasado; pausada congela, cronograma null não casa)
  select least(16, greatest(
           coalesce((
             select max(e.numero)
               from encontros e
              where e.dupla_id = p_dupla_id
                and e.status = 'realizado'
           ), 0) + 1,
           (
             select count(*)::int
               from ciclo_eventos ce
              where ce.cronograma_id = v_dupla.cronograma_id
                and ce.tipo = 'encontro'
                and ce.data >= coalesce(v_dupla.iniciada_em::date, '-infinity'::date)
                and ce.data < (now() at time zone 'America/Sao_Paulo')::date - 7
                and v_dupla.status = 'ativa'
           ) + 1
         ))
    into v_enc;

  -- o checklist entra no loop: início disponível desde a formação (como
  -- visao/pdm/roda no enc. 1); a final emite quando a janela do fim abre
  -- (v_enc = 16 → encontro 15+ realizado) e o início já foi respondido.
  foreach v_sistema in array array['visao', 'pdm', 'roda_vida', 'metas', 'competencias_mentor']
  loop
    if not exists (
      select 1 from formularios f
       where f.sistema = v_sistema and f.ativo
    ) then
      continue;
    end if;
    if v_sistema = 'metas' and v_enc < 2 then
      continue;
    end if;
    -- instrumento cumprido descansa: respondida encerra a emissão
    -- automática — re-emissão é gesto humano. As exceções são as duas
    -- pontas com janela própria: a roda (formal no enc. 12) e o checklist
    -- (final quando a janela do fim abre).
    if v_sistema = 'roda_vida' then
      select count(*) into v_rodadas
        from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = 'roda_vida'
         and x.dupla_id = p_dupla_id
         and x.usado_em is not null;
      if v_rodadas >= 2 or (v_rodadas = 1 and v_enc < 12) then
        continue;
      end if;
    elsif v_sistema = 'competencias_mentor' then
      select count(*) into v_rodadas
        from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = 'competencias_mentor'
         and x.dupla_id = p_dupla_id
         and x.usado_em is not null;
      -- 0 respondidas → emite o início; 1 → a final só quando a janela
      -- do fechamento já abriu; 2 → as duas marcações cumpridas
      if v_rodadas >= 2 or (v_rodadas = 1 and v_enc < 16) then
        continue;
      end if;
    elsif exists (
      select 1 from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = v_sistema
         and x.dupla_id = p_dupla_id
         and x.usado_em is not null
    ) then
      continue;
    end if;
    begin
      perform public.emitir_instrumento_core(
        p_dupla_id, v_sistema, null, 'auto'
      );
    exception when others then
      raise warning 'jornada_autoemit(%, %): %', p_dupla_id, v_sistema, sqlerrm;
    end;
  end loop;
end $$;

revoke all on function public.jornada_autoemit(uuid)
  from public, anon, authenticated;

-- ---------- 5) expiração no fechamento/remanejo ----------

create or replace function public.jornada_expirar_links_encerrada()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update formulario_links l
     set expira_em = now()
    from formularios f
   where f.id = l.formulario_id
     and f.sistema in ('visao', 'roda_vida', 'pdm', 'metas', 'competencias_mentor')
     and l.dupla_id = new.id
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now());
  return new;
end $$;

-- ---------- 6) instrumentos_da_dupla — o 5º instrumento na árvore ----------

create or replace function public.instrumentos_da_dupla(p_dupla_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupla record;
  v_out jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id, d.supervisor_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(v_dupla.id)
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) is not true then
    raise exception 'sem permissão pra ver instrumentos desta dupla';
  end if;

  select coalesce(jsonb_agg(inst order by ordem), '[]'::jsonb)
    into v_out
    from (
      select
        case f.sistema
          when 'visao' then 1 when 'metas' then 2
          when 'pdm' then 3 when 'roda_vida' then 4
          when 'competencias_mentor' then 5
        end as ordem,
        jsonb_build_object(
          'sistema', f.sistema,
          'formulario_id', f.id,
          'titulo', f.titulo,
          'descricao', f.descricao,
          'ativo', f.ativo,
          'campos', f.campos,
          'entregas', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'link_id', l.id,
                     'token', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else l.token end,
                     'destino', case
                       when l.dest_mentorado_id is not null then 'mentorado'
                       when l.dest_profile_id = v_dupla.mentor_id then 'mentor'
                       else 'outro' end,
                     'status', case
                       when l.usado_em is not null then 'respondido'
                       when l.expira_em is not null and l.expira_em < now()
                         then 'expirado'
                       else 'pendente' end,
                     'respondido_em', r.respondido_em,
                     'respostas', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else r.respostas end,
                     'contexto', coalesce((
                       select jsonb_object_agg(cx.key, cx.value)
                         from jsonb_each(l.contexto) as cx(key, value)
                        where cx.key in ('origem','momento','encontro','dupla_id')
                     ), '{}'::jsonb),
                     'created_at', l.created_at,
                     'usado_em', l.usado_em,
                     'expira_em', l.expira_em
                   ) order by l.created_at)
              from formulario_links l
              left join formulario_respostas r on r.link_id = l.id
             where l.formulario_id = f.id
               and l.dupla_id = v_dupla.id
               and (l.dest_mentorado_id = v_dupla.mentorado_id
                    or l.dest_profile_id = v_dupla.mentor_id)
          ), '[]'::jsonb)
        ) as inst
      from formularios f
      where f.sistema in ('visao', 'roda_vida', 'pdm', 'metas', 'competencias_mentor')
        -- o checklist é autoavaliação do mentor: pra jovem nem a linha do
        -- instrumento sai (a regra de entrega já zera token/resposta —
        -- aqui some título, campos e existência). O recorte dela passa
        -- por jovem_jornada, que também filtra — defesa em profundidade
        -- pra chamada direta da RPC
        and (f.sistema <> 'competencias_mentor'
             or v_dupla.mentorado_id is distinct from public.my_mentorado_id())
    ) s;

  return v_out;
end $function$;

-- ---------- 7) jovem_jornada — checklist fora do payload da jovem +
--                a linha do tempo da retrospectiva ----------

create or replace function public.jovem_jornada()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
  v_desbloqueada boolean;
begin
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  select d.id, d.mentor_id, d.mentorado_id, d.cronograma_id, d.status
    into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    return null;
  end if;

  perform public.jornada_autoemit(v_dupla.id);

  -- a retro destrava com o encontro 16 realizado; dupla já fechada
  -- (concluída/encerrada) abre também — é leitura de história, não prêmio
  select exists (
           select 1 from encontros e
            where e.dupla_id = v_dupla.id
              and e.numero = 16 and e.status = 'realizado'
         ) or v_dupla.status in ('concluida', 'encerrada')
    into v_desbloqueada;

  return jsonb_build_object(
    'dupla_id', v_dupla.id,
    'cronograma', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', e.numero,
               'data', e.data,
               'tipo', e.tipo,
               'fase', e.fase,
               'instrumentos', e.instrumentos
             ) order by e.data)
        from ciclo_eventos e
       where e.cronograma_id = v_dupla.cronograma_id
    ), '[]'::jsonb),
    -- a árvore da ficha MENOS o checklist do mentor: a autoavaliação dele
    -- é recorte de staff — a jovem não vê link, token nem resposta (a
    -- regra 0096 dentro da RPC já zera token/respostas de entregas
    -- endereçadas a outra pessoa; aqui o item inteiro sai do payload)
    'instrumentos', coalesce((
      select jsonb_agg(i)
        from jsonb_array_elements(public.instrumentos_da_dupla(v_dupla.id)) i
       where i ->> 'sistema' <> 'competencias_mentor'
    ), '[]'::jsonb),
    'avaliacao_360', coalesce((
      select jsonb_agg(jsonb_build_object(
               'link_id', l.id,
               'token', l.token,
               'status', case
                 when l.usado_em is not null then 'respondido'
                 when l.expira_em is not null and l.expira_em < now()
                   then 'expirado'
                 else 'pendente' end,
               'respondido_em', r.respondido_em,
               'respostas', r.respostas,
               'contexto', coalesce((
                 select jsonb_object_agg(cx.key, cx.value)
                   from jsonb_each(l.contexto) as cx(key, value)
                  where cx.key in ('origem','momento','encontro','dupla_id')
               ), '{}'::jsonb),
               'created_at', l.created_at,
               'expira_em', l.expira_em
             ) order by l.created_at)
        from formulario_links l
        join formularios f on f.id = l.formulario_id
        left join formulario_respostas r on r.link_id = l.id
       -- 0130: a CHAVE segue 'avaliacao_360' mas lê o instrumento novo do
       -- mentorado — o 360 antigo está arquivado (ativo=false)
       where f.sistema = 'avaliacao_final_mentorado'
         and l.dest_mentorado_id = v_ment
         and (l.dupla_id = v_dupla.id or l.dupla_id is null)
    ), '[]'::jsonb),
    -- retrospectiva da jovem (0190): a linha do tempo que ela pode ver —
    -- encontros realizados com tema do registro. Nada de observações,
    -- pedido de apoio ou avaliação interna do mentor (recorte de staff).
    'retrospectiva', jsonb_build_object(
      'desbloqueada', v_desbloqueada,
      'encontros', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'numero', e.numero,
                 'data', coalesce(e.realizado_em, e.data_hora),
                 'tema', r.tema
               ) order by e.numero)
          from encontros e
          left join registros r on r.encontro_id = e.id
         where e.dupla_id = v_dupla.id
           and e.status = 'realizado'
      ), '[]'::jsonb)
    )
  );
end $$;

-- ---------- 8) backfill — a marcação de início pras duplas vivas ----------

select public.jornada_autoemit(d.id)
  from duplas d
 where d.trilha is distinct from 'especialista'
   and d.status in ('ativa', 'pausada');

commit;
