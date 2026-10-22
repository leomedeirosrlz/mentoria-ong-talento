begin;

-- 0109 — REALIZA-181: PDM nativo na plataforma.
--
-- O PDM deixa de ser só uma resposta de formulário: vira um documento vivo,
-- co-editado por mentor e mentorado ao longo do ciclo. Duas tabelas:
--
--   pdm       — um documento por dupla DPP (Declaração de Visão + metas).
--   pdm_itens — as metas (raiz, parent_id null) e as submetas (filhos,
--               aninhamento livre). Status ativa/atingida/descartada, prazo,
--               indicador de sucesso, área da vida, ordem = prioridade.
--
-- As respostas dos instrumentos `metas` e `pdm` continuam sendo o snapshot
-- histórico (jsonb, imutável) E projetam no documento relacional: o slot
-- origem_campo 'meta_N' é compartilhado pelos dois sistemas, então a
-- resposta do PDM revisa a meta que a resposta das Metas criou — nunca
-- duplica. Linhas do mapa de submetas viram filhas ('sub_N_i'). O que a
-- resposta nova não menciona vira 'descartada' (some da vista, fica no
-- histórico); itens manuais (origem_campo null) nunca são tocados.
--
-- Escrita só via RPCs escopadas (mentor/mentorado da dupla viva DPP) — a
-- RLS é select-only pra quem enxerga a dupla; o resto dos papéis lê, não
-- escreve. `submeter_resposta_formulario` é estendida verbatim (0080, a
-- definição viva — 0103/0105 não a reescreveram) com a chamada da projeção;
-- a projeção roda em bloco protegido: falha nela nunca derruba a entrega
-- da resposta, que já é o snapshot de registro.

-- ---------- 1) tabelas ----------

create table public.pdm (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null unique references public.duplas(id) on delete cascade,
  -- Declaração de Visão — uma frase, não um tratado (teto do DBA review)
  visao text check (visao is null or char_length(visao) <= 2000),
  visao_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pdm is
  'PDM vivo da dupla DPP (REALIZA-181): um documento por dupla — visão +
   metas/submetas em pdm_itens. Escrita só por RPCs escopadas.';

create table public.pdm_itens (
  id uuid primary key default gen_random_uuid(),
  pdm_id uuid not null references public.pdm(id) on delete cascade,
  -- null = meta (raiz); aponta outro item do MESMO pdm = submeta (recursivo)
  parent_id uuid references public.pdm_itens(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) > 0 and char_length(titulo) <= 500),
  porque text check (porque is null or char_length(porque) <= 2000),
  indicador text check (indicador is null or char_length(indicador) <= 500),
  area_vida text check (area_vida is null or char_length(area_vida) <= 80),
  prazo_alvo date,
  status text not null default 'ativa'
    check (status in ('ativa', 'atingida', 'descartada')),
  atingida_em timestamptz,
  -- prioridade: 1 é a mais importante (a ordem do guia, não display-only)
  ordem smallint not null default 0,
  -- quem mintou o item: 'manual' (a dupla) ou o instrumento que projetou
  -- ('metas', 'pdm', 'visao'); origem_campo é o slot estável do campo
  origem text not null default 'manual'
    check (origem in ('manual', 'metas', 'pdm', 'visao')),
  origem_campo text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pdm_itens is
  'Itens do PDM: raiz = meta, filho = submeta (aninhamento livre). Teto de
   10 metas e 20 subitens por documento, travado por trigger com advisory
   lock. Projeção dos instrumentos usa origem_campo como slot idempotente.';

-- slot de projeção é único por documento — re-submissão da mesma resposta
-- atualiza, não duplica (idempotência do par resposta→doc)
create unique index pdm_itens_origem_slot_uk
  on public.pdm_itens (pdm_id, origem_campo)
  where origem_campo is not null;
create index pdm_itens_pdm_idx on public.pdm_itens (pdm_id, parent_id, ordem);

-- ---------- 2) triggers: teto, pai-no-mesmo-doc, touch ----------

