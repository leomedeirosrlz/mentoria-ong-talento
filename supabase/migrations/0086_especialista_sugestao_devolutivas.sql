-- 0086: WP6 especialistas do jovem — três frentes numa transaction:
--
-- A) Pedido registrado pelo MENTOR DPP em nome do jovem (D10 / REALIZA-146):
--    o guia prevê "demanda registrada pelo Mentor de Desenvolvimento". Fluxo:
--    mentor registra (tema, preferência opcional, objetivo) → jovem confirma
--    ou edita → só então vira solicitação real. Modelo: `origem='mentor'` +
--    `status='sugerida'` — um estado ANTERIOR a 'aberta' que não conta nos
--    tetos, não aparece no mural e só existe até o jovem decidir.
--
-- B) Híbrido DPP+especialista (D9/WP0b): os checks `role='mentor_especialista'`
--    viram `has_papel(...)` — o papel agora é relação, não coluna. O catálogo
--    do jovem lista por `has_papel('mentor_especialista', turma dele)` e o
--    DPP da própria dupla fica fora (trilha com o próprio mentor misturaria
--    os mundos — decisão do plano).
--
-- C) `devolutivas` — feed datado por trilha (REALIZA-139): a coluna única
--    `duplas.devolutiva_pdm` só comporta a entrega final; o guia pede a
--    trilha devolvendo pro jovem ao longo do percurso. Escrita só via RPC
--    definer (mesmo molde das RPCs de solicitação — policy nunca abre ramo
--    de escrita direto).
--
-- Risco verificado antes de escrever: o trigger `solicitacao_integridade`
-- (0074) é o bloqueio real — INSERT pra não-coord só aceita
-- ('aberta','aguardando_coord') e UPDATE torna demanda/motivo/origem/turma/
-- especialista_desejado_id imutáveis. Aqui ele aprende: 'sugerida' só nasce
-- de origem='mentor' com o mentor sendo o DPP daquela dupla; e enquanto
-- 'sugerida' os campos de CONTEÚDO ficam editáveis (identidade segue
-- imutável) — quem escreve continua sendo só coord ou RPC sob o GUC
-- realiza.sol_transicao (a policy sol_update não muda).

begin;

-- ============ 1) CHECKs ============

alter table public.solicitacoes_especialista
  drop constraint if exists solicitacoes_origem_check,
  add constraint solicitacoes_origem_check
    check (origem in ('staff','jovem','mentor')),
  drop constraint if exists solicitacoes_especialista_status_check,
  add constraint solicitacoes_especialista_status_check check (
    status in ('sugerida','aberta','aguardando_coord','contra_proposta',
               'aceita','recusada','cancelada','expirada'));

-- ============ 2) trigger — sugere/edita + papel como relação ============

