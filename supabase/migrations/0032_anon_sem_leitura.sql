-- 0032: revoga o SELECT table-level de `anon` em todas as tabelas públicas.
-- A 0026 endureceu `authenticated` (grant por coluna em profiles) mas `anon`
-- seguia com o default do Supabase (ALL em todo objeto novo de public).
-- Hoje a RLS barra tudo (policies exigem JWT), mas grant é a primeira linha:
-- qualquer policy permissiva futura ou RLS desabilitada por engano vazaria
-- dados pra requisição sem login. Mínimo privilégio: anon não lê tabela nenhuma
-- (o app não tem dados públicos — login/privacidade não consultam tabelas).
-- Views escopadas (profiles_contato, solicitacoes_mural) já revogam anon na
-- própria migration; cobertas aqui por via das dúvidas não custam nada.

begin;

revoke all on all tables in schema public from anon;

-- futuras tabelas também nascem sem grant pra anon
alter default privileges in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon;

commit;
