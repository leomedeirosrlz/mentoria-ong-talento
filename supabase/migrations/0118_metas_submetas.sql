begin;

-- 0118 — Definindo Minhas Metas ganha o desdobramento em submetas.
--
-- O instrumento Metas colhia só meta_N + porque_N; o desdobramento ("o
-- que eu preciso fazer pra conseguir isso?") existia só no PDM. Agora
-- cada meta do template leva submetas_N (texto_longo, opcional) — uma
-- linha por submeta, o mesmo contrato de pdm_parse_submetas que o mapa
-- do PDM já usa.
--
-- O que muda:
--   1) formularios.campos do oficial 'metas': submetas_N logo depois de
--      porque_N, pra todas as metas do template (1–3 obrigatórias +
--      4–5 opcionais). Mesmo escape hatch da 0109§11: guard desabilita,
--      campos literal, reabilita. Respostas antigas intactas — campo
--      novo, nada a reinterpretar.
--   2) pdm_projeta_resposta passa a ler submetas_N também das respostas
--      de 'metas' (antes só 'pdm'): as linhas viram filhas sub_N_i do
--      documento vivo, com origem = quem projetou ('metas'|'pdm'), e um
--      update mantém a procedência de quem mintou o slot — como já
--      acontece com meta_N.
--      O descarte do mapa segue EXCLUSIVO do PDM: a resposta de Metas
--      soma e atualiza, nunca varre — seus campos de submeta são todos
--      opcionais, então um envio sem eles não pode derrubar o mapa que
--      a dupla já construiu (Metas pode chegar depois do PDM num link
--      re-emitido). O filtro de origem do descarte amplia pra
--      ('metas','pdm') — o PDM revisa o mapa inteiro, não importa quem
--      mintou a linha.

-- ---------- 1) form oficial de Metas com submetas_N ----------

alter table public.formularios disable trigger formularios_sistema_guard;

update public.formularios
   set campos = '[
    {"id":"s_visao","tipo":"secao","label":"Minha visão de futuro","obrigatorio":false,"descricao":"No encontro anterior você construiu sua Declaração de Visão: uma frase que representa o que você deseja ser, alcançar ou conquistar. Agora o passo é pensar: quais conquistas preciso alcançar para tornar essa visão realidade? Metas são resultados que você deseja alcançar — ligados à sua visão e importantes pra você."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Minha Declaração de Visão (copie ou reescreva a frase que você criou)","obrigatorio":true},
    {"id":"preciso_criar","tipo":"texto","label":"Para me aproximar da minha visão, o que eu preciso CRIAR?","obrigatorio":false},
    {"id":"preciso_aprender","tipo":"texto","label":"O que eu preciso APRENDER?","obrigatorio":false},
    {"id":"preciso_melhorar","tipo":"texto","label":"O que eu preciso MELHORAR?","obrigatorio":false},
    {"id":"preciso_eliminar","tipo":"texto","label":"O que eu preciso ELIMINAR?","obrigatorio":false},
    {"id":"s_metas","tipo":"secao","label":"Minhas metas","obrigatorio":false,"descricao":"Preencha de 3 a 5 metas, da mais importante pra menos importante. Dica: comece cada meta com um verbo de ação — Desenvolver, Concluir, Aprender, Melhorar, Conseguir, Criar, Organizar. Se já souber os primeiros passos de uma meta, anote no desdobramento — uma submeta por linha. No próximo encontro vocês revisam juntos com o modelo SMART (clara, mensurável, alcançável, relevante e com prazo) — não precisa sair perfeita agora."},
    {"id":"meta_1","tipo":"texto","label":"Minha meta 1 (a mais importante)","obrigatorio":true},
    {"id":"porque_1","tipo":"texto_longo","label":"Por que a meta 1 é importante pra mim?","obrigatorio":true},
    {"id":"submetas_1","tipo":"texto_longo","label":"Desdobramento — submetas (uma por linha)","obrigatorio":false},
    {"id":"meta_2","tipo":"texto","label":"Minha meta 2","obrigatorio":true},
    {"id":"porque_2","tipo":"texto_longo","label":"Por que a meta 2 é importante pra mim?","obrigatorio":true},
    {"id":"submetas_2","tipo":"texto_longo","label":"Desdobramento — submetas (uma por linha)","obrigatorio":false},
    {"id":"meta_3","tipo":"texto","label":"Minha meta 3","obrigatorio":true},
    {"id":"porque_3","tipo":"texto_longo","label":"Por que a meta 3 é importante pra mim?","obrigatorio":true},
    {"id":"submetas_3","tipo":"texto_longo","label":"Desdobramento — submetas (uma por linha)","obrigatorio":false},
    {"id":"meta_4","tipo":"texto","label":"Minha meta 4","obrigatorio":false},
    {"id":"porque_4","tipo":"texto_longo","label":"Por que a meta 4 é importante pra mim?","obrigatorio":false},
    {"id":"submetas_4","tipo":"texto_longo","label":"Desdobramento — submetas (uma por linha)","obrigatorio":false},
    {"id":"meta_5","tipo":"texto","label":"Minha meta 5","obrigatorio":false},
    {"id":"porque_5","tipo":"texto_longo","label":"Por que a meta 5 é importante pra mim?","obrigatorio":false},
    {"id":"submetas_5","tipo":"texto_longo","label":"Desdobramento — submetas (uma por linha)","obrigatorio":false}
  ]'::jsonb,
      descricao = 'Template do mentorado da sequência da Visão (PDF oficial): da Declaração de Visão para 3 a 5 metas com o porquê de cada uma e o desdobramento em submetas — a dupla revisa no encontro seguinte com o modelo SMART.',
      versao = versao + 1,
      updated_at = now()
 where sistema = 'metas';

