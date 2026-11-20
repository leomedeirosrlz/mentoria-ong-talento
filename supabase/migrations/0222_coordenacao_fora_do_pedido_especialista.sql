-- REALIZA-468: a coordenação sai do fluxo de solicitação de especialista.
-- O pedido nasce 'aberta' no mural desde a 0158 e o aceite efetiva a trilha;
-- em nenhum dos dois a coordenação tem ação. Esta migration fecha a borda:
--
--   1) ela só lê a tabela (SELECT pela sol_select); o UPDATE direto pelo
--      PostgREST morre aqui. Cancelar, contrapropor, recusar e aceitar
--      seguem pelas RPCs security definer, que continuam sendo o caminho
--      da UI.
--   2) reconhecer_solicitacao era a triagem e não tem mais chamador.
--   3) sol_coords() era o ponto único que alimentava os sinos de criação e
--      confirmação de pedido para a coordenação. Vazio, o fluxo não acorda
--      mais o sino dela: o mural e o card da home já mostram o que fazer.

begin;

-- 1) coordenação só lê: escrita só por RPC definer
revoke update on public.solicitacoes_especialista from authenticated, anon;

drop policy if exists sol_update on public.solicitacoes_especialista;
create policy sol_update on public.solicitacoes_especialista
  for update to authenticated
  using ((select current_setting('realiza.sol_transicao', true)) = 'on')
  with check ((select current_setting('realiza.sol_transicao', true)) = 'on');

-- 2) a triagem saiu do fluxo na 0158: RPC sem chamador
drop function if exists public.reconhecer_solicitacao(uuid, text);

-- 3) nenhum destinatário de coordenação nos avisos do fluxo de especialista
create or replace function public.sol_coords()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where false
$$;
revoke all on function public.sol_coords() from public, anon, authenticated;

commit;
