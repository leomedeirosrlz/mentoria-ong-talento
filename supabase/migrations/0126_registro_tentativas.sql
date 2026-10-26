-- 0126 — registro_tentativas (REALIZA-217, fase 1): telemetria do form de
-- registro ANTES do redesign "1 minuto no celular". Uma linha por abertura
-- do RegistroForm: quando abriu, em qual dispositivo, por qual fluxo e —
-- se o mentor terminou — quanto tempo levou e em qual registro desembocou.
-- Sem medir primeiro, o redesign é achismo: a tabela responde "quanto tempo
-- leva", "em que etapa desistem" e "celular abandona mais que desktop?".
--
-- Abandono é DERIVADO (não concluída + ultima_atividade velha), sem evento
-- próprio: a última batida do heartbeat é o sinal de vida. O form escreve
-- SÓ pelas três RPCs definer abaixo (fire-and-forget — telemetria nunca
-- bloqueia nem falha o preenchimento); as policies de insert/update são o
-- cinto de segurança pra escrita REST direta, não o caminho do app.
--
-- origem: 'novo' (follow-up sobre encontro criado na plataforma, na ficha
-- ou no dialog da agenda), 'retroativo' (o mesmo form sobre encontro
-- 'externo' — o catch-up que já nasce realizado via RegistrarRetroativo),
-- 'edicao' (form sobre um registro já gravado).
-- dispositivo: heurística do client (UA + viewport) — mede a experiência
-- de tela, não o hardware: janela estreita conta como 'mobile'.
-- etapas: jsonb { "1": ms, "2": ms, "3": ms } — tempo acumulado por passo
-- do wizard (a chave casa com o "Passo N de 3" da interface).

begin;

create table public.registro_tentativas (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  encontro_id uuid references public.encontros (id) on delete cascade,
  registro_id uuid references public.registros (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  origem text not null check (origem in ('novo', 'retroativo', 'edicao')),
  dispositivo text check (dispositivo in ('mobile', 'desktop', 'tablet')),
  inicio timestamptz not null default now(),
  ultima_atividade timestamptz,
  duracao_ms integer,
  concluido boolean not null default false,
  etapas jsonb,
  created_at timestamptz not null default now()
);
comment on table public.registro_tentativas is
  'Sessões de preenchimento do form de registro (REALIZA-217 fase 1). '
  'Escrita só via RPCs iniciar/atualizar/concluir_tentativa_registro; '
  'abandono derivado de concluido=false + ultima_atividade velha.';
comment on column public.registro_tentativas.origem is
  'Fluxo do form: novo = encontro da plataforma; retroativo = catch-up '
  '(encontro externo, criado já realizado); edicao = registro já gravado.';
comment on column public.registro_tentativas.dispositivo is
  'Heurística do client (UA + viewport): mede a experiência de tela — '
  'janela estreita conta como mobile.';
comment on column public.registro_tentativas.etapas is
  'Tempo por passo do wizard em ms: { "1": n, "2": n, "3": n }.';

-- relatório dos 30 dias (concluída × quando) e leitura por dupla
create index registro_tentativas_concluido_inicio_idx
  on public.registro_tentativas (concluido, inicio);
create index registro_tentativas_dupla_inicio_idx
  on public.registro_tentativas (dupla_id, inicio);
-- FK sem índice: delete de encontro (limpeza e2e, desfazer raro) faria
-- seq scan no cascade
create index registro_tentativas_encontro_idx
  on public.registro_tentativas (encontro_id);

alter table public.registro_tentativas enable row level security;

-- grants explícitos (o checklist de toda tabela nova): anon nada;
-- authenticated lê/escreve a própria linha via policy — sem delete pra
-- ninguém abaixo do service role (a série histórica não se apaga)
revoke all on public.registro_tentativas from public, anon;
revoke delete on public.registro_tentativas from authenticated;
grant select, insert, update on public.registro_tentativas to authenticated;

-- leitura: o dono revê a própria sessão; o relatório é da equipe
drop policy if exists registro_tentativas_select on public.registro_tentativas;
create policy registro_tentativas_select on public.registro_tentativas
  for select to authenticated
  using (
    profile_id = public.my_profile_id()
    or public.my_role() in ('coordenacao', 'supervisor')
  );

-- insert/update diretos (caminho REST, não o do app): mesma régua das RPCs
-- — a linha é do próprio preenchimento e só nasce pra dupla que o mentor
-- tem (ou pra staff)
drop policy if exists registro_tentativas_insert on public.registro_tentativas;
create policy registro_tentativas_insert on public.registro_tentativas
  for insert to authenticated
  with check (
    profile_id = public.my_profile_id()
    and (
      public.my_role() in ('coordenacao', 'supervisor')
      or exists (
        select 1 from public.duplas d
        where d.id = dupla_id and d.mentor_id = public.my_profile_id()
      )
    )
  );

drop policy if exists registro_tentativas_update on public.registro_tentativas;
create policy registro_tentativas_update on public.registro_tentativas
  for update to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());