-- Teto (guia: ~5 metas no template, 10 é o dobro; submetas ~20 no doc).
-- O advisory lock serializa o check-then-insert — sem ele duas sessões
-- contando 9 passariam juntas (race apontada na revisão do DBA).
create or replace function public.pdm_itens_cap() returns trigger
language plpgsql set search_path to '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('pdm-cap:' || new.pdm_id::text));
  if new.parent_id is null then
    if (select count(*) from public.pdm_itens
         where pdm_id = new.pdm_id and parent_id is null
           and status <> 'descartada') >= 10 then
      raise exception 'o PDM comporta no máximo 10 metas';
    end if;
  else
    if (select count(*) from public.pdm_itens
         where pdm_id = new.pdm_id and parent_id is not null
           and status <> 'descartada') >= 20 then
      raise exception 'o PDM comporta no máximo 20 subitens';
    end if;
  end if;
  return new;
end $$;

create trigger pdm_itens_cap before insert on public.pdm_itens
  for each row execute function public.pdm_itens_cap();

-- O pai precisa viver no mesmo documento (sem ponte entre PDMs) e não pode
-- ser o próprio item nem um descendente dele (sem ciclo na árvore).
create or replace function public.pdm_itens_valida_pai() returns trigger
language plpgsql set search_path to '' as $$
declare
  v_pai_pdm uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select pdm_id into v_pai_pdm
    from public.pdm_itens where id = new.parent_id;
  if v_pai_pdm is null then
    raise exception 'item pai não encontrado';
  end if;
  if v_pai_pdm is distinct from new.pdm_id then
    raise exception 'item pai pertence a outro PDM';
  end if;
  if new.parent_id = new.id then
    raise exception 'item não pode ser pai de si mesmo';
  end if;
  if tg_op = 'UPDATE' and exists (
    with recursive desc_ as (
      select i.id from public.pdm_itens i where i.parent_id = new.id
      union all
      select i.id from public.pdm_itens i
        join desc_ d on i.parent_id = d.id
    )
    select 1 from desc_ where id = new.parent_id
  ) then
    raise exception 'item não pode virar filho do próprio descendente';
  end if;
  return new;
end $$;

create trigger pdm_itens_valida_pai before insert or update on public.pdm_itens
  for each row execute function public.pdm_itens_valida_pai();

create or replace function public.pdm_touch() returns trigger
language plpgsql set search_path to '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger pdm_touch before update on public.pdm
  for each row execute function public.pdm_touch();
create trigger pdm_itens_touch before update on public.pdm_itens
  for each row execute function public.pdm_touch();

-- ---------- 3) RLS: leitura por vínculo, escrita só por RPC ----------

alter table public.pdm enable row level security;
alter table public.pdm_itens enable row level security;

-- O documento é de trabalho da dupla: coord lê tudo; mentor/supervisor lêem
-- as suas duplas (RLS de `duplas` já filtra o subselect); o mentorado lê o
-- próprio PDM via a view definer jovem_duplas — a lição da 0068: o jovem
-- não tem SELECT em `duplas`, então a oracle de pertencimento dele é a
-- view. (O ramo d.mentorado_id no subselect é intencionalmente redundante:
-- quem tem acesso a `duplas` resolve ali; quem não tem cai na view.)
create policy pdm_select on public.pdm for select to authenticated using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
     where d.id = pdm.dupla_id
       and (d.mentor_id = public.my_profile_id()
            or d.supervisor_id = public.my_profile_id()
            or d.mentorado_id = public.my_mentorado_id()))
  or exists (
    select 1 from public.jovem_duplas jd where jd.id = pdm.dupla_id)
);

create policy pdm_itens_select on public.pdm_itens for select to authenticated using (
  exists (
    select 1 from public.pdm p
     where p.id = pdm_itens.pdm_id
       and (public.my_role() = 'coordenacao'
            or exists (
              select 1 from public.duplas d
               where d.id = p.dupla_id
                 and (d.mentor_id = public.my_profile_id()
                      or d.supervisor_id = public.my_profile_id()
                      or d.mentorado_id = public.my_mentorado_id()))
            or exists (
              select 1 from public.jovem_duplas jd where jd.id = p.dupla_id)))
);

