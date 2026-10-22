-- valida 0103 (avaliação por terceiros) no stack local — transação + rollback.
-- RLS só vale de verdade sob `set role authenticated/anon` (postgres bypassa);
-- `pg_temp.sou(uid)` troca as claims JWT que my_role()/auth.uid() leem.
--
-- personas:
--   Otávio/Ana (DPP ativa)  dupla de…0300  mentor de…0110 (uid ff537803)
--                            jovem profile de…0140 (uid 7458c337)
--   outro mentor c/ conta   e2e…0110 (uid 5c7fb958)
--   trilha especialista     dupla e2e…0150
--   coords ativos           de…0100, de…0101, e2e…0040

\set ON_ERROR_STOP off
begin;

create or replace function pg_temp.sou(p_uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- tokens/ids que os blocos autenticados não enxergam ficam aqui
create temp table fx (k text primary key, v text);

-- ─── 1) convite: mentor da dupla cria; cap e gates ───────────────────
set role authenticated;
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_esp uuid := 'e2e00000-0000-4000-8000-000000000150';
  v_n int; v_token text;
begin
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');  -- mentor de…0110

  insert into public.terceiros_contatos (dupla_id, nome, vinculo, whatsapp)
  values (v_dupla, 'Fulano Amigo', 'amigo', '11999990000')
  returning token into v_token;
  if v_token is null or char_length(v_token) < 20 then
    raise exception 'FALHA 1a: token não foi mintado no insert';
  end if;

  -- cap 9: já há 1; +8 chegam a 9; o 10º dispara o trigger
  for i in 1..8 loop
    insert into public.terceiros_contatos (dupla_id, nome, vinculo)
    values (v_dupla, 'Contato ' || i, 'familiar');
  end loop;
  begin
    insert into public.terceiros_contatos (dupla_id, nome, vinculo)
    values (v_dupla, 'Décimo', 'colega');
    raise exception 'FALHA 1b: cap de 9 não disparou';
  exception when others then
    if sqlerrm not like '%9 pessoas%' then raise; end if;
  end;

  -- trilha especialista não recebe convite (RLS nega; se o cap trigger
  -- disparar antes, a row também não entra — o assert é o count)
  select count(*) into v_n from public.terceiros_contatos where dupla_id = v_esp;
  begin
    insert into public.terceiros_contatos (dupla_id, nome, vinculo)
    values (v_esp, 'Contato Esp', 'amigo');
  exception when others then null;
  end;
  if (select count(*) from public.terceiros_contatos where dupla_id = v_esp) <> v_n then
    raise exception 'FALHA 1c: convite aceito em dupla especialista';
  end if;

  -- outro mentor não cria convite nesta dupla
  perform pg_temp.sou('5c7fb958-4400-4178-b72a-5f229de68248');
  select count(*) into v_n from public.terceiros_contatos where dupla_id = v_dupla;
  begin
    insert into public.terceiros_contatos (dupla_id, nome, vinculo)
    values (v_dupla, 'Intruso', 'amigo');
  exception when others then null;
  end;
  if (select count(*) from public.terceiros_contatos where dupla_id = v_dupla) <> v_n then
    raise exception 'FALHA 1d: mentor de outra dupla inseriu contato';
  end if;

  raise notice 'OK 1: mentor cria convite (token mintado), cap 9, gates de trilha/escopo';
end $$;
reset role;

-- captura tokens como service (anon/authenticated não leem `token`)
insert into fx (k, v)
  select 'tok_amigo', token from public.terceiros_contatos
   where dupla_id = 'de000000-0000-4000-8000-000000000300' and vinculo = 'amigo';
insert into fx (k, v)
  select 'c_familiar', id::text from public.terceiros_contatos
   where dupla_id = 'de000000-0000-4000-8000-000000000300' and vinculo = 'familiar'
   order by nome limit 1;
insert into fx (k, v)
  select 'c_pendente', id::text from public.terceiros_contatos
   where dupla_id = 'de000000-0000-4000-8000-000000000300' and status = 'pendente'
   order by nome limit 1;

-- ─── 2) colunas trancadas: update direto de status/token é recusado ──
set role authenticated;
do $$
declare
  v_c uuid := (select v::uuid from fx where k = 'c_familiar');
begin
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');
  update public.terceiros_contatos set nome = 'Fulano Silva', whatsapp = '11988887777'
   where id = v_c;
  begin
    update public.terceiros_contatos set status = 'expirado' where id = v_c;
    raise exception 'FALHA 2: update direto em status passou';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.terceiros_contatos set token = 'x'.repeat('x',24) where id = v_c;
    raise exception 'FALHA 2b: update direto em token passou';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 2: mentor edita cadastro; status/token só via RPC';
