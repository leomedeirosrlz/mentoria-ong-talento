-- 0112: promoção de ex-mentorado a mentor (alumni → staff), REALIZA-159.
--
-- CONTEXTO
-- Jovem que conclui o programa é candidato natural a mentor num ciclo
-- seguinte. Não existia caminho: `setPessoaRole` rejeita 'mentorado' como
-- alvo e trocar o papel na mão quebraria a invariante de identidade —
-- `mentorados` é a identidade de PARTICIPAÇÃO (duplas/encontros/forms
-- penduram nela), `profiles` a de conta/staff. `mentorados.profile_id`
-- (unique, nullable — 0066) liga os dois permanentemente.
--
-- O que a promoção faz, atomicamente:
--   · reusa o `profiles` já vinculado ou CRIA um (pré-cadastro 0045:
--     user_id null até o 1º magic link — por isso e-mail é exigido);
--   · sai o papel 'mentorado', entra mentor_dpp (escopo = turma) ou
--     mentor_especialista (pool global, escopo null — 0101) como PRIMÁRIO
--     direto em profile_papeis; profiles.role deriva pelo trigger
--     profile_papeis_projeta_role — NUNCA é escrito à mão: o espelho
--     profiles_role_para_papeis reinterpretaria o write como "papel
--     global primário" e criaria uma linha global redundante ao lado da
--     escopada (a revisão de banco apontou exatamente isso);
--   · mentor_profiles nasce com o tipo do papel e capacidade default;
--   · a trilha de auditoria vai pra pessoa_notas dos DOIS lados da
--     identidade — o CHECK XOR (0016: num_nonnulls(profile_id,
--     mentorado_id) = 1) exige uma linha por âncora, então são dois
--     inserts com o mesmo texto: um na ficha da pessoa, um no histórico
--     do jovem;
--   · dados_civis do jovem migra pro profile — perfil canônico rico.
--     Criação: copia integral. Profile existente: merge "só-vazios" —
--     chave já preenchida no profile nunca é sobrescrita.
--
-- O que NÃO muda: mentorados/duplas/encontros/registros/respostas/
-- assinaturas seguem intocados (o jovem era ele, o mentor é ele) e
-- mentorados.profile_id nunca é reescrito — só preenchido quando null.
-- As superfícies de jovem fecham sozinhas: my_role() deixa de ser
-- 'mentorado' e toda view/RPC jovem tem esse gate explícito.
-- `my_mentorado_id()` SEGUE resolvendo (0066: identidade permanente) —
-- o que sobra de acesso é sempre e só o histórico da PRÓPRIA pessoa:
-- auditoria da revisão de segurança conferiu que nenhum ramo
-- `= my_mentorado_id()` em policy/RPC vaza dado de terceiro — são
-- leituras das próprias linhas (PDM próprio, chamado próprio, thread de
-- negociação própria), que já eram dela como jovem.
--
-- Elegibilidade (decisão fechada): SÓ situacao='concluido'. Desistente
-- não entra — o caminho pra ele é reverter a saída e concluir.
-- Reversão da promoção não existe (como nenhum papel): a coordenação
-- corrige via setPessoaRole.

begin;