-- leitura direta liberada pros logados; escrita SÓ via RPC definer (sem
-- grant de insert/update/delete pra ninguém — nem autenticado)
grant select on public.pdm to authenticated;
grant select on public.pdm_itens to authenticated;
-- o default do Postgres não granta nada a `anon`, mas a revisão do DBA pede
-- o revoke explícito: padrão do projeto desde a 0053
revoke all on public.pdm from anon;
revoke all on public.pdm_itens from anon;

-- ---------- 4) gate interno de escrita ----------

-- Só mentor e mentorado DA dupla DPP viva (ativa/pausada) editam. Coord e
-- supervisor leem; trilha de especialista e dupla encerrada/concluída são
-- somente-leitura. Reuso interno pelas RPCs — execute revogado.
create or replace function public.pdm_pode_editar(p_dupla_id uuid)
returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
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
  return v_dupla.mentor_id = public.my_profile_id()
      or v_dupla.mentorado_id = public.my_mentorado_id();
end $$;

revoke all on function public.pdm_pode_editar(uuid)
  from public, anon, authenticated;

-- ---------- 5) RPC de leitura: o documento inteiro numa chamada ----------

-- {duplaId, visao, visaoEm, itens:[{id,parentId,titulo,porque,indicador,
-- areaVida,prazoAlvo,status,atingidaEm,ordem,origem,origemCampo}]}
-- Mesmo escopo dos instrumentos da dupla (0080): coord; mentor, supervisor
-- e o próprio mentorado dela. Dupla sem PDM ainda devolve doc vazio — a
-- row nasce preguiçosa na primeira escrita.
create or replace function public.pdm_da_dupla(p_dupla_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
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

  if not (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or v_dupla.supervisor_id = public.my_profile_id()
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) then
    raise exception 'sem permissão pra ver o PDM desta dupla';
  end if;

  select p.id, p.visao, p.visao_em into v_pdm
    from public.pdm p where p.dupla_id = p_dupla_id;

  if v_pdm.id is null then
    return jsonb_build_object(
      'duplaId', p_dupla_id, 'visao', null, 'visaoEm', null, 'itens', '[]'::jsonb);
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
             'origemCampo', i.origem_campo)
           order by i.ordem, i.created_at), '[]'::jsonb)
    into v_itens
    from public.pdm_itens i
   where i.pdm_id = v_pdm.id;

  return jsonb_build_object(
    'duplaId', p_dupla_id,
    'visao', v_pdm.visao,
    'visaoEm', v_pdm.visao_em,
    'itens', v_itens);
end $$;

revoke all on function public.pdm_da_dupla(uuid) from public, anon;
grant execute on function public.pdm_da_dupla(uuid) to authenticated;

-- ---------- 6) RPCs de escrita ----------

-- Visão: escreve/reescreve a Declaração (teto 2000 — o check é o mesmo).
create or replace function public.pdm_salvar_visao(
  p_dupla_id uuid, p_visao text
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  insert into public.pdm (dupla_id, visao, visao_em)
  values (p_dupla_id, nullif(btrim(p_visao), ''), now())
  on conflict (dupla_id) do update
    set visao = nullif(btrim(p_visao), ''), visao_em = now();
end $$;

revoke all on function public.pdm_salvar_visao(uuid, text) from public, anon;
grant execute on function public.pdm_salvar_visao(uuid, text) to authenticated;

-- Item: p_item_id null = novo (meta quando parent null, submeta quando
-- preenchido); preenchido = edição dos campos — status e ordem são dos
-- fluxos próprios (pdm_status_item / pdm_reordenar). O cap trigger trava
-- excesso; o pai é validado pelo trigger de integridade.
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
language plpgsql security definer set search_path to 'public' as $$
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
      ordem, origem, created_by
    ) values (
      v_pdm, p_parent_id, left(btrim(p_titulo), 500),
      nullif(btrim(p_porque), ''), nullif(btrim(p_indicador), ''),
      nullif(btrim(p_area_vida), ''), p_prazo_alvo,
      coalesce((select max(i.ordem) + 1 from public.pdm_itens i
                 where i.pdm_id = v_pdm
                   and i.parent_id is not distinct from p_parent_id
                   and i.status <> 'descartada'), 1),
      'manual', public.my_profile_id()
    ) returning id into p_item_id;
    return p_item_id;
  end if;

  update public.pdm_itens
     set titulo = left(btrim(p_titulo), 500),
         porque = nullif(btrim(p_porque), ''),
         indicador = nullif(btrim(p_indicador), ''),
         area_vida = nullif(btrim(p_area_vida), ''),
         prazo_alvo = p_prazo_alvo
   where id = p_item_id and pdm_id = v_pdm;
  if not found then
    raise exception 'item não encontrado neste PDM';
  end if;
  return p_item_id;
