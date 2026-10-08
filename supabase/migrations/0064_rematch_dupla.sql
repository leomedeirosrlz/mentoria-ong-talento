-- 0064 — rematch_dupla: remanejamento atômico (REALIZA-100).
--
-- Encerrar-e-criar em uma transação: a dupla atual vira `encerrada` (histórico
-- intacto — encontros, registros, supervisões e vínculos ficam nela) e nasce a
-- dupla nova herdando turma/cronograma/supervisor/demanda/trilha, com
-- `remanejada_de` (0063) apontando pra origem. PDM viaja junto quando o
-- mentorado permanece — o plano é dele, não do mentor.
--
-- Regras:
--   - coord-only (a action também confere antes de chamar)
--   - só dupla ativa/pausada remaneja
--   - lado='mentor': novo perfil precisa do papel compatível com a trilha
--     (capacidade é garantida pelo trigger duplas_capacidade, que dispara no
--     insert dentro da mesma transação)
--   - lado='mentorado': vaga por trilha — o novo mentorado não pode ter dupla
--     ativa/pausada na mesma trilha (o índice parcial seria o backstop; aqui
--     o erro chega legível)
--   - nota opcional na ficha de quem sai (pessoa_notas aceita profile OU
--     mentorado)

create or replace function public.rematch_dupla(
  p_dupla_id uuid,
  p_lado text,
  p_novo_id uuid,
  p_motivo text default null,
  p_registrar_nota boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  antiga public.duplas%rowtype;
  nova uuid;
  novo_mentor uuid;
  novo_mentorado uuid;
  papel_esperado text;
  nota_saida text;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação remaneja duplas';
  end if;
  if p_lado not in ('mentor', 'mentorado') then
    raise exception 'Lado inválido — use mentor ou mentorado';
  end if;

  select * into antiga from public.duplas where id = p_dupla_id for update;
  if not found then
    raise exception 'Dupla não encontrada';
  end if;
  if antiga.status not in ('ativa', 'pausada') then
    raise exception 'Só dupla ativa ou pausada pode ser remanejada';
  end if;

  novo_mentor    := case when p_lado = 'mentor'    then p_novo_id else antiga.mentor_id end;
  novo_mentorado := case when p_lado = 'mentorado' then p_novo_id else antiga.mentorado_id end;

  if p_lado = 'mentor' then
    papel_esperado := case when antiga.trilha = 'especialista'
                           then 'mentor_especialista' else 'mentor_dpp' end;
    if not exists (
      select 1 from public.profiles
      where id = p_novo_id and ativo and role = papel_esperado
    ) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
    end if;
  else
    if not exists (select 1 from public.mentorados where id = p_novo_id) then
      raise exception 'Mentorado não encontrado';
    end if;
    if exists (
      select 1 from public.duplas
      where mentorado_id = p_novo_id
        and trilha = antiga.trilha
        and status in ('ativa', 'pausada')
    ) then
      raise exception 'Esse mentorado já está em dupla nessa trilha';
    end if;
  end if;

  update public.duplas set status = 'encerrada' where id = p_dupla_id;

  insert into public.duplas (
    mentor_id, mentorado_id, supervisor_id, trilha, turma, cronograma_id,
    demanda, iniciada_em, status, remanejada_de, pdm_url
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id,
    -- PDM é do mentorado: viaja só quando ele permanece
    case when p_lado = 'mentor' then antiga.pdm_url else null end
  )
  returning id into nova;

  if p_registrar_nota and nullif(btrim(p_motivo), '') is not null then
    nota_saida := 'Saiu da dupla em ' || to_char(current_date, 'DD/MM/YYYY') ||
                  ' (remanejamento): ' || btrim(p_motivo);
    insert into public.pessoa_notas (profile_id, mentorado_id, texto, created_by)
    values (
      case when p_lado = 'mentor' then antiga.mentor_id else null end,
      case when p_lado = 'mentorado' then antiga.mentorado_id else null end,
      nota_saida,
      public.my_profile_id()
    );
  end if;

  return nova;
end;
$$;

revoke all on function public.rematch_dupla(uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.rematch_dupla(uuid, text, uuid, text, boolean) to authenticated;
