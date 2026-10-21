-- valida 0101 (especialistas globais) no stack local — roda numa transação
-- e reverte tudo no final. Cada caso usa claims JWT simulados via
-- request.jwt.claims (auth.uid() lê de lá).
--
-- personas:
--   Ana (jovem T1, DPP ativa)  profile de000000-…-0140 user 7458c337-…
--   Esp E2E   (esp Turma E2E)  e2e00000-…-0060 user 1e497708-… grade ter 19-21
--   Esp Dois  (esp Turma E2E)  e2e00000-…-00c0 user 4ecef02c-… grade qui 19-21
--   Sem DPP   (jovem, DPP paus.) e2e00000-…-00f0/…-00d0 user 296b76c7-…
--   Coord E2E                  e2e00000-…-0040 user 5f89a66f-…

\set ON_ERROR_STOP off
set timezone = 'UTC';
begin;

-- ─── 1) catálogo cross-turma (view jovem_especialistas) ───────────────
set local "request.jwt.claims" to
  '{"sub":"7458c337-949e-4738-9350-417b60ce20ef","role":"authenticated"}';

do $$
declare t record;
begin
  select
    bool_or(nome = 'Esp E2E')       as esp1,
    bool_or(nome = 'Esp Dois E2E')  as esp2,
    bool_or(nome = 'Otávio Martins') as dpp
  into t from public.jovem_especialistas;
  if not (t.esp1 and t.esp2) then
    raise exception 'FALHA 1a: esp de outra turma sumiu do catálogo: %', t;
  end if;
  if t.dpp then
    raise exception 'FALHA 1b: mentor DPP vazou pro catálogo';
  end if;
  raise notice 'OK 1: catálogo lista esp de outra turma e exclui o próprio DPP';
end $$;

-- ─── 2) aceite cross-turma (dirigida jovem → esp de outra turma) ──────
do $$
declare
  s uuid;
  slot timestamptz := ((current_date + ((4 - extract(dow from current_date)::int + 6) % 7 + 1))::text || ' 19:00')::timestamp at time zone 'America/Sao_Paulo';
  d uuid;
  t record;
begin
  -- Ana pede dirigida ao Esp Dois (papel escopado "Turma E2E", jovem T1)
  set local "request.jwt.claims" to
    '{"sub":"7458c337-949e-4738-9350-417b60ce20ef","role":"authenticated"}';
  s := public.pedir_especialista_jovem(
    'e2e00000-0000-4000-8000-0000000000c0', 'validação 0101', null);

  -- Esp Dois aceita com slot dentro da grade dele (quinta 19–21 SP)
  set local "request.jwt.claims" to
    '{"sub":"4ecef02c-26f5-4b43-9471-23a18ef315d0","role":"authenticated"}';
  d := public.aceitar_solicitacao(s, slot);

  select du.turma, du.trilha, du.status,
         (select count(*) from public.encontros e where e.dupla_id = du.id) as encs
    into t from public.duplas du where du.id = d;
  if t.trilha <> 'especialista' or t.encs <> 1 then
    raise exception 'FALHA 2: aceite cross-turma não formou dupla+sessão: %', t;
  end if;
  raise notice 'OK 2: Esp Dois (Turma E2E) aceitou pedido da Ana (T1) — dupla % turma=%', d, t.turma;
end $$;

-- ─── 3) budget por par: 5 sessões contam através das turmas ───────────
do $$
declare
  d uuid := (select dupla_id from public.solicitacoes_especialista
              where demanda = 'validação 0101' order by created_at desc limit 1);
  s2 uuid;
  slot2 timestamptz := ((current_date + ((4 - extract(dow from current_date)::int + 6) % 7 + 8))::text || ' 19:00')::timestamp at time zone 'America/Sao_Paulo';
begin
  -- simula o par que já viveu em outra turma: a dupla passa a ser "T2"
  -- e recebe 4 sessões realizadas + a aceita = 5 no total
  update public.duplas set turma = 'T2 · 2026/2027' where id = d;
  insert into public.encontros (dupla_id, numero, data_hora, duracao_min, status)
  select d, g.n, now() - (g.n || ' days')::interval, 60, 'realizado'
    from generate_series(2, 5) g(n);

  -- pedido de follow-up (par já existe → slot-only), aceite pelo esp
  set local "request.jwt.claims" to
    '{"sub":"7458c337-949e-4738-9350-417b60ce20ef","role":"authenticated"}';
  s2 := public.pedir_especialista_jovem(
    'e2e00000-0000-4000-8000-0000000000c0', null, null);

  set local "request.jwt.claims" to
    '{"sub":"4ecef02c-26f5-4b43-9471-23a18ef315d0","role":"authenticated"}';
  begin
    perform public.aceitar_solicitacao(s2, slot2);
    raise exception 'FALHA 3: budget cross-turma não segurou a 6ª sessão';
  exception when others then
    if sqlerrm not like '%5 sessões%' then raise; end if;
    raise notice 'OK 3: 6ª sessão barrada mesmo com a trilha em outra turma (%)', sqlerrm;
  end;
