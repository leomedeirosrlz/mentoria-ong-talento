-- 0098 — remove o link externo do PDM (duplas.pdm_url, criado na 0044).
--
-- O instrumento PDM nativo (0080) cobre o caso de uso de ponta a ponta;
-- PDMs antigos e demais documentos externos entram por importação manual
-- de materiais antes do lançamento. Em prod a coluna estava 100% NULL —
-- zero dados perdidos na remoção.
--
-- Dependentes mapeados via pg_depend antes de escrever:
--   * function definir_pdm_url (única escrita mentor-escopada) — drop
--   * view jovem_duplas (0067) — recriada sem a projeção
--   * 3 policies que referenciam jovem_duplas — derrubadas pelo cascade,
--     re-emitidas verbatim logo abaixo
--   * rematch_dupla (0091) — copiava pdm_url no insert; recriada sem
--   * constraint duplas_pdm_url_check — desce com a coluna

-- ─── 1. a RPC morre primeiro: ninguém mais escreve a coluna ────────────
drop function if exists public.definir_pdm_url(uuid, text);

-- ─── 2. jovem_duplas sem pdm_url — drop cascade derruba as 3 policies
--        dependentes; view e policies recriadas na sequência ────────────
drop view public.jovem_duplas cascade;

create view public.jovem_duplas as
select d.id, d.trilha, d.status, d.turma, d.cronograma_id, d.iniciada_em,
       d.encerrada_em, d.motivo_encerramento, d.demanda,
       d.mentor_id, p.nome as mentor_nome, p.nome_social as mentor_nome_social,
       p.avatar_path as mentor_avatar_path,
       d.supervisor_id, s.nome as supervisor_nome,
       s.nome_social as supervisor_nome_social,
       s.avatar_path as supervisor_avatar_path
from public.duplas d
left join public.profiles p on p.id = d.mentor_id
left join public.profiles s on s.id = d.supervisor_id
where d.mentorado_id = public.my_mentorado_id()
  and public.my_role() = 'mentorado';

grant select on public.jovem_duplas to authenticated;

-- policies re-emitidas verbatim das definições vigentes (0068, 0090, 0089):
create policy encontros_select on public.encontros for select using (
  public.my_role() = 'coordenacao'
  or exists (select 1 from public.duplas d
             where d.id = encontros.dupla_id
               and (d.mentor_id = public.my_profile_id()
                    or d.supervisor_id = public.my_profile_id()))
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.jovem_duplas jd
                  where jd.id = encontros.dupla_id))
);

create policy avaliacoes_select on avaliacoes_encontro
  for select to authenticated using (
    my_role() = 'coordenacao'
    or (public.has_papel('supervisor'::public.app_role) and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.supervisor_id = my_profile_id()))
    or (public.has_papel('mentor_dpp'::public.app_role)
      and avaliacao_visivel_mentor and exists (
      select 1 from duplas d
      where d.id = dupla_id and d.mentor_id = my_profile_id()
        and d.trilha is distinct from 'especialista'))
    or (my_role() = 'mentorado' and exists (
      select 1 from jovem_duplas jd where jd.id = dupla_id))
  );

create policy devolutivas_select on public.devolutivas for select using (
  public.my_role() = 'coordenacao'
  or autor_id = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and exists (select 1 from public.jovem_duplas jd
                  where jd.id = devolutivas.dupla_id))
);

-- ─── 3. rematch_dupla (0091) sem pdm_url — o PDM é instrumento nativo,
--        não viaja mais entre duplas ────────────────────────────────────
create or replace function public.rematch_dupla(p_dupla_id uuid, p_lado text, p_novo_id uuid, p_motivo text DEFAULT NULL::text, p_registrar_nota boolean DEFAULT true)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    -- has_papel confere o papel efetivo E o ativo (join profiles) — híbrido
    -- com o papel da trilha como secundário passa a ser candidato válido.
    -- O escopo da turma da dupla também vale: papel restrito a OUTRA
    -- turma não habilita o remanejo (0091).
    if not public.has_papel(p_novo_id, papel_esperado::public.app_role, antiga.turma) then
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
    demanda, iniciada_em, status, remanejada_de
  ) values (
    novo_mentor, novo_mentorado, antiga.supervisor_id, antiga.trilha,
    antiga.turma, antiga.cronograma_id, antiga.demanda, current_date, 'ativa',
    p_dupla_id
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
$function$;

-- ─── 4. a coluna sai por último — o CHECK desce junto ──────────────────
alter table public.duplas drop column pdm_url;
