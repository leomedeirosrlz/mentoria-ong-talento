-- WP3 · REALIZA-134/135 — trilha_do_jovem: projeção das trilhas de especialista
-- do mentorado para o mentor DPP da dupla informada.
--
-- Visibilidade decidida (Thiago, out/2026 — reconcilia REALIZA-134 vs 135):
-- COMPLETA. O DPP vê datas/estados das sessões, o registro integral do
-- especialista, a ★ que o jovem deu por sessão e as devolutivas da trilha.
-- Continua fora: link da sessão (o DPP acompanha, não participa — sem botão
-- de entrar) e os campos de avaliação do jovem além da nota (sentimento/
-- comentário/temas/avancei/pedir_apoio identificam o avaliador — a ★ por
-- sessão foi liberada por decisão explícita).
--
-- Validação: o chamador precisa ser mentor, supervisor da dupla DPP ou
-- coordenação — mesmo predicado do ramo 2 da solicitacoes_mural (0087).
-- Vínculo é status-agnóstico (convenção jovem_relacionado 0076 / mural 0087):
-- quem já foi mentor/supervisor da dupla lê — a ficha do jovem já o libera.
-- ATENÇÃO ao gate: supervisor_id é nullable e my_profile_id() pode vir NULL —
-- `or`-chain avalia NULL e `if not (NULL)` NÃO dispara. Por isso `is not true`
-- (mesmo defeito corrigido em 0093 pras RPCs 0080/0090).

create or replace function public.trilha_do_jovem(p_dupla_dpp_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dpp record;
  v_me  uuid := public.my_profile_id();
begin
  select d.id, d.trilha, d.mentor_id, d.supervisor_id, d.mentorado_id
    into v_dpp
    from public.duplas d
   where d.id = p_dupla_dpp_id;

  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if coalesce(v_dpp.trilha, 'dpp') <> 'dpp'
     or (v_dpp.mentor_id = v_me
         or v_dpp.supervisor_id = v_me
         or public.has_papel('coordenacao'::public.app_role)) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'dupla_id',            ed.id,
               'especialista_nome',   ep.nome,
               'demanda',             ed.demanda,
               'status',              ed.status,
               'iniciada_em',         ed.iniciada_em,
               'encerrada_em',        ed.encerrada_em,
               'motivo_encerramento', ed.motivo_encerramento,
               'devolutiva_pdm',      ed.devolutiva_pdm,
               'sessoes', coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'id',           e.id,
                            'numero',       e.numero,
                            'data_hora',    e.data_hora,
                            'realizado_em', e.realizado_em,
                            'status',       e.status,
                            'duracao_min',  e.duracao_min,
                            'motivo_reagendamento', e.motivo_reagendamento,
                            'estrelas',     av.estrelas,
                            'registro', case
                              when r.id is null then null
                              else jsonb_build_object(
                                'id',                    r.id,
                                'tema',                  r.tema,
                                'ferramenta',            r.ferramenta,
                                'atividades',            r.atividades,
                                'avaliacao',             r.avaliacao,
                                'dificuldade',           r.dificuldade,
                                'dificuldade_detalhe',   r.dificuldade_detalhe,
                                'reflexoes',             r.reflexoes,
                                'observacoes',           r.observacoes,
                                'proximo_passo',         r.proximo_passo,
                                'proximo_passo_detalhe', r.proximo_passo_detalhe,
                                'precisa_apoio',         r.precisa_apoio,
                                'created_at',            r.created_at,
                                'anexos', coalesce((
                                  select jsonb_agg(
                                           jsonb_build_object(
                                             'nome',    an.nome,
                                             'tamanho', an.tamanho,
                                             'mime',    an.mime
                                           ) order by an.created_at
                                         )
                                    from public.registro_anexos an
                                   where an.registro_id = r.id
                                ), '[]'::jsonb)
                              )
                            end
                          ) order by e.numero
                        )
                   from public.encontros e
                   left join public.registros r on r.encontro_id = e.id
                   left join public.avaliacoes_encontro av on av.encontro_id = e.id
                  where e.dupla_id = ed.id
               ), '[]'::jsonb),
               'devolutivas', coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'autor_nome', ap.nome,
                            'texto',      dv.texto,
                            'created_at', dv.created_at
                          ) order by dv.created_at
                        )
                   from public.devolutivas dv
                   left join public.profiles ap on ap.id = dv.autor_id
                  where dv.dupla_id = ed.id
               ), '[]'::jsonb)
             ) order by ed.iniciada_em desc nulls last
           )
      from public.duplas ed
      left join public.profiles ep on ep.id = ed.mentor_id
     where ed.mentorado_id = v_dpp.mentorado_id
       and ed.trilha = 'especialista'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.trilha_do_jovem(uuid) from public, anon;
grant execute on function public.trilha_do_jovem(uuid) to authenticated;
