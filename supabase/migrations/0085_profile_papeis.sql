-- 0085: papéis por programa — `profile_papeis` + sync com `profiles.role`
-- (WP0b fase 1 do plano de telas finais — REALIZA-105. FASE ADITIVA:
-- nenhum consumidor migra aqui; o inventário pra fase 2 mora em
-- docs/planos/wp0b-inventario.md).
--
-- CONTEXTO
-- `profiles.role` é único, mas o domínio exige a mesma pessoa ser mentor DPP
-- e mentor especialista ao mesmo tempo (guia DPP §5: o pool de especialistas
-- inclui "mentores voluntários capacitados"; "perfil por programa, não fixo",
-- doc Novos Sistemas). A tabela nova guarda o CONJUNTO de papéis da pessoa,
-- com escopo opcional de turma: escopo preenchido só vale naquela turma,
-- escopo nulo = papel global (vale em qualquer turma).
--
-- AUTORIDADE — uma direção só:
--   · `profile_papeis` é a fonte de verdade;
--   · `profiles.role` é a PROJEÇÃO do papel primário — continua existindo,
--     preenchido e sendo o que `my_role()` lê. É o kill switch da migração:
--     rollback de um fluxo = voltar o consumidor pra `my_role()`, sem
--     migration reversa.
--   · Um write DIRETO em `profiles.role` (caminho legado: setPessoaRole,
--     cadastro em /pessoas, seeds, scripts) não é bloqueado nem ignorado —
--     é reinterpretado como "este papel global passa a ser o primário".
--     Isso preserva a semântica de papel-único enquanto a fase 2 não chega:
--     os papéis escopados/secundários continuam na tabela (PATCH comum em
--     /pessoas não apaga o segundo papel do híbrido). A exceção é
--     `role := null` — "sem papel = sem acesso" — que remove todos os papéis.
--   · Os dois triggers se guardam por `pg_trigger_depth()`: a escrita feita
--     POR trigger (depth > 1) não reprocessa — profile→papeis→profile fecha
--     numa passada, sem recursão nem ping-pong.
--
-- PRIMÁRIO — determinístico, nunca ao sabor da ordem de escrita:
--   · no máximo UM primário por profile (unique parcial `where primario`);
--   · write explícito com `primario = true` rebaixa os demais do profile;
--   · profile com papéis nunca fica sem primário: se o primário some
--     (delete, ou "desmarcar" o único primário sem escolher sucessor),
--     promove-se o papel mais antigo pela precedência fixa
--     coordenacao > supervisor > mentor_dpp > mentor_especialista > mentorado,
--     desempate por created_at, id. Pra trocar o primário, marque outro —
--     não "desmarque" este.
--
-- ESCOPO × supervisor_id: papel-escopo é um SEGUNDO eixo de restrição que só
-- filtra, nunca amplia (supervisor escopo T1 vê das supervisionadas só T1) —
-- regra de uso pra fase 2, registrada aqui porque nasce com a coluna.
--
-- Banco alvo é PG15+ (Supabase): `unique nulls not distinct` existe. Sem ele,
-- NULLs são distintos em unique comum e o papel global (escopo null)
-- duplicaria.

begin;

-- ============ 1) a tabela ============

create table public.profile_papeis (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  papel public.app_role not null,
  -- label TEXT: turma não é entidade com id — duplas.turma e
  -- cronogramas.turma são text. Validada por trigger contra os labels vivos.
  escopo_turma text
    check (escopo_turma is null or char_length(escopo_turma) <= 80),
  primario boolean not null default false,
  created_at timestamptz not null default now(),
  -- sem NULLS NOT DISTINCT o papel global (escopo null) poderia duplicar
  constraint profile_papeis_uniq
    unique nulls not distinct (profile_id, papel, escopo_turma)
);

comment on table public.profile_papeis is
  'Papéis por programa (WP0b): mesma pessoa pode ser DPP numa frente e especialista em outra. Fonte de verdade dos papéis; profiles.role projeta o primário. escopo_turma null = papel global.';
comment on column public.profile_papeis.primario is
  'Papel projetado em profiles.role (o que my_role() devolve). No máx. 1 por profile; promoção por precedência fixa quando some.';

