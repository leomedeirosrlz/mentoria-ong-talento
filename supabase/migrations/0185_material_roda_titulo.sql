-- 0185 — título canônico da Roda da Vida + flip "doc:<slug>" pendente +
-- cap do bucket de evidências.
--
-- (a) REALIZA-362: o material "Roda da Vida: roteiro de aplicação" vira
--     "Roda da Vida (instrumento)", o nome que o catálogo usa pro doc
--     nativo.
-- (b) REALIZA-368: o seed já declara path "doc:<slug>" pros 16 roteiros e
--     pros instrumentos de corpus (Roda, Definindo Metas) — em prod eles
--     continuavam apontando pro PDF embutido. O código já rende "doc:"
--     nativo em /materiais/documento/<slug>; era drift de dado, não de
--     código. Updates casados por título/encontro_num e limitados a
--     path "materiais/%" — rodar duas vezes é no-op.
-- (c) REALIZA-66: o client comprime a foto e barra acima de 50 MB antes
--     de subir, mas quem garante o teto é o bucket — file_size_limit +
--     allowlist de MIME fecham a validação do lado do servidor.

begin;

update public.materiais
  set titulo = 'Roda da Vida (instrumento)'
  where titulo = 'Roda da Vida: roteiro de aplicação';

update public.materiais
  set path = 'doc:instrumento-roda-da-vida'
  where titulo = 'Roda da Vida (instrumento)'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:instrumento-definindo-minhas-metas'
  where titulo = 'Instrumento: Definindo Metas'
    and path like 'materiais/%';

update public.materiais
  set path = 'doc:roteiro-encontro-' || lpad(encontro_num::text, 2, '0')
  where titulo like 'Roteiro Semana %'
    and encontro_num between 1 and 16
    and path like 'materiais/%';

update storage.buckets
  set file_size_limit = 52428800, -- 50 MB, mesmo teto do plano
      allowed_mime_types = array[
        'application/pdf', 'image/png', 'image/jpeg', 'image/webp'
      ]
  where id = 'registro-anexos';

commit;