end $$;
reset role;

-- ─── 3) fluxo público (role anon): por_token → submeter → anti-replay ─
set role anon;
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_token text := (select v from fx where k = 'tok_amigo');
  v_j jsonb; v_n int;
begin
  -- sem claims: público resolve o convite
  perform set_config('request.jwt.claims', '{}', true);
  v_j := public.terceiro_por_token(v_token);
  if v_j is null or v_j->>'status' <> 'pendente'
     or v_j->'alvo'->>'jovem_nome' is null then
    raise exception 'FALHA 3a: por_token devolveu %', v_j;
  end if;

  perform public.submeter_resposta_terceiro(v_token,
    'Ele é muito dedicado e persistente.', 'Poderia arriscar mais.');
  v_j := public.terceiro_por_token(v_token);
  if v_j->>'status' <> 'respondido' then
    raise exception 'FALHA 3b: status pós-submit = %', v_j->>'status';
  end if;

  -- segundo submit no mesmo token é recusado
  begin
    perform public.submeter_resposta_terceiro(v_token, 'x', 'y');
    raise exception 'FALHA 3d: re-submit passou';
  exception when others then
    if sqlerrm not like '%usado ou expirou%' then raise; end if;
  end;
  raise notice 'OK 3a: convite anônimo resolve, responde uma vez, rejeita replay';
end $$;
reset role;

-- notificação gravada pelo definer (confiro como service)
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_n int;
begin
  select count(*) into v_n from public.notificacoes
   where tipo = 'terceiro_respondeu' and href = '/duplas/' || v_dupla;
  if v_n < 2 then
    raise exception 'FALHA 3e: só % notificações de terceiro_respondeu', v_n;
  end if;
  if not exists (select 1 from public.notificacoes
     where tipo = 'terceiro_respondeu'
       and profile_id = 'de000000-0000-4000-8000-000000000110') then
    raise exception 'FALHA 3f: mentor não foi notificado';
  end if;
  raise notice 'OK 3b: % notificações para mentor+coords', v_n;
end $$;

-- ─── 4) visibilidade: mentor lê identificado; jovem NUNCA lê ─────────
set role authenticated;
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_n int;
begin
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');  -- mentor
  select count(*) into v_n from public.terceiros_respostas r
    join public.terceiros_contatos c on c.id = r.contato_id
   where c.dupla_id = v_dupla and c.nome = 'Fulano Amigo';
  if v_n <> 1 then
    raise exception 'FALHA 4a: mentor não leu a resposta identificada (%)', v_n;
  end if;

  perform pg_temp.sou('5c7fb958-4400-4178-b72a-5f229de68248');  -- outro mentor
  select count(*) into v_n from public.terceiros_respostas r
    join public.terceiros_contatos c on c.id = r.contato_id
   where c.dupla_id = v_dupla;
  if v_n <> 0 then
    raise exception 'FALHA 4b: mentor de outra dupla leu respostas';
  end if;

  perform pg_temp.sou('7458c337-949e-4738-9350-417b60ce20ef');  -- jovem da dupla
  select count(*) into v_n from public.terceiros_contatos where dupla_id = v_dupla;
  if v_n <> 0 then
    raise exception 'FALHA 4c: jovem leu contatos (%)', v_n;
  end if;
  select count(*) into v_n from public.terceiros_respostas r
    join public.terceiros_contatos c on c.id = r.contato_id
   where c.dupla_id = v_dupla;
  if v_n <> 0 then
    raise exception 'FALHA 4d: jovem leu respostas';
  end if;
  raise notice 'OK 4: mentor identificado, outro mentor 0, jovem 0 em ambas';
end $$;
reset role;

