-- 20261028224422 — stub de reconciliação de histórico.
-- Esta versão existe no histórico remoto de produção mas não tinha arquivo
-- local: foi aplicada direto no banco via MCP apply_migration (que nomeia
-- versões por timestamp). O conteúdo real já está refletido no schema
-- vigente — este arquivo existe só pra alinhar local × remoto e destravar
-- `supabase db push`. Intencionalmente vazio: não rodar DDL aqui.

begin;
commit;
