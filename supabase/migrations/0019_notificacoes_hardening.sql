-- hardening pós-auditoria do 0018.
--
-- 1) href: '/%' aceitava '//evil.com' e '/\evil.com' — ambos viram navegação
--    externa no router.push do sino. Regex exige '/' seguido de não-barra e
--    não-backslash ('/' sozinho continua válido).
alter table public.notificacoes drop constraint notificacoes_href_check;
alter table public.notificacoes add constraint notificacoes_href_check
  check (href is null or href = '/' or href ~ '^/[^/\\]');

-- 2) insert por não-coord: antes bastava o destinatário ser staff — permitia
--    forjar tipo='comunicado', created_by alheio e flood. Agora exige o fluxo
--    legítimo: pedido_apoio, autoria própria, destino staff.
drop policy notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert
  with check (
    public.my_role() = 'coordenacao'
    or (
      tipo = 'pedido_apoio'
      and created_by = public.my_profile_id()
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.role in ('coordenacao', 'supervisor')
      )
    )
  );

-- 3) update: destinatário só pode marcar lida — antes dava pra reescrever
--    título/corpo/href da própria row. Trigger barra qualquer outra coluna.
create or replace function public.guard_notificacao_update()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.profile_id is distinct from old.profile_id
     or new.tipo is distinct from old.tipo
     or new.titulo is distinct from old.titulo
     or new.corpo is distinct from old.corpo
     or new.href is distinct from old.href
     or new.comunicado_id is distinct from old.comunicado_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'notificacao: apenas lida_em pode ser alterada';
  end if;
  return new;
end $$;
create trigger notificacoes_guard_update
  before update on public.notificacoes
  for each row execute function public.guard_notificacao_update();

-- 4) delete pra coordenação — resposta a incidente (remove ping envenenado/spam).
create policy notificacoes_delete on public.notificacoes for delete
  using (public.my_role() = 'coordenacao');

-- 5) índice da FK do cascade — excluir comunicado varre notificacoes sem ele.
create index notificacoes_comunicado_idx
  on public.notificacoes (comunicado_id);

-- 6) comunicados 'todos' era legível por anon/sem-papel/desativado — exige papel.
drop policy comunicados_select on public.comunicados;
create policy comunicados_select on public.comunicados for select using (
  public.my_role() is not null and (
    audiencia = 'todos'
    or public.my_role() = 'coordenacao'
    or (audiencia = 'dpp' and public.my_role() = 'mentor_dpp')
    or (audiencia = 'especialista' and public.my_role() = 'mentor_especialista')
    or (audiencia = 'equipe' and public.my_role() = 'supervisor')
  )
);

-- 7) autoria do aviso não é forjável: quem publica é quem assina.
drop policy comunicados_insert on public.comunicados;
create policy comunicados_insert on public.comunicados for insert
  with check (
    public.my_role() = 'coordenacao'
    and created_by = public.my_profile_id()
  );

-- 8) audiência 'equipe' = coordenação + supervisores (aviso interno sem pingar
--    mentores — ex.: reunião de supervisão). 'coordenacao' segue só-coord.
alter table public.comunicados drop constraint comunicados_audiencia_check;
alter table public.comunicados add constraint comunicados_audiencia_check
  check (audiencia in ('todos', 'dpp', 'especialista', 'coordenacao', 'equipe'));
