-- 0156 — encerramentos.tipo vira NOT NULL com 'pendente' explícito.
-- Antes: tipo NULL = "aguardando decisão" (sentinela implícita acoplada a
-- decidido_por NULL pelo check encerramentos_check). Agora: 'pendente' é
-- valor de primeira classe; a coluna não aceita mais NULL.
--
-- Ordem importa dentro da transação:
--   1. abre o check de tipo pra aceitar 'pendente' (senão o backfill falha)
--   2. backfill NULL → 'pendente'
--   3. check de acoplamento na forma final — pendente ⟺ decidido_por null
--   4. NOT NULL
--   5. stamp_encerramento_decisor: pendente NÃO carimba decisor (antes o
--      gatilho era `tipo is not null` — com 'pendente' não-nulo ele
--      carimbaria a coordenação no insert automático e violaria o check)
--   6. dupla_encerramento_auto: a row do rito nasce 'pendente' explícita
begin;

-- 1. check de vocabulario
alter table public.encerramentos drop constraint encerramentos_tipo_check;
alter table public.encerramentos add constraint encerramentos_tipo_check
  check (tipo in ('concluida', 'encerrada', 'pendente'));

-- 2. backfill
update public.encerramentos set tipo = 'pendente' where tipo is null;

-- 3. acoplamento na forma final
alter table public.encerramentos drop constraint encerramentos_check;
alter table public.encerramentos add constraint encerramentos_check
  check ((tipo = 'pendente') = (decidido_por is null));

-- 4. coluna tranca
alter table public.encerramentos alter column tipo set not null;

-- 5. stamp do decisor: 'pendente' não é decisão
create or replace function public.stamp_encerramento_decisor()
 returns trigger
 language plpgsql
 security definer
 set search_path = ''
as $function$
begin
  if new.tipo is not null and new.tipo <> 'pendente'
     and new.decidido_por is null then
    new.decidido_por := public.my_profile_id();
  elsif new.decidido_por is not null
        and auth.uid() is not null
        and public.my_role() is distinct from 'coordenacao'
        and new.decidido_por is distinct from public.my_profile_id() then
    raise exception 'decidido_por não pode ser forjado';
  end if;
  return new;
end $function$;

-- 6. trigger que cria a row pendente (corpo verbatim da versão em banco,
--    só o insert ganha a coluna tipo)
create or replace function public.dupla_encerramento_auto()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d record;
  v_janela int[];   -- números dos encontros efetivos (pós-início da dupla)
  v_ultimo int;
  v_feitos int;
  v_href text;
  v_mentorado text;
begin
  if new.numero is null then
    return new;
  end if;

  select id, trilha, status, cronograma_id, iniciada_em, mentor_id,
         supervisor_id, mentorado_id
    into d
    from public.duplas
   where id = new.dupla_id;

  if d.id is null
     or d.trilha is distinct from 'dpp'
     or d.status not in ('ativa', 'pausada')
     or d.cronograma_id is null then
    return new;
  end if;

  -- janela efetiva = passos 'encontro' do cronograma a partir do início da
  -- dupla (mesma poda de jornadaDaDupla em ciclo.ts: o que veio antes dela
  -- entrar não conta). Dupla que começa no enc. 7 tem ~10 passos, não 16.
  select array_agg(e.numero order by e.numero)
    into v_janela
    from public.ciclo_eventos e
   where e.cronograma_id = d.cronograma_id
     and e.tipo = 'encontro'
     and e.numero is not null
     and (d.iniciada_em is null or e.data is null or e.data >= d.iniciada_em);

  if v_janela is null then
    return new;
  end if;
  v_ultimo := v_janela[array_length(v_janela, 1)];

  select count(distinct en.numero) into v_feitos
    from public.encontros en
   where en.dupla_id = d.id
     and en.status = 'realizado'
     and en.numero = any (v_janela);

  v_href := '/duplas/' || d.id;
  select nome into v_mentorado from public.mentorados where id = d.mentorado_id;

  -- último encontro do cronograma → a jornada terminou de fato. Avaliado
  -- ANTES do aviso de reta final: o último caindo com 2 buracos no meio
  -- tem restante=2 e é o último ao mesmo tempo — fechar é o que importa
  -- (avisar "faltam 2" ali seria mentira: os 2 que faltam já passaram).
  if new.numero = v_ultimo then
    update public.duplas set status = 'concluida'
     where id = d.id and status in ('ativa', 'pausada');

    -- a row do rito nasce 'pendente' (ou preserva a que já existia):
    -- decidido_por segue sendo a coordenação
    insert into public.encerramentos (dupla_id, tipo) values (d.id, 'pendente')
      on conflict (dupla_id) do nothing;

    -- equipe: o fechamento automático pede o rito — copy carrega a ação
    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_formada',
           'Dupla concluiu a jornada',
           'Último encontro de ' || coalesce(v_mentorado, 'a dupla')
             || ' registrado — falta o checklist de encerramento na ficha.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null;

    -- mentor: paridade com o fluxo manual — sem filtro de ator, a conclusão
    -- é efeito do registro dele e ele precisa saber
    if d.mentor_id is not null then
      insert into public.notificacoes
        (profile_id, tipo, titulo, corpo, href, created_by)
      values (d.mentor_id, 'dupla_formada',
        'Sua dupla concluiu a jornada',
        'O último encontro com ' || coalesce(v_mentorado, 'seu mentorado')
          || ' foi registrado. O resumo segue na ficha da dupla.',
        v_href, public.my_profile_id());
    end if;

    return new;
  end if;

  -- faltam 2 → um aviso por destinatário, uma vez por dupla. O advisory
  -- lock por dupla serializa transições concorrentes (import + registro do
  -- mentor na mesma janela) — convenção da 0099/0094 — e o dedup no
  -- tipo+href torna o aviso fire-once (o restante só desce: realizado é
  -- imutável e o número identifica o passo).
  if array_length(v_janela, 1) - v_feitos = 2 then
    perform pg_advisory_xact_lock(hashtext('reta_final:' || d.id::text));

    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_reta_final',
           'Dupla na reta final',
           coalesce(v_mentorado, 'A dupla')
             || ' e o mentor têm 2 encontros pela frente — dá pra adiantar o encerramento.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null
       and not exists (
         select 1 from public.notificacoes n
          where n.profile_id = p.id
            and n.tipo = 'dupla_reta_final'
            and n.href = v_href
       );
  end if;

  return new;
end $function$;

commit;
