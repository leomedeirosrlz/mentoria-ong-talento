-- 0063 — linhagem de remanejamento de duplas (REALIZA-100).
--
-- Quando um lado da dupla é substituído (desistência, remanejo), a dupla
-- antiga é encerrada e a nova nasce herdando turma/cronograma/equipe. Este
-- campo liga a dupla nova à que ela substituiu — histórico e navegação sem
-- mexer no histórico da encerrada (encontros/registros ficam nela).

alter table public.duplas
  add column if not exists remanejada_de uuid references public.duplas(id);

comment on column public.duplas.remanejada_de is
  'Dupla encerrada que esta substituiu num remanejamento. NULL = dupla original.';

create index if not exists duplas_remanejada_de_idx
  on public.duplas (remanejada_de)
  where remanejada_de is not null;
