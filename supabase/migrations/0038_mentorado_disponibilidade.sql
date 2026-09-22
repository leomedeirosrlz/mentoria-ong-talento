-- 0038: grade de disponibilidade do mentorado — par da coluna que a 0034
-- criou em mentor_profiles. O matching compara a grade dos dois lados (o
-- form de inscrição do BP pergunta disponibilidade pros dois).
-- Coluna pública-interna como interesses/objetivos: entra no grant por
-- coluna da 0034 (o SELECT table-level saiu lá — coluna nova precisa de
-- grant explícito senão some pra authenticated).
begin;

alter table public.mentorados
  add column disponibilidade jsonb,
  add constraint mentorados_disponibilidade_ok
    check (public.disponibilidade_ok(disponibilidade));

grant select (disponibilidade) on public.mentorados to authenticated;

commit;
