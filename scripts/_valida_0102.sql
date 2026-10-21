-- valida 0102 (encerramento automático no último encontro + reta final)
-- no stack local — roda numa transação e reverte tudo no final.
--
-- personas:
--   Rafaela  (DPP ativa)    dupla de…0305 mentor de…0115 sup de…0103
--   DPP pausada             dupla de…0307 mentor de…0117 sup de…0103
--   Já concluída (manual)   dupla de…0321
--   Esp sem cronograma      dupla e2e…0150
--   Coordenadores           de…0100, de…0101, e2e…0040
-- cronograma demo de…04f0: 16 encontros; as duplas abertas têm 6 feitos.

\set ON_ERROR_STOP off
begin;

-- helper de cenário: marca numeros realizados numa dupla (insert se a row
-- não existe, update se está agendada) — cruza os dois triggers do par
create or replace function pg_temp.marca_realizados(p_dupla uuid, p_ate int)
returns void language plpgsql as $$
begin
  for i in 1..p_ate loop
    insert into public.encontros (dupla_id, numero, status, data_hora, realizado_em)
    values (p_dupla, i, 'realizado', now() - (i || ' days')::interval, now() - (i || ' days')::interval)
    on conflict (dupla_id, numero) do update
      set status = 'realizado'
      where encontros.status is distinct from 'realizado';
  end loop;
end $$;

-- ─── 1) reta final: faltam 2 → aviso pra coords + supervisor ─────────
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000305';
  n int;
begin
  perform pg_temp.marca_realizados(v_dupla, 14);   -- 14/16 → restam 2

  select count(*) into n from public.notificacoes
   where tipo = 'dupla_reta_final' and href = '/duplas/' || v_dupla;
  -- 3 coords ativos + supervisor de…0103; o mentor NÃO é destinatário
  if n <> 4 then
    raise exception 'FALHA 1a: reta final notificou % destinatários (esperava 4)', n;
  end if;
  if exists (select 1 from public.notificacoes
              where tipo = 'dupla_reta_final' and href = '/duplas/' || v_dupla
                and profile_id = 'de000000-0000-4000-8000-000000000115') then
    raise exception 'FALHA 1b: mentor recebeu aviso de reta final';
  end if;
  -- ainda viva: resta 1 e resta 0 não disparam o aviso de novo
  perform pg_temp.marca_realizados(v_dupla, 15);
  select count(*) into n from public.notificacoes
   where tipo = 'dupla_reta_final' and href = '/duplas/' || v_dupla;
  if n <> 4 then
    raise exception 'FALHA 1c: reta final re-disparou (% rows)', n;
  end if;
  raise notice 'OK 1: faltam 2 → 4 avisos (coord×3 + supervisor), fire-once';
end $$;

-- ─── 2) último encontro → conclui + rito pendente + avisa todos ──────
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000305';
  t record; n int;
begin
  -- ainda ativa antes do 16º (o 15º acabou de cair no caso 1)
  select status into t from public.duplas where id = v_dupla;
  if t.status <> 'ativa' then
    raise exception 'FALHA 2a: dupla fechou antes do último encontro: %', t.status;
  end if;

  perform pg_temp.marca_realizados(v_dupla, 16);

  select d.status, e.tipo as enc_tipo, e.decidido_por
    into t
    from public.duplas d left join public.encerramentos e on e.dupla_id = d.id
   where d.id = v_dupla;
  if t.status <> 'concluida' then
    raise exception 'FALHA 2b: último encontro não concluiu a dupla: %', t.status;
  end if;
  if t.enc_tipo is not null or t.decidido_por is not null then
    raise exception 'FALHA 2c: automático decidiu o rito (tipo=%): %', t.enc_tipo, t;
  end if;

  select count(*) into n from public.notificacoes
   where tipo = 'dupla_formada' and href = '/duplas/' || v_dupla;
  -- coords×3 + supervisor + mentor
  if n <> 5 then
    raise exception 'FALHA 2d: fechamento avisou % destinatários (esperava 5)', n;
  end if;
  raise notice 'OK 2: 16º → concluida, encerramentos pendente, 5 avisos';
end $$;

-- ─── 3) re-save do registro não re-dispara (WHEN old<>realizado) ─────
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000305';
  n int;
