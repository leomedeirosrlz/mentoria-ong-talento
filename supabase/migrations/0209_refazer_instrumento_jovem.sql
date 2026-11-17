begin;

-- Refazer self-serve do jovem (rodada UX de instrumentos): o mentorado
-- reemite o próprio instrumento sem pedir pro mentor — a resposta
-- anterior segue guardada como evidência (a decisão da REALIZA-435) e a
-- nova emissão sai marcada com origem 'jovem', que é como a ficha da
-- dupla conta quem pediu. O reuso de link vivo segue a mesma régua do
-- emitir da equipe; cobre os dois gestos — refazer o respondido e
-- renovar o link expirado.

create or replace function public.refazer_instrumento_jovem(p_sistema text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_momento text;
  v_token text;
begin
  -- os 4 de jornada do mentorado — o checklist é do mentor, nunca self-serve
  if p_sistema not in ('visao', 'metas', 'pdm', 'roda_vida') then
    raise exception 'instrumento inválido';
  end if;

  -- a dupla DPP viva do próprio jovem (jovem_duplas é escopada por
  -- my_mentorado_id + role — a mesma orácula do retroativo 0207)
  select jd.id, jd.status, jd.trilha, jd.mentor_id
    into v_dupla
    from jovem_duplas jd
   where jd.trilha = 'dpp' and jd.status in ('ativa', 'pausada')
   order by jd.id
   limit 1;
  if not found then
    raise exception 'sem dupla de mentoria ativa';
  end if;

  -- refazer pressupõe uma emissão anterior: respondida (a evidência que
  -- se refaz) ou link morto (renovar). Sem nenhuma entrega anterior a
  -- porta é a equipe — o instrumento ainda não foi liberado pra dupla.
  if not exists (
    select 1
      from formulario_links l
      join formularios f on f.id = l.formulario_id
     where f.sistema = p_sistema
       and l.dupla_id = v_dupla.id
  ) then
    raise exception 'este instrumento ainda não foi liberado pra você';
  end if;

  -- o momento é o da última resposta: refazer a roda inicial devolve
  -- link 'inicial', não o 'formal' que a régua automática calcularia
  select l.contexto ->> 'momento'
    into v_momento
    from formulario_links l
    join formularios f on f.id = l.formulario_id
   where f.sistema = p_sistema
     and l.dupla_id = v_dupla.id
     and l.usado_em is not null
   order by l.usado_em desc
   limit 1;

  -- link vivo do mesmo destinatário+momento: devolve sem mexer na origem
  -- (se a equipe emitiu, a etiqueta é dela — o jovem só está abrindo)
  select l.token
    into v_token
    from formulario_links l
    join formularios f on f.id = l.formulario_id
   where f.sistema = p_sistema
     and l.dupla_id = v_dupla.id
     and l.dest_mentorado_id is not null
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.contexto ->> 'momento') is not distinct from v_momento
   order by l.created_at desc
   limit 1;
  if found then
    return jsonb_build_object('token', v_token, 'reutilizado', true);
  end if;

  return public.emitir_instrumento_core(
    v_dupla.id, p_sistema, public.my_profile_id(), 'jovem', 'auto', v_momento
  );
end $$;

revoke all on function public.refazer_instrumento_jovem(text) from public, anon;
grant execute on function public.refazer_instrumento_jovem(text) to authenticated;

commit;
