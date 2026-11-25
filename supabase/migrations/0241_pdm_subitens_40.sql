-- 0241 — teto de submetas do PDM: 20 → 40.
--
-- Pedido do cliente (25/11): o documento suportava 20 subitens no total e
-- duplas com muitos encaminhamentos batiam no limite. Metas seguem em 10
-- (guia: ~5 no template). O trigger pdm_itens_cap chama esta função por
-- nome, então `create or replace` basta — sem recriar trigger nem policy.
--
-- Mesma régua de contagem da 0109: só itens com status <> 'descartada'
-- entram no teto, e o advisory lock serializa o check-then-insert.
create or replace function public.pdm_itens_cap() returns trigger
language plpgsql set search_path to '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('pdm-cap:' || new.pdm_id::text));
  if new.parent_id is null then
    if (select count(*) from public.pdm_itens
         where pdm_id = new.pdm_id and parent_id is null
           and status <> 'descartada') >= 10 then
      raise exception 'o PDM comporta no máximo 10 metas';
    end if;
  else
    if (select count(*) from public.pdm_itens
         where pdm_id = new.pdm_id and parent_id is not null
           and status <> 'descartada') >= 40 then
      raise exception 'o PDM comporta no máximo 40 subitens';
    end if;
  end if;
  return new;
end $$;
