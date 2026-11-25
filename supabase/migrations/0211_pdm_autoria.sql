begin;

-- 0211 — PDM com autoria (REALIZA-450 / spec 007 US13): o documento vivo
-- é co-editável pela dupla (mentor e mentorado, via pdm_pode_editar) e
-- quem lê a ficha ou o portal do jovem enxerga honestamente quem
-- escreveu/editou o quê — sem nunca tocar a resposta original do
-- instrumento (formulario_respostas segue imutável, decisão REALIZA-435).
--
-- Desenho (plan D9 da spec 007):
--   pdm.visao_por            → profile que escreveu a Declaração de Visão
--                              atual (pareia com visao_em, já existente)
--   pdm_itens.atualizado_por → profile da última escrita humana no item
--   pdm_itens.atualizado_em  → quando foi essa escrita
-- A marca "editado por" da UI acende quando a última escrita mudou de
-- mãos (atualizado_por != created_by); criar e depois ajustar o próprio
-- texto não marca — o que se exibe é a co-autoria, não redundância.
--
-- Imunidade à projeção: pdm_projeta_resposta só atualiza/descarta o que
-- nenhuma pessoa tocou (atualizado_por is null / visao_por is null) — a
-- edição manual nunca é sobrescrita pela próxima resposta de instrumento,
-- e a edição nunca altera a resposta (ela continua snapshot). O que o
-- instrumento gerencia sozinho continua gerenciável.
--
-- pdm_reordenar não carimba: a ordem é arranjo do conjunto, não conteúdo
-- de um item — carimbaria todos os irmãos por um gesto só. Idem
-- pdm_remover_item (o item some). created_by/origem/origem_campo
-- permanecem: proveniência e criação ≠ última escrita.
--
-- Rows pré-0211 ficam com autoria null — o histórico de quem editou
-- antes não existe pra reconstruir; a ausência lê-se como "sem escrita
-- humana registrada" (doc que veio de instrumento fica idêntico).
--
-- Toda mutação continua passando só pelas RPCs escopadas (não há grant de
-- insert/update/delete nas tabelas): o carimbo sai de my_profile_id() do
-- JWT, nunca de parâmetro do cliente.
--
-- Fix de gate flagrado pelo teste de papel negado da US13: pdm_pode_editar
-- e a checagem inline de pdm_da_dupla podiam devolver NULL — caller sem
-- mentorado próprio fora da dupla fazia `false or null` virar NULL, e
-- `if not NULL` é tratado como não-verdadeiro pelo PL/pgSQL: a exceção
-- não disparava e a escrita/leitura passava. coalesce → fora do escopo é
-- FALSE, nunca NULL (fail-closed).

alter table public.pdm
  add column visao_por uuid references public.profiles(id) on delete set null;

alter table public.pdm_itens
  add column atualizado_por uuid references public.profiles(id) on delete set null,
  add column atualizado_em timestamptz;

-- ---------- gate: fail-closed (NULL vira FALSE) ----------