create or replace function public.solicitacao_integridade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.dupla_dpp_id is not null
       and new.mentorado_id is distinct from (
         select d.mentorado_id from public.duplas d where d.id = new.dupla_dpp_id
       ) then
      raise exception 'mentorado_id diverge do mentorado da dupla';
    end if;
    -- papel por relação (WP0b): o híbrido DPP+especialista é alvo válido
    if new.especialista_desejado_id is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.especialista_desejado_id and p.ativo
        and public.has_papel(p.id, 'mentor_especialista')
    ) then
      raise exception 'especialista de destino inválido';
    end if;
    if new.dupla_id is not null and not exists (
      select 1 from public.duplas d
      where d.id = new.dupla_id and d.trilha = 'especialista'
        and d.mentorado_id = new.mentorado_id
    ) then
      raise exception 'dupla de destino inválida';
    end if;
    -- gate sem demanda: pedido que NÃO encosta num par existente precisa do
    -- porquê; pedido de sessão seguinte (dupla_id ou par já ativo) é slot-only.
    -- 'sugerida' sempre carrega demanda (o mentor registra o tema) — a regra
    -- vale igual pra qualquer outro caminho de escrita.
    if new.demanda is null and new.dupla_id is null and not exists (
      select 1 from public.duplas d
      where d.mentorado_id = new.mentorado_id and d.trilha = 'especialista'
        and d.status in ('ativa','pausada')
        and (new.especialista_desejado_id is null
             or d.mentor_id = new.especialista_desejado_id)
    ) then
      raise exception 'pedido novo precisa de demanda';
    end if;
    -- autoria não se forja (service role/seed roda sem role e passa reto)
    if public.my_role() is not null and public.my_role() <> 'coordenacao' then
      if new.created_by is distinct from public.my_profile_id() then
        raise exception 'created_by tem que ser o autor';
      end if;
      if new.origem = 'jovem' and public.my_role() <> 'mentorado' then
        raise exception 'origem jovem exige autor mentorado';
      end if;
      if new.origem = 'staff' and public.my_role() = 'mentorado' then
        raise exception 'jovem não cria pedido como staff';
      end if;
      -- 'mentor': o autor precisa ser o mentor DPP daquela dupla de origem —
      -- mentor de OUTRA dupla não registra demanda pra este jovem
      if new.origem = 'mentor' and (
        new.dupla_dpp_id is null or not exists (
          select 1 from public.duplas d
          where d.id = new.dupla_dpp_id
            and d.mentor_id = public.my_profile_id()
            and coalesce(d.trilha, 'dpp') = 'dpp'
            and d.status = 'ativa')
      ) then
        raise exception 'origem mentor exige ser o DPP da dupla';
      end if;
      -- status inicial: 'sugerida' é exclusivo do fluxo mentor→jovem
      if new.status = 'sugerida' then
        if new.origem <> 'mentor' then
          raise exception 'status sugerida exige origem mentor';
        end if;
      elsif new.status not in ('aberta','aguardando_coord') then
        raise exception 'status inicial inválido';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: pra não-coord os campos de identidade/conteúdo são imutáveis —
  -- EXCETO enquanto 'sugerida': a confirmação do jovem (RPC sob GUC) edita
  -- demanda/motivo/alvo, porque a sugestão é do mentor mas a demanda é do
  -- jovem. Quem pode escrever não muda (policy: coord ou GUC).
  if public.my_role() is not null and public.my_role() <> 'coordenacao' then
    if new.mentorado_id is distinct from old.mentorado_id
       or new.dupla_dpp_id is distinct from old.dupla_dpp_id
       or new.origem is distinct from old.origem
       or new.turma is distinct from old.turma
       or new.created_by is distinct from old.created_by
       or (old.status <> 'sugerida' and (
            new.demanda is distinct from old.demanda
            or new.motivo is distinct from old.motivo
            or new.especialista_desejado_id is distinct from old.especialista_desejado_id))
    then
      raise exception 'campos da solicitação são imutáveis';
    end if;
  end if;
  return new;
end $$;

-- ============ 3) RPCs do fluxo mentor → jovem ============

-- o DPP registra a demanda em nome do jovem: nasce 'sugerida' — fora dos
-- tetos, fora do mural — e espera o aceite dele. Valida a dupla DPP ativa
-- com o autor como mentor (o vínculo real, não só o papel).
create or replace function public.sugerir_especialista_mentor(
  p_mentorado_id uuid,
  p_demanda text,
  p_objetivo text default null,
  p_especialista_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  meu uuid := public.my_profile_id();
  v_dpp record;
  v_id uuid;
  v_nome text;
  v_jovem_profile uuid;
begin
  select d.id, d.turma into v_dpp from public.duplas d
   where d.mentor_id = meu and d.mentorado_id = p_mentorado_id
     and coalesce(d.trilha, 'dpp') = 'dpp' and d.status = 'ativa';
  if not found then
    raise exception 'Você não é o mentor DPP dessa pessoa';
  end if;
  if p_demanda is null or char_length(btrim(p_demanda)) < 10 then
    raise exception 'Descreva o tema ou a necessidade (mín. 10 caracteres)';
  end if;
  if p_especialista_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_especialista_id and p.ativo
      and public.has_papel(p.id, 'mentor_especialista')
  ) then
    raise exception 'Especialista não encontrado';
  end if;
  -- dedup: uma sugestão pendente por jovem — duas sugestões abertas viram
  -- fila confusa na página dele
  if exists (select 1 from public.solicitacoes_especialista s
             where s.mentorado_id = p_mentorado_id and s.status = 'sugerida') then
    raise exception 'Já existe uma sugestão esperando a resposta dela/dele';
  end if;

  insert into public.solicitacoes_especialista (
    dupla_dpp_id, mentorado_id, demanda, motivo, especialista_desejado_id,
    origem, status, turma, created_by
  ) values (
    v_dpp.id, p_mentorado_id, btrim(p_demanda), nullif(btrim(p_objetivo),''),
    p_especialista_id, 'mentor', 'sugerida', v_dpp.turma, meu
  ) returning id into v_id;

  select m.nome, m.profile_id into v_nome, v_jovem_profile
    from public.mentorados m where m.id = p_mentorado_id;
  perform public.sol_notificar(v_jovem_profile, 'sugestao_especialista',
    'Seu mentor sugeriu um especialista',
    'Ele registrou um tema pra você — confirme ou ajuste na página de especialistas.',
    '/jovem/especialistas');
  return v_id;
