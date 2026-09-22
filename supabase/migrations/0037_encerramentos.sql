-- 0037: fechamento do ciclo — a etapa que faltava do programa (guia DPP:
-- "encerramento ou renovação da jornada") + lifecycle completo da trilha de
-- especialista (guia: até 5 encontros em até 3 meses, devolutiva pro PDM).
--
-- Duas peças de domínio:
--   encerramentos — o rito de fechamento da dupla DPP: checklist do guia
--     (feedback final/mútuo, revisão do PDM, avaliação 360 enviada,
--     autoavaliação do mentor) + a decisão da coordenação: a jornada foi
--     percorrida até o fim ('concluida') ou terminou antes ('encerrada').
--   duplas (trilha='especialista') — encerrada_em/motivo/devolutiva_pdm:
--     o fechamento da trilha curta, que devolve ao mentor DPP o que segue
--     pro plano do jovem.
begin;

-- 1) 'concluida' entra no enum de status da dupla — o guia distingue
-- encerramento (interrupção) de conclusão (jornada completa). ADD VALUE numa
-- transação só não pode ser USADO dentro dela — aqui só amplia o domínio:
-- nenhuma escrita desta migration referencia o valor novo. Fora do índice
-- parcial de vaga (ativa/pausada), então concluir libera o mentorado como
-- encerrar já liberava.
alter type public.dupla_status add value if not exists 'concluida';

-- 2) checklist do fechamento é vocabulário fechado (as 5 chaves do rito,
-- valores boolean) — CHECK não aceita subquery, então a validação mora numa
-- função immutable (mesmo padrão de areas_perfil_ok, 0030).
create or replace function public.encerramento_checklist_ok(c jsonb)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select not exists (
    select 1
      from jsonb_each(c) as k
     where k.key <> all (array[
             'feedback_final', 'feedback_mutuo', 'revisao_pdm',
             'avaliacao_360_enviada', 'autoavaliacao'])
        or jsonb_typeof(k.value) <> 'boolean'
  );
$$;

create table public.encerramentos (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas(id),
  -- null enquanto a decisão não foi tomada: a row pode nascer só com a
  -- autoavaliação do mentor (ele preenche na ficha antes da coordenação
  -- fechar) — tipo/decidido_por viajam juntos e marcam o fechamento de fato
  tipo text check (tipo in ('concluida', 'encerrada')),
  checklist jsonb not null default '{}'
    check (public.encerramento_checklist_ok(checklist)),
  autoavaliacao_mentor text
    check (autoavaliacao_mentor is null or char_length(autoavaliacao_mentor) <= 4000),
  disponivel_proximo_ciclo boolean,
  -- snapshot gerado dos dados da jornada no momento do fechamento — o
  -- relatório final do guia nasce dele; não é campo livre do formulário
  resumo_jornada text,
  decidido_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (dupla_id),
  -- decisão e decisor são um par: ou os dois null (pendente) ou os dois
  -- preenchidos — nunca uma decisão sem autor nem um autor sem decisão
  check ((tipo is null) = (decidido_por is null))
);

alter table public.encerramentos enable row level security;

-- superfície mínima como nas demais: RLS faz o escopo; delete não tem grant
-- nem policy — fechamento registrado não se apaga
grant select, insert, update on public.encerramentos to authenticated;

-- leitura: coordenação + mentor e supervisor DA dupla (mesmo escopo de
-- encontros/registros — o fechamento é histórico da dupla)
drop policy if exists encerramentos_select on public.encerramentos;
create policy encerramentos_select on public.encerramentos for select using (
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = encerramentos.dupla_id
      and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
  )
);

-- escrita da decisão: só coordenação. A autoavaliação do mentor passa pelo
-- RPC salvar_autoavaliacao (escopo fino de colunas — padrão do
-- aceitar_solicitacao, 0028: definer em vez de policy de coluna).
drop policy if exists encerramentos_coord on public.encerramentos;
create policy encerramentos_coord on public.encerramentos for all
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

-- decidido_por vem do token, não do cliente (mesma convenção do
-- stamp_solicitacao_autor, 0027)
create or replace function public.stamp_encerramento_decisor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo is not null and new.decidido_por is null then
    new.decidido_por := public.my_profile_id();
  elsif new.decidido_por is not null
        and new.decidido_por is distinct from public.my_profile_id()
        and public.my_role() <> 'coordenacao' then
    raise exception 'decidido_por não pode ser forjado';
  end if;
  return new;
