-- 0213 relatorio_ia_card_supersede — fix da ordem supersede/insert na
-- relatorio_ia_card_registrar (0212).
--
-- A 0212 inseria a row nova ANTES de pendurar a vigente anterior — no
-- instante do insert existiam duas rows com superseded_by null e o unique
-- parcial relatorio_ia_cards_vigente_uk derrubava a transação (23505).
--
-- Fix: o id do card novo nasce antes (gen_random_uuid), a vigente
-- anterior é pendurada nele e só então o insert acontece — em nenhum
-- momento duas vigentes coexistem. Dedup e advisory lock intactos; a
-- assinatura não muda.
--
-- NOTA: esta sequência ainda esbarra na FK de superseded_by (o update
-- aponta pra um id que ainda não existe). A ordem final — auto-apelido
-- transitório da vigente — está na 0214.

begin;

create or replace function public.relatorio_ia_card_registrar(
  p_secao text,
  p_recorte jsonb,
  p_recorte_key text,
  p_contexto_hash text,
  p_pergunta text,
  p_resposta_md text,
  p_modelo text default null,
  p_tier text default null,
  p_request_id uuid default null
)
returns public.relatorio_ia_cards
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.my_profile_id();
  v_vigente public.relatorio_ia_cards;
  v_novo public.relatorio_ia_cards;
  v_novo_id uuid := gen_random_uuid();
begin
  if v_uid is null or not public.has_papel('coordenacao') then
    raise exception 'relatorio_ia_card_registrar: permissão negada';
  end if;
  if nullif(btrim(p_secao), '') is null
     or nullif(btrim(p_recorte_key), '') is null
     or nullif(btrim(p_contexto_hash), '') is null
     or nullif(btrim(p_pergunta), '') is null
     or nullif(btrim(p_resposta_md), '') is null then
    raise exception 'relatorio_ia_card_registrar: argumento obrigatório vazio';
  end if;

  -- serializa por par (secao, recorte): dois pedidos no mesmo instante
  -- viram veredictos sequenciais — o segundo enxerga o vigente do primeiro
  perform pg_advisory_xact_lock(hashtext(p_secao || '|' || p_recorte_key));

  select * into v_vigente
    from public.relatorio_ia_cards
   where secao = p_secao
     and recorte_key = p_recorte_key
     and superseded_by is null;

  -- dedup: mesma pergunta sobre o mesmo contexto devolve a vigente —
  -- custo zero e o histórico não ganha gêmea
  if v_vigente.id is not null
     and v_vigente.contexto_hash = p_contexto_hash
     and v_vigente.pergunta = p_pergunta then
    return v_vigente;
  end if;

  -- pendura a vigente ANTES do insert: o unique parcial nunca enxerga duas
  -- rows com superseded_by null ao mesmo tempo
  if v_vigente.id is not null then
    update public.relatorio_ia_cards
       set superseded_by = v_novo_id
     where id = v_vigente.id;
  end if;

  insert into public.relatorio_ia_cards (
      id, secao, recorte, recorte_key, contexto_hash, pergunta, resposta_md,
      modelo, tier, request_id, gerado_por
    )
    values (
      v_novo_id, p_secao, coalesce(p_recorte, '{}'::jsonb), p_recorte_key,
      p_contexto_hash, p_pergunta, p_resposta_md,
      p_modelo, p_tier, p_request_id, v_uid
    )
    returning * into v_novo;

  return v_novo;
end $$;

revoke all on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  to authenticated;

commit;