end $$;

revoke all on function public.pdm_salvar_item(uuid, uuid, uuid, text, text, text, text, date)
  from public, anon;
grant execute on function public.pdm_salvar_item(uuid, uuid, uuid, text, text, text, text, date)
  to authenticated;

-- Status: 'atingida' carimba agora; voltar a 'ativa' limpa o carimbo;
-- 'descartada' preserva a data de conquista (o item saiu da vista depois
-- de cumprido — a história fica).
create or replace function public.pdm_status_item(
  p_dupla_id uuid, p_item_id uuid, p_status text
) returns void
language plpgsql security definer set search_path to 'public' as $$
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
         end
    from public.pdm p
   where i.id = p_item_id and i.pdm_id = p.id and p.dupla_id = p_dupla_id;
  if not found then
    raise exception 'item não encontrado neste PDM';
  end if;
end $$;

revoke all on function public.pdm_status_item(uuid, uuid, text) from public, anon;
grant execute on function public.pdm_status_item(uuid, uuid, text) to authenticated;

-- Remover: delete em cascata (os filhos caem junto). A UI prefere
-- "Descartar" — apagar é o gesto de correção, não o de revisão.
create or replace function public.pdm_remover_item(
  p_dupla_id uuid, p_item_id uuid
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  delete from public.pdm_itens i
   using public.pdm p
   where i.id = p_item_id and i.pdm_id = p.id and p.dupla_id = p_dupla_id;
  if not found then
    raise exception 'item não encontrado neste PDM';
  end if;
end $$;

revoke all on function public.pdm_remover_item(uuid, uuid) from public, anon;
grant execute on function public.pdm_remover_item(uuid, uuid) to authenticated;

-- Reordenar: recebe a lista COMPLETA dos irmãos do mesmo nível (a UI manda
-- as metas na nova prioridade). Incompleta ou misturando níveis → exceção,
-- nada grava (o "arraste" nunca vira estado quebrado no servidor).
create or replace function public.pdm_reordenar(
  p_dupla_id uuid, p_parent_id uuid, p_item_ids uuid[]
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_pdm uuid;
  v_total int;
  v_marcados int;
  v_distintos int;
  v_pos smallint := 0;
  v_id uuid;
begin
  if not public.pdm_pode_editar(p_dupla_id) then
    raise exception 'sem permissão pra editar o PDM desta dupla';
  end if;
  select p.id into v_pdm from public.pdm p where p.dupla_id = p_dupla_id;
  if v_pdm is null then
    raise exception 'PDM não encontrado';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pdm::text || ':ordem'));

  select count(*),
         count(*) filter (where i.id = any(p_item_ids))
    into v_total, v_marcados
    from public.pdm_itens i
   where i.pdm_id = v_pdm
     and i.parent_id is not distinct from p_parent_id
     and i.status <> 'descartada';
  select count(distinct x) into v_distintos from unnest(p_item_ids) x;

  if v_total is distinct from v_marcados
     or v_total is distinct from v_distintos
     or v_total is distinct from coalesce(array_length(p_item_ids, 1), 0) then
    raise exception 'a reordenação precisa listar todos os itens do mesmo nível';
  end if;

  foreach v_id in array p_item_ids loop
    v_pos := v_pos + 1;
    update public.pdm_itens set ordem = v_pos where id = v_id;
  end loop;