-- um primário por profile — a invariante que o sync mantém
create unique index profile_papeis_primario_key
  on public.profile_papeis (profile_id) where primario;

create index profile_papeis_profile_idx on public.profile_papeis (profile_id);
-- catálogo/filtros por papel×turma (o jovem lista especialistas da turma dele)
create index profile_papeis_papel_idx on public.profile_papeis (papel, escopo_turma);

-- ============ 2) backfill: todo role vira papel global primário ============

insert into public.profile_papeis (profile_id, papel, primario)
select id, role, true
  from public.profiles
 where role is not null
on conflict do nothing;

-- ============ 3) helpers — mesma forma de my_role()/my_mentorado_id() ============
-- sql stable security definer + search_path fixo + grant explícito.
-- anon de fora de propósito: a variante por linha responderia "quem tem qual
-- papel" pra chamada anônima — vazamento de estrutura de equipe.

-- união dos papéis do usuário atual (nav/guards da fase 2 leem isso).
-- Ordenada pela precedência fixa: a primeira linha é o papel "mais alto".
create or replace function public.my_papeis()
returns setof public.app_role
language sql stable security definer set search_path = ''
as $$
  select pp.papel
    from public.profile_papeis pp
    join public.profiles p on p.id = pp.profile_id
   where p.user_id = auth.uid() and p.ativo
   order by case pp.papel
              when 'coordenacao' then 1
              when 'supervisor' then 2
              when 'mentor_dpp' then 3
              when 'mentor_especialista' then 4
              when 'mentorado' then 5
            end,
            pp.created_at, pp.id;
$$;

-- predicado do USUÁRIO ATUAL, espelho de my_role() pra policies/guards.
-- Semântica do escopo (mesma nas duas assinaturas):
--   p_escopo_turma null → o papel em qualquer escopo conta
--                         (nav: "sou especialista em algum lugar?")
--   p_escopo_turma 'T1' → papel GLOBAL ou escopo 'T1'
--                         (catálogo da T1; especialista escopo T2 fica fora)
-- Escopo só filtra, nunca amplia.
create or replace function public.has_papel(
  p_papel public.app_role,
  p_escopo_turma text default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.profile_papeis pp
      join public.profiles p on p.id = pp.profile_id
     where p.user_id = auth.uid() and p.ativo
       and pp.papel = p_papel
       and (p_escopo_turma is null
            or pp.escopo_turma is null
            or pp.escopo_turma = p_escopo_turma)
  );
$$;

-- predicado POR LINHA: filtra a linha do catálogo, não o caller
-- (jovem_especialistas, atribuição em /pessoas). Gate `ativo` incluído pra
-- manter paridade com my_role(): pessoa desativada não "tem" o papel.
-- Sobrecarga proposital has_papel(papel, escopo?) × has_papel(profile, papel,
-- escopo?): em SQL cru, literais de papel pedem cast explícito
-- ('mentor_dpp'::app_role) — literal solto é ambíguo entre as assinaturas.
create or replace function public.has_papel(
  p_profile_id uuid,
  p_papel public.app_role,
  p_escopo_turma text default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.profile_papeis pp
      join public.profiles p on p.id = pp.profile_id
     where pp.profile_id = p_profile_id and p.ativo
       and pp.papel = p_papel
       and (p_escopo_turma is null
            or pp.escopo_turma is null
            or pp.escopo_turma = p_escopo_turma)
  );
$$;

comment on function public.my_papeis() is
  'Papéis do usuário atual (ativo), ordenados por precedência — a união que a nav da fase 2 lê. (WP0b)';
comment on function public.has_papel(public.app_role, text) is
  'Tenho o papel P? escopo null = qualquer; ''T'' = global ou escopo T. Gate ativo. (WP0b)';
comment on function public.has_papel(uuid, public.app_role, text) is
  'A linha profile_id tem o papel P (ativo)? Mesma régua de escopo. Pra catálogo/filtro por linha. (WP0b)';

revoke all on function public.my_papeis() from public, anon;
revoke all on function public.has_papel(public.app_role, text) from public, anon;
revoke all on function public.has_papel(uuid, public.app_role, text) from public, anon;
grant execute on function public.my_papeis() to authenticated, service_role;
grant execute on function public.has_papel(public.app_role, text) to authenticated, service_role;
grant execute on function public.has_papel(uuid, public.app_role, text) to authenticated, service_role;

