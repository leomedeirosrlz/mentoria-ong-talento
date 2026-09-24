begin;

-- Bug encontrado no primeiro uso real: a via pública em PDF
-- (/api/assinar-token/<token>) devolvia 500 "assinatura sem template" —
-- a RPC devolvia a linha crua de `assinaturas` sem o embed de
-- documento_templates que o render precisa (slug/versao pra escolher o
-- documento). Como templates são authenticated-only, a rota pública não
-- podia buscar o template num segundo read — embutimos na RPC.
-- drop+create: mudança de tipo de retorno não cabe em OR REPLACE.
-- O contrato novo (objeto único jsonb ou null) espelha o que o stub demo
-- já devolvia — a rota passa a ler `data` direto, sem `[0]`.
drop function public.assinatura_completa_por_token(uuid);

create function public.assinatura_completa_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  select to_jsonb(a) || jsonb_build_object(
      'template', jsonb_build_object(
        'slug', t.slug, 'titulo', t.titulo, 'versao', t.versao))
    into r
    from public.assinaturas a
    join public.documento_templates t on t.id = a.template_id
    where a.token = p_token and a.status = 'assinado';
  return r;
end $$;

-- mesmo contrato de antes: a row só sai assinada (o token é a posse)
revoke all on function public.assinatura_completa_por_token(uuid) from public;
grant execute on function public.assinatura_completa_por_token(uuid)
  to anon, authenticated;

commit;
