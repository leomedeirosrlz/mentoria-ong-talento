-- 0075: catálogo de especialistas pro jovem — a view definer que a 0065 já
-- previa ("o catálogo que o jovem vê vem por view dedicada"). O jovem não lê
-- profiles (profiles_select exclui mentorado): sem esta view ele não saberia
-- nem pra quem direcionar o pedido. expõe o mesmo nível do jovem_contatos
-- (nome/social/avatar) + areas — whatsapp/email NÃO entram: o contato direto
-- abre quando a dupla nasce, pelo canal de sempre.
begin;

create or replace view public.jovem_especialistas as
select p.id, p.nome, p.nome_social, p.avatar_path, p.areas
from public.profiles p
where p.role = 'mentor_especialista'
  and p.ativo
  and public.my_role() = 'mentorado';

revoke all on public.jovem_especialistas from public, anon;
grant select on public.jovem_especialistas to authenticated;

commit;

-- rollback: drop view public.jovem_especialistas;