end $$;
drop trigger if exists encerramentos_decisor on public.encerramentos;
create trigger encerramentos_decisor
  before insert or update on public.encerramentos
  for each row execute function public.stamp_encerramento_decisor();

-- 3) autoavaliação do mentor: escreve só os 2 campos dele na row da própria
-- dupla — upsert porque a coordenação pode ter criado a row primeiro (ou o
-- mentor, adiantando a parte dele). Depois de decidido_por a row trava: a
-- autoavaliação entrou no checklist, não muda mais.
create or replace function public.salvar_autoavaliacao(
  p_dupla uuid,
  p_texto text,
  p_disponivel boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  n int;
begin
  select id, mentor_id, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if d.mentor_id is distinct from public.my_profile_id() then
    raise exception 'Só o mentor da dupla pode enviar a autoavaliação';
  end if;
  -- dupla já fechada não ganha autoavaliação nova — a row ficaria pendente
  -- sem caminho de decisão (registrar encerra só dupla aberta)
  if d.status is distinct from 'ativa' and d.status is distinct from 'pausada' then
    raise exception 'A dupla já está fechada';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) not between 10 and 4000 then
    raise exception 'A autoavaliação precisa de 10 a 4.000 caracteres';
  end if;

  insert into public.encerramentos (dupla_id, autoavaliacao_mentor, disponivel_proximo_ciclo)
  values (p_dupla, nullif(btrim(p_texto), ''), p_disponivel)
  on conflict (dupla_id) do update set
    autoavaliacao_mentor = excluded.autoavaliacao_mentor,
    disponivel_proximo_ciclo = excluded.disponivel_proximo_ciclo
  where encerramentos.decidido_por is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'O encerramento já foi registrado — a autoavaliação não pode mais mudar';
  end if;
end
$$;

revoke all on function public.salvar_autoavaliacao(uuid, text, boolean) from public, anon;
grant execute on function public.salvar_autoavaliacao(uuid, text, boolean) to authenticated;

-- 4) fechamento da trilha de especialista — a trilha É a dupla
-- (trilha='especialista'; não existe tabela própria). Os 3 campos só têm
-- sentido nela: encerrada_em carimba, motivo é obrigatório com o carimbo, e
-- devolutiva_pdm é o que a trilha devolve pro plano do jovem (o mentor DPP
-- lê via solicitacoes_mural, abaixo).
alter table public.duplas
  add column if not exists encerrada_em timestamptz,
  add column if not exists motivo_encerramento text,
  add column if not exists devolutiva_pdm text;

alter table public.duplas
  drop constraint if exists duplas_encerramento_esp,
  drop constraint if exists duplas_motivo_encerramento_cap,
  drop constraint if exists duplas_devolutiva_pdm_cap;

alter table public.duplas
  add constraint duplas_encerramento_esp
    check (
      trilha = 'especialista'
      or (encerrada_em is null and motivo_encerramento is null and devolutiva_pdm is null)
    ),
  add constraint duplas_motivo_encerramento_cap
    check (motivo_encerramento is null or char_length(motivo_encerramento) between 3 and 300),
  add constraint duplas_devolutiva_pdm_cap
    check (devolutiva_pdm is null or char_length(devolutiva_pdm) between 10 and 4000),
  add constraint duplas_encerrada_em_motivo
    check (encerrada_em is null or motivo_encerramento is not null);