-- ─── 5) consolidado: jovem só vê publicado ───────────────────────────
set role authenticated;
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_n int; v_txt text;
begin
  -- escrito mas não publicado → invisível pro jovem
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');
  perform public.salvar_consolidado_terceiros(v_dupla,
    'Apareceu muito: dedicação, escuta, foco. A trabalhar: pedir ajuda.', false);
  perform pg_temp.sou('7458c337-949e-4738-9350-417b60ce20ef');
  select count(*) into v_n from public.terceiros_consolidacao
   where dupla_id = v_dupla;
  if v_n <> 0 then
    raise exception 'FALHA 5a: jovem viu consolidado não-publicado';
  end if;

  -- publicar → jovem lê o texto
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');
  perform public.salvar_consolidado_terceiros(v_dupla,
    'Apareceu muito: dedicação, escuta, foco. A trabalhar: pedir ajuda.', true);
  perform pg_temp.sou('7458c337-949e-4738-9350-417b60ce20ef');
  select consolidado into v_txt from public.terceiros_consolidacao
   where dupla_id = v_dupla;
  if v_txt is null then
    raise exception 'FALHA 5b: jovem não viu consolidado publicado';
  end if;

  -- publicar vazio é recusado; escrita de fora da dupla também
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');
  begin
    perform public.salvar_consolidado_terceiros(v_dupla, '   ', true);
    raise exception 'FALHA 5c: publicou consolidado vazio';
  exception when others then
    if sqlerrm not like '%antes de publicar%' then raise; end if;
  end;
  perform pg_temp.sou('5c7fb958-4400-4178-b72a-5f229de68248');
  begin
    perform public.salvar_consolidado_terceiros(v_dupla, 'intruso', true);
    raise exception 'FALHA 5d: mentor de outra dupla escreveu consolidado';
  exception when others then
    if sqlerrm not like '%não encontrada%' then raise; end if;
  end;
  raise notice 'OK 5: consolidado invisível → publicado → visível; gates ok';
end $$;
reset role;

-- ─── 6) cancelamento e reemissão ──────────────────────────────────────
set role authenticated;
do $$
declare
  v_dupla uuid := 'de000000-0000-4000-8000-000000000300';
  v_c uuid; v_token text; v_j jsonb;
begin
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');

  -- mentor cancela convite pendente (delete)
  v_c := (select v::uuid from fx where k = 'c_pendente');
  delete from public.terceiros_contatos where id = v_c;
  if exists (select 1 from public.terceiros_contatos where id = v_c) then
    raise exception 'FALHA 6a: delete de pendente não funcionou';
  end if;

  -- mentor NÃO apaga convite respondido
  select id into v_c from public.terceiros_contatos
   where dupla_id = v_dupla and status = 'respondido' limit 1;
  delete from public.terceiros_contatos where id = v_c;
  if not exists (select 1 from public.terceiros_contatos where id = v_c) then
    raise exception 'FALHA 6b: mentor apagou convite respondido';
  end if;

  -- reemissão de convite pendente devolve o mesmo token
  select id, token into v_c, v_token from public.terceiros_contatos
   where dupla_id = v_dupla and status = 'pendente' order by nome limit 1;
  insert into fx (k, v) values ('c_reemitir', v_c::text), ('tok_reemitir', v_token)
    on conflict (k) do update set v = excluded.v;
  v_j := public.reemitir_convite_terceiro(v_c);
  if v_j->>'token' <> v_token or (v_j->>'reutilizado')::boolean is not true then
    raise exception 'FALHA 6c: reemissão de pendente mudou token';
  end if;
  raise notice 'OK 6a: cancela pendente, protege respondido, reutiliza pendente';
end $$;
reset role;

-- expirar de fábrica roda como service (mentor não alcança 'status' por grant)
update public.terceiros_contatos set status = 'expirado'
 where id = (select v::uuid from fx where k = 'c_reemitir');

set role authenticated;
do $$
declare
  v_c uuid := (select v::uuid from fx where k = 'c_reemitir');
  v_token text := (select v from fx where k = 'tok_reemitir');
  v_j jsonb;
begin
  perform pg_temp.sou('ff537803-1b78-4b8f-89f3-5162d2eed7aa');
  v_j := public.reemitir_convite_terceiro(v_c);
  if v_j->>'token' = v_token or (v_j->>'reutilizado')::boolean then
    raise exception 'FALHA 6d: expirado não ganhou token novo';
  end if;
  insert into fx (k, v) values ('tok_novo', v_j->>'token')
    on conflict (k) do update set v = excluded.v;
  raise notice 'OK 6b: expirado ganhou token novo';
end $$;
reset role;

-- o token novo abre como convite válido (checagem como anon)
set role anon;
do $$
declare
  v_j jsonb;
begin
  perform set_config('request.jwt.claims', '{}', true);
  v_j := public.terceiro_por_token((select v from fx where k = 'tok_novo'));
  if v_j->>'status' <> 'pendente' then
    raise exception 'FALHA 6e: token reemitido não abre (status=%)', v_j->>'status';
  end if;
  raise notice 'OK 6c: token reemitido abre como pendente';
end $$;
reset role;

do $$ begin raise notice '── 0103 validada: 6/6 ──'; end $$;
rollback;