end $$;

-- ─── 4) triagem: liberar sem turma + com turma explícita ──────────────
do $$
declare
  sA uuid; sB uuid;
  tA record; tB record;
begin
  -- jovem sem DPP ativa pede broadcast → aguardando_coord
  set local "request.jwt.claims" to
    '{"sub":"296b76c7-f4e4-4a4f-8c59-ff0adcff9901","role":"authenticated"}';
  sA := public.pedir_especialista_jovem(null, 'ajuda matemática 0101', null);
  sB := public.pedir_especialista_jovem(null, 'ajuda redação 0101', null);

  set local "request.jwt.claims" to
    '{"sub":"5f89a66f-d1d6-479b-ae27-0ac533389b1f","role":"authenticated"}';

  perform public.reconhecer_solicitacao(sA);                       -- sem turma
  perform public.reconhecer_solicitacao(sB, 'T2 · 2026/2027');     -- com turma

  select status, turma into tA from public.solicitacoes_especialista where id = sA;
  select status, turma into tB from public.solicitacoes_especialista where id = sB;
  if tA.status <> 'aberta' then
    raise exception 'FALHA 4a: liberar sem turma não abriu: %', tA;
  end if;
  if tB.status <> 'aberta' or tB.turma <> 'T2 · 2026/2027' then
    raise exception 'FALHA 4b: liberar com turma não gravou: %', tB;
  end if;
  raise notice 'OK 4: triagem libera sem turma (turma=%) e honra turma explícita (%)',
    tA.turma, tB.turma;
end $$;

-- ─── 5) rematch: esp cross-turma passa, DPP escopado continua barrando ─
do $$
declare
  d1 uuid := (select dupla_id from public.solicitacoes_especialista
               where demanda = 'validação 0101' order by created_at desc limit 1);
  d_dpp uuid := (select d.id from public.duplas d
                  join public.mentorados m on m.id = d.mentorado_id
                  join public.profiles q on q.id = m.profile_id
                  where q.nome = 'Ana Beatriz Souza'
                    and coalesce(d.trilha,'dpp') = 'dpp' and d.status = 'ativa');
  nova uuid;
begin
  set local "request.jwt.claims" to
    '{"sub":"5f89a66f-d1d6-479b-ae27-0ac533389b1f","role":"authenticated"}';

  -- a dupla esp está "T2 · 2026/2027" (teste 3) e o Esp E2E tem papel só
  -- em "Turma E2E" — antes da 0101 o rematch falhava aqui
  nova := public.rematch_dupla(d1, 'mentor',
    'e2e00000-0000-4000-8000-000000000060');
  raise notice 'OK 5a: rematch esp cross-turma criou dupla %', nova;

  -- controle: papel mentor_dpp escopado em OUTRA turma segue insuficiente
  insert into public.profile_papeis (profile_id, papel, escopo_turma, primario)
  values ('e2e00000-0000-4000-8000-0000000000c0', 'mentor_dpp',
          'T2 · 2026/2027', false);
  begin
    perform public.rematch_dupla(d_dpp, 'mentor',
      'e2e00000-0000-4000-8000-0000000000c0');
    raise exception 'FALHA 5b: mentor_dpp de outra turma remanejou DPP';
  exception when others then
    if sqlerrm not like '%papel compatível%' then raise; end if;
    raise notice 'OK 5b: mentor_dpp continua restrito à turma da dupla';
  end;

  -- guard de autoatribuição no rematch (0101): Otávio é o DPP da Ana —
  -- mesmo habilitado como especialista não pode assumir a trilha esp dela
  insert into public.profile_papeis (profile_id, papel, escopo_turma, primario)
  values ('de000000-0000-4000-8000-000000000110', 'mentor_especialista', null, false)
  on conflict do nothing;
  declare
    d_esp_ana uuid := (select d.id from public.duplas d
                        join public.mentorados m on m.id = d.mentorado_id
                        join public.profiles q on q.id = m.profile_id
                        where q.nome = 'Ana Beatriz Souza'
                          and d.trilha = 'especialista'
                          and d.status in ('ativa','pausada')
                        order by d.created_at desc limit 1);
  begin
    if d_esp_ana is not null then
      perform public.rematch_dupla(d_esp_ana, 'mentor',
        'de000000-0000-4000-8000-000000000110');
      raise exception 'FALHA 5c: DPP da jovem remanejou pra trilha esp dela';
    end if;
  exception when others then
    if sqlerrm not like '%DPP%' then raise; end if;
    raise notice 'OK 5c: rematch bloqueia o próprio DPP da jovem';
  end;
end $$;

rollback;
-- saída esperada: 5 blocos "OK …" e nenhum ERROR/FALHA
