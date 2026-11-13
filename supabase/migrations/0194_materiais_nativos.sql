-- 0194 — REALIZA-380: catálogo de materiais 100% nativo. Os 5 paths de
-- PDF que restavam (os dois guias de mentor, Perguntas Eficazes e os
-- cronogramas por turma) têm documento do corpus (docs/rag/*.md, chave
-- `material` do frontmatter) servido em /materiais/documento/<slug> —
-- o mesmo flip que a 0185 fez nos roteiros e instrumentos. Era drift de
-- dado, não de código. Updates casados por título e limitados a
-- path "materiais/%" — rodar duas vezes é no-op.

begin;

update public.materiais
  set path = 'doc:guia-mentor-dpp'
  where titulo = 'Guia do Mentor DPP'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:guia-mentor-especialista'
  where titulo = 'Guia do Mentor Especialista'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:perguntas-eficazes'
  where titulo = 'Perguntas Eficazes'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:ciclo-cronograma'
  where titulo = 'Cronograma do programa — Turma 1'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:ciclo-turma2-cronograma'
  where titulo = 'Cronograma do programa — Turma 2'
    and path like 'materiais/%';

commit;