end $$;
grant execute on function public.sugerir_especialista_mentor(uuid, text, text, uuid)
  to authenticated;

-- o jovem confirma (e pode editar tema/objetivo/alvo) → vira pedido real:
-- 'aberta', entra nos tetos a partir daqui, vai pro mural/dirigido.
create or replace function public.confirmar_sugestao_especialista(
  p_id uuid,
  p_demanda text default null,
  p_objetivo text default null,
  p_especialista_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  v_alvo uuid;
  v_nome text;
  v_dest uuid;
begin
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.mentorado_id is distinct from public.my_mentorado_id() then
    raise exception 'Essa sugestão não é sua';
  end if;
  if s.status <> 'sugerida' then
    raise exception 'Essa sugestão já foi respondida';
  end if;

  v_alvo := coalesce(p_especialista_id, s.especialista_desejado_id);
  if v_alvo is not null and not exists (
    select 1 from public.profiles p
    where p.id = v_alvo and p.ativo
      and public.has_papel(p.id, 'mentor_especialista')
  ) then
    raise exception 'Especialista não encontrado';
  end if;
  -- os mesmos tetos do pedido próprio passam a valer na confirmação
  if (select count(*) from public.solicitacoes_especialista x
      where x.mentorado_id = s.mentorado_id
        and x.status in ('aberta','aguardando_coord','contra_proposta')) >= 3 then
    raise exception 'Você já tem pedidos demais em aberto — espere uma resposta';
  end if;
  if v_alvo is not null and exists (
    select 1 from public.solicitacoes_especialista x
    where x.mentorado_id = s.mentorado_id
      and x.status in ('aberta','aguardando_coord','contra_proposta')
      and coalesce(x.especialista_desejado_id, x.especialista_id) = v_alvo
  ) then
    raise exception 'Você já tem um pedido em aberto com esse especialista';
  end if;

  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'aberta',
         demanda = coalesce(nullif(btrim(p_demanda),''), demanda),
         motivo = coalesce(nullif(btrim(p_objetivo),''), motivo),
         especialista_desejado_id = v_alvo
   where id = s.id;

  select m.nome into v_nome from public.mentorados m where m.id = s.mentorado_id;
  -- dirigida: avisa o especialista; broadcast: radar da coordenação (mesmo
  -- molde do pedir_especialista_jovem). O mentor autor também fica sabendo.
  if v_alvo is not null then
    perform public.sol_notificar(v_alvo, 'demanda_especialista',
      'Novo pedido de sessão',
      v_nome || ' pediu uma sessão com você.', '/');
  else
    for v_dest in select * from public.sol_coords() loop
      perform public.sol_notificar(v_dest, 'solicitacao_registrada',
        'Pedido de especialista em aberto',
        v_nome || ' confirmou a sugestão do mentor — o mural decide.', '/');
    end loop;
  end if;
  if s.created_by is not null then
    perform public.sol_notificar(s.created_by, 'solicitacao_registrada',
      'Sugestão confirmada',
      v_nome || ' confirmou a sua sugestão de especialista — o pedido seguiu.',
      '/duplas/' || s.dupla_dpp_id);
  end if;
end $$;
grant execute on function public.confirmar_sugestao_especialista(uuid, text, text, uuid)
  to authenticated;

-- o jovem dispensa a sugestão (a demanda é dele — decidir não é privilégio
-- do mentor). Vira 'cancelada' e sai de vista.
create or replace function public.dispensar_sugestao_especialista(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitacoes_especialista%rowtype;
  v_nome text;
begin
  select * into s from public.solicitacoes_especialista
   where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.mentorado_id is distinct from public.my_mentorado_id() then
    raise exception 'Essa sugestão não é sua';
  end if;
  if s.status <> 'sugerida' then
    raise exception 'Essa sugestão já foi respondida';
  end if;
  perform set_config('realiza.sol_transicao', 'on', true);
  update public.solicitacoes_especialista
     set status = 'cancelada', respondida_em = now()
   where id = s.id;
  select m.nome into v_nome from public.mentorados m where m.id = s.mentorado_id;
  if s.created_by is not null then
    perform public.sol_notificar(s.created_by, 'solicitacao_cancelada',
      'Sugestão dispensada',
      v_nome || ' dispensou a sugestão de especialista por enquanto.',
      '/duplas/' || s.dupla_dpp_id);
  end if;
end $$;
grant execute on function public.dispensar_sugestao_especialista(uuid)
  to authenticated;

-- ============ 4) devolutivas (feed datado por trilha) ============

create table public.devolutivas (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  texto text not null check (char_length(btrim(texto)) between 10 and 4000),
  created_at timestamptz not null default now()
);
create index devolutivas_dupla_idx
  on public.devolutivas (dupla_id, created_at);
comment on table public.devolutivas is
  'Devolutivas datadas da trilha de especialista — o especialista devolve ao longo do percurso, não só no fim (a entrega final segue em duplas.devolutiva_pdm).';

alter table public.devolutivas enable row level security;
revoke all on public.devolutivas from public, anon;
grant select on public.devolutivas to authenticated;

-- leitura: o jovem dono da trilha, o autor (especialista) e a coordenação.
-- O mentor DPP recebe o resumo pela superfície do WP3, não a coluna crua.
create policy devolutivas_select on public.devolutivas for select using (
  public.my_role() = 'coordenacao'
  or autor_id = public.my_profile_id()
  or exists (select 1 from public.duplas d
    where d.id = dupla_id and d.mentorado_id = public.my_mentorado_id())
);
-- sem insert/update/delete: quem escreve é a RPC definer

-- posta uma devolutiva na trilha: só o especialista da dupla (a trilha tem
-- que existir e seguir aberta — devolutiva de trilha encerrada é a coluna
-- devolutiva_pdm do encerramento).
create or replace function public.postar_devolutiva(
  p_dupla_id uuid, p_texto text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  meu uuid := public.my_profile_id();
  v_dupla record;
  v_id uuid;
  v_jovem_profile uuid;
  v_esp_nome text;
begin
  select d.id, d.mentorado_id, d.encerrada_em into v_dupla
    from public.duplas d
   where d.id = p_dupla_id and d.trilha = 'especialista'
     and d.mentor_id = meu and d.status in ('ativa','pausada');
  if not found then
    raise exception 'Essa trilha não é sua';
  end if;
  if v_dupla.encerrada_em is not null then
    raise exception 'Trilha encerrada — a devolutiva final vai no encerramento';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) < 10 then
    raise exception 'Escreva a devolutiva (mín. 10 caracteres)';
  end if;
  insert into public.devolutivas (dupla_id, autor_id, texto)
  values (p_dupla_id, meu, btrim(p_texto)) returning id into v_id;
  select m.profile_id, p.nome into v_jovem_profile, v_esp_nome
    from public.mentorados m, public.profiles p
   where m.id = v_dupla.mentorado_id and p.id = meu;
  perform public.sol_notificar(v_jovem_profile, 'devolutiva_especialista',
    'Nova devolutiva da trilha',
    v_esp_nome || ' registrou uma devolutiva pra você.',
    '/jovem/especialistas');
  return v_id;
end $$;
grant execute on function public.postar_devolutiva(uuid, text) to authenticated;

-- ============ 5) catálogo rico (cardápio) ============
-- drop+create (padrão 0074): novas colunas bio/cargo/empresa/cidade/uf/
-- voluntariado (self-authored de profiles) + experiencia_previa/
-- formacao_externa (mentor_profiles) + grade_resumo (períodos, nunca slot)
-- + vagas (derivada: alimenta o estado do card, nunca mostra número).
-- O filtro vira has_papel escopado na turma do jovem e o DPP da própria
-- dupla sai do cardápio. Linkedin continua fora de propósito (canal de DM
-- entre adulto e menor fora da plataforma — mesma regra da 0075).
drop view if exists public.jovem_especialistas;
create view public.jovem_especialistas as
select
  p.id,
  p.nome,
  p.nome_social,
  p.avatar_path,
  p.areas,
  p.bio,
  p.cargo,
  p.empresa,
  p.cidade,
  p.uf,
  p.voluntariado,
  mp.experiencia_previa,
  mp.formacao_externa,
  (select array_agg(lbl order by dow, per_ord)
     from (select distinct
             g.dia_semana as dow,
             case per when 'manha' then 1 when 'tarde' then 2 else 3 end as per_ord,
             case g.dia_semana when 0 then 'dom' when 1 then 'seg'
                  when 2 then 'ter' when 3 then 'qua' when 4 then 'qui'
                  when 5 then 'sex' else 'sáb' end
             || case per when 'manha' then ' de manhã'
                         when 'tarde' then ' à tarde' else ' à noite' end as lbl
             from public.especialista_grade g
             cross join lateral (select unnest(array[
               case when g.hora_inicio < '12:00'::time then 'manha' end,
               case when g.hora_inicio < '18:00'::time
                      and g.hora_fim > '12:00'::time then 'tarde' end,
               case when g.hora_fim > '18:00'::time then 'noite' end
             ]) as per) pp
            where pp.per is not null and g.profile_id = p.id) x) as grade_resumo,
  greatest(0, coalesce(mp.capacidade_especialista, 1) - (
    select count(*) from public.duplas d
     where d.mentor_id = p.id and d.trilha = 'especialista'
       and d.status in ('ativa','pausada')))::int as vagas
