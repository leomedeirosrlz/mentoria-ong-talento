-- 0100: grade de disponibilidade por célula — {"celulas":[{"dia","periodo"}]}
-- substitui o produto de conjuntos {"dias":[],"periodos":[]} que não
-- representava "ter de manhã e qui à noite" (o produto marcava os dois dias
-- nos dois períodos, inflando o cruzamento do matching e do overlay da
-- agenda). A célula é o encaixe honesto: mesmo dia E mesmo período.
--
-- app writes may briefly arrive in either shape during deploy; the trigger
-- canonicalizes so the CHECK only ever sees cells.
--
-- Ordem dentro da migration: a função de normalização nasce primeiro, o
-- CHECK (disponibilidade_ok) vira canônico em seguida, os triggers passam a
-- traduzir qualquer escrita legada e só então o backfill regrava as grades
-- antigas no formato novo. As constraints existentes seguem com o mesmo
-- nome — elas chamam disponibilidade_ok por referência e passam a validar
-- a forma de células sem precisar de drop/recreate.

-- Deploy-window: o objeto gravado carrega `dias`/`periodos` derivados das
-- células (expand & contract). O app antigo em produção lê as chaves
-- legadas e segue funcionando até o deploy do código novo — que prefere
-- `celulas`. A união derivada é superset do padrão exato (seg-manhã +
-- qui-noite vira dias{seg,qui}×períodos{manhã,noite} pro leitor velho):
-- degradação graciosa, mesma semântica que o modelo antigo já tinha.

begin;

-- ---------- normalizar_disponibilidade ----------
-- Aceita as duas formas e devolve sempre a canônica:
--   {"celulas":[{"dia":"seg","periodo":"manha"}...],
--    "dias":["seg",...],"periodos":["manha",...]}   ← chaves derivadas
-- · forma nova: limpa entradas inválidas/não-objeto, deduplica e reordena
--   na ordem canônica (seg→dom, manhã→noite);
-- · forma legada: produto dias×periodos; `periodos` vazio/ausente vale "o
--   dia inteiro" — a régua histórica era dia marcado sem recorte =
--   qualquer horário, então expande pras três células do dia;
-- · `dias`/`periodos` da saída são sempre DERIVADOS das células — mesmo
--   que a entrada os traga, são recalculados (nunca confiar na entrada);
-- · grade sem nenhuma célula devolve NULL: vazio é "não informado", nunca
--   um esqueleto gravado;
-- · entrada fora das duas formas volta intacta — inválido não se
--   normaliza, se reprova (o CHECK/RPC continuam travando).
create or replace function public.normalizar_disponibilidade(d jsonb)
returns jsonb
language plpgsql immutable parallel safe
set search_path = ''
as $$
declare
  cel jsonb := '[]'::jsonb;
  v_dias_out jsonb := '[]'::jsonb;
  v_pers_out jsonb := '[]'::jsonb;
  v_dia text;
  v_per text;
  v_pers text[];
