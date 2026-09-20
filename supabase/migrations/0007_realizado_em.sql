-- ===== registro retroativo: quando o encontro aconteceu de fato =====
-- A dupla pode registrar um encontro que já aconteceu sem agendamento prévio
-- (combinado por WhatsApp — origem 'externo'). data_hora segue como o instante
-- oficial do encontro (ordenação, semáforo, "já passou"); realizado_em guarda
-- quando ele aconteceu de verdade — hoje igual a data_hora, mas a coluna
-- separa o conceito pra quando divergirem.
alter table public.encontros add column realizado_em timestamptz;

comment on column public.encontros.realizado_em is
  'Quando o encontro aconteceu de fato, informado pelo mentor. Igual a data_hora quando coincidem.';

-- backfill: encontros já realizados aconteceram em data_hora
update public.encontros
  set realizado_em = data_hora
  where status = 'realizado' and realizado_em is null;