-- ============ 4) sync bidirecional com tranca de recursão ============

-- 4a) escopo precisa ser um label de turma vivo — typo viraria papel morto
-- (nunca satisfaz has_papel com escopo). Vale label de cronograma OU de
-- dupla (a 0061 admite turma que só exista em duplas).
create or replace function public.profile_papeis_escopo_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- update que não toca o escopo sai cedo: senão apagar a turma depois
  -- (cronograma/dupla removida) travaria até manutenção de primário na linha
  if tg_op = 'UPDATE' and new.escopo_turma is not distinct from old.escopo_turma then
    return new;
  end if;
  if new.escopo_turma is null then
    return new;
  end if;
  if not exists (select 1 from public.cronogramas c where c.turma = new.escopo_turma)
     and not exists (select 1 from public.duplas d where d.turma = new.escopo_turma) then
    raise exception 'escopo_turma ''%'' não corresponde a nenhuma turma (cronogramas/duplas)', new.escopo_turma;
  end if;
  return new;
end $$;

-- 4b) BEFORE: normaliza o primário. Em depth > 1 (write vindo do próprio
-- sync — o rebaixa/promove abaixo, ou o espelho de profiles) o flag já chega
-- certo: sai cedo, senão rebaixar primário reentraria aqui pra sempre.
create or replace function public.profile_papeis_norm_primario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.primario then
    -- marcou primário: os demais do profile descem (cada update reentra aqui
    -- com depth>1 e só confirma o flag — sem reprocessar a regra)
    update public.profile_papeis
       set primario = false
     where profile_id = new.profile_id
       and primario
       and id is distinct from new.id;
  elsif not exists (
    select 1 from public.profile_papeis pp
     where pp.profile_id = new.profile_id and pp.primario
       and pp.id is distinct from new.id
  ) then
    -- ficaria sem primário tendo papéis (única linha, ou "desmarcaram" o
    -- primário direto): este assume. Trocar primário = marcar o sucessor.
    new.primario := true;
  end if;
  return new;
end $$;

-- 4c) AFTER: projeta o primário em profiles.role. Delete do primário promove
-- o próximo pela precedência fixa antes de projetar — role nunca fica ao
-- acaso. O update em profiles dispara os triggers dela com depth 2: o
-- espelho (4d) sai cedo; guard_profiles_self_columns roda normal (self-edit
-- de papel segue bloqueado, igual a hoje).
create or replace function public.profile_papeis_projeta_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_papel public.app_role;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  -- INSERT/DELETE: um lado só; UPDATE que move a linha entre profiles
  -- (policy coord permite) projeta origem E destino
  for v_profile in
    select distinct p
      from (values (new.profile_id), (old.profile_id)) as v(p)
     where p is not null
  loop
    -- sem primário tendo papéis → promove por precedência fixa
    -- (o update reentra nos triggers com depth>1 e não reprocessa)
    update public.profile_papeis
       set primario = true
     where id = (
       select c.id from public.profile_papeis c
        where c.profile_id = v_profile
        order by case c.papel
                   when 'coordenacao' then 1
                   when 'supervisor' then 2
                   when 'mentor_dpp' then 3
                   when 'mentor_especialista' then 4
                   when 'mentorado' then 5
                 end,
                 c.created_at, c.id
        limit 1)
       and not exists (
         select 1 from public.profile_papeis x
          where x.profile_id = v_profile and x.primario);
    select pp.papel into v_papel
      from public.profile_papeis pp
     where pp.profile_id = v_profile and pp.primario;
    update public.profiles set role = v_papel
     where id = v_profile and role is distinct from v_papel;
  end loop;
  return null;
end $$;

