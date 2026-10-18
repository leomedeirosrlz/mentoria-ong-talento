-- WP6 (fix) — o ramo mentorado de devolutivas_select usava a tabela `duplas`
-- crua como oracle de pertencimento. Mesma armadilha da 0068: subquery de
-- policy é avaliada sob o RLS do invoker na tabela referenciada, e o
-- mentorado NÃO tem SELECT em `duplas` (ele lê por jovem_duplas — a coluna
-- devolutiva_pdm é do mentor DPP, não dele). Resultado: o exists avaliava
-- contra conjunto vazio e o feed de devolutivas vinha sempre vazio pro
-- jovem (o persona test do WP6 no staging pegou).
--
-- Fix: a checagem passa a ser a view definer `jovem_duplas` (0067), que já
-- resolve `mentorado_id = my_mentorado_id() and my_role() = 'mentorado'`
-- com direito de dono. Regra mantida: oracle de pertencimento pra papel sem
-- SELECT na tabela-base é view/função definer, nunca a tabela crua.

begin;

drop policy if exists devolutivas_select on public.devolutivas;
create policy devolutivas_select on public.devolutivas for select using (
  public.my_role() = 'coordenacao'
  or autor_id = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.jovem_duplas jd
                  where jd.id = devolutivas.dupla_id))
);

commit;

-- rollback: repõe o exists cru sobre duplas (corpo da 0086).