alter table public.formularios enable trigger formularios_sistema_guard;

-- ---------- 2) projeção: submetas_N do Metas alimenta o PDM ----------

-- Verbatim da 0109 (a definição viva — nenhuma migration posterior a
-- reescreveu) com dois deltas: o mapa de submetas roda pra 'metas'
-- também e a linha nova nasce com origem = p_sistema; o descarte
-- continua só do PDM, mas agora cobre origem ('metas','pdm').
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

  -- os três instrumentos podem trazer a Declaração de Visão
  v_titulo := nullif(btrim(coalesce(
    p_respostas->>'declaracao_visao', p_respostas->>'visao', '')), '');
  if v_titulo is not null then
    update public.pdm
       set visao = left(v_titulo, 2000), visao_em = now()
     where id = v_pdm and visao is distinct from left(v_titulo, 2000);
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
      where id = v_item;
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
           where id = v_pai;
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
  -- história é do doc). Só slots projetados; manual é intocável.
  update public.pdm_itens i
     set status = 'descartada'
   where i.pdm_id = v_pdm and i.parent_id is null
     and i.origem in ('metas', 'pdm')
     and i.origem_campo like 'meta\_%' escape '\'
     and not (i.origem_campo = any(v_slots))
     and i.status <> 'descartada';

  -- o descarte do mapa é só do PDM (0118): a resposta de Metas soma e
  -- atualiza, nunca remove — submetas_N lá é opcional e um envio sem
  -- desdobramento não pode varrer o que a dupla já construiu. O PDM,
  -- instrumento de revisão, limpa qualquer sub projetada que ele não
  -- mencione — mintada por ele mesmo ou pelo Metas.
  if p_sistema = 'pdm' then
    update public.pdm_itens i
       set status = 'descartada'
     where i.pdm_id = v_pdm and i.parent_id is not null
       and i.origem in ('metas', 'pdm')
       and i.origem_campo like 'sub\_%' escape '\'
       and not (i.origem_campo = any(v_subslots))
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

revoke all on function public.pdm_projeta_resposta(uuid, text, jsonb)
  from public, anon, authenticated;

commit;
