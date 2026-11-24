-- 0239 — diretório do jovem e catálogo staff de especialistas (REALIZA-523 UI/UX)
--
-- `jovem_diretorio`: diretório do programa para o papel mentorado — adultos
-- ativos, todos os jovens com conta (decisão do lead 24/11: inclusive menores
-- e foto) e o catálogo de especialistas. Dados civis, documentos, contato,
-- PDM e avaliações ficam fora da projeção; WhatsApp/e-mail continuam vindo
-- das views de rede (`jovem_contatos`), nunca desta.
-- `especialistas_catalogo`: a MESMA projeção de `jovem_especialistas`, com
-- gate staff, para o pool de sugestão/solicitação não driftar.
begin;

create or replace view public.jovem_diretorio as
with base as (
  -- adultos do programa (papel primário ou secundário), sem duplicar
  select p.id,
         'adulto'::text as tipo,
         p.nome,
         p.nome_social,
         p.avatar_path,
         p.role::text as papel,
         p.cidade,
         p.uf,
         p.interesses,
         p.areas,
         p.bio,
         p.cargo,
         p.empresa,
         null::text as experiencia_previa,
         null::text as formacao_externa,
         p.voluntariado,
         null::text[] as grade_resumo,
         null::int as vagas,
         exists (select 1 from public.jovem_contatos c where c.id = p.id) as minha_rede,
         false as minha_turma,
         1 as prioridade
    from public.profiles p
   where p.ativo
     and (public.has_papel(p.id, 'mentor_dpp'::public.app_role)
          or public.has_papel(p.id, 'mentor_especialista'::public.app_role)
          or public.has_papel(p.id, 'supervisor'::public.app_role)
          or public.has_papel(p.id, 'coordenacao'::public.app_role))
  union all
  -- todos os jovens com conta no programa (não só a mesma turma)
  select m.id,
         'jovem'::text as tipo,
         m.nome,
         m.nome_social,
         m.avatar_path,
         'mentorado'::text as papel,
         m.cidade,
         m.uf,
         m.interesses,
         null::text[] as areas,
         null::text as bio,
         null::text as cargo,
         null::text as empresa,
         null::text as experiencia_previa,
         null::text as formacao_externa,
         null::text as voluntariado,
         null::text[] as grade_resumo,
         null::int as vagas,
         exists (
           select 1 from public.mentorados_turma t where t.id = m.id
         ) as minha_rede,
         exists (
           select 1
             from public.duplas minha
             join public.duplas colega
               on colega.mentorado_id = m.id
              and colega.turma = minha.turma
            where minha.mentorado_id = public.my_mentorado_id()
              and minha.turma is not null
         ) as minha_turma,
         2 as prioridade
    from public.mentorados m
   where m.profile_id is not null
     and m.id is distinct from public.my_mentorado_id()
  union all
  -- catálogo de especialistas (inclui grade_resumo e vagas)
  select e.id,
         'especialista'::text as tipo,
         e.nome,
         e.nome_social,
         e.avatar_path,
         'mentor_especialista'::text as papel,
         e.cidade,
         e.uf,
         null::text[] as interesses,
         e.areas,
         e.bio,
         e.cargo,
         e.empresa,
         e.experiencia_previa,
         e.formacao_externa,
         e.voluntariado,
         e.grade_resumo,
         e.vagas,
         false as minha_rede,
         false as minha_turma,
         0 as prioridade
    from public.jovem_especialistas e
)
select distinct on (id)
       id, tipo, nome, nome_social, avatar_path, papel, cidade, uf,
       interesses, areas, bio, cargo, empresa, experiencia_previa,
       formacao_externa, voluntariado, grade_resumo, vagas,
       minha_rede, minha_turma
  from base
 where public.my_role() = 'mentorado'::public.app_role
 order by id, prioridade;

revoke all on public.jovem_diretorio from public, anon;
grant select on public.jovem_diretorio to authenticated;

create or replace view public.especialistas_catalogo as
SELECT p.id,
    p.nome,
    p.nome_social,
    p.avatar_path,
    p.areas,
    p.bio,
    p.cargo,
    p.empresa,
    p.cidade,
    p.uf,
    p.voluntariado,
    mp.experiencia_previa,
    mp.formacao_externa,
    ( SELECT array_agg(x.lbl ORDER BY x.dow, x.per_ord) AS array_agg
           FROM ( SELECT DISTINCT g.dia_semana AS dow,
                        CASE pp.per
                            WHEN 'manha'::text THEN 1
                            WHEN 'tarde'::text THEN 2
                            ELSE 3
                        END AS per_ord,
                        CASE g.dia_semana
                            WHEN 0 THEN 'dom'::text
                            WHEN 1 THEN 'seg'::text
                            WHEN 2 THEN 'ter'::text
                            WHEN 3 THEN 'qua'::text
                            WHEN 4 THEN 'qui'::text
                            WHEN 5 THEN 'sex'::text
                            ELSE 'sáb'::text
                        END ||
                        CASE pp.per
                            WHEN 'manha'::text THEN ' de manhã'::text
                            WHEN 'tarde'::text THEN ' à tarde'::text
                            ELSE ' à noite'::text
                        END AS lbl
                   FROM especialista_grade g
                     CROSS JOIN LATERAL ( SELECT unnest(ARRAY[
                                CASE
                                    WHEN g.hora_inicio < '12:00:00'::time without time zone THEN 'manha'::text
                                    ELSE NULL::text
                                END,
                                CASE
                                    WHEN g.hora_inicio < '18:00:00'::time without time zone AND g.hora_fim > '12:00:00'::time without time zone THEN 'tarde'::text
                                    ELSE NULL::text
                                END,
                                CASE
                                    WHEN g.hora_fim > '18:00:00'::time without time zone THEN 'noite'::text
                                    ELSE NULL::text
                                END]) AS per) pp
                  WHERE pp.per IS NOT NULL AND g.profile_id = p.id) x) AS grade_resumo,
    GREATEST(0::bigint, COALESCE(mp.capacidade_especialista::integer, 1) - (( SELECT count(*) AS count
           FROM duplas d
          WHERE d.mentor_id = p.id AND d.trilha = 'especialista'::text AND (d.status = ANY (ARRAY['ativa'::dupla_status, 'pausada'::dupla_status])))))::integer AS vagas
   FROM profiles p
     LEFT JOIN mentor_profiles mp ON mp.profile_id = p.id
  WHERE p.ativo
    AND my_role() IN ('coordenacao'::app_role, 'mentor_dpp'::app_role,
                      'mentor_especialista'::app_role, 'supervisor'::app_role)
    AND has_papel(p.id, 'mentor_especialista'::app_role)
;

revoke all on public.especialistas_catalogo from public, anon;
grant select on public.especialistas_catalogo to authenticated;

commit;