end $$;

revoke all on function public.pdm_reordenar(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.pdm_reordenar(uuid, uuid, uuid[]) to authenticated;

-- ---------- 7) parser do mapa de submetas (espelho de src/lib/pdm.ts) ----------

-- texto_longo do campo submetas_N → array de linhas. Uma linha por item;
-- se tudo veio numa linha só (colado do doc impresso), os marcadores
-- "2." / "3)" no meio da linha também separam. Limpeza: prefixo
-- "1.", "2)", "-" e espaços saem; vazias não entram; teto 20.
create or replace function public.pdm_parse_submetas(p_texto text)
returns text[]
language plpgsql immutable set search_path to '' as $$
declare
  v_linha text;
  v_pedaco text;
  v_out text[] := '{}';
begin
  if p_texto is null or btrim(p_texto) = '' then
    return '{}';
  end if;
  for v_linha in
    select s from regexp_split_to_table(p_texto, E'\r?\n+') s
  loop
    for v_pedaco in
      select p from regexp_split_to_table(v_linha, E'\\s+\\d+[.)]\\s+') p
    loop
      v_pedaco := btrim(regexp_replace(v_pedaco, '^\s*(\d+[.)]|[-•*])\s*', ''));
      if v_pedaco <> '' then
        v_out := v_out || left(v_pedaco, 500);
      end if;
    end loop;
  end loop;
  return v_out[1:20];
end $$;

revoke all on function public.pdm_parse_submetas(text)
  from public, anon, authenticated;

-- ---------- 8) projeção resposta → documento (interna) ----------

-- Chamada pelo submit e pelo backfill abaixo. Idempotente: o slot
-- origem_campo ('meta_N', 'sub_N_i') é a chave — a re-submissão da mesma
-- resposta re-grava os mesmos itens. A resposta nova manda nos CAMPOS que
-- o instrumento coleta (título, porquê, IS, prazo); status, atingida_em e
-- ordem são trabalho da dupla no doc — a projeção não pisa. Item deixado
-- de fora da resposta nova vira 'descartada'; manual nunca é tocado.
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

    -- mapa de submetas do PDM: cada linha vira filha do slot meta_N
    if p_sistema = 'pdm' and v_item is not null then
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
              v_pdm, v_item, left(v_linhas[v_i], 500), v_i, 'pdm',
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

  if p_sistema = 'pdm' then
    update public.pdm_itens i
       set status = 'descartada'
     where i.pdm_id = v_pdm and i.parent_id is not null
       and i.origem = 'pdm'
       and i.origem_campo like 'sub\_%' escape '\'
       and not (i.origem_campo = any(v_subslots))
       and i.status <> 'descartada';
  end if;

  -- meta_principal (legado do form de Metas, removido nesta migration):
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

-- ---------- 9) submit estendido (verbatim 0080 + projeção) ----------

