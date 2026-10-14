-- 0082 — importar_registros: import em lote das respostas do form semanal
-- externo ("Avaliação semanal das Mentorias" — Google Forms) pra dentro da
-- plataforma. Cada resposta vira:
--
--   encontro (dupla_id, numero):
--     · não existe  → cria born-realizado (origem 'externo',
--                     data_hora = realizado_em = data do form)
--     · existe e não é realizado → marca realizado, realizado_em coalescido
--       (o instante real do encontro: o que a dupla já tinha preenchido,
--       senão a data do form, senão o agendado)
--     · já realizado → não toca (a agenda da dupla é a verdade)
--   registro (encontro_id, unique):
--     · não existe → insert com os campos do form
--     · existe     → update dos campos mapeados — re-import é idempotente
--       (precisa_apoio NUNCA entra: apoio é pedido explícito do mentor na
--       plataforma, o import não infere — e a flag é sticky, mexer nela
--       apagaria um pedido legítimo)
--
-- O registro sai com created_by = mentor da dupla — atribuição honesta, o
-- follow-up é dele (a coordenação só fez a ponte do form). Isso exige
-- bypassar o guard_autoria (0023), que derruba "autoria forjada" quando
-- created_by <> my_profile_id(). O bypass segue o padrão realiza.* já
-- usado em 0040/0052/0074: flag transaction-local que só esta RPC liga —
-- PostgREST roda um statement por transação e set_config não é alcançável
-- pela API, então ninguém arma a flag antes de um insert solto.
--
-- Quem chama: coordenação (app) ou service_role/postgres (script CLI e
-- reparos via SQL — mesmo escopo do backfill de seed, sem JWT de papel).
-- Anon/authenticated sem papel de coordenação caem na exceção.
--
-- Idempotente por item: cada resposta processa dentro de um sub-bloco
-- (savepoint implícito), erro de uma linha não derruba o lote — vira
-- {i, erro} no relatório jsonb.

begin;

-- 1) guard_autoria: brecha transaction-local pro import creditar o mentor.
--    Só o ramo INSERT abre — 'autoria imutavel' no UPDATE segue absoluta.
create or replace function public.guard_autoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text := tg_argv[0];
  novo uuid := (to_jsonb(new) ->> col)::uuid;
begin
  if tg_op = 'INSERT' then
    if novo is null then
      new := jsonb_populate_record(
        new, jsonb_build_object(col, public.my_profile_id())
      );
    elsif public.my_profile_id() is not null
      and novo <> public.my_profile_id()
      -- 0082: import de registros credita o mentor da dupla no created_by.
      -- A flag é transaction-local e só importar_registros() liga — um
      -- usuário não consegue ligá-la via PostgREST antes de um insert.
      and current_setting('realiza.import_registros', true) is distinct from 'on'
    then
      raise exception 'autoria forjada';
    end if;
    return new;
  end if;
  if (to_jsonb(old) ->> col) is distinct from (to_jsonb(new) ->> col) then
    raise exception 'autoria imutavel';
  end if;
  return new;
end;
$$;

-- 2) a RPC ------------------------------------------------------------------

create or replace function public.importar_registros(itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::json) ->> 'role',
    ''
  );
  v_item jsonb;
  v_reg  jsonb;
  v_i int := -1;
  v_resultado jsonb := '[]'::jsonb;
  v_dupla_id uuid;
  v_mentor_id uuid;
  v_numero int;
  v_data timestamptz;
  v_duracao smallint;
  v_enc record;
  v_enc_id uuid;
  v_enc_criado boolean;
  v_reg_criado boolean;
  v_atividades text[];
