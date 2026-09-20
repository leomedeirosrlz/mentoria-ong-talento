-- motivo auditavel da remarcacao: quando a dupla remarca um encontro, o mentor
-- diz o porquê (preset canonico ou texto livre). Null em agendamento normal e
-- em edicao que nao muda a data — a coluna e escrita so na remarcacao real.

alter table public.encontros add column motivo_reagendamento text;