-- A definição viva é a da 0080 (0103/0105 não a reescreveram): gate de
-- identidade do 0070, wiring do checklist 360º do 0042/0080, notificação
-- da coord — tudo preservado byte a byte; a adição é o bloco da projeção.
create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
  v_nome text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dupla_id, fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo as f_titulo, f.sistema as f_sistema,
         f.ativo as f_ativo, f.campos
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- gate de identidade (0070): autenticado não responde link de outra pessoa
  if auth.uid() is not null
     and ((l.dest_profile_id is not null
           and l.dest_profile_id is distinct from public.my_profile_id())
       or (l.dest_mentorado_id is not null
           and l.dest_mentorado_id is distinct from public.my_mentorado_id())) then
    raise exception 'este link é de outra pessoa';
  end if;

  -- idempotente: já respondido devolve a resposta existente
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas);

  update formulario_links
    set usado_em = now(),
        respondido_por_profile_id = public.my_profile_id()
    where id = l.id and usado_em is null;
  if not found then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;

  -- wiring 360º (0042, restaurado): a resposta do instrumento oficial
  -- carimba o checklist do encerramento da dupla. Só UPDATE, nunca INSERT —
  -- a row nasce pela autoavaliação do mentor ou pela decisão da coordenação.
  -- `decidido_por is null` evita reescrever registro fechado e o falso-
  -- positivo do trigger encerramentos_decisor quando o respondente é um
  -- mentor logado (my_profile_id() lê o JWT do caller mesmo no definer).
  if l.f_sistema = 'avaliacao_360' and l.dupla_id is not null then
    update encerramentos
       set checklist = checklist || '{"avaliacao_360_enviada":true}'::jsonb
     where dupla_id = l.dupla_id
       and decidido_por is null;
  end if;

  -- projeção no PDM vivo (0109): visao/metas/pdm alimentam o documento
  -- relacional da dupla além do snapshot jsonb (que fica intacto). Bloco
  -- protegido: a projeção é re-jogável e nunca pode derrubar a entrega —
  -- mapa com >20 linhas, teto de metas ou dado legado estranho viram
  -- warning no log, não resposta perdida.
  if l.f_sistema in ('visao', 'metas', 'pdm') and l.dupla_id is not null then
    begin
      perform public.pdm_projeta_resposta(l.dupla_id, l.f_sistema, v_limpo);
    exception when others then
      raise warning 'pdm: projeção da resposta % (% na dupla %) falhou: %',
        v_id, l.f_sistema, l.dupla_id, sqlerrm;
    end;
  end if;

  -- toda resposta avisa a coordenação (0042, restaurado) — mentorado não
  -- tem login, o sino é como a equipe fica sabendo. O insert roda como
  -- owner da função, então a policy notificacoes_insert não se aplica a
  -- este caminho; o CHECK de tipo cobre o vocabulário.
  v_nome := coalesce(
    (select nome from profiles where id = l.dest_profile_id),
    (select nome from mentorados where id = l.dest_mentorado_id)
  );
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  select c.id,
         'formulario_respondido',
         'Resposta de formulário',
         case
           when v_nome is not null
             then v_nome || ' respondeu "' || l.f_titulo || '"'
           else 'Chegou uma resposta de "' || l.f_titulo || '"'
         end,
         '/formularios/' || l.f_id,
         l.dest_profile_id
    from profiles c
   where c.role = 'coordenacao' and c.ativo
     -- quem respondeu não se notifica (coord testando o próprio form)
     and c.id is distinct from l.dest_profile_id;

  return v_id;
end $$;

-- grants preservados (a função aceita resposta pública por token desde a
-- 0036) — reafirmados por clareza
revoke all on function public.submeter_resposta_formulario(text, jsonb)
  from public;
grant execute on function public.submeter_resposta_formulario(text, jsonb)
  to anon, authenticated;

-- ---------- 10) backfill idempotente ----------

-- A resposta MAIS RECENTE de cada sistema por dupla projeta na ordem
-- visao → metas → pdm (o PDM é a revisão, sobrescreve os campos que o
-- instrumento anterior coletou — status/ordem manuais não existem ainda).
-- Rodável de novo sem efeito: os slots dedupe e o doc converge pro mesmo
-- estado. Erros de uma dupla não abortam as demais (warning no log).
do $$
declare
  v_dupla record;
  v_resp record;
  v_sistema text;
