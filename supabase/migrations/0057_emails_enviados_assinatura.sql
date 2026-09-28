-- 0057: tipo 'assinatura' no log de e-mails — a emissão em massa de links de
-- assinatura (enviarLinksAssinatura) dispara um e-mail por pessoa, cada um com
-- seu link tokenizado, e registra no mesmo emails_enviados dos comunicados e
-- materiais (0056): audiencia carrega o slug do documento, ref_id o template.
begin;

alter table public.emails_enviados
  drop constraint emails_enviados_tipo_check;
alter table public.emails_enviados
  add constraint emails_enviados_tipo_check
  check (tipo in ('comunicado', 'material', 'assinatura'));

commit;
