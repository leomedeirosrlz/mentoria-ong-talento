-- 0191: contexto de trajetória dentro do 360º (REALIZA-71).
--
-- CONTEXTO
-- Os formulários finais (avaliacao_final_mentor / _mentorado, 0130) chegam
-- "secos": quem responde não vê a trajetória que o ciclo já coletou —
-- avaliacoes_encontro do jovem (0071) e registros.avaliacao do mentor. A
-- RPC pública formulario_por_token (0080) ganha `contexto_avaliacao` só
-- pra esses dois sistemas, derivado na leitura — nada de coluna/tabela
-- agregada.
--
-- PRIVACIDADE — mesma régua da 0071, sem exceção nova:
--   · o link é a identidade ('anon' recebe o mesmo corte — o token só vai
--     pro destinatário; 'outra_pessoa' segue saindo cedo, sem contexto);
--   · mentor: a própria série 1–4 de registros + a média do jovem SÓ
--     quando o lote ≥3 libera (quantização extraída de avaliacao_media_dpp
--     pra função interna — mesma matemática, mesmo cutoff);
--   · jovem: as próprias estrelas/avancei — nada que a RLS já não lhe
--     mostrasse;
--   · comentario/sentimento/temas/pedir_apoio NUNCA entram no payload —
--     o agregado não abre exceção ao que a RLS esconde do mentor DPP.
--
-- Nenhuma tabela/coluna/RLS nova — leitura definer com o mesmo corte de
-- identidade ('anon' | 'outra_pessoa' | 'ok') já existente.

begin;

-- ---------- 1) quantização compartilhada (era o corpo de avaliacao_media_dpp) --
-- Lote de ≥3 sobre as k primeiras por created_at (anti difference-attack:
-- uma avaliação nova não reabre a conta sobre o mesmo lote) + round(avg*2)/2.
-- Sem grant de execute — chamada interna pelas duas RPCs públicas; o gate de
-- identidade/dupla fica na camada de cima.
create or replace function public.avaliacao_media_quantizada(p_dupla_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_n int;
  v_k int;
  v_media numeric;
begin
  select count(*) into v_n from avaliacoes_encontro where dupla_id = p_dupla_id;
  v_k := (v_n / 3) * 3;
  if v_k < 3 then
    return jsonb_build_object('n', v_n, 'liberado', false);
  end if;
  select round(avg(estrelas) * 2) / 2 into v_media
    from (select estrelas from avaliacoes_encontro
          where dupla_id = p_dupla_id
          order by created_at limit v_k) s;
  return jsonb_build_object('n', v_n, 'liberado', true,
    'media', v_media, 'base', v_k);
end $$;
revoke all on function public.avaliacao_media_quantizada(uuid) from public, anon, authenticated;

-- Idem 0071 — o gate "só o mentor DPP daquela dupla" fica aqui; a conta é a
-- função interna. Assinatura e payload inalterados.
create or replace function public.avaliacao_media_dpp(p_dupla_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from duplas d
    where d.id = p_dupla_id and d.trilha = 'dpp'
      and d.mentor_id = public.my_profile_id()) then
    raise exception 'dupla não encontrada';
  end if;
  return public.avaliacao_media_quantizada(p_dupla_id);
end $$;
grant execute on function avaliacao_media_dpp(uuid) to authenticated;

-- ---------- 2) formulario_por_token — idem 0080 + contexto_avaliacao ----------
create or replace function public.formulario_por_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_nome text;
  v_identidade text;
  v_contexto jsonb;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dupla_id,
         fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo, f.descricao, f.campos, f.ativo, f.versao,
         f.sistema
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    return null;
  end if;

  -- identidade híbrida (0070): autenticado só enxerga link endereçado a ele
  -- (ou genérico). Fora isso, o form não vaza — o conteúdo pode ser pessoal.
  v_identidade := case
    when auth.uid() is null then 'anon'
    when (l.dest_profile_id is not null
          and l.dest_profile_id is distinct from public.my_profile_id())
      or (l.dest_mentorado_id is not null
          and l.dest_mentorado_id is distinct from public.my_mentorado_id())
      then 'outra_pessoa'
    else 'ok' end;

  select coalesce(p.nome, m.nome) into v_nome
    from formulario_links fl
    left join profiles p on p.id = fl.dest_profile_id
    left join mentorados m on m.id = fl.dest_mentorado_id
    where fl.id = l.id;

  if v_identidade = 'outra_pessoa' then
    return jsonb_build_object(
      'status', 'outra_pessoa',
      'destinatario', v_nome
    );
  end if;

  -- trajetória da dupla dentro do 360º (REALIZA-71). O corte é o do
  -- destinatário do link: mentor recebe a série 1–4 dele + a média do
  -- jovem só quando a régua da 0071 libera (o quantizado nunca reabre
  -- estrelas individuais); mentorado recebe as próprias estrelas. Série
  -- derivada na leitura — encontro sem avaliação simplesmente não entra.
  v_contexto := null;
  if l.dupla_id is not null then
    if l.sistema = 'avaliacao_final_mentor' then
      select jsonb_build_object(
        'registros', coalesce((
          select jsonb_agg(jsonb_build_object('numero', e.numero,
                                              'avaliacao', r.avaliacao)
                           order by e.numero)
            from registros r
            join encontros e on e.id = r.encontro_id
           where e.dupla_id = l.dupla_id
             and r.avaliacao is not null),
          '[]'::jsonb),
        'media_jovem', (
          select case when (q ->> 'liberado')::boolean
                      then (q ->> 'media')::numeric end
            from (select public.avaliacao_media_quantizada(l.dupla_id) as q) s
        )
      ) into v_contexto;
    elsif l.sistema = 'avaliacao_final_mentorado' then
      select jsonb_build_object(
        'estrelas', coalesce((
          select jsonb_agg(jsonb_build_object('numero', e.numero,
                                              'estrelas', a.estrelas,
                                              'avancei', a.avancei)
                           order by e.numero)
            from avaliacoes_encontro a
            join encontros e on e.id = a.encontro_id
           where a.dupla_id = l.dupla_id),
          '[]'::jsonb)
      ) into v_contexto;
    end if;
  end if;

  return jsonb_build_object(
    'status', case
      when l.usado_em is not null then 'respondido'
      when not l.ativo then 'inativo'
      when l.expira_em is not null and l.expira_em < now() then 'expirado'
      else 'pendente' end,
    'expira_em', l.expira_em,
    'respondido_em', l.usado_em,
    'destinatario', v_nome,
    'formulario', jsonb_build_object(
      'id', l.f_id,
      'titulo', l.titulo,
      'descricao', l.descricao,
      'campos', l.campos,
      'versao', l.versao,
      'sistema', l.sistema
    ),
    'contexto_avaliacao', v_contexto
  );
end $$;

-- idem 0036 — anon executa (link público), o create or replace preserva os
-- grants existentes; reafirmar documenta o contrato no arquivo novo
grant execute on function public.formulario_por_token(text)
  to anon, authenticated;

commit;
