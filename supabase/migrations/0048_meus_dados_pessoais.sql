-- Prefill do onboarding/perfil: a pessoa lê os PRÓPRIOS campos sensíveis
-- (0034 tirou o grant de coluna — nem o dono os lê por select direto).
-- Escopo mínimo: só a própria linha via my_profile_id(), só os 4 campos.
-- A view profiles_pessoal continua coord-only; aqui nada de terceiro vaza.
create or replace function public.meus_dados_pessoais()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p record;
begin
  select pr.data_nascimento, pr.genero, pr.pref_genero_par, pr.motivacao
    into p
    from public.profiles pr
    where pr.id = public.my_profile_id();
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'data_nascimento', p.data_nascimento,
    'genero', p.genero,
    'pref_genero_par', p.pref_genero_par,
    'motivacao', p.motivacao
  );
end $$;

revoke all on function public.meus_dados_pessoais() from public, anon;
grant execute on function public.meus_dados_pessoais() to authenticated;