begin
  -- salvarRegistro regrava status='realizado' a cada edição do registro
  update public.encontros set status = 'realizado', realizado_em = now()
   where dupla_id = v_dupla and numero = 16;
  select count(*) into n from public.notificacoes
   where href = '/duplas/' || v_dupla
     and tipo in ('dupla_reta_final', 'dupla_formada');
  if n <> 9 then   -- 4 reta_final + 5 dupla_formada
    raise exception 'FALHA 3: edição do registro re-disparou o fechamento (% avisos)', n;
  end if;
  raise notice 'OK 3: re-save do 16º não re-dispara (9 avisos estáveis)';
end $$;

-- ─── 4) autoavaliação do mentor continua aberta pós-conclusão ────────
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';   -- Ana/Otávio
begin
  perform pg_temp.marca_realizados(v_dupla, 16);
  -- claims JWT simulados do mentor de…0110 (auth.uid() lê request.jwt.claims)
  perform set_config('request.jwt.claims',
    (select json_build_object('sub', p.user_id, 'role', 'authenticated')::text
       from public.profiles p where p.id = 'de000000-0000-4000-8000-000000000110'), true);

  perform public.salvar_autoavaliacao(
    v_dupla,
    'Ciclo intenso — a mentorada cresceu demais no período.',
    true);

  if not exists (select 1 from public.encerramentos
                  where dupla_id = v_dupla and autoavaliacao_mentor is not null
                    and tipo is null) then
    raise exception 'FALHA 4: autoavaliação não gravou na row pendente';
  end if;
  raise notice 'OK 4: autoavaliação do mentor grava em dupla concluida+pendente';
end $$;

-- ─── 5) pausada também conclui (retroativo/import podem pousar o 16º) ─
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000307';
  v_status text;
begin
  perform pg_temp.marca_realizados(v_dupla, 16);
  select status into v_status from public.duplas where id = v_dupla;
  if v_status <> 'concluida' then
    raise exception 'FALHA 5: dupla pausada não concluiu no 16º: %', v_status;
  end if;
  raise notice 'OK 5: pausada conclui no último encontro efetivo';
end $$;

-- ─── 6) dupla já concluída não re-dispara nada ────────────────────────
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000308';   -- DPP concluida
  n int;
begin
  perform pg_temp.marca_realizados(v_dupla, 16);
  select count(*) into n from public.notificacoes
   where href = '/duplas/' || v_dupla
     and tipo in ('dupla_reta_final', 'dupla_formada');
  if n <> 0 then
    raise exception 'FALHA 6: dupla já concluída gerou avisos novos: %', n;
  end if;
  raise notice 'OK 6: concluída anterior não re-dispara (guard de status)';
end $$;

-- ─── 6b) último caindo com buracos: restante=2 e ultimo juntos ───────
-- a ordem dos ramos importa: 16º realizado com 14º/15º furados ainda é o
-- fim da jornada — o aviso de reta final não pode engolir o fechamento.
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000302';   -- Maria Fernanda
  v_status text;
  n int;
begin
  perform pg_temp.marca_realizados(v_dupla, 13);           -- 13 feitos
  insert into public.encontros (dupla_id, numero, status, data_hora, realizado_em)
  values (v_dupla, 16, 'realizado', now(), now())
  on conflict (dupla_id, numero) do update set status = 'realizado';
  -- agora: feitos 14, faltam 14º e 15º → restante=2 — e ainda assim fecha
  select status into v_status from public.duplas where id = v_dupla;
  if v_status <> 'concluida' then
    raise exception 'FALHA 6b: último com restante=2 não concluiu: %', v_status;
  end if;
  select count(*) into n from public.notificacoes
   where tipo = 'dupla_reta_final' and href = '/duplas/' || v_dupla;
  if n <> 0 then
    raise exception 'FALHA 6c: reta final disparou com a jornada fechada';
  end if;
  raise notice 'OK 6b: último encontro com buracos ainda conclui (sem ping de reta final)';
end $$;

-- ─── 7) trilha especialista é ignorada ────────────────────────────────
do $$
declare
  v_dupla uuid := 'e2e00000-0000-4000-8000-000000000150';
  v_status text;
begin
  -- trilha esp não tem cronograma — encontro realizado não pode fechar
  insert into public.encontros (dupla_id, numero, status, data_hora, realizado_em)
  values (v_dupla, 5, 'realizado', now(), now());
  select status into v_status from public.duplas where id = v_dupla;
  if v_status <> 'ativa' then
    raise exception 'FALHA 7: trilha especialista foi tocada: %', v_status;
  end if;
  raise notice 'OK 7: especialista ignorada pelo gatilho';
end $$;

do $$ begin raise notice '── 0102 validada: 8/8 ──'; end $$;
rollback;
