-- 0141 — perf: índices em FKs sem cobertura + auth_rls_initplan.
-- Aditivo: create index if not exists (sem lock de tabela longo em tabelas pequenas).
-- Recria 3 policies substituindo auth.uid()/current_setting() por (select ...)
-- para evitar re-avaliação por linha (advisor auth_rls_initplan).

-- ========== índices em FKs (advisor unindexed_foreign_keys) ==========
create index if not exists idx_assinaturas_created_by on public.assinaturas (created_by);
create index if not exists idx_assinaturas_template_id on public.assinaturas (template_id);
create index if not exists idx_avaliacao_links_dupla_id on public.avaliacao_links (dupla_id);
create index if not exists idx_avaliacao_links_respondido_por on public.avaliacao_links (respondido_por_profile_id);
create index if not exists idx_avaliacoes_encontro_respondido_por on public.avaliacoes_encontro (respondido_por_profile_id);
create index if not exists idx_chamado_anexos_created_by on public.chamado_anexos (created_by);
create index if not exists idx_chamado_atualizacoes_autor_id on public.chamado_atualizacoes (autor_id);
create index if not exists idx_chamado_comentarios_autor_id on public.chamado_comentarios (autor_id);
create index if not exists idx_chamados_dupla_id on public.chamados (dupla_id);
create index if not exists idx_chamados_resolvido_por on public.chamados (resolvido_por);
create index if not exists idx_comunicados_created_by on public.comunicados (created_by);
create index if not exists idx_cronogramas_created_by on public.cronogramas (created_by);
create index if not exists idx_devolutivas_autor_id on public.devolutivas (autor_id);
create index if not exists idx_documentos_pessoa_created_by on public.documentos_pessoa (created_by);
create index if not exists idx_dupla_eventos_por on public.dupla_eventos (por);
create index if not exists idx_duplas_desfecho_por on public.duplas (desfecho_por);
create index if not exists idx_duplas_solicitacao_id on public.duplas (solicitacao_id);
create index if not exists idx_emails_enviados_autor_id on public.emails_enviados (autor_id);
create index if not exists idx_encaminhamentos_registro_id on public.encaminhamentos (registro_id);
create index if not exists idx_encerramentos_decidido_por on public.encerramentos (decidido_por);
create index if not exists idx_encontro_notas_created_by on public.encontro_notas (created_by);
create index if not exists idx_encontros_created_by on public.encontros (created_by);
create index if not exists idx_formulario_links_created_by on public.formulario_links (created_by);
create index if not exists idx_formulario_links_dupla_id on public.formulario_links (dupla_id);
create index if not exists idx_formulario_links_respondido_por on public.formulario_links (respondido_por_profile_id);
create index if not exists idx_formulario_respostas_promovido_mentorado on public.formulario_respostas (promovido_mentorado_id);
create index if not exists idx_formulario_respostas_promovido_profile on public.formulario_respostas (promovido_profile_id);
create index if not exists idx_formularios_created_by on public.formularios (created_by);
create index if not exists idx_interacoes_autor_id on public.interacoes (autor_id);
create index if not exists idx_notificacoes_created_by on public.notificacoes (created_by);
create index if not exists idx_pdm_itens_created_by on public.pdm_itens (created_by);
create index if not exists idx_pdm_itens_parent_id on public.pdm_itens (parent_id);
create index if not exists idx_pessoa_notas_created_by on public.pessoa_notas (created_by);
create index if not exists idx_presencas_marcado_por on public.presencas (marcado_por);
create index if not exists idx_registro_anexos_created_by on public.registro_anexos (created_by);
create index if not exists idx_registro_anexos_registro_id on public.registro_anexos (registro_id);
create index if not exists idx_registro_tentativas_profile_id on public.registro_tentativas (profile_id);
create index if not exists idx_registro_tentativas_registro_id on public.registro_tentativas (registro_id);
create index if not exists idx_registros_created_by on public.registros (created_by);
create index if not exists idx_relatorio_links_criado_por on public.relatorio_links (criado_por);
create index if not exists idx_relatorio_links_revogado_por on public.relatorio_links (revogado_por);
create index if not exists idx_resumo_acessos_link_id on public.resumo_acessos (link_id);
create index if not exists idx_solicitacao_propostas_autor_id on public.solicitacao_propostas (autor_id);
create index if not exists idx_solicitacoes_especialista_created_by on public.solicitacoes_especialista (created_by);
create index if not exists idx_solicitacoes_especialista_dupla_dpp_id on public.solicitacoes_especialista (dupla_dpp_id);
create index if not exists idx_solicitacoes_especialista_dupla_id on public.solicitacoes_especialista (dupla_id);
create index if not exists idx_solicitacoes_especialista_esp_desejado on public.solicitacoes_especialista (especialista_desejado_id);
create index if not exists idx_solicitacoes_especialista_mentorado_id on public.solicitacoes_especialista (mentorado_id);
create index if not exists idx_supervisoes_created_by on public.supervisoes (created_by);
create index if not exists idx_terceiros_consolidacao_escrito_por on public.terceiros_consolidacao (escrito_por);
create index if not exists idx_terceiros_contatos_created_by on public.terceiros_contatos (created_by);
create index if not exists idx_turma_inscricoes_created_by on public.turma_inscricoes (created_by);

-- FKs de alto tráfego adicionais (não listadas pelo advisor mas quentes)
create index if not exists idx_encontros_dupla_id on public.encontros (dupla_id);
create index if not exists idx_mentorados_profile_id on public.mentorados (profile_id);

-- ========== auth_rls_initplan: recriar policies com (select ...) ==========
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to public
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and role = my_role());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or my_role() = 'coordenacao'::app_role
    or (
      my_role() = any (array['supervisor'::app_role, 'mentor_dpp'::app_role, 'mentor_especialista'::app_role])
      and (role <> 'mentorado'::app_role or jovem_relacionado(id))
    )
  );

drop policy if exists sol_update on public.solicitacoes_especialista;
create policy sol_update on public.solicitacoes_especialista
  for update to public
  using (
    my_role() = 'coordenacao'::app_role
    or (select current_setting('realiza.sol_transicao'::text, true)) = 'on'::text
  )
  with check (
    my_role() = 'coordenacao'::app_role
    or (select current_setting('realiza.sol_transicao'::text, true)) = 'on'::text
  );
