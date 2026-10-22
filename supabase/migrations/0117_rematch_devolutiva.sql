-- 0117 — rematch de especialista exige a devolutiva pro PDM (REALIZA-171).
--
-- A 0105 fez o rematch esp carimbar encerrada_em + motivo sistêmico e emitir
-- o link da avaliação geral (§13), mas a devolutiva_pdm ficou de fora — e
-- nenhuma via grava o campo depois: `encerrar_trilha_especialista` exige
-- dupla viva, `postar_devolutiva` recusa trilha encerrada ("a devolutiva
-- final vai no encerramento", 0086). O rito fechava operacionalmente (o
-- texto do especialista via WhatsApp) sem ter onde morar.
--
-- O rematch passa a exigir `p_devolutiva` quando a dupla é de especialista —
-- mesma régua do encerramento (10–4.000 após trim). A coordenação transcreve
-- a entrega de quem sai; a devolutiva segue pro PDM pela solicitacoes_mural
-- (a solicitação continua apontando pra dupla encerrada). Em trilha DPP o
-- campo não existe (duplas_encerramento_esp, 0037) — quem mandar valor recebe
-- erro em vez de descarte silencioso.
--
-- Assinatura nova: a 5-args anterior é dropada — com default no 6º parâmetro
-- os dois corpos ficariam ambíguos pra toda chamada antiga, e manter a
-- versão velha deixaria uma porta aberta que pula o rito.
--
-- ⚠ Merge: a 98 (duplas.dupla_dpp_id) também reescreve rematch_dupla — quem
-- mergear depois re-lê pg_get_functiondef e carrega os dois deltas.

begin;

drop function public.rematch_dupla(uuid, text, uuid, text, boolean);

-- verbatim da 0105 + p_devolutiva (exigida/gravada quando trilha=esp,
-- rejeitada quando dpp)
create or replace function public.rematch_dupla(
  p_dupla_id uuid, p_lado text, p_novo_id uuid,
  p_motivo text default null, p_registrar_nota boolean default true,
  p_devolutiva text default null
) returns uuid
language plpgsql security definer set search_path = '' as $function$
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
    -- Escopo (0101): especialista é pool GLOBAL — o papel em qualquer
    -- escopo habilita; mentor_dpp segue restrito à turma da dupla.
    if not public.has_papel(
      p_novo_id, papel_esperado::public.app_role,
      case when papel_esperado = 'mentor_especialista' then null
           else antiga.turma end
    ) then
      raise exception 'A pessoa escolhida como mentor não tem papel compatível com a trilha';
    end if;
    -- 0101: mesmo guard de autoatribuição do sol_efetivar — a trilha de
    -- especialista exige um SEGUNDO adulto; quem já é mentor DPP da jovem
    -- não pode assumir a trilha de especialista dela via rematch (o caminho
    -- cross-turma facilitou chegar aqui, então o guard mora no RPC).
    if papel_esperado = 'mentor_especialista' and exists (
      select 1 from public.duplas d
       where d.mentorado_id = antiga.mentorado_id
         and d.mentor_id = p_novo_id
         and d.trilha is distinct from 'especialista'
         and d.status in ('ativa', 'pausada')
    ) then
      raise exception 'O mentor DPP da jovem não pode assumir também a trilha de especialista';
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

  -- 0117: a validação fica depois dos guards de escopo (a ordem dos erros
  -- é a mesma de sempre) e antes do primeiro write — rematch esp sem a
  -- devolutiva aborta inteiro, não "fecha e avisa". Mesma faixa do rito de
  -- encerramento (duplas_devolutiva_pdm_cap é o backstop declarativo).
  if antiga.trilha = 'especialista' then
    if p_devolutiva is null
       or char_length(btrim(p_devolutiva)) not between 10 and 4000 then
      raise exception 'O rematch de uma trilha de especialista exige a devolutiva pro PDM de quem sai (10 a 4.000 caracteres)';
    end if;
  elsif nullif(btrim(p_devolutiva), '') is not null then
    -- dpp não tem o campo (duplas_encerramento_esp) — erro explícito evita
    -- "gravei e sumiu": o texto ia pro limbo e o chamador nem saberia
    raise exception 'A devolutiva pro PDM só existe na trilha de especialista';
  end if;

  -- 0105: fechamento "só de status" deixava a trilha de especialista sem
  -- encerrada_em, sem motivo e sem o link da avaliação geral — estado que
  -- nenhuma outra via produz. O check duplas_encerramento_esp (0102)
  -- proíbe esses campos em trilha DPP de propósito (o rito DPP mora em
  -- encerramentos), então o carimbo vale só pra especialista: motivo
  -- sistêmico + emissão do §13 pro especialista que sai.
  -- 0117: a devolutiva pro PDM fecha o rito na mesma transação.
  if antiga.trilha = 'especialista' then
    update public.duplas
       set status = 'encerrada',
           encerrada_em = now(),
           -- o check motivo_encerramento_cap corta em 300 e p_motivo chega a
           -- ~430 chars via motivoRemanejo — trunca em vez de estourar 23514
           motivo_encerramento = left(
             'Remanejamento — ' ||
             case p_lado when 'mentorado' then 'jovem' else 'especialista' end ||
             ' substituído(a)' ||
             coalesce(': ' || nullif(btrim(p_motivo), ''), ''),
             300),
           devolutiva_pdm = btrim(p_devolutiva)
     where id = p_dupla_id;
    perform public.emitir_avaliacao_esp(p_dupla_id, antiga.mentor_id);
  else
    update public.duplas set status = 'encerrada' where id = p_dupla_id;
  end if;

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

revoke all on function public.rematch_dupla(uuid, text, uuid, text, boolean, text) from public, anon;
grant execute on function public.rematch_dupla(uuid, text, uuid, text, boolean, text) to authenticated;

commit;

-- rollback: drop function public.rematch_dupla(uuid, text, uuid, text,
-- boolean, text); restaurar o corpo da 0105 (pg_get_functiondef pré-merge)
-- com o grant (uuid, text, uuid, text, boolean) original.
