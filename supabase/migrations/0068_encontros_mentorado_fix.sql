-- REALIZA-107 fase C (fix) — o ramo mentorado de encontros_select precisava
-- de oracle definer, não de subquery crua.
--
-- Descoberto no persona test do staging (jovem real, JWT próprio):
-- `exists (select 1 from duplas d where ...)` DENTRO de policy é avaliado sob
-- o RLS do invoker na tabela referenciada — NÃO bypassa. O padrão sempre
-- funcionou porque mentor/supervisor/coord já tinham SELECT em `duplas`;
-- o mentorado (que por desenho NÃO lê `duplas` — devolutiva_pdm é do mentor)
-- avaliava o exists contra um conjunto vazio: zero linhas, silencioso.
--
-- Fix: a oracle de pertencimento passa a ser a view definer `jovem_duplas`
-- (0067) — ela já resolve `mentorado_id = my_mentorado_id() and my_role() =
-- 'mentorado'` com direito de dono. Regra que fica: toda checagem
-- "o X pertence à minha dupla" pra papel sem SELECT na tabela-base usa view/
-- função definer, nunca a tabela crua.

begin;

drop policy if exists encontros_select on public.encontros;
create policy encontros_select on public.encontros for select using (
  public.my_role() = 'coordenacao'
  or exists (select 1 from public.duplas d
             where d.id = encontros.dupla_id
               and (d.mentor_id = public.my_profile_id()
                    or d.supervisor_id = public.my_profile_id()))
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.jovem_duplas jd
                  where jd.id = encontros.dupla_id))
);

commit;