begin
  for v_dupla in
    select distinct l.dupla_id as id
      from public.formulario_links l
      join public.formulario_respostas r on r.link_id = l.id
      join public.formularios f on f.id = l.formulario_id
     where l.dupla_id is not null
       and f.sistema in ('visao', 'metas', 'pdm')
  loop
    for v_sistema in select unnest(array['visao', 'metas', 'pdm']) loop
      select r.respostas into v_resp
        from public.formulario_respostas r
        join public.formulario_links l on l.id = r.link_id
        join public.formularios f on f.id = l.formulario_id
       where l.dupla_id = v_dupla.id and f.sistema = v_sistema
       order by r.respondido_em desc
       limit 1;
      if v_resp.respostas is not null then
        begin
          perform public.pdm_projeta_resposta(v_dupla.id, v_sistema, v_resp.respostas);
        exception when others then
          raise warning 'pdm: backfill da dupla % (%) falhou: %',
            v_dupla.id, v_sistema, sqlerrm;
        end;
      end if;
    end loop;
  end loop;
end $$;

-- ---------- 11) form oficial de Metas sem os campos legados ----------

-- meta_principal + rev_* saem do form: a prioridade mora na ordem do doc
-- e a revisão acontece no PDM vivo, não num campo de checklist. O escape
-- hatch é o do 0043/0053: desabilita o guard, atualiza, reabilita.
-- Respostas antigas continuam íntegras — o renderer ignora campo sem
-- definição e as chaves removidas seguem no snapshot jsonb.
alter table public.formularios disable trigger formularios_sistema_guard;

update public.formularios
   set campos = '[
    {"id":"s_visao","tipo":"secao","label":"Minha visão de futuro","obrigatorio":false,"descricao":"No encontro anterior você construiu sua Declaração de Visão: uma frase que representa o que você deseja ser, alcançar ou conquistar. Agora o passo é pensar: quais conquistas preciso alcançar para tornar essa visão realidade? Metas são resultados que você deseja alcançar — ligados à sua visão e importantes pra você."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Minha Declaração de Visão (copie ou reescreva a frase que você criou)","obrigatorio":true},
    {"id":"preciso_criar","tipo":"texto","label":"Para me aproximar da minha visão, o que eu preciso CRIAR?","obrigatorio":false},
    {"id":"preciso_aprender","tipo":"texto","label":"O que eu preciso APRENDER?","obrigatorio":false},
    {"id":"preciso_melhorar","tipo":"texto","label":"O que eu preciso MELHORAR?","obrigatorio":false},
    {"id":"preciso_eliminar","tipo":"texto","label":"O que eu preciso ELIMINAR?","obrigatorio":false},
    {"id":"s_metas","tipo":"secao","label":"Minhas metas","obrigatorio":false,"descricao":"Preencha de 3 a 5 metas, da mais importante pra menos importante. Dica: comece cada meta com um verbo de ação — Desenvolver, Concluir, Aprender, Melhorar, Conseguir, Criar, Organizar. No próximo encontro vocês revisam juntos com o modelo SMART (clara, mensurável, alcançável, relevante e com prazo) — não precisa sair perfeita agora."},
    {"id":"meta_1","tipo":"texto","label":"Minha meta 1 (a mais importante)","obrigatorio":true},
    {"id":"porque_1","tipo":"texto_longo","label":"Por que a meta 1 é importante pra mim?","obrigatorio":true},
    {"id":"meta_2","tipo":"texto","label":"Minha meta 2","obrigatorio":true},
    {"id":"porque_2","tipo":"texto_longo","label":"Por que a meta 2 é importante pra mim?","obrigatorio":true},
    {"id":"meta_3","tipo":"texto","label":"Minha meta 3","obrigatorio":true},
    {"id":"porque_3","tipo":"texto_longo","label":"Por que a meta 3 é importante pra mim?","obrigatorio":true},
    {"id":"meta_4","tipo":"texto","label":"Minha meta 4","obrigatorio":false},
    {"id":"porque_4","tipo":"texto_longo","label":"Por que a meta 4 é importante pra mim?","obrigatorio":false},
    {"id":"meta_5","tipo":"texto","label":"Minha meta 5","obrigatorio":false},
    {"id":"porque_5","tipo":"texto_longo","label":"Por que a meta 5 é importante pra mim?","obrigatorio":false}
  ]'::jsonb,
      versao = versao + 1,
      updated_at = now()
 where sistema = 'metas';

alter table public.formularios enable trigger formularios_sistema_guard;

commit;
