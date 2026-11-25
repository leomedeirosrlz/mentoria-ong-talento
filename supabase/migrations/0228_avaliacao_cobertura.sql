-- 0228 — avaliação de sessão herda a cobertura do link (REALIZA-519)
-- O link da âncora (0226) já carrega os números da sessão. A avaliação
-- inserida por `submeter_avaliacao` (token ou autenticada) copia essa
-- cobertura sem mudar a assinatura da RPC.
begin;

create or replace function public.trg_avaliacao_cobertura()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cobertura is null or cardinality(new.cobertura) = 0 then
    new.cobertura := coalesce(
      (select l.cobertura from public.avaliacao_links l
        where l.encontro_id = new.encontro_id),
      '{}'::smallint[]
    );
  end if;
  return new;
end $$;

drop trigger if exists avaliacoes_encontro_cobertura on public.avaliacoes_encontro;
create trigger avaliacoes_encontro_cobertura
  before insert on public.avaliacoes_encontro
  for each row execute function public.trg_avaliacao_cobertura();

commit;
