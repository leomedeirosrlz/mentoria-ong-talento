-- ===== re-match de mentorado após encerramento =====
-- unique(ciclo, mentorado_id) bloqueava uma nova dupla pro mesmo mentorado mesmo
-- depois de a anterior ser encerrada — o app permite o re-match (dupla encerrada
-- não ocupa vaga) e o insert explodia 23505 com mensagem genérica.
-- O índice parcial passa a refletir a regra de domínio: a vaga só conta enquanto
-- a dupla está ativa ou pausada; encerrada vira histórico e libera o re-match.
alter table public.duplas drop constraint duplas_ciclo_mentorado_id_key;

create unique index duplas_ciclo_mentorado_ativa_key
  on public.duplas (ciclo, mentorado_id)
  where status in ('ativa', 'pausada');