-- ============ RPCs (o único caminho do app) ============
-- Definer porque a validação lê duplas/encontros acima da RLS do caller —
-- e pra telemetria ser generosa: falha de escopo devolve null/void em
-- silêncio em vez de erro, porque o form nunca pode parar por causa dela.

-- abertura do form. Devolve o id da tentativa (uuid) ou null quando o
-- caller não pode preencher naquela dupla — o client trata null como
-- "telemetria desligada" e segue o fluxo normal.
create or replace function public.iniciar_tentativa_registro(
  p_dupla uuid,
  p_encontro uuid,
  p_origem text,
  p_dispositivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.my_profile_id();
  v_id uuid;
begin
  if v_eu is null then
    return null;
  end if;
  -- o form é do mentor da dupla; coordenação/auxiliar também passam — se a
  -- equipe abrir o form em contexto de apoio a sessão conta como tentativa
  if not (
    public.my_role() in ('coordenacao', 'supervisor')
    or exists (
      select 1 from public.duplas d
      where d.id = p_dupla and d.mentor_id = v_eu
    )
  ) then
    return null;
  end if;
  -- par incoerente (encontro de outra dupla) não vira métrica
  if p_encontro is not null and not exists (
    select 1 from public.encontros e
    where e.id = p_encontro and e.dupla_id = p_dupla
  ) then
    return null;
  end if;
  insert into public.registro_tentativas
    (dupla_id, encontro_id, profile_id, origem, dispositivo)
  values (
    p_dupla,
    p_encontro,
    v_eu,
    case when p_origem in ('novo', 'retroativo', 'edicao')
      then p_origem else 'novo' end,
    case when p_dispositivo in ('mobile', 'desktop', 'tablet')
      then p_dispositivo else null end
  )
  returning id into v_id;
  return v_id;
end $$;
comment on function public.iniciar_tentativa_registro(uuid, uuid, text, text) is
  'Abre uma sessão de preenchimento do registro (REALIZA-217). Mentor da '
  'dupla ou staff; devolve o id ou null (o form segue sem telemetria).';

-- heartbeat: troca de passo do wizard ou ~15s com atividade — carimba o
-- sinal de vida e o tempo por etapa. Só o dono; concluída não reabre.
create or replace function public.atualizar_tentativa_registro(
  p_id uuid,
  p_etapas jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.registro_tentativas t
     set ultima_atividade = now(),
         etapas = coalesce(p_etapas, t.etapas)
   where t.id = p_id
     and t.profile_id = public.my_profile_id()
     and t.concluido = false;
end $$;
comment on function public.atualizar_tentativa_registro(uuid, jsonb) is
  'Heartbeat da tentativa (REALIZA-217): carimba ultima_atividade e o '
  'tempo por etapa. Só o dono, só enquanto não concluída.';

-- submit com sucesso: fecha a sessão com a duração medida no cliente e o
-- registro gravado. Só o dono; p_registro, quando informado, precisa ser
-- do mesmo encontro da tentativa (link errado não cola).
create or replace function public.concluir_tentativa_registro(
  p_id uuid,
  p_registro uuid,
  p_duracao_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.registro_tentativas t
     set concluido = true,
         registro_id = p_registro,
         duracao_ms = greatest(coalesce(p_duracao_ms, 0), 0),
         ultima_atividade = now()
   where t.id = p_id
     and t.profile_id = public.my_profile_id()
     and t.concluido = false
     and (
       p_registro is null
       or exists (
         select 1 from public.registros r
         where r.id = p_registro and r.encontro_id = t.encontro_id
       )
     );
end $$;
comment on function public.concluir_tentativa_registro(uuid, uuid, integer) is
  'Fecha a tentativa com duração e o registro gravado (REALIZA-217). Só o '
  'dono; o registro precisa ser do mesmo encontro da tentativa.';

-- chamadas do app são do usuário logado (anon nunca abre o form); o tick
-- dos jobs não usa estas — service_role recebe por simetria das demais
revoke all on function public.iniciar_tentativa_registro(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.iniciar_tentativa_registro(uuid, uuid, text, text)
  to authenticated, service_role;
revoke all on function public.atualizar_tentativa_registro(uuid, jsonb)
  from public, anon;
grant execute on function public.atualizar_tentativa_registro(uuid, jsonb)
  to authenticated, service_role;
revoke all on function public.concluir_tentativa_registro(uuid, uuid, integer)
  from public, anon;
grant execute on function public.concluir_tentativa_registro(uuid, uuid, integer)
  to authenticated, service_role;

commit;

-- rollback manual:
-- drop function public.concluir_tentativa_registro(uuid, uuid, integer);
-- drop function public.atualizar_tentativa_registro(uuid, jsonb);
-- drop function public.iniciar_tentativa_registro(uuid, uuid, text, text);
-- drop table public.registro_tentativas;
