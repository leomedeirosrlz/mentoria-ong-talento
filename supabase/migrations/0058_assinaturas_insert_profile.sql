-- 0058 — emissão de termo do voluntário por link tokenizado
--
-- A policy assinaturas_insert (0033) exigia `mentorado_id not null` /
-- `profile_id is null`: na época, profile só assinava logado via RPC
-- security definer (assinar_termo) — a row nunca passava por insert
-- direto. A emissão em lote e o "Enviar" da ficha mudaram isso: a coord
-- insere rows de profile_id e a policy barrava silenciosamente (o retry
-- do emitirUm devolvia null → "não foi possível emitir").
--
-- Regra nova, uma linha só: coord cria solicitação pendente e o alvo tem
-- que casar com o `signatario` do template — termo-voluntario → profile,
-- documentos do jovem → mentorado. O `num_nonnulls(...) = 1` do CHECK da
-- tabela segue garantindo exatamente um alvo.

begin;

drop policy assinaturas_insert on public.assinaturas;

create policy assinaturas_insert on public.assinaturas for insert
  to authenticated with check (
    public.my_role() = 'coordenacao'
    and status = 'pendente'
    and exists (
      select 1
      from public.documento_templates t
      where t.id = template_id
        and (
          (t.signatario = 'profile' and profile_id is not null)
          or (t.signatario = 'mentorado' and mentorado_id is not null)
        )
    )
  );

commit;