-- pdm_pode_editar (0109) + coalesce: mentor/mentorado da dupla viva ou
-- FALSE — NULL do "false or null" não pode mais escorregar pelo `if not`
create or replace function public.pdm_pode_editar(p_dupla_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupla record;
begin
  select d.mentor_id, d.mentorado_id, d.status, d.trilha
    into v_dupla
    from public.duplas d
   where d.id = p_dupla_id;
  if not found or v_dupla.trilha = 'especialista' then
    return false;
  end if;
  if v_dupla.status not in ('ativa', 'pausada') then
    return false;
  end if;
  return coalesce(
    v_dupla.mentor_id = public.my_profile_id()
      or v_dupla.mentorado_id = public.my_mentorado_id(),
    false);
end $function$;

-- ---------- escritas: o autor da escrita é quem a JWT carrega ----------

-- pdm_salvar_visao (0109) + carimbo visao_por
create or replace function public.pdm_salvar_visao(
  p_dupla_id uuid,
  p_visao text
) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  insert into public.pdm (dupla_id, visao, visao_em, visao_por)
  values (p_dupla_id, nullif(btrim(p_visao), ''), now(), public.my_profile_id())
  on conflict (dupla_id) do update
    set visao = nullif(btrim(p_visao), ''), visao_em = now(),
        visao_por = public.my_profile_id();
end $function$;

-- pdm_salvar_item (0109) + carimbo atualizado_por/atualizado_em
create or replace function public.pdm_salvar_item(
  p_dupla_id uuid,
  p_item_id uuid,
  p_parent_id uuid,
  p_titulo text,
  p_porque text,
  p_indicador text,
  p_area_vida text,
  p_prazo_alvo date
) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_pdm uuid;
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  if nullif(btrim(p_titulo), '') is null then
    raise exception 'o item precisa de um título';
  end if;

  insert into public.pdm (dupla_id) values (p_dupla_id)
    on conflict (dupla_id) do nothing;
  select id into v_pdm from public.pdm where dupla_id = p_dupla_id;

  if p_item_id is null then
    insert into public.pdm_itens (
      pdm_id, parent_id, titulo, porque, indicador, area_vida, prazo_alvo,
      ordem, origem, created_by, atualizado_por, atualizado_em
    ) values (
      v_pdm, p_parent_id, left(btrim(p_titulo), 500),
      nullif(btrim(p_porque), ''), nullif(btrim(p_indicador), ''),
      nullif(btrim(p_area_vida), ''), p_prazo_alvo,
      coalesce((select max(i.ordem) + 1 from public.pdm_itens i
                 where i.pdm_id = v_pdm
                   and i.parent_id is not distinct from p_parent_id
                   and i.status <> 'descartada'), 1),
      'manual', public.my_profile_id(),
      public.my_profile_id(), now()
    ) returning id into p_item_id;
    return p_item_id;
  end if;

  update public.pdm_itens
     set titulo = left(btrim(p_titulo), 500),
         porque = nullif(btrim(p_porque), ''),
         indicador = nullif(btrim(p_indicador), ''),
         area_vida = nullif(btrim(p_area_vida), ''),
         prazo_alvo = p_prazo_alvo,
         atualizado_por = public.my_profile_id(),
         atualizado_em = now()
   where id = p_item_id and pdm_id = v_pdm;
  if not found then
    raise exception 'item não encontrado neste PDM';
  end if;
  return p_item_id;
end $function$;

-- pdm_status_item (0109) + carimbo: mudar status É mexer no item
create or replace function public.pdm_status_item(
  p_dupla_id uuid,
  p_item_id uuid,
  p_status text
) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  if p_status not in ('ativa', 'atingida', 'descartada') then
    raise exception 'status inválido';
  end if;
  update public.pdm_itens i
     set status = p_status,
         atingida_em = case
           when p_status = 'atingida' then now()
           when p_status = 'ativa' then null
           else i.atingida_em
         end,
         atualizado_por = public.my_profile_id(),
         atualizado_em = now()
    from public.pdm p
   where i.id = p_item_id and i.pdm_id = p.id and p.dupla_id = p_dupla_id;
  if not found then
    raise exception 'item não encontrado neste PDM';
  end if;
end $function$;

-- ---------- leitura: autoria viaja no contrato da RPC ----------

-- pdm_da_dupla (0125) + visaoPor no doc e criadoPor/atualizadoPor/
-- atualizadoEm por item. Autor resolve pra {id, nome} com o nome de
-- exibição da plataforma (nome_social ?? nome) — a UI não faz join.
create or replace function public.pdm_da_dupla(p_dupla_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dupla record;
  v_pdm record;
  v_itens jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id, d.supervisor_id
    into v_dupla
    from public.duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- mesmo fail-closed do gate: caller sem mentorado próprio fora do
  -- escopo fazia a disjunção virar NULL e passava do `if not` sem erro
  if not coalesce(
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(v_dupla.id)
    or v_dupla.mentorado_id = public.my_mentorado_id(),
    false
  ) then
    raise exception 'sem permissão pra ver o PDM desta dupla';
  end if;

  select p.id, p.visao, p.visao_em,
         case when vp.id is null then null
              else jsonb_build_object(
                'id', vp.id, 'nome', coalesce(vp.nome_social, vp.nome))
         end as visao_por
    into v_pdm
    from public.pdm p
    left join public.profiles vp on vp.id = p.visao_por
   where p.dupla_id = p_dupla_id;

  if v_pdm.id is null then
    return jsonb_build_object(
      'duplaId', p_dupla_id, 'visao', null, 'visaoEm', null,
      'visaoPor', null, 'itens', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', i.id,
             'parentId', i.parent_id,
             'titulo', i.titulo,
             'porque', i.porque,
             'indicador', i.indicador,
             'areaVida', i.area_vida,
             'prazoAlvo', i.prazo_alvo,
             'status', i.status,
             'atingidaEm', i.atingida_em,
             'ordem', i.ordem,
             'origem', i.origem,
             'origemCampo', i.origem_campo,
             'criadoPor', case when cp.id is null then null
                 else jsonb_build_object(
                   'id', cp.id, 'nome', coalesce(cp.nome_social, cp.nome))
                 end,
             'atualizadoPor', case when ap.id is null then null
                 else jsonb_build_object(
                   'id', ap.id, 'nome', coalesce(ap.nome_social, ap.nome))
                 end,
             'atualizadoEm', i.atualizado_em)
           order by i.ordem, i.created_at), '[]'::jsonb)
    into v_itens
    from public.pdm_itens i
    left join public.profiles cp on cp.id = i.created_by
    left join public.profiles ap on ap.id = i.atualizado_por
   where i.pdm_id = v_pdm.id;

  return jsonb_build_object(
    'duplaId', p_dupla_id,
    'visao', v_pdm.visao,
    'visaoEm', v_pdm.visao_em,
    'visaoPor', v_pdm.visao_por,
    'itens', v_itens);
