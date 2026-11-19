-- 0214 relatorio_ia_card_supersede_fk — ordem final do supersede na
-- relatorio_ia_card_registrar (0213).
--
-- A 0213 pendurava a vigente no id novo ANTES do insert — a FK de
-- superseded_by apontava pra uma row que ainda não existia (23503).
--
-- Sequência definitiva, dentro do advisory lock por (secao, recorte_key):
--   1. a vigente anterior aponta superseded_by pra SI MESMA — sai do
--      unique parcial sem violar a FK; o auto-apelido é transitório,
--      nunca commita (a tx termina com o ponteiro real ou rollback);
--   2. a nova entra com superseded_by null — única vigente;
--   3. a antiga ganha o ponteiro real velho→novo.
-- Dedup, lock e assinatura intactos.

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

  -- passo 1: a vigente sai do unique parcial apontando pra si mesma —
  -- auto-apelido transitório dentro da tx (o advisory lock + o commit
  -- atômico tornam ele invisível pra qualquer outra sessão)
  if v_vigente.id is not null then
    update public.relatorio_ia_cards
       set superseded_by = v_vigente.id
     where id = v_vigente.id;
  end if;

  -- passo 2: a nova entra como única vigente
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

  -- passo 3: a antiga ganha o ponteiro real — histórico velho→novo
  if v_vigente.id is not null then
    update public.relatorio_ia_cards
       set superseded_by = v_novo_id
     where id = v_vigente.id;
  end if;

  return v_novo;
end $$;

revoke all on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.relatorio_ia_card_registrar(text, jsonb, text, text, text, text, text, text, uuid)
  to authenticated;

commit;
