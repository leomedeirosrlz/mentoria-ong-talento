-- 0167 — audiência dos materiais por papel (auditoria nov/2026)
--
-- O catálogo divergia do corpus (frontmatter docs/rag) e do chat:
--   * supervisor (auxiliar executivo) só via `todos` — não abria guia,
--     roteiros, cronogramas nem modelos que acompanha nas duplas DPP
--   * Feedback Construtivo (instrumento de fala do mentor) aparecia ao jovem
--   * Formação EaD ia a todos, mas é trilha de mentores e mentorados
--
-- Só dados: a policy da 0139 já cobre supervisor/mentorado. Idempotente —
-- os filtros pulam rows já ajustadas. `audiencia` (legado de valor único)
-- acompanha a regra de audienciaLegada (materiais.ts).
begin;

-- 1. material de mentor (DPP e especialista) passa a servir o supervisor
update public.materiais
   set audiencias = array_append(audiencias, 'supervisor')
 where audiencias && array['mentor_dpp', 'mentor_especialista']
   and not ('supervisor' = any (audiencias))
   and not ('todos' = any (audiencias));

-- 2. Feedback Construtivo: equipe e mentores, sem o jovem
update public.materiais
   set audiencias = array['coordenacao', 'supervisor', 'mentor_dpp', 'mentor_especialista'],
       audiencia = 'dpp'
 where titulo = 'Feedback Construtivo'
   and audiencias = array['todos'];

-- 3. Formação EaD: mentores e mentorados (sai coordenação/supervisor via todos)
update public.materiais
   set audiencias = array['mentor_dpp', 'mentor_especialista', 'mentorado'],
       audiencia = 'dpp'
 where titulo = 'Formação EaD gratuita'
   and audiencias = array['todos'];

commit;