end $function$;

-- ---------- projeção: nunca pisa em escrita humana ----------

-- pdm_projeta_resposta (0118) + guarda de imunidade: atualiza/descarta
-- só slots que nenhuma pessoa tocou (atualizado_por is null); a visão só
-- sai da resposta quando nunca foi reescrita à mão (visao_por is null).
create or replace function public.pdm_projeta_resposta(
  p_dupla_id uuid, p_sistema text, p_respostas jsonb
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_trilha text;
  v_pdm uuid;
  v_titulo text;
  v_item uuid;
  v_pai uuid;
  v_slots text[] := '{}';
  v_subslots text[] := '{}';
  v_n int;
  v_i int;
  v_linhas text[];
  v_head int;
  v_principal int;
  v_prazo date;
  v_ord smallint;
  v_restante record;
begin
  select d.trilha into v_trilha from public.duplas d where d.id = p_dupla_id;
  if not found or v_trilha = 'especialista' then
    return;
  end if;

  -- doc preguiçoso: a projeção cria a row mesmo em dupla encerrada (o
  -- backfill histórico é documento de registro; o gate estrito é só das
  -- escritas manuais, via pdm_pode_editar)
  insert into public.pdm (dupla_id) values (p_dupla_id)
    on conflict (dupla_id) do nothing;
  select id into v_pdm from public.pdm where dupla_id = p_dupla_id;

  perform pg_advisory_xact_lock(hashtext(v_pdm::text));

  -- os três instrumentos podem trazer a Declaração de Visão — mas uma
  -- visão já reescrita à mão (visao_por) é da dupla, não da resposta
  v_titulo := nullif(btrim(coalesce(
    p_respostas->>'declaracao_visao', p_respostas->>'visao', '')), '');
  if v_titulo is not null then
    update public.pdm
       set visao = left(v_titulo, 2000), visao_em = now()
     where id = v_pdm and visao is distinct from left(v_titulo, 2000)
       and visao_por is null;
  end if;

  if p_sistema not in ('metas', 'pdm') then
    return;
  end if;

  for v_n in 1..10 loop
    v_titulo := nullif(btrim(p_respostas->>('meta_' || v_n)), '');
    continue when v_titulo is null;
    v_slots := v_slots || ('meta_' || v_n);

    -- prazo pode vir mal formado de resposta legada — a projeção não morre
    begin
      v_prazo := nullif(btrim(p_respostas->>('prazo_' || v_n)), '')::date;
    exception when others then
      v_prazo := null;
    end;

    select id into v_item from public.pdm_itens
      where pdm_id = v_pdm and parent_id is null
        and origem_campo = 'meta_' || v_n;

    if v_item is not null then
      -- slot que a dupla já editou (atualizado_por) é dela: título,
      -- porquê, IS, prazo e o descarte/revanche ficam como ela deixou
      update public.pdm_itens set
        titulo = left(v_titulo, 500),
        porque = case when p_sistema = 'metas'
                      then coalesce(nullif(btrim(p_respostas->>('porque_' || v_n)), ''), porque)
                      else porque end,
        indicador = case when p_sistema = 'pdm'
                         then coalesce(nullif(btrim(p_respostas->>('is_' || v_n)), ''), indicador)
                         else indicador end,
        prazo_alvo = case when p_sistema = 'pdm'
                          then coalesce(v_prazo, prazo_alvo)
                          else prazo_alvo end,
        -- uma meta descartada que volta na revisão ressurge ativa
        status = case when status = 'descartada' then 'ativa' else status end
      where id = v_item and atualizado_por is null;
    else
      -- respeita o teto: meta além da 10ª não derruba a resposta
      v_head := 10 - (select count(*) from public.pdm_itens
                       where pdm_id = v_pdm and parent_id is null
                         and status <> 'descartada');
      if v_head > 0 then
        insert into public.pdm_itens (
          pdm_id, titulo, porque, indicador, prazo_alvo, ordem, origem, origem_campo
        ) values (
          v_pdm, left(v_titulo, 500),
          case when p_sistema = 'metas'
               then nullif(btrim(p_respostas->>('porque_' || v_n)), '') end,
          case when p_sistema = 'pdm'
               then nullif(btrim(p_respostas->>('is_' || v_n)), '') end,
          case when p_sistema = 'pdm' then v_prazo end,
          v_n, p_sistema, 'meta_' || v_n
        ) returning id into v_item;
      else
        v_item := null;
      end if;
    end if;

    -- mapa de submetas (Metas desde a 0118, PDM desde a 0109): cada
    -- linha vira filha do slot meta_N, com origem = quem projetou
    if p_sistema in ('metas', 'pdm') and v_item is not null then
      v_linhas := public.pdm_parse_submetas(p_respostas->>('submetas_' || v_n));
      for v_i in 1..coalesce(array_length(v_linhas, 1), 0) loop
        v_subslots := v_subslots || ('sub_' || v_n || '_' || v_i);
        select id into v_pai from public.pdm_itens
          where pdm_id = v_pdm and parent_id = v_item
            and origem_campo = 'sub_' || v_n || '_' || v_i;
        if v_pai is not null then
          update public.pdm_itens
             set titulo = left(v_linhas[v_i], 500),
                 status = case when status = 'descartada' then 'ativa' else status end
           where id = v_pai and atualizado_por is null;
        else
          v_head := 20 - (select count(*) from public.pdm_itens
                           where pdm_id = v_pdm and parent_id is not null
                             and status <> 'descartada');
          if v_head > 0 then
            insert into public.pdm_itens (
              pdm_id, parent_id, titulo, ordem, origem, origem_campo
            ) values (
              v_pdm, v_item, left(v_linhas[v_i], 500), v_i, p_sistema,
              'sub_' || v_n || '_' || v_i);
          end if;
        end if;
      end loop;
    end if;
  end loop;

  -- o que ficou de fora da resposta nova sai da vista (não apaga: a
  -- história é do doc). Só slots projetados E nunca tocados à mão;
  -- manual ou editado são intocáveis.
  update public.pdm_itens i
     set status = 'descartada'
   where i.pdm_id = v_pdm and i.parent_id is null
     and i.origem in ('metas', 'pdm')
     and i.origem_campo like 'meta\_%' escape '\'
     and not (i.origem_campo = any(v_slots))
     and i.atualizado_por is null
     and i.status <> 'descartada';

  -- o descarte do mapa é só do PDM (0118): a resposta de Metas soma e
  -- atualiza, nunca remove — submetas_N lá é opcional e um envio sem
  -- desdobramento não pode varrer o que a dupla já construiu. O PDM,
  -- instrumento de revisão, limpa qualquer sub projetada que ele não
  -- mencione — mintada por ele mesmo ou pelo Metas — desde que a dupla
  -- não tenha posto a mão nela.
  if p_sistema = 'pdm' then
    update public.pdm_itens i
       set status = 'descartada'
     where i.pdm_id = v_pdm and i.parent_id is null
       and i.origem in ('metas', 'pdm')
       and i.origem_campo like 'sub\_%' escape '\'
       and not (i.origem_campo = any(v_subslots))
       and i.atualizado_por is null
       and i.status <> 'descartada';
  end if;

  -- meta_principal (legado do form de Metas, removido na 0109):
  -- a escolhida da época vira a prioridade 1 da ordem inicial
  if p_sistema = 'metas' and p_respostas->>'meta_principal' ~ '\d+' then
    v_principal := (regexp_match(p_respostas->>'meta_principal', '(\d+)'))[1]::int;
    update public.pdm_itens set ordem = 1
      where pdm_id = v_pdm and parent_id is null
        and origem_campo = 'meta_' || v_principal and status <> 'descartada';
    if found then
      v_ord := 2;
      for v_restante in
        select id from public.pdm_itens
         where pdm_id = v_pdm and parent_id is null
           and status <> 'descartada'
           and origem_campo is distinct from 'meta_' || v_principal
         order by ordem, created_at
      loop
        update public.pdm_itens set ordem = v_ord where id = v_restante.id;
        v_ord := v_ord + 1;
      end loop;
    end if;
  end if;
end $$;

commit;
