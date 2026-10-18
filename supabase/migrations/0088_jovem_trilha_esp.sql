-- 0088: passos do guia de especialista pro jovem (WP6).
--
-- `especialista_eventos` (o guia de 5 passos da trilha esp) tem SELECT só
-- pros papéis staff (0065) — o mentorado não lê. A página
-- /jovem/especialistas precisa dos títulos/focos pra montar o stepper da
-- trilha dele; sem isso os nós virariam "Sessão N" sem sentido.
-- O conteúdo é um catálogo fixo (5 linhas, nada pessoal) — a superfície
-- segue o contrato jovem_*: view definer, grant ao autenticado, e a linha
-- `my_role() = 'mentorado'` mantém o recorte explícito de quem é a pra quem.

begin;

create or replace view public.jovem_trilha_esp as
select numero, titulo, foco
from public.especialista_eventos
where public.my_role() = 'mentorado'
order by numero;

revoke all on public.jovem_trilha_esp from public, anon;
grant select on public.jovem_trilha_esp to authenticated;

comment on view public.jovem_trilha_esp is
  'Os 5 passos do guia da trilha de especialista, projetados pro jovem (título + foco, sem dados de ninguém).';

commit;

-- rollback: drop view public.jovem_trilha_esp;