create or replace function public.promover_mentorado_mentor(
  p_mentorado_id uuid,
  p_papel public.app_role,
  p_turma text default null,
  p_obs text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m public.mentorados%rowtype;
  v_profile uuid;
  v_escopo text;
  v_nota text;
begin
  if public.my_role() is distinct from 'coordenacao' then
    raise exception 'Só a coordenação promove ex-mentorados a mentor';
  end if;
  if p_papel not in ('mentor_dpp', 'mentor_especialista') then
    raise exception 'O papel alvo precisa ser mentor de jornada ou especialista';
  end if;
  -- especialista é pool GLOBAL (0101): escopo fica null mesmo se vier turma.
  -- DPP exige a turma — o trigger profile_papeis_escopo_check ainda valida
  -- o label contra cronogramas/duplas (typo vira papel morto sem ela)
  v_escopo := case
    when p_papel = 'mentor_especialista' then null
    else nullif(btrim(coalesce(p_turma, '')), '')
  end;
  if p_papel = 'mentor_dpp' and v_escopo is null then
    raise exception 'Escolha a turma de escopo do mentor de jornada';
  end if;
  if p_obs is not null and char_length(p_obs) > 2000 then
    raise exception 'Observação muito longa (máx. 2000 caracteres)';
  end if;

  -- lock da row: duplo clique/corrida serializa aqui antes dos writes
  select * into m from public.mentorados where id = p_mentorado_id
   for update;
  if not found then
    raise exception 'Mentorado não encontrado';
  end if;
  if m.situacao is distinct from 'concluido' then
    raise exception 'Só quem concluiu o programa pode virar mentor';
  end if;
  -- redundante com o bloqueio da saída (0077), barato — defesa em
  -- profundidade: promover quem ainda tá em dupla deixaria a pessoa dos
  -- dois lados da relação mentor×mentorado
  if exists (
    select 1 from public.duplas d
     where d.mentorado_id = m.id and d.status in ('ativa', 'pausada')
  ) then
    raise exception 'Esse cadastro ainda tem dupla em andamento';
  end if;

  v_profile := m.profile_id;
  if v_profile is null then
    -- jovem nunca logou (fluxos por token): a promoção CRIA o profile de
    -- staff. E-mail é obrigatório — é a identidade do magic link e a chave
    -- do vínculo automático do handle_new_user no 1º login
    if nullif(btrim(coalesce(m.email, '')), '') is null then
      raise exception 'Cadastre um e-mail na ficha do jovem antes de promover — é o endereço do magic link';
    end if;
    if lower(btrim(m.email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'O e-mail do jovem não parece válido — corrija na ficha antes de promover';
    end if;
    if exists (
      select 1 from public.profiles p
       where lower(p.email) = lower(btrim(m.email))
    ) then
      raise exception 'Já existe uma pessoa cadastrada com esse e-mail — vincule o cadastro na ficha do jovem antes de promover';
    end if;
    -- role entra NULL de propósito: o espelho profiles_role_para_papeis
    -- (0085) leria o insert como "papel global primário". O papel certo —
    -- escopado e primário — é escrito direto na tabela abaixo e o trigger
    -- profile_papeis_projeta_role projeta o profiles.role dele.
    -- whatsapp só migra se estiver livre (unique parcial): em colisão fica
    -- de fora em vez de derrubar a promoção — a coordenação completa depois
    insert into public.profiles (nome, email, whatsapp, dados_civis, role, ativo)
    values (
      m.nome,
      lower(btrim(m.email)),
      case
        when m.whatsapp is not null and m.whatsapp ~ '^\d+$'
             and not exists (
               select 1 from public.profiles w where w.whatsapp = m.whatsapp)
        then m.whatsapp
      end,
      m.dados_civis,
      null,
      true
    )
    returning id into v_profile;
    -- vínculo permanente jovem↔conta (0066) — preenchido uma única vez
    update public.mentorados set profile_id = v_profile where id = m.id;
  else
    if not exists (select 1 from public.profiles p where p.id = v_profile) then
      raise exception 'O cadastro vinculado ao jovem não existe mais';
    end if;
    -- mesma regra do setPessoaRole: papel próprio não se troca — e aqui o
    -- guard_profiles_self_columns derrubaria a projeção com erro opaco
    if v_profile = public.my_profile_id() then
      raise exception 'Não é possível promover o próprio cadastro — peça a outra pessoa da coordenação';
    end if;
    if exists (
      select 1 from public.profiles p where p.id = v_profile and not p.ativo
    ) then
      raise exception 'O cadastro dessa pessoa está desativado — reative na seção Inativos antes de promover';
    end if;
    -- merge "só-vazios": o que o profile já tem preenchido vence sempre;
    -- do jovem entram só chaves ausentes ou vazias (null / '' / jsonb
    -- null), e só quando o VALOR do jovem tem conteúdo — não se copia
    -- vazio por cima de vazio
    update public.profiles p
       set dados_civis =
         coalesce(p.dados_civis, '{}'::jsonb) || coalesce((
           select jsonb_object_agg(me.key, me.value)
             from jsonb_each(coalesce(m.dados_civis, '{}'::jsonb)) me
            where me.value is not null
              and me.value <> 'null'::jsonb
              and (jsonb_typeof(me.value) is distinct from 'string'
                   or btrim(me.value #>> '{}') <> '')
              and (p.dados_civis ->> me.key is null
                   or btrim(p.dados_civis ->> me.key) = '')
         ), '{}'::jsonb)
     where p.id = v_profile;
  end if;

  -- segundo clique/corrida: mesmo papel + mesmo escopo já existe → erro
  -- explícito (a unique nulls not distinct barraria com mensagem feia).
  -- Escopo/outro papel diferente segue — multi-papel é modelo do 0085
  if exists (
    select 1 from public.profile_papeis pp
     where pp.profile_id = v_profile
       and pp.papel = p_papel
       and pp.escopo_turma is not distinct from v_escopo
  ) then
    raise exception 'Essa pessoa já tem esse papel de mentor';
  end if;

  -- fonte de verdade dos papéis (0085): entra o papel novo como PRIMÁRIO
  -- (norm_primario rebaixa o mentorado; projeta_role escreve
  -- profiles.role dele) e sai o papel de mentorado — a autorização jovem
  -- morre aqui, a identidade (mentorados.profile_id) permanece
  insert into public.profile_papeis (profile_id, papel, escopo_turma, primario)
  values (v_profile, p_papel, v_escopo, true);
  delete from public.profile_papeis
   where profile_id = v_profile and papel = 'mentorado';

  -- extensão de mentor: tipo pelo papel, capacidades no default 1
  -- (pool DPP lê `capacidade`, pool esp `capacidade_especialista`).
  -- conflict-do-nothing: quem já teve ficha de mentor não perde
  -- capacidade/áreas/termo gravados
  insert into public.mentor_profiles (profile_id, tipo)
  values (
    v_profile,
    case when p_papel = 'mentor_especialista' then 'especialista' else 'dpp' end
  )
  on conflict (profile_id) do nothing;

  -- trilha nos DOIS lados da identidade — a nota aparece na ficha da
  -- pessoa nova de staff E no histórico do cadastro de jovem (o XOR da
  -- 0016 proíbe as duas colunas na mesma linha: um insert por âncora).
  -- O verbo flexiona no feminino quando a ficha declara — o resto dos
  -- valores (não_binario/outro/prefiro_nao_dizer/null) cai no masculino
  -- genérico, padrão do pt-BR pra desconhecido
  v_nota :=
    case m.genero when 'feminino' then 'Promovida a mentora' else 'Promovido a mentor' end ||
    case
      when p_papel = 'mentor_dpp' then ' de jornada (turma ' || v_escopo || ')'
      else ' especialista'
    end ||
    ' em ' || to_char(current_date, 'DD/MM/YYYY') ||
    coalesce(' — ' || nullif(btrim(p_obs), ''), '');
  insert into public.pessoa_notas (profile_id, texto, created_by)
  values (v_profile, v_nota, public.my_profile_id());
  insert into public.pessoa_notas (mentorado_id, texto, created_by)
  values (m.id, v_nota, public.my_profile_id());

  return v_profile;
end $$;

comment on function public.promover_mentorado_mentor(uuid, public.app_role, text, text) is
  'Promove mentorado concluído a mentor (REALIZA-159): cria/reusa profile, papel mentor_* primário escopado em profile_papeis (profiles.role deriva), mentor_profiles, nota nos dois lados da identidade. Coord-only.';

-- mesmo padrão do rematch_dupla (0105): executável por authenticated, o
-- guard my_role no corpo é a fronteira; fora de authenticated nada executa
revoke all on function public.promover_mentorado_mentor(uuid, public.app_role, text, text)
  from public, anon;
grant execute on function public.promover_mentorado_mentor(uuid, public.app_role, text, text)
  to authenticated;

-- mentorados.profile_id legível pelo app: a coluna nasceu na 0066 DEPOIS do
-- revoke table-level + grant por coluna da 0034, e nunca entrou na lista —
-- toda leitura client-side (o "tem conta" do dialog de saída, o guard de
-- dupla viva do setPessoaRole) batia em permission denied e falhava em
-- silêncio. A promoção precisa do vínculo visível pra UI explicar conta
-- nova × conta existente e a ficha mostrar a pessoa nos dois lados. Não é
-- dado sensível: o diretório de turma já expõe profile_id de colegas (0076).
grant select (profile_id) on public.mentorados to authenticated;

commit;

-- rollback: drop function public.promover_mentorado_mentor(uuid, public.app_role, text, text);
--           revoke select (profile_id) on public.mentorados from authenticated;
-- (dados produzidos ficam — reverter uma promoção é decisão de domínio,
--  feita à mão via setPessoaRole + delete do papel em profile_papeis)
