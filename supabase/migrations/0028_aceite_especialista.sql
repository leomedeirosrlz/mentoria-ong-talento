-- 0028: aceite atômico da solicitação de especialista + canal de notificação
-- do fluxo (mentor DPP registra -> especialista aceita -> dupla nasce).
begin;

-- 1) tipos de notificação do fluxo — o check só tinha os 4 originais
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada',
    'especialista_aceitou', 'solicitacao_cancelada'
  ));

-- 2) insert de notificação por não-coord: antes só 'pedido_apoio' pra staff.
-- Os ramos novos espelham os fluxos legítimos da trilha — autoria própria
-- sempre, e o destinatário é escopado por papel ou pelo vínculo gravado na
-- solicitação (especialista só pinga quem pediu o que ELE aceitou + coord).
drop policy notificacoes_insert on public.notificacoes;
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
      )
    )
  );

-- 3) sol_insert não exigia status 'aberta': um mentor DPP podia inserir a
-- solicitação já 'aceita' com especialista_id/dupla_id forjados (o mural e o
-- chip acreditariam). A solicitação só nasce aberta e sem resposta.
drop policy if exists sol_insert on public.solicitacoes_especialista;
create policy sol_insert on public.solicitacoes_especialista for insert
  with check (
    (public.my_role() = 'coordenacao'
     or exists (
       select 1 from public.duplas d
       where d.id = dupla_dpp_id and d.mentor_id = public.my_profile_id()))
    and status = 'aberta'
    and especialista_id is null
    and dupla_id is null
    and respondida_em is null
  );

-- 4) aceite atômico. FOR UPDATE na solicitação serializa dois especialistas
-- clicando juntos — o segundo recebe o erro de domínio, não uma 2ª dupla.
-- security definer porque o especialista não tem grant de insert em duplas
-- (RLS: só a coordenação cria dupla) nem passaria no WITH CHECK do update
-- (a policy já permite o aceite direto, mas sem atomicidade com o insert).
create or replace function public.aceitar_solicitacao(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  nova uuid;
  meu uuid := public.my_profile_id();
begin
  -- IS DISTINCT FROM: my_role() é null pra quem não tem papel — e
  -- "null <> 'mentor_especialista'" avalia NULL, ou seja, o IF não barraria.
  if public.my_role() is distinct from 'mentor_especialista' then
    raise exception 'Só mentores especialistas podem aceitar demandas';
  end if;

  select * into s
    from public.solicitacoes_especialista
   where id = p_id
   for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;
  if s.status <> 'aberta' then
    raise exception 'Essa demanda não está mais aberta';
  end if;
  -- IS DISTINCT FROM pelo mesmo motivo: meu nunca é null aqui (o guard acima
  -- já exige profile com papel), mas o <> com null cairia em NULL
  if s.especialista_desejado_id is not null
     and s.especialista_desejado_id is distinct from meu then
    raise exception 'Essa demanda foi direcionada a outro especialista';
  end if;

  -- o trigger de capacidade (0025) serializa pelo FOR UPDATE na row do mentor
  -- em mentor_profiles: sem a row não há o que travar, e dois aceites
  -- concorrentes do mesmo especialista passariam juntos do cap implícito (1).
  -- Garante a row sem tocar em capacidade/áreas/validações já configuradas.
  insert into public.mentor_profiles (profile_id, tipo, capacidade)
  values (meu, 'especialista', 1)
  on conflict (profile_id) do nothing;

  insert into public.duplas (mentor_id, mentorado_id, trilha, demanda, solicitacao_id, iniciada_em)
    values (meu, s.mentorado_id, 'especialista', s.demanda, s.id, current_date)
    returning id into nova;

  update public.solicitacoes_especialista
     set status = 'aceita',
         especialista_id = meu,
         dupla_id = nova,
         respondida_em = now()
   where id = s.id;

  return nova;
end
$$;

revoke all on function public.aceitar_solicitacao(uuid) from public, anon;
grant execute on function public.aceitar_solicitacao(uuid) to authenticated;

commit;
