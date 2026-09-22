-- 0041: sessões de supervisão — o ritual supervisor ↔ mentor do guia que
-- ainda não existia no sistema. O supervisor registra a conversa (data +
-- resumo, opcionalmente vinculada a uma dupla); a coordenação lê tudo e
-- modera; o mentor lê as sessões sobre ele.
--
-- Decisão de visibilidade: o mentor VÊ data e resumo das sessões sobre ele.
-- A supervisão do guia é desenvolvimento do mentor, não vigilância — o tom
-- é positivo e a transparência fecha o ciclo de feedback (o mentor também
-- recebe uma notificação). Se um dia houver conteúdo sigiloso, o caminho é
-- uma coluna separada fora do select dele — não esconder a sessão inteira.
begin;

create table public.supervisoes (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references public.profiles(id),
  mentor_id uuid not null references public.profiles(id),
  -- null = sessão geral com o mentor (não sobre uma dupla específica).
  -- A validação "mentor de dupla ativa/pausada que eu supervisiono" mora na
  -- action — CHECK não aceita subquery e a regra é de negócio, não integridade.
  dupla_id uuid references public.duplas(id),
  data date not null,
  resumo text not null check (char_length(resumo) between 10 and 4000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index supervisoes_supervisor_idx
  on public.supervisoes (supervisor_id, data desc);
create index supervisoes_mentor_idx
  on public.supervisoes (mentor_id, data desc);
create index supervisoes_dupla_idx
  on public.supervisoes (dupla_id, data desc) where dupla_id is not null;

alter table public.supervisoes enable row level security;

-- superfície mínima: sem update — sessão registrada é fato; correção passa
-- por apagar e re-registrar (e apagar é só da coordenação)
grant select, insert, delete on public.supervisoes to authenticated;

-- leitura: coordenação tudo; o supervisor autor; o mentor sobre quem é a
-- sessão; e o supervisor das sessões vinculadas a duplas que ele supervisiona
-- (continuidade quando a sessão é de outro supervisor — troca no meio do ciclo)
drop policy if exists supervisoes_select on public.supervisoes;
create policy supervisoes_select on public.supervisoes for select using (
  public.my_role() = 'coordenacao'
  or supervisor_id = public.my_profile_id()
  or mentor_id = public.my_profile_id()
  or exists (
    select 1 from public.duplas d
    where d.id = supervisoes.dupla_id
      and d.supervisor_id = public.my_profile_id()
  )
);

-- escrita: só o supervisor, nas próprias (autoria = a si mesmo)
drop policy if exists supervisoes_insert on public.supervisoes;
create policy supervisoes_insert on public.supervisoes for insert
  with check (
    public.my_role() = 'supervisor'
    and supervisor_id = public.my_profile_id()
  );

-- delete só da coordenação — moderação (mesmo desenho de comunicados: quem
-- escreveu errado pede pra coordenação apagar e registra de novo)
drop policy if exists supervisoes_delete on public.supervisoes;
create policy supervisoes_delete on public.supervisoes for delete
  using (public.my_role() = 'coordenacao');

-- created_by vem do token, não do cliente (padrão stamp_solicitacao_autor, 0027)
create or replace function public.stamp_supervisao_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null then
    new.created_by := public.my_profile_id();
  elsif new.created_by <> public.my_profile_id()
        and public.my_role() <> 'coordenacao' then
    raise exception 'created_by não pode ser forjado';
  end if;
  return new;
end $$;
drop trigger if exists supervisoes_autor on public.supervisoes;
create trigger supervisoes_autor
  before insert on public.supervisoes
  for each row execute function public.stamp_supervisao_autor();

-- o mentor é avisado no sino — fecha o ciclo da transparência. Tipo novo no
-- check + ramo na policy de insert: o supervisor só notifica um mentor com
-- quem tem sessão registrada (a row de supervisoes entra antes da notificação
-- na mesma ação, então o exists já a enxerga).
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada',
    'especialista_aceitou', 'solicitacao_cancelada', 'trilha_encerrada',
    'supervisao_registrada'
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
        or (tipo = 'supervisao_registrada'
            and public.my_role() = 'supervisor'
            and exists (
              select 1 from public.supervisoes s
              where s.supervisor_id = public.my_profile_id()
                and s.mentor_id = profile_id))
      )
    )
  );

commit;