begin
  if d is null then
    return null;
  end if;
  if jsonb_typeof(d) <> 'object' then
    return d;
  end if;

  if jsonb_typeof(d -> 'celulas') = 'array' then
    -- forma canônica: a ordem fixa já deduplica e ignora o que não é
    -- par válido de dia/periodo
    for v_dia in
      select * from unnest(array['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])
    loop
      for v_per in select * from unnest(array['manha', 'tarde', 'noite']) loop
        if exists (
          select 1
            from jsonb_array_elements(d -> 'celulas') as c
           where c ->> 'dia' = v_dia
             and c ->> 'periodo' = v_per
        ) then
          cel := cel || jsonb_build_object('dia', v_dia, 'periodo', v_per);
        end if;
      end loop;
    end loop;
  elsif d ? 'dias' or d ? 'periodos' then
    -- forma legada: as chaves existentes precisam ser arrays — tipo errado
    -- passa adiante pro CHECK reprovar em vez de normalizar inválido
    if (d ? 'dias' and jsonb_typeof(d -> 'dias') <> 'array')
       or (d ? 'periodos' and jsonb_typeof(d -> 'periodos') <> 'array') then
      return d;
    end if;
    -- períodos marcados na ordem canônica; nenhum = o dia inteiro
    select array_agg(p) into v_pers
      from unnest(array['manha', 'tarde', 'noite']) as p
     where (d -> 'periodos') ? p;
    if v_pers is null then
      v_pers := array['manha', 'tarde', 'noite'];
    end if;
    for v_dia in
      select * from unnest(array['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])
    loop
      -- `?` testa elemento de array jsonb: dedup e ordem canônica de graça
      if coalesce(d -> 'dias', '[]'::jsonb) ? v_dia then
        foreach v_per in array v_pers loop
          cel := cel || jsonb_build_object('dia', v_dia, 'periodo', v_per);
        end loop;
      end if;
    end loop;
  else
    -- nem células nem conjuntos — o objeto vazio vale "não informado";
    -- o resto devolve intacto pra reprovação
    if d = '{}'::jsonb then
      return null;
    end if;
    return d;
  end if;

  if coalesce(jsonb_array_length(cel), 0) = 0 then
    return null;
  end if;
  -- chaves derivadas pra leitura legada: os dias/períodos que AS CÉLULAS
  -- cobrem, na ordem canônica — a entrada nunca influencia a derivação
  for v_dia in
    select * from unnest(array['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])
  loop
    if exists (
      select 1 from jsonb_array_elements(cel) as c where c ->> 'dia' = v_dia
    ) then
      v_dias_out := v_dias_out || to_jsonb(v_dia);
    end if;
  end loop;
  for v_per in select * from unnest(array['manha', 'tarde', 'noite']) loop
    if exists (
      select 1 from jsonb_array_elements(cel) as c where c ->> 'periodo' = v_per
    ) then
      v_pers_out := v_pers_out || to_jsonb(v_per);
    end if;
  end loop;
  return jsonb_build_object(
    'celulas', cel, 'dias', v_dias_out, 'periodos', v_pers_out
  );
end;
$$;

-- ---------- disponibilidade_ok (canônica) ----------
-- Os CHECKs mentor_profiles_disponibilidade_ok (0034) e
-- mentorados_disponibilidade_ok (0038) seguem os mesmos: chamam esta
-- função por referência e o replace os atualiza de graça. Exige `celulas`
-- válida; `dias`/`periodos` são chaves derivadas aceitas (o trigger as
-- regrava sempre, então chegar aqui com elas erradas é impossível —
-- por isso não são revalidadas).
create or replace function public.disponibilidade_ok(d jsonb)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select d is null or (
    jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(d) as k
      where k not in ('celulas', 'dias', 'periodos')
    )
    and (
      -- `celulas` é obrigatória e tem que ser array válido — um objeto só
      -- de chaves legadas não passa (o trigger/RPC sempre normalizam antes,
      -- então uma grade válida chega aqui com células, nunca sem)
      jsonb_typeof(d -> 'celulas') = 'array'
        and not exists (
          select 1
            from jsonb_array_elements(d -> 'celulas') as c
           where jsonb_typeof(c) <> 'object'
              or exists (
                select 1 from jsonb_object_keys(c) as k
                where k not in ('dia', 'periodo')
              )
              or (c ->> 'dia') not in
                 ('seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom')
              or (c ->> 'periodo') not in ('manha', 'tarde', 'noite')
        )
    )
  );
$$;

-- ---------- trigger de canonicalização ----------
-- BEFORE INSERT OR UPDATE: traduz a escrita antes do CHECK ver — a janela
-- de deploy em que o app velho manda {"dias","periodos"} termina gravando
-- {"celulas"} do mesmo jeito. Também é o que transforma {"celulas":[]} em
-- NULL: esqueleto vazio nunca persiste.
create or replace function public.trg_normalizar_disponibilidade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  NEW.disponibilidade := public.normalizar_disponibilidade(NEW.disponibilidade);
  return NEW;
end;
$$;

drop trigger if exists mentor_profiles_disponibilidade_canonica
  on public.mentor_profiles;
create trigger mentor_profiles_disponibilidade_canonica
  before insert or update of disponibilidade on public.mentor_profiles
  for each row execute function public.trg_normalizar_disponibilidade();

drop trigger if exists mentorados_disponibilidade_canonica
  on public.mentorados;
create trigger mentorados_disponibilidade_canonica
  before insert or update of disponibilidade on public.mentorados
  for each row execute function public.trg_normalizar_disponibilidade();

-- ---------- backfill ----------
-- Regrava as grades existentes na forma canônica. O trigger acima refaz a
-- normalização em cima do resultado — idempotente, não muda nada.
update public.mentor_profiles
   set disponibilidade = public.normalizar_disponibilidade(disponibilidade)
 where disponibilidade is not null;

update public.mentorados
   set disponibilidade = public.normalizar_disponibilidade(disponibilidade)
 where disponibilidade is not null;

-- ---------- set_disponibilidade_mentorado (0078, forma nova) ----------
-- Mesma escrita escopada a my_mentorado_id() — a policy de UPDATE em
-- mentorados é coord-only. O que muda é a entrada: normaliza PRIMEIRO (o
-- jovem no app velho manda conjuntos; no novo, células) e só depois
-- valida; {"celulas":[]} vira NULL pelo mesmo caminho que o esqueleto
-- legado virava — "não informado" nunca grava grade vazia.
create or replace function public.set_disponibilidade_mentorado(p_grade jsonb)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_grade jsonb;
begin
  if public.my_role() <> 'mentorado' then
    raise exception 'Só o próprio jovem informa a própria disponibilidade';
  end if;
  -- inválido volta intacto da normalização e reprova aqui embaixo com a
  -- mensagem pt-BR — não como violação de constraint (mesma régua da 0078)
  v_grade := public.normalizar_disponibilidade(p_grade);
  if v_grade is not null and not public.disponibilidade_ok(v_grade) then
    raise exception 'Grade de disponibilidade inválida';
  end if;
  update public.mentorados
     set disponibilidade = v_grade
   where id = public.my_mentorado_id();
  if not found then
    raise exception 'Ficha de mentorado não encontrada';
  end if;
end;
$$;

revoke all on function public.set_disponibilidade_mentorado(jsonb) from public, anon;
grant execute on function public.set_disponibilidade_mentorado(jsonb) to authenticated;

commit;
