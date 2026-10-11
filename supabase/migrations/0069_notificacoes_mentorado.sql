-- REALIZA-107 fase C (fix 2) — "pedir ajuda" do jovem.
--
-- O plano assumia que o ramo `pedido_apoio` de notificacoes_insert cobriria o
-- mentorado de graça — não cobre: o `exists (select 1 from profiles p ...)`
-- do with_check é avaliado sob o RLS do invoker (mesma lição da 0068), e o
-- jovem não tem SELECT em profiles além do self.
--
-- O ramo novo é melhor que o genérico: em vez de "qualquer coord/supervisor",
-- o destinatário é validado contra `jovem_contatos` — os adultos das próprias
-- duplas dele + coordenação. O jovem não pode plantar pedido_apoio pra um
-- supervisor aleatório, só pros adultos que a plataforma já lhe apresenta.
--
-- with_check reescrito na íntegra (política única, sem ramos soltos): os
-- outros caminhos ficam semanticamente idênticos ao texto normalizado atual.

begin;

drop policy if exists notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert with check (
  public.my_role() = 'coordenacao'
  or (created_by = public.my_profile_id() and (
    (tipo = 'pedido_apoio' and exists (
      select 1 from public.profiles p
      where p.id = notificacoes.profile_id
        and p.role in ('coordenacao','supervisor')))
    -- mentorado: mesmo tipo, destinatário escopado aos próprios adultos.
    or (tipo = 'pedido_apoio' and public.my_role() = 'mentorado' and exists (
      select 1 from public.jovem_contatos jc
      where jc.id = notificacoes.profile_id))
    or (tipo = 'demanda_especialista' and exists (
      select 1 from public.profiles p
      where p.id = notificacoes.profile_id
        and p.role = 'mentor_especialista'))
    or (tipo in ('solicitacao_registrada','solicitacao_cancelada') and exists (
      select 1 from public.profiles p
      where p.id = notificacoes.profile_id
        and p.role = 'coordenacao'))
    or (tipo = 'especialista_aceitou' and public.my_role() = 'mentor_especialista' and (
      exists (select 1 from public.profiles p
              where p.id = notificacoes.profile_id and p.role = 'coordenacao')
      or exists (select 1 from public.solicitacoes_especialista s
                 where s.created_by = notificacoes.profile_id
                   and s.especialista_id = public.my_profile_id())))
    or (tipo = 'trilha_encerrada' and public.my_role() = 'mentor_especialista' and (
      exists (select 1 from public.profiles p
              where p.id = notificacoes.profile_id and p.role = 'coordenacao')
      or exists (select 1 from public.solicitacoes_especialista s
                 where s.created_by = notificacoes.profile_id
                   and s.especialista_id = public.my_profile_id())))
    or (tipo = 'supervisao_registrada' and public.my_role() = 'supervisor' and exists (
      select 1 from public.supervisoes s
      where s.supervisor_id = public.my_profile_id()
        and s.mentor_id = notificacoes.profile_id))
  ))
);

commit;