from public.profiles p
left join public.mentor_profiles mp on mp.profile_id = p.id
where p.ativo
  and public.my_role() = 'mentorado'
  and public.has_papel(
    p.id, 'mentor_especialista',
    (select d.turma from public.duplas d
      where d.mentorado_id = public.my_mentorado_id()
        and coalesce(d.trilha,'dpp') = 'dpp' and d.status = 'ativa'
      limit 1))
  and not exists (
    select 1 from public.duplas d
     where d.mentorado_id = public.my_mentorado_id()
       and d.mentor_id = p.id
       and coalesce(d.trilha,'dpp') = 'dpp'
       and d.status in ('ativa','pausada'));

revoke all on public.jovem_especialistas from public, anon;
grant select on public.jovem_especialistas to authenticated;

-- ============ 6) tipos novos de notificação ============
-- sugestao_especialista: mentor→jovem (confirme a sugestão)
-- devolutiva_especialista: especialista→jovem (trilha devolveu)
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado','pedido_apoio','apoio_resolvido','dupla_formada',
    'demanda_especialista','solicitacao_registrada','especialista_aceitou',
    'solicitacao_cancelada','trilha_encerrada','supervisao_registrada',
    'formulario_respondido','avaliacao_pendente','apoio_jovem',
    'encontro_marcado','encontro_alterado','encontro_desfeito',
    'solicitacao_triagem','solicitacao_recusada','solicitacao_proposta',
    'chamado_aberto','chamado_atribuido','chamado_atualizacao',
    'chamado_resposta_autor','chamado_resolvido','chamado_reaberto',
    'chamado_mencao','sugestao_especialista','devolutiva_especialista'));

commit;

-- rollback: drop function confirmar_sugestao_especialista /
--           dispensar_sugestao_especialista / sugerir_especialista_mentor /
--           postar_devolutiva; drop table devolutivas; restore
--           jovem_especialistas (corpo da 0075) e solicitacao_integridade
--           (corpo da 0074); restore os CHECKs (status sem 'sugerida',
--           origem sem 'mentor', notificacoes sem os 2 tipos).