begin
  -- coord (app) ou caminho de operação: service_role (script CLI) e
  -- postgres/supabase_admin (SQL direto — mesmo escopo do backfill, sem JWT)
  if public.my_role() is distinct from 'coordenacao'
     and v_jwt_role not in ('service_role')
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só a coordenação importa registros';
  end if;
  if itens is null or jsonb_typeof(itens) <> 'array' then
    raise exception 'itens precisa ser um array jsonb';
  end if;

  -- flags transaction-local (padrão realiza.*): sem sino de "encontro
  -- marcado"/prompt de avaliação pro lote inteiro (os triggers de agenda
  -- consultam realiza.no_notify — 0071/0072) e autoria = mentor da dupla.
  perform set_config('realiza.no_notify', 'on', true);
  perform set_config('realiza.import_registros', 'on', true);

  for v_item in select value from pg_catalog.jsonb_array_elements(itens)
  loop
    v_i := v_i + 1;
    begin
      -- estado por item: variáveis plpgsql persistem entre iterações — sem
      -- o reset um erro cedo no bloco vazaria valores da linha anterior
      -- pro relatório (dupla_id errado no {i, erro})
      v_dupla_id := null;
      v_mentor_id := null;
      v_numero := null;
      v_data := null;
      v_duracao := null;
      v_enc := null;
      v_enc_id := null;
      v_enc_criado := null;
      v_reg_criado := null;
      v_atividades := null;

      -- entrada mínima: dupla + número do encontro
      if jsonb_typeof(v_item) <> 'object' then
        raise exception 'item precisa ser um objeto';
      end if;
      v_dupla_id := nullif(v_item ->> 'dupla_id', '')::uuid;
      v_numero := nullif(v_item ->> 'numero', '')::int;
      if v_dupla_id is null then
        raise exception 'sem dupla_id';
      end if;
      if v_numero is null or v_numero < 1 or v_numero > 24 then
        raise exception 'número de encontro inválido: %', v_item ->> 'numero';
      end if;
      select d.mentor_id into v_mentor_id
        from public.duplas d where d.id = v_dupla_id;
      if not found then
        raise exception 'dupla não encontrada';
      end if;

      -- data_hora: texto ISO ou null (encontro sem data entra só com numero)
      begin
        v_data := nullif(v_item ->> 'data_hora', '')::timestamptz;
      exception when others then
        raise exception 'data_hora inválida: %', v_item ->> 'data_hora';
      end;

      -- duração opcional — mesma faixa do CHECK encontros_duracao_faixa
      v_duracao := nullif(v_item ->> 'duracao_min', '')::smallint;
      if v_duracao is not null and v_duracao not in (30, 45, 60, 90, 120) then
        v_duracao := null;
      end if;

      -- ----- encontro -----
      select * into v_enc
        from public.encontros e
        where e.dupla_id = v_dupla_id and e.numero = v_numero;
      if not found then
        insert into public.encontros
          (dupla_id, numero, data_hora, duracao_min, status, origem,
           realizado_em, created_by)
        values
          (v_dupla_id, v_numero, v_data, coalesce(v_duracao, 60), 'realizado',
           'externo', v_data, v_mentor_id)
        returning id into v_enc_id;
        v_enc_criado := true;
      else
        v_enc_id := v_enc.id;
        v_enc_criado := false;
        if v_enc.status <> 'realizado' then
          update public.encontros e set
            status = 'realizado',
            realizado_em = coalesce(e.realizado_em, v_data, e.data_hora),
            data_hora = coalesce(e.data_hora, v_data),
            duracao_min = coalesce(v_duracao, e.duracao_min)
          where e.id = v_enc.id;
        end if;
      end if;

      -- ----- registro (upsert por encontro_id) -----
      v_reg := coalesce(v_item -> 'registro', '{}'::jsonb);
      if jsonb_typeof(v_reg) <> 'object' then
        raise exception 'registro precisa ser um objeto';
      end if;
      if v_reg ? 'atividades' then
        if jsonb_typeof(v_reg -> 'atividades') = 'array' then
          select coalesce(pg_catalog.array_agg(x), '{}') into v_atividades
            from pg_catalog.jsonb_array_elements_text(v_reg -> 'atividades') x;
        else
          raise exception 'atividades precisa ser array';
        end if;
      else
        v_atividades := null; -- update preserva; insert cai no default '{}'
      end if;

      -- enums: o CHECK existe, mas validar aqui devolve erro legível por item
      if v_reg ->> 'avaliacao' is not null
         and v_reg ->> 'avaliacao' not in ('excelente', 'boa', 'regular', 'baixa') then
        raise exception 'avaliacao inválida: %', v_reg ->> 'avaliacao';
      end if;
      if v_reg ->> 'dificuldade' is not null
         and v_reg ->> 'dificuldade' not in
             ('nenhuma', 'aprendizagem', 'participacao', 'comportamental',
              'organizacao', 'outro') then
        raise exception 'dificuldade inválida: %', v_reg ->> 'dificuldade';
      end if;
      if v_reg ->> 'proximo_passo' is not null
         and v_reg ->> 'proximo_passo' not in
             ('continuar', 'reforcar', 'novo_feedback', 'acompanhar_de_perto',
              'conversa_individual', 'outro') then
        raise exception 'proximo_passo inválido: %', v_reg ->> 'proximo_passo';
      end if;

      if exists (select 1 from public.registros r where r.encontro_id = v_enc_id) then
        -- idempotente: mesmos campos do form, precisa_apoio e created_by fora
        update public.registros r set
          tema = nullif(v_reg ->> 'tema', ''),
          ferramenta = nullif(v_reg ->> 'ferramenta', ''),
          reflexoes = nullif(v_reg ->> 'reflexoes', ''),
          observacoes = nullif(v_reg ->> 'observacoes', ''),
          atividades = coalesce(v_atividades, r.atividades),
          avaliacao = v_reg ->> 'avaliacao',
          dificuldade = v_reg ->> 'dificuldade',
          dificuldade_detalhe = nullif(v_reg ->> 'dificuldade_detalhe', ''),
          proximo_passo = v_reg ->> 'proximo_passo',
          proximo_passo_detalhe = nullif(v_reg ->> 'proximo_passo_detalhe', '')
        where r.encontro_id = v_enc_id;
        v_reg_criado := false;
      else
        insert into public.registros
          (encontro_id, tema, ferramenta, reflexoes, observacoes, atividades,
           avaliacao, dificuldade, dificuldade_detalhe, proximo_passo,
           proximo_passo_detalhe, created_by)
        values
          (v_enc_id,
           nullif(v_reg ->> 'tema', ''),
           nullif(v_reg ->> 'ferramenta', ''),
           nullif(v_reg ->> 'reflexoes', ''),
           nullif(v_reg ->> 'observacoes', ''),
           coalesce(v_atividades, '{}'),
           v_reg ->> 'avaliacao',
           v_reg ->> 'dificuldade',
           nullif(v_reg ->> 'dificuldade_detalhe', ''),
           v_reg ->> 'proximo_passo',
           nullif(v_reg ->> 'proximo_passo_detalhe', ''),
           v_mentor_id);
        v_reg_criado := true;
      end if;

      v_resultado := v_resultado || pg_catalog.jsonb_build_object(
        'i', v_i,
        'dupla_id', v_dupla_id,
        'encontro_id', v_enc_id,
        'encontro_criado', v_enc_criado,
        'registro_criado', v_reg_criado
      );
    exception when others then
      v_resultado := v_resultado || pg_catalog.jsonb_build_object(
        'i', v_i,
        'dupla_id', v_dupla_id,
        'erro', sqlerrm
      );
    end;
  end loop;

  return v_resultado;
end;
$$;

revoke all on function public.importar_registros(jsonb) from public, anon;
grant execute on function public.importar_registros(jsonb) to authenticated, service_role;

comment on function public.importar_registros(jsonb) is
  'Importa respostas do form semanal externo: encontro born-realizado (origem externo) + upsert do registro do mentor. Coord-only via app; service_role/postgres pro script CLI. Retorna relatório jsonb por item.';

commit;
