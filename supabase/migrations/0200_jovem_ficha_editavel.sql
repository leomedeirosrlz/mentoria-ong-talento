-- 0200: perfil do jovem editável (REALIZA-419/420) — duas RPCs definer
-- novas no padrão do set_contato_compartilhado (0076) e do
-- set_disponibilidade_mentorado (0078). A policy de UPDATE em mentorados
-- é coord-only (mentorados_coord, 0001), então toda escrita do jovem na
-- própria ficha desce por RPC escopada a my_mentorado_id() — nunca um
-- update livre na tabela.
--
-- jovem_update_ficha — o subconjunto auto-descritivo da ficha: objetivos
-- com a mentoria, motivação, escolaridade e origem. A whitelist é a
-- própria assinatura: o que não é parâmetro não tem caminho de escrita
-- (nome/contato/documentos nunca passam por aqui — seguem da coordenação,
-- assim como os campos sensíveis e de matching). Toda chamada reescreve
-- os 4 campos: o form do perfil manda o conjunto completo, então null
-- significa "limpar", não "não tocar".
--
-- jovem_set_avatar — a foto do jovem mora em mentorados.avatar_path (é a
-- coluna que jovem_perfil e mentorados_turma projetam; profiles.avatar_path
-- é a dos adultos). O storage segue a regra da 0014/0024 (escrita só na
-- pasta do próprio profile_id); a RPC confere que a pasta do path é mesmo
-- a do caller — sem ela valia apontar avatar_path pra arquivo de pasta
-- alheia, já que o bucket é público e a leitura sempre funcionou.
begin;

create or replace function public.jovem_update_ficha(
  p_objetivos text default null,
  p_motivacao text default null,
  p_escolaridade text default null,
  p_origem text default null
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
  if char_length(coalesce(p_origem, '')) > 300 then
    raise exception 'O campo origem aceita até 300 caracteres';
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
         escolaridade = nullif(btrim(p_escolaridade), ''),
         origem = nullif(btrim(p_origem), '')
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.jovem_update_ficha(text, text, text, text)
  from public, anon;
grant execute on function public.jovem_update_ficha(text, text, text, text)
  to authenticated;

create or replace function public.jovem_set_avatar(p_path text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if public.my_role() <> 'mentorado' then
    raise exception 'Só o próprio jovem troca a própria foto';
  end if;
  -- o bucket aceita escrita só na pasta do profile_id (0014/0024); aqui a
  -- conferência é semântica: impede registrar o arquivo de outra pasta
  if p_path is not null
     and p_path not like (public.my_profile_id()::text || '/%') then
    raise exception 'Foto fora da sua pasta';
  end if;
  update public.mentorados
     set avatar_path = p_path
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.jovem_set_avatar(text) from public, anon;
grant execute on function public.jovem_set_avatar(text) to authenticated;

commit;
