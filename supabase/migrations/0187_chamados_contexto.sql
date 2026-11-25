-- 0187: chamados_contexto — os nomes derivados do chamado do autor.
--
-- CONTEXTO
-- O detalhe/lista dos chamados do próprio autor enriquece a linha com
-- atribuido_nome (responsável da equipe) e mentorado_nome (jovem da dupla
-- vinculada). As leituras iam direto em profiles/duplas+mentorados e a RLS
-- responde vazio pro jovem (e pro mentor em atribuído por staff fora do
-- escopo dele) — o chamado dele nascia sem os dois nomes.
--
-- Mesmo desenho das views jovem_* (0067/0076/0098): security definer
-- projeta só os campos derivados e escopa pelo chamados_select de autor —
-- autor_id = my_profile_id() ou autor_mentorado_id = my_mentorado_id().
-- Equipe não usa: o enriquecimento dela já lê tudo sob a própria RLS.

begin;

create or replace view public.chamados_contexto as
select c.id as chamado_id,
       coalesce(pa.nome_social, pa.nome) as atribuido_nome,
       coalesce(m.nome_social, m.nome) as mentorado_nome
  from public.chamados c
  left join public.profiles pa on pa.id = c.atribuido_a
  left join public.duplas d on d.id = c.dupla_id
  left join public.mentorados m on m.id = d.mentorado_id
 where c.autor_id = public.my_profile_id()
    or c.autor_mentorado_id = public.my_mentorado_id();

grant select on public.chamados_contexto to authenticated;

commit;
