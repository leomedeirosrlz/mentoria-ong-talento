-- 0212 relatorio_ia_cards — "Perguntar à Liza" nos relatórios operacionais
-- (REALIZA-456 / specs/008-telemetria-nov US5).
--
-- Duas mudanças nesta migration:
--
-- 1) Canal 'relatorio' no vocabulário de ia_eventos — mesma régua da 0193:
--    o CHECK da tabela e o guard das 4 funções de escrita/limite passam a
--    valer a união ('chat','mcp','importacao','relatorio'). As 4 funções
--    voltam verbatim (0159/0160/0193) — só a lista de canais muda;
--    assinaturas intactas.
--
-- 2) Tabela public.relatorio_ia_cards + RPC relatorio_ia_card_registrar:
--    o card é o histórico auditável das respostas da Liza sobre os
--    AGREGADOS de uma seção (nunca texto livre de mentorado). Uma row
--    vigente por (secao, recorte_key) via unique parcial; o histórico fica
--    ligado por superseded_by. contexto_hash marca "desatualizado" quando
--    os agregados mudam — nunca auto-regenera.
--
-- Autorização: RLS coord-only no SELECT; INSERT/UPDATE só pela RPC
-- security definer com o mesmo has_papel('coordenacao') — a action não é
-- a fronteira, o banco é.
--
-- Blast radius: zero pra dados existentes (CHECK só valida insert novo;
-- canais antigos seguem valendo). Funções internas — mesmos grants.

begin;

-- ---- CHECK da coluna ----
alter table public.ia_eventos drop constraint if exists ia_eventos_canal_check;
alter table public.ia_eventos
  add constraint ia_eventos_canal_check
  check (canal in ('chat', 'mcp', 'importacao', 'relatorio'));

