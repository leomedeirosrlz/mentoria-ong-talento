-- 0155 · REALIZA-313 — drop completo da feature "supervisões" (sessões
-- supervisor↔mentor registradas na tabela supervisoes, 0041). A superfície
-- saiu do app no 5bb4d9f; ficavam os objetos de banco. Thiago decidiu o drop
-- (02/nov): a tabela virou beco sem saída — nada mais a alimenta.
--
-- O que FICA (é infra viva, não é esta feature):
--   · supervisiona_dupla(uuid) — escopo do auxiliar por turma (0125); lê
--     duplas.supervisor_id + profile_papeis, nunca esta tabela
--   · o papel supervisor, duplas.supervisor_id, escopo_supervisao
--
-- Dependências reais conferidas em staging (pg_depend/pg_policy):
--   · policy notificacoes_insert tem ramo EXISTS supervisoes → recriada sem ele
--   · check notificacoes_tipo_check lista 'supervisao_registrada' → sai do check
--   · 1 notificação órfã do tipo → removida junto (o tipo morre)
--   · trigger supervisoes_autor + stamp_supervisao_autor + policies próprias
--     caem com a tabela
-- Sem views/matviews/FKs de fora apontando pra cá.
begin;

-- 1. policy de notificações sem o ramo que lê supervisoes
drop policy if exists notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert
  with check (
    public.has_papel('coordenacao')
    or (
      created_by = public.my_profile_id()
      and (
        (tipo in ('encontro_marcado', 'encontro_alterado', 'encontro_desfeito')
          and public.par_de_mim(profile_id))
        or (tipo = 'pedido_apoio' and exists (
          select 1 from public.profiles p
          where p.id = profile_id
            and (public.has_papel(p.id, 'coordenacao')
                 or public.has_papel(p.id, 'supervisor'))))
        or (tipo = 'pedido_apoio' and public.has_papel('mentorado') and exists (
          select 1 from public.jovem_contatos jc
          where jc.id = profile_id))
        or (tipo = 'demanda_especialista'
            and public.has_papel(profile_id, 'mentor_especialista'))
        or (tipo in ('solicitacao_registrada', 'solicitacao_cancelada') and exists (
          select 1 from public.profiles p
          where p.id = profile_id and public.has_papel(p.id, 'coordenacao')))
        or (tipo = 'especialista_aceitou'
            and public.has_papel('mentor_especialista')
            and (
              exists (select 1 from public.profiles p
                      where p.id = profile_id
                        and public.has_papel(p.id, 'coordenacao'))
              or exists (select 1 from public.solicitacoes_especialista s
                         where s.created_by = profile_id
                           and s.especialista_id = public.my_profile_id())
            ))
        or (tipo = 'trilha_encerrada'
            and public.has_papel('mentor_especialista')
            and (
              exists (select 1 from public.profiles p
                      where p.id = profile_id
                        and public.has_papel(p.id, 'coordenacao'))
              or exists (select 1 from public.solicitacoes_especialista s
                         where s.created_by = profile_id
                           and s.especialista_id = public.my_profile_id())
            ))
      )
    )
  );

-- 2. notificações do tipo morto somem (o check a seguir deixa de aceitá-las)
delete from public.notificacoes where tipo = 'supervisao_registrada';

-- 3. tipo sai do check
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'comunicado', 'pedido_apoio', 'apoio_resolvido', 'dupla_formada',
    'demanda_especialista', 'solicitacao_registrada', 'especialista_aceitou',
    'solicitacao_cancelada', 'trilha_encerrada', 'formulario_respondido',
    'avaliacao_pendente', 'apoio_jovem', 'encontro_marcado',
    'encontro_alterado', 'encontro_desfeito', 'solicitacao_triagem',
    'solicitacao_recusada', 'solicitacao_proposta', 'chamado_aberto',
    'chamado_atribuido', 'chamado_atualizacao', 'chamado_resposta_autor',
    'chamado_resolvido', 'chamado_reaberto', 'chamado_mencao',
    'sugestao_especialista', 'devolutiva_especialista', 'lembrete',
    'dupla_reta_final', 'terceiro_respondeu', 'trilha_prazo',
    'trilha_prazo_coord'
  ));

-- 4. a tabela e o que pendurava nela
drop trigger if exists supervisoes_autor on public.supervisoes;
drop function if exists public.stamp_supervisao_autor();
drop table public.supervisoes;

commit;
