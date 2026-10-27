-- 0137 — decisão de catálogo (Leo, fev/2027): a autoavaliação do mentor
-- saiu do programa (o form já tinha ido embora na 0128/REALIZA-236; sobrava
-- só o material apontando pro doc aposentado). No lugar entra o doc nativo
-- "Feedback Construtivo" — instrumento que o guia cita e que não tinha
-- material próprio (a versão em PDF fica com a coordenação; o slug
-- doc:feedback-construtivo renderiza o texto do guia no app).
--
--   * delete por path (estável entre ambientes — prod e staging receberam
--     o doc:checklist-competencias pela 0135, que já rodou em prod)
--   * insert idempotente por path — o mesmo motivo do on conflict da 0135
begin;

delete from public.materiais
 where path = 'doc:checklist-competencias';

insert into public.materiais
  (titulo, descricao, tipo, audiencia, encontro_num, ordem, path)
values
  ('Feedback Construtivo',
   'Instrumento do guia: o modelo de fala e os cuidados para feedback sobre comportamento negativo.',
   'conteudo', 'todos', null, 23,
   'doc:feedback-construtivo')
on conflict do nothing;

commit;