-- ---- registrar_ia_evento (definição vigente: 0193) ----
create or replace function public.registrar_ia_evento(
  p_canal text,
  p_tool text,
  p_args jsonb,
  p_ok boolean,
  p_erro text default null,
  p_duracao_ms int default null,
  p_profile_id uuid default null,
  p_modelo text default null,
  p_tier text default null,
  p_tokens_in int default null,
  p_tokens_out int default null,
  p_tokens_reasoning int default null,
  p_cache_read int default null,
  p_custo_usd numeric default null,
  p_allowance_usd numeric default null,
  p_billing_source text default null,
  p_request_id uuid default null,
  p_iteracoes int default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_dono uuid;
begin
  if p_canal not in ('chat', 'mcp', 'importacao', 'relatorio') then
    raise exception 'canal inválido';
  end if;
  -- o autor declarado só vale pra service_role (MCP legado); caller comum
  -- carimba o próprio JWT — sem forjar evento no nome de outro
  v_dono := case
    when auth.jwt() ->> 'role' = 'service_role'
      then coalesce(p_profile_id, public.my_profile_id())
    else public.my_profile_id()
  end;
  insert into public.ia_eventos (
      profile_id, canal, tool, args, ok, erro, duracao_ms,
      modelo, tier, tokens_in, tokens_out, tokens_reasoning, cache_read,
      custo_usd, allowance_usd, billing_source, request_id, iteracoes
    )
    values (
      v_dono, p_canal, p_tool, coalesce(p_args, '{}'::jsonb), p_ok, p_erro,
      p_duracao_ms, p_modelo, p_tier, p_tokens_in, p_tokens_out,
      p_tokens_reasoning, p_cache_read, p_custo_usd, p_allowance_usd,
      p_billing_source, p_request_id, p_iteracoes
    )
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  from public, anon;
grant execute on function public.registrar_ia_evento(text, text, jsonb, boolean, text, int, uuid, text, text, int, int, int, int, numeric, numeric, text, uuid, int)
  to authenticated;

-- ---- consumir_limite_ia (definição vigente: 0193) ----
create or replace function public.consumir_limite_ia(
  p_args jsonb default '{}'::jsonb,
  p_limite int default 20,
  p_canal text default 'chat'
)
returns table (permitido boolean, usados int, request_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.my_profile_id();
  v_usados int;
  v_req uuid := gen_random_uuid();
begin
  if v_uid is null or p_canal not in ('chat', 'mcp', 'importacao', 'relatorio') then
    return query select false, 0, v_req; return;
  end if;
  -- serializa o par check+insert por profile: dois requests paralelos viram
  -- veredictos sequenciais — o segundo já conta o evento do primeiro
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_usados
    from public.ia_eventos e
   where e.profile_id = v_uid
     and e.tool = 'mensagem'
     and e.created_at > now() - interval '60 seconds';
  if v_usados >= p_limite then
    return query select false, v_usados, v_req; return;
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, duracao_ms, request_id)
    values (v_uid, p_canal, 'mensagem', coalesce(p_args, '{}'::jsonb), true, 0, v_req);
  return query select true, v_usados + 1, v_req;
end $$;

revoke all on function public.consumir_limite_ia(jsonb, int, text) from public, anon;
grant execute on function public.consumir_limite_ia(jsonb, int, text) to authenticated;

-- ---- ia_contexto_e_limite (definição vigente: 0193) ----
create or replace function public.ia_contexto_e_limite(
  p_args jsonb default '{}'::jsonb,
  p_limite int default 20,
  p_canal text default 'chat'
)
returns table (
  profile_id uuid,
  role public.app_role,
  papeis public.app_role[],
  permitido boolean,
  usados int,
  request_id uuid
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  -- my_profile_id() já filtra ativo: desativado/desconhecido sai null
  v_uid uuid := public.my_profile_id();
  v_role public.app_role;
  v_papeis public.app_role[];
  v_usados int;
  v_req uuid := gen_random_uuid();
begin
  if v_uid is null then
    return query select null::uuid, null::public.app_role,
      array[]::public.app_role[], false, 0, null::uuid;
    return;
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  -- mesma ordem de precedência do my_papeis (0085): primeiro = mais alto
  select coalesce(array_agg(pp.papel order by
           case pp.papel
             when 'coordenacao' then 1
             when 'supervisor' then 2
             when 'mentor_dpp' then 3
             when 'mentor_especialista' then 4
             when 'mentorado' then 5
           end,
           pp.created_at, pp.id),
         array[]::public.app_role[])
    into v_papeis
    from public.profile_papeis pp
   where pp.profile_id = v_uid;

  if p_canal not in ('chat', 'mcp', 'importacao', 'relatorio') then
    return query select v_uid, v_role, v_papeis, false, 0, null::uuid;
    return;
  end if;

  -- mesma chave do consumir_limite_ia: chat e MCP disputam o mesmo lock
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_usados
    from public.ia_eventos e
   where e.profile_id = v_uid
     and e.tool = 'mensagem'
     and e.created_at > now() - interval '60 seconds';
  if v_usados >= p_limite then
    return query select v_uid, v_role, v_papeis, false, v_usados, null::uuid;
    return;
  end if;
  insert into public.ia_eventos (profile_id, canal, tool, args, ok, duracao_ms, request_id)
    values (v_uid, p_canal, 'mensagem', coalesce(p_args, '{}'::jsonb), true, 0, v_req);
  return query select v_uid, v_role, v_papeis, true, v_usados + 1, v_req;
end $$;

revoke all on function public.ia_contexto_e_limite(jsonb, int, text) from public, anon;
grant execute on function public.ia_contexto_e_limite(jsonb, int, text) to authenticated;

-- ---- registrar_ia_eventos_lote (definição vigente: 0193) ----
create or replace function public.registrar_ia_eventos_lote(p_eventos jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_service boolean := auth.jwt() ->> 'role' = 'service_role';
  v_eu uuid := public.my_profile_id();
begin
  if p_eventos is null or jsonb_typeof(p_eventos) <> 'array' then
    raise exception 'lote inválido';
  end if;
  v_n := jsonb_array_length(p_eventos);
  if v_n = 0 then return 0; end if;
  -- teto do lote: uma mensagem gera no máximo ~6 rodadas de tools + o resumo
  if v_n > 50 then
    raise exception 'lote acima de 50 eventos';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_eventos) e
     where coalesce(e ->> 'canal', '') not in ('chat', 'mcp', 'importacao', 'relatorio')
  ) then
    raise exception 'canal inválido';
  end if;

  -- mesma regra do registrar_ia_evento (0159): autor declarado só vale pra
  -- service_role; caller comum carimba o próprio JWT
  insert into public.ia_eventos (
      profile_id, canal, tool, args, ok, erro, duracao_ms,
      modelo, tier, tokens_in, tokens_out, tokens_reasoning, cache_read,
      custo_usd, allowance_usd, billing_source, request_id, iteracoes
    )
  select
    case when v_service
      then coalesce((e ->> 'profile_id')::uuid, v_eu)
      else v_eu
    end,
    e ->> 'canal',
    e ->> 'tool',
    coalesce(e -> 'args', '{}'::jsonb),
    (e ->> 'ok')::boolean,
    e ->> 'erro',
    (e ->> 'duracao_ms')::int,
    e ->> 'modelo',
    e ->> 'tier',
    (e ->> 'tokens_in')::int,
    (e ->> 'tokens_out')::int,
    (e ->> 'tokens_reasoning')::int,
    (e ->> 'cache_read')::int,
    (e ->> 'custo_usd')::numeric,
    (e ->> 'allowance_usd')::numeric,
    e ->> 'billing_source',
    (e ->> 'request_id')::uuid,
    (e ->> 'iteracoes')::int
  from jsonb_array_elements(p_eventos) e;

  return v_n;
end $$;

revoke all on function public.registrar_ia_eventos_lote(jsonb) from public, anon;
grant execute on function public.registrar_ia_eventos_lote(jsonb) to authenticated;

-- =====================================================================
-- relatorio_ia_cards — os cards persistidos do "Perguntar à Liza"
-- =====================================================================

create table public.relatorio_ia_cards (
  id            uuid primary key default gen_random_uuid(),
  -- a aba do hub (visao/aderencia/…/adocao) — text livre: vocabulário novo
  -- não pede migration
  secao         text not null,
  -- o recorte canônico exibido no card (turma/cronograma/janela/papel)
  recorte       jsonb not null default '{}'::jsonb,
  -- chave estável do recorte — identidade do "mesmo lugar" junto da secao
  recorte_key   text not null,
  -- fingerprint dos agregados da pergunta: mudou → a resposta ficou pra
  -- trás (badge "desatualizado" na tela; nunca auto-regenera)
  contexto_hash text not null,
  pergunta      text not null,
  -- resposta em markdown já sanitizada — imutável depois de gravada
  resposta_md   text not null,
  modelo        text,
  tier          text,
  -- correlação com o evento 'mensagem' da reserva (consumir_limite_ia)
  request_id    uuid,
  gerado_por    uuid not null references public.profiles(id),
  gerado_em     timestamptz not null default now(),
  -- ponteiro do ciclo de vida: a row vigente é a que tem superseded_by
  -- null; o histórico inteiro fica encadeado da mais velha pra mais nova
  superseded_by uuid references public.relatorio_ia_cards(id)
);

comment on table public.relatorio_ia_cards is
  'Cards da Liza sobre agregados das seções de /relatorios/operacionais (REALIZA-456): um vigente por (secao, recorte_key), histórico encadeado por superseded_by, contexto_hash marca desatualizado. Conteúdo = pergunta da coordenação + resposta em markdown — agregados do programa, nunca texto livre de mentorado.';

-- uma row vigente por (secao, recorte_key) — o "desatualizado" vive no
-- hash, não numa segunda vigente
create unique index relatorio_ia_cards_vigente_uk
  on public.relatorio_ia_cards (secao, recorte_key)
  where superseded_by is null;

create index relatorio_ia_cards_secao_idx
  on public.relatorio_ia_cards (secao, gerado_em desc);

alter table public.relatorio_ia_cards enable row level security;

-- leitura coord-only; insert/update não recebem grant — a escrita passa
-- toda pela RPC definer abaixo
revoke all on public.relatorio_ia_cards from public, anon;
grant select on public.relatorio_ia_cards to authenticated;

create policy relatorio_ia_cards_select_coord
  on public.relatorio_ia_cards for select to authenticated
  using (public.has_papel('coordenacao'));

-- relatorio_ia_card_registrar: único caminho de escrita. Serializa a geração
-- do par (secao, recorte) por advisory lock, deduplica a vigente de mesmo
-- contexto+pergunta (dois cliques no mesmo instante não queimam 2 chamadas
-- nem criam 2 vigentes) e pendura o vigente anterior em superseded_by —
-- o conteúdo gravado nunca é reescrito.
create or replace function public.relatorio_ia_card_registrar(
  p_secao text,
  p_recorte jsonb,
  p_recorte_key text,
  p_contexto_hash text,
  p_pergunta text,
  p_resposta_md text,
  p_modelo text default null,
  p_tier text default null,
  p_request_id uuid default null
)
returns public.relatorio_ia_cards
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.my_profile_id();
  v_vigente public.relatorio_ia_cards;
  v_novo public.relatorio_ia_cards;
begin
  if v_uid is null or not public.has_papel('coordenacao') then
    raise exception 'relatorio_ia_card_registrar: permissão negada';
  end if;
  if nullif(btrim(p_secao), '') is null
     or nullif(btrim(p_recorte_key), '') is null
     or nullif(btrim(p_contexto_hash), '') is null
     or nullif(btrim(p_pergunta), '') is null
     or nullif(btrim(p_resposta_md), '') is null then
    raise exception 'relatorio_ia_card_registrar: argumento obrigatório vazio';
  end if;

  -- serializa por par (secao, recorte): dois pedidos no mesmo instante
  -- viram veredictos sequenciais — o segundo enxerga o vigente do primeiro
  perform pg_advisory_xact_lock(hashtext(p_secao || '|' || p_recorte_key));

  select * into v_vigente
    from public.relatorio_ia_cards
   where secao = p_secao
     and recorte_key = p_recorte_key
     and superseded_by is null;

  -- dedup: mesma pergunta sobre o mesmo contexto devolve a vigente —
  -- custo zero e o histórico não ganha gêmea
  if v_vigente.id is not null
     and v_vigente.contexto_hash = p_contexto_hash
     and v_vigente.pergunta = p_pergunta then
    return v_vigente;
  end if;

  insert into public.relatorio_ia_cards (
      secao, recorte, recorte_key, contexto_hash, pergunta, resposta_md,
      modelo, tier, request_id, gerado_por
    )
    values (
      p_secao, coalesce(p_recorte, '{}'::jsonb), p_recorte_key,
      p_contexto_hash, p_pergunta, p_resposta_md,
      p_modelo, p_tier, p_request_id, v_uid
    )
    returning * into v_novo;

  if v_vigente.id is not null then
    update public.relatorio_ia_cards
       set superseded_by = v_novo.id
     where id = v_vigente.id;
  end if;

  return v_novo;
end $$;

revoke all on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  to authenticated;

commit;
