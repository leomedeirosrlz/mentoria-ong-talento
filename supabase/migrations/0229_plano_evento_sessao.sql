-- 0229 — ledger do plano aceita evento de sessão (REALIZA-519)
-- A 0227 registra `sessao_aplicada` em dupla_plano_eventos; a CHECK da
-- 0219 só conhecia os tipos antigos. Alarga o vocabulário sem perder os
-- eventos históricos.
begin;
alter table public.dupla_plano_eventos
  drop constraint if exists dupla_plano_eventos_tipo_check;
alter table public.dupla_plano_eventos
  add constraint dupla_plano_eventos_tipo_check
  check (tipo in ('proposto','aceito','contestado','passo_aplicado','sessao_aplicada','concluido','expirado'));
commit;