-- 4d) AFTER em profiles: o write legado em `role` vira "marca o primário".
-- ADITIVO de propósito — papéis secundários/escopados ficam (a gestão fina
-- é da tabela, na UI da fase 2). `role := null` = sem acesso → zera a tabela.
-- NÃO dá pra inserir primario=true direto: em depth>1 a guarda não roda o
-- rebaixa e a unique parcial explodiria — por isso demote→promove em dois
-- passos, e o insert entra com o default (false).
create or replace function public.profiles_role_para_papeis()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'INSERT' then
    if new.role is not null then
      insert into public.profile_papeis (profile_id, papel, primario)
      values (new.id, new.role, true)
      on conflict do nothing;
    end if;
    return null;
  end if;
  -- UPDATE: `update of role` já filtra coluna no SET; o is distinct filtra o
  -- no-op de cliente que manda a coluna sempre (`set role = role`)
  if new.role is not distinct from old.role then
    return null;
  end if;
  if new.role is null then
    delete from public.profile_papeis where profile_id = new.id;
  else
    insert into public.profile_papeis (profile_id, papel)
    values (new.id, new.role)
    on conflict do nothing;
    update public.profile_papeis set primario = false
     where profile_id = new.id and primario;
    update public.profile_papeis set primario = true
     where profile_id = new.id
       and papel = new.role and escopo_turma is null;
  end if;
  return null;
end $$;

create trigger profile_papeis_escopo_check
  before insert or update on public.profile_papeis
  for each row execute function public.profile_papeis_escopo_check();

create trigger profile_papeis_norm_primario
  before insert or update on public.profile_papeis
  for each row execute function public.profile_papeis_norm_primario();

create trigger profile_papeis_projeta_role
  after insert or update or delete on public.profile_papeis
  for each row execute function public.profile_papeis_projeta_role();

-- UPDATE OF role: não dispara no `set user_id` do handle_new_user (o espelho
-- explícito dele, abaixo, cobre esse caminho) nem em PATCH de outras colunas
create trigger profiles_role_para_papeis
  after insert or update of role on public.profiles
  for each row execute function public.profiles_role_para_papeis();

-- ============ 5) handle_new_user: vínculo do 1º login espelha o papel ============
-- Mesma função da 0059 (e-mail canônico + nome_proprio) + o insert do papel.
-- O trigger de profiles só espelha writes na coluna `role`; o vínculo
-- atualiza `user_id` (role não entra no SET) — sem este insert, profile
-- pré-cadastrado ficaria com role e sem linha de papel. Idempotente:
-- o insert de profiles pela coordenação já cria a linha via 4d.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role public.app_role;
begin
  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null
  returning id, role into v_profile_id, v_role;
  if not found then
    insert into public.profiles (user_id, email, nome)
    values (
      new.id,
      lower(btrim(new.email)),
      coalesce(
        nullif(public.nome_proprio(coalesce(
          new.raw_user_meta_data ->> 'nome',
          translate(split_part(new.email, '@', 1), '._-', '   ')
        )), ''),
        split_part(new.email, '@', 1)
      )
    )
    returning id, role into v_profile_id, v_role;
  end if;
  if v_role is not null then
    insert into public.profile_papeis (profile_id, papel, primario)
    values (v_profile_id, v_role, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ============ 6) RLS — mesmo recorte de profiles (0023/0065) ============
-- Leitura: os próprios papéis sempre + os 4 papéis de staff leem todos
-- ('mentorado' fora por omissão, espelho da profiles_select endurecida).
-- Escrita: só coordenação — papel é atribuição dela, nunca self-service.

alter table public.profile_papeis enable row level security;

revoke all on public.profile_papeis from public, anon;
grant select, insert, update, delete on public.profile_papeis to authenticated;

create policy profile_papeis_select on public.profile_papeis
  for select to authenticated
  using (
    profile_id = public.my_profile_id()
    or public.my_role() in ('coordenacao', 'supervisor', 'mentor_dpp', 'mentor_especialista')
  );

create policy profile_papeis_coord on public.profile_papeis
  for all to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

commit;

-- rollback: drop trigger profiles_role_para_papeis on public.profiles;
--           drop trigger profile_papeis_projeta_role on public.profile_papeis;
--           drop trigger profile_papeis_norm_primario on public.profile_papeis;
--           drop trigger profile_papeis_escopo_check on public.profile_papeis;
--           restore handle_new_user (corpo da 0059);
--           drop function my_papeis / has_papel ×2 / os 4 de trigger;
--           drop table public.profile_papeis;
-- profiles.role nunca deixou de ser escrito — nada a restaurar nela.
