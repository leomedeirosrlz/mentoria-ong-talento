-- 0202: origem sai da ficha editável do jovem (REALIZA-429). "Como você
-- chegou ao programa" é dado de importação/matching da coordenação, não
-- auto-descritivo — a whitelist é a própria assinatura da RPC, então o
-- campo sai do parâmetro, não só do form. A 4-arg da 0200 é dropada
-- (nada chama ela além da action, que já não manda p_origem); a leitura
-- da coluna segue intacta — origem continua exibida só-leitura na ficha.
begin;

drop function public.jovem_update_ficha(text, text, text, text);

create or replace function public.jovem_update_ficha(
  p_objetivos text default null,
  p_motivacao text default null,
  p_escolaridade text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if public.my_role() <> 'mentorado' then
    raise exception 'Só o próprio jovem edita a própria ficha';
  end if;
  -- mesmos tetos dos CHECKs mentorados_matching_caps/escolaridade_check
  -- (0034): validar aqui devolve a mensagem pt-BR em vez de 23514 crua
  if char_length(coalesce(p_objetivos, '')) > 2000
     or char_length(coalesce(p_motivacao, '')) > 2000 then
    raise exception 'Objetivos e motivação aceitam até 2.000 caracteres';
  end if;
  if p_escolaridade is not null
     and p_escolaridade not in
       ('fundamental', 'medio', 'tecnico',
        'superior_incompleto', 'superior', 'pos') then
    raise exception 'Escolha uma escolaridade válida';
  end if;
  update public.mentorados
     set objetivos = nullif(btrim(p_objetivos), ''),
         motivacao = nullif(btrim(p_motivacao), ''),
         escolaridade = nullif(btrim(p_escolaridade), '')
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.jovem_update_ficha(text, text, text)
  from public, anon;
grant execute on function public.jovem_update_ficha(text, text, text)
  to authenticated;

commit;
