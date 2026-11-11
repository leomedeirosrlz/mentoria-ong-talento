-- 0188 — digest semanal da coordenação: 'digest' entra no check de
-- emails_enviados.tipo.
--
-- O job digest_semanal do tick (REALIZA-178) e o disparo manual na página
-- /relatorios gravam a memória do envio como os demais transacionais. O
-- dedup do job lê este log: row da semana com enviados>0 segura o re-run
-- (run com envio desligado grava enviados=0 e não bloqueia a próxima
-- tentativa). Conjunto vivo conferido no staging via pg_get_constraintdef
-- (superset do 0180 + 'digest').

begin;

alter table public.emails_enviados drop constraint if exists
  emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura',
                           'apoio_jovem','chamado','instrumento','convite',
                           'digest']));

commit;
