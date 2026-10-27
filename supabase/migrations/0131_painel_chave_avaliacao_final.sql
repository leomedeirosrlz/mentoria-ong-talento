-- 0131 · Chave do painel para a avaliação final (REALIZA-230)
--
-- A 0130 trocou o sistema que alimenta a estação do encontro 16 (de
-- `avaliacao_360` para `avaliacao_final_mentorado`), mas o painel agrega
-- as entregas com `jsonb_object_agg(f.sistema, …)`: sem apelido, a chave
-- do payload viraria o nome novo e a jornada — que lê `entregas.
-- avaliacao_360` desde a 0096, junto com `jovem_jornada` — perderia a
-- entrega. O slot da jornada continua sendo `avaliacao_360`; o nome do
-- formulário é que mudou.
--
-- Função re-emitida com o mínimo: o SELECT ganha o CASE e o GROUP BY passa
-- a agrupar pela expressão (ordinal 1).

CREATE OR REPLACE FUNCTION public.painel_instrumentos_jornada()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (
    public.my_role() = 'coordenacao'
    or public.has_papel('supervisor'::public.app_role)
  ) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'dupla_id', d.id,
        'turma', d.turma,
        'cronograma_id', d.cronograma_id,
        'mentor_id', d.mentor_id,
        'mentor_nome', coalesce(pm.nome_social, pm.nome),
        'mentorado_id', d.mentorado_id,
        'jovem_nome', coalesce(m.nome_social, m.nome),
        'entregas', coalesce((
          select jsonb_object_agg(x.sistema, x.entregas)
            from (
              -- a chave da entrega é o SLOT da jornada ('avaliacao_360'),
              -- não o nome do formulário — a jornada e a ficha leem a
              -- mesma chave desde a 0096
              select case when f.sistema = 'avaliacao_final_mentorado'
                          then 'avaliacao_360' else f.sistema end as sistema,
                     jsonb_agg(jsonb_build_object(
                       'status', case
                         when l.usado_em is not null then 'respondido'
                         when l.expira_em is not null and l.expira_em < now()
                           then 'expirado'
                         else 'pendente' end,
                       'created_at', l.created_at,
                       'destino', case
                         when l.dest_mentorado_id is not null then 'mentorado'
                         else 'mentor' end,
                       -- momento (inicial×formal) via a mesma whitelist —
                       -- sem contexto o painel diverge da jornada no corte
                       'contexto', coalesce((
                         select jsonb_object_agg(cx.key, cx.value)
                           from jsonb_each(l.contexto) as cx(key, value)
                          where cx.key in ('origem','momento','encontro','dupla_id')
                       ), '{}'::jsonb)
                     ) order by l.created_at) as entregas
                from formularios f
                join formulario_links l
                  on l.formulario_id = f.id
                 and l.dupla_id = d.id
                 and (l.dest_mentorado_id = d.mentorado_id
                      or l.dest_profile_id = d.mentor_id)
               where f.sistema in ('visao','metas','pdm','roda_vida','avaliacao_final_mentorado')
               group by 1
            ) x
        ), '{}'::jsonb),
        'avaliacoes_encontro', (
          select jsonb_build_object(
            'feitas', count(a.id),
            'realizados', count(e.id),
            -- posição real da dupla (não a da coorte): dupla tardia tem
            -- janela ainda aberta mesmo com a turma lá na frente
            'max_numero', max(e.numero)
          )
            from encontros e
            left join avaliacoes_encontro a on a.encontro_id = e.id
           where e.dupla_id = d.id
             and e.status = 'realizado'
        )
      )
      order by d.turma, coalesce(m.nome_social, m.nome)
    )
      from duplas d
      join profiles pm on pm.id = d.mentor_id
      join mentorados m on m.id = d.mentorado_id
     where d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
       and (
         public.my_role() = 'coordenacao'
         or public.supervisiona_dupla(d.id)
       )
  ), '[]'::jsonb);
end $function$;
