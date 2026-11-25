-- 0180 — convite de acesso: 'convite' entra no check de emails_enviados.tipo.
--
-- A coordenação ganha o disparo do convite de primeiro acesso pela ficha da
-- pessoa (staff) e do jovem (src/lib/actions-convite.ts): generateLink cria
-- o auth.users e o handle_new_user vincula o cadastro já no envio — por
-- isso o e-mail sai pelo Resend com o token na URL do /auth/confirm, não
-- pelo SMTP de auth do Supabase (o link da plataforma exige o gesto
-- explícito e o e-mail leva a copy da marca). O envio fica logado aqui como
-- os demais transacionais. Superset do check vivo (0114) + 'convite' —
-- quem mergear DEPOIS relê pg_get_constraintdef e carrega o superset da vez.

begin;

alter table public.emails_enviados drop constraint if exists
  emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo = any (array['comunicado','material','assinatura',
                           'apoio_jovem','chamado','instrumento','convite']));

commit;