-- 5) encerrar a trilha: o especialista dono da dupla ou a coordenação. O
-- mentor não tem grant de update em duplas (só coord e supervisor tocam a
-- row), então o fechamento é RPC definer — mesmo padrão do aceite. O WHERE
-- 'ativa'/'pausada' trava a corrida de dois cliques e a re-abertura pelo
-- dialog de edição segue intocada (status continua sendo status).
create or replace function public.encerrar_trilha_especialista(
  p_dupla uuid,
  p_tipo text,
  p_motivo text,
  p_devolutiva text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  n int;
begin
  select id, mentor_id, trilha, status into d from public.duplas where id = p_dupla;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if d.trilha is distinct from 'especialista' then
    raise exception 'Essa ação é só pra trilha de especialista';
  end if;
  -- IS DISTINCT FROM: my_role()/my_profile_id() voltam null sem papel, e
  -- "null <> 'coordenacao'" avaliaria NULL — sem a forma is-distinct o
  -- guard não barraria (mesmo cuidado do aceitar_solicitacao, 0028)
  if d.mentor_id is distinct from public.my_profile_id()
     and public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só o especialista da dupla ou a coordenação podem encerrar a trilha';
  end if;
  if p_tipo not in ('concluida', 'encerrada') then
    raise exception 'Escolha entre concluir e encerrar a trilha';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 300 then
    raise exception 'O motivo do encerramento precisa de 3 a 300 caracteres';
  end if;
  if p_devolutiva is null or char_length(btrim(p_devolutiva)) not between 10 and 4000 then
    raise exception 'A devolutiva pro PDM precisa de 10 a 4.000 caracteres';
  end if;

  update public.duplas
     set status = p_tipo::public.dupla_status,
         encerrada_em = now(),
         motivo_encerramento = btrim(p_motivo),
         devolutiva_pdm = btrim(p_devolutiva)
   where id = p_dupla
     and status in ('ativa', 'pausada');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Essa trilha já está encerrada';
  end if;
end
$$;

revoke all on function public.encerrar_trilha_especialista(uuid, text, text, text) from public, anon;
grant execute on function public.encerrar_trilha_especialista(uuid, text, text, text) to authenticated;

-- 6) a devolutiva chega ao mentor DPP pela view do mural — ele não lê a
-- dupla de especialista (RLS de duplas), mas a solicitação que ele mesmo
-- abriu é do escopo dele. A view roda como owner e o WHERE já replica o
-- sol_select (0030): expor devolutiva/encerrada_em aqui não alarga o
-- escopo, só o conteúdo da row já visível. Colunas novas vão no FIM —
-- create or replace view exige a lista original intacta.
create or replace view public.solicitacoes_mural as
select
  s.id,
  s.mentorado_id,
  s.dupla_dpp_id,
  s.demanda,
  s.especialista_desejado_id,
  s.especialista_id,
  s.dupla_id,
  s.status,
  s.created_by,
  s.created_at,
  s.respondida_em,
  m.nome as mentorado_nome,
  ed.devolutiva_pdm,
  ed.encerrada_em as trilha_encerrada_em
from public.solicitacoes_especialista s
join public.mentorados m on m.id = s.mentorado_id
left join public.duplas ed on ed.id = s.dupla_id
where
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = s.dupla_dpp_id
      and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
  )
  or (s.status = 'aberta' and public.my_role() = 'mentor_especialista')
  or s.especialista_id = public.my_profile_id();

-- 7) a devolutiva é entrega — quem pediu precisa saber que chegou. Tipo
-- novo no check + ramo na policy de insert pro especialista avisar o
-- solicitante da trilha DELE e a coordenação (espelha o ramo do aceite, 0028).
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada',
    'especialista_aceitou', 'solicitacao_cancelada', 'trilha_encerrada'
  ));

drop policy if exists notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or (
      created_by = public.my_profile_id()
      and (
        (tipo = 'pedido_apoio' and exists (
          select 1 from public.profiles p
          where p.id = profile_id
            and p.role in ('coordenacao', 'supervisor')))
        or (tipo = 'demanda_especialista' and exists (
          select 1 from public.profiles p
          where p.id = profile_id and p.role = 'mentor_especialista'))
        or (tipo in ('solicitacao_registrada', 'solicitacao_cancelada') and exists (
          select 1 from public.profiles p
          where p.id = profile_id and p.role = 'coordenacao'))
        or (tipo = 'especialista_aceitou'
            and public.my_role() = 'mentor_especialista'
            and (
              exists (select 1 from public.profiles p
                      where p.id = profile_id and p.role = 'coordenacao')
              or exists (select 1 from public.solicitacoes_especialista s
                         where s.created_by = profile_id
                           and s.especialista_id = public.my_profile_id())
            ))
        or (tipo = 'trilha_encerrada'
            and public.my_role() = 'mentor_especialista'
            and (
              exists (select 1 from public.profiles p
                      where p.id = profile_id and p.role = 'coordenacao')
              or exists (select 1 from public.solicitacoes_especialista s
                         where s.created_by = profile_id
                           and s.especialista_id = public.my_profile_id())
            ))
      )
    )
  );

commit;
