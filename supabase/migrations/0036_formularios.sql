-- 0036: engine nativa de formulários — a coordenação monta forms (avaliação
-- de encontro, 360, anamnese, inscrição), gera links individuais por pessoa
-- e o destinatário responde SEM login (mentorado não tem conta).
--
-- Modelo:
--   formularios          — definição: título, descrição e `campos` (jsonb
--                          [{id, tipo, label, obrigatorio, opcoes?}]);
--                          `versao` sobe a cada edição de campos pra leitura
--                          de respostas antigas saber que o schema mudou
--   formulario_links     — 1 token por destinatário (profile, mentorado ou
--                          genérico sem destinatário); `usado_em` marca a
--                          resposta, `expira_em` o prazo; `contexto` guarda
--                          metadados de emissão (ex.: encontro avaliado)
--   formulario_respostas — payload validado/sanitizado no servidor; uma
--                          resposta por link (unique link_id)
--
-- Acesso:
--   · app (coordenação) — RLS coord-only nas três tabelas; outros papéis
--     não leem nem escrevem
--   · público (/f/<token>) — SEM grant de tabela pra anon: leitura e envio
--     passam por RPCs security definer (mesmo padrão do aceite de termo por
--     token, 0033). O token é o fator de posse — 192 bits, base64url.
--
-- A definição do form vazada pelo token é inofensiva: são perguntas, não
-- respostas. Respostas nunca saem por RPC pública — só pela RLS da coord.

begin;

create table public.formularios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  campos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  versao int not null default 1,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(campos) = 'array')
);

create table public.formulario_links (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references public.formularios (id) on delete cascade,
  -- 192 bits url-safe (crypto.randomBytes(24).toString('base64url')) — a
  -- posse do link é a autorização pra responder
  token text not null unique check (char_length(token) >= 20),
  -- destinatário nominado (no máximo um dos dois) ou ambos null = genérico
  dest_profile_id uuid references public.profiles (id),
  dest_mentorado_id uuid references public.mentorados (id),
  -- vínculo de contexto (avaliação de encontro, 360 da dupla…): derivado do
  -- destinatário na emissão — a resposta sabe a quem/a qual dupla pertence
  dupla_id uuid references public.duplas (id),
  contexto jsonb not null default '{}'::jsonb,
  usado_em timestamptz,
  expira_em timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(dest_profile_id, dest_mentorado_id) <= 1),
  check (jsonb_typeof(contexto) = 'object')
);

create table public.formulario_respostas (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null unique references public.formulario_links (id) on delete cascade,
  -- {campo_id: valor} — só chaves declaradas em campos, tipos coagidos e
  -- validados pela RPC de envio (o banco é a fronteira, não o client)
  respostas jsonb not null,
  respondido_em timestamptz not null default now(),
  check (jsonb_typeof(respostas) = 'object')
);

create index formulario_links_formulario_idx
  on public.formulario_links (formulario_id);
create index formulario_links_dest_profile_idx
  on public.formulario_links (dest_profile_id) where dest_profile_id is not null;
create index formulario_links_dest_mentorado_idx
  on public.formulario_links (dest_mentorado_id) where dest_mentorado_id is not null;

alter table public.formularios enable row level security;
alter table public.formulario_links enable row level security;
alter table public.formulario_respostas enable row level security;

-- app inteiro é coord-only: outros papéis não têm tela (nav nem rota), e o
-- banco garante a fronteira mesmo se uma rota vazar
create policy formularios_coord on public.formularios for all
  to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

create policy formulario_links_coord on public.formulario_links for all
  to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

create policy formulario_respostas_coord on public.formulario_respostas for all
  to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

-- anon não toca tabela nenhuma (reforço explícito à linha dura da 0032):
-- o fluxo público inteiro é RPC
revoke all on public.formularios from anon;
revoke all on public.formulario_links from anon;
revoke all on public.formulario_respostas from anon;
grant select, insert, update, delete on public.formularios to authenticated;
grant select, insert, update, delete on public.formulario_links to authenticated;
grant select, insert, update, delete on public.formulario_respostas to authenticated;

create trigger formularios_touch
  before update on public.formularios
  for each row execute function public.touch_updated_at();

-- ---------- RPCs públicos (token = fator de posse) ----------

-- Valida e saneia o payload contra a definição `campos`: devolve um objeto
-- só com as chaves declaradas (qualquer campo extra do POST — honeypot,
-- injeção — é descartado), valores coagidos pro tipo e teto por campo.
-- Levanta exceção pt-BR nomeando a pergunta quando algo obrigatório falta
-- ou um valor não cabe no tipo.
create or replace function public.formularios_limpa_respostas(
  p_campos jsonb, p_respostas jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_campo jsonb;
  v_id text;
  v_tipo text;
  v_label text;
  v_obrig boolean;
  v_opcoes jsonb;
  v_val jsonb;
  v_txt text;
  v_num numeric;
  v_items jsonb;
  v_el jsonb;
begin
  if p_campos is null or jsonb_typeof(p_campos) <> 'array' then
    raise exception 'formulário sem perguntas';
  end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'respostas inválidas';
  end if;

  for v_campo in select value from jsonb_array_elements(p_campos) loop
    v_id := v_campo ->> 'id';
    v_tipo := v_campo ->> 'tipo';
    v_label := coalesce(nullif(btrim(v_campo ->> 'label'), ''), 'esta pergunta');
    v_obrig := coalesce((v_campo ->> 'obrigatorio')::boolean, false);
    v_opcoes := v_campo -> 'opcoes';
    v_val := p_respostas -> v_id;

    -- vazio genérico: ausente, null, "" ou [] — idem pro obrigatório
    if v_id is null
       or v_val is null
       or v_val = 'null'::jsonb
       or (jsonb_typeof(v_val) = 'string' and btrim(v_val #>> '{}') = '')
       or (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0)
    then
      if v_obrig then
        raise exception 'Responda "%" antes de enviar', v_label;
      end if;
      continue;
    end if;

    case v_tipo
      when 'texto', 'texto_longo' then
        if jsonb_typeof(v_val) <> 'string' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        v_txt := left(btrim(v_val #>> '{}'),
                      case when v_tipo = 'texto' then 500 else 5000 end);
        v_out := jsonb_set(v_out, array[v_id], to_jsonb(v_txt));

      when 'data' then
        if jsonb_typeof(v_val) <> 'string'
           or (v_val #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Use uma data válida em "%"', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], to_jsonb(v_val #>> '{}'));

      when 'select' then
        if jsonb_typeof(v_val) <> 'string' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        v_txt := v_val #>> '{}';
        if jsonb_typeof(v_opcoes) = 'array' and not exists (
          select 1 from jsonb_array_elements_text(v_opcoes) o where o = v_txt
        ) then
          raise exception 'Opção inválida em "%"', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], to_jsonb(v_txt));

      when 'sim_nao' then
        if jsonb_typeof(v_val) <> 'string'
           or (v_val #>> '{}') not in ('sim', 'nao') then
          raise exception 'Responda "%" com sim ou não', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], to_jsonb(v_val #>> '{}'));

      when 'escala_1_5' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        v_num := (v_val #>> '{}')::numeric;
        if v_num <> trunc(v_num) or v_num < 1 or v_num > 5 then
          raise exception 'Escolha uma nota de 1 a 5 em "%"', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], to_jsonb(v_num::int));

      when 'checkbox' then
        if jsonb_typeof(v_val) <> 'boolean' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        if v_obrig and not (v_val #>> '{}')::boolean then
          raise exception 'Marque "%" pra continuar', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], v_val);

      when 'multi_select' then
        if jsonb_typeof(v_val) <> 'array' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        if jsonb_array_length(v_val) > 50 then
          raise exception 'Opções demais em "%"', v_label;
        end if;
        v_items := '[]'::jsonb;
        for v_el in select value from jsonb_array_elements(v_val) loop
          if jsonb_typeof(v_el) <> 'string' then
            raise exception 'Formato inválido em "%"', v_label;
          end if;
          v_txt := v_el #>> '{}';
          if jsonb_typeof(v_opcoes) = 'array' and not exists (
            select 1 from jsonb_array_elements_text(v_opcoes) o where o = v_txt
          ) then
            raise exception 'Opção inválida em "%"', v_label;
          end if;
          -- dedupe: a UI pode mandar repetição, o banco guarda conjunto
          if not (v_items @> to_jsonb(v_txt)) then
            v_items := v_items || to_jsonb(v_txt);
          end if;
        end loop;
        if v_obrig and jsonb_array_length(v_items) = 0 then
          raise exception 'Marque ao menos uma opção em "%"', v_label;
        end if;
        v_out := jsonb_set(v_out, array[v_id], v_items);

      else
        -- tipo desconhecido (schema evoluiu depois do envio): não grava o
        -- valor — melhor perder um campo do que guardar lixo
        continue;
    end case;
  end loop;
  return v_out;
end $$;

-- Público (anon): definição do form pra renderizar /f/<token>. Só devolve o
-- necessário pra tela: perguntas, saudação (primeiro nome do destinatário)
-- e o estado do link — nunca respostas nem dados de outros links.
create or replace function public.formulario_por_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_nome text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
         fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo, f.descricao, f.campos, f.ativo, f.versao
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(p.nome, m.nome) into v_nome
    from formulario_links fl
    left join profiles p on p.id = fl.dest_profile_id
    left join mentorados m on m.id = fl.dest_mentorado_id
    where fl.id = l.id;

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
      'versao', l.versao
    )
  );
end $$;

-- Público (anon): envia a resposta do link. Atômico: o update que marca
-- usado_em é o gate da corrida — dois submits simultâneos, só um insere;
-- o segundo recebe o id da resposta já gravada (idempotente, duplo-clique
-- e retry de rede não erram nem duplicam).
create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
begin
  select fl.id, fl.usado_em, fl.expira_em, f.ativo as f_ativo, f.campos
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- idempotente: já respondido devolve a resposta existente
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas);

  update formulario_links set usado_em = now()
    where id = l.id and usado_em is null;
  if not found then
    -- perdeu a corrida: a resposta do vencedor já está gravada (ou vai
    -- estar no commit dele — o unique de link_id protege o pior caso)
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;
  return v_id;
end $$;

-- grants de execução: o público (anon) usa os dois do token; o helper de
-- validação é interno — só roda dentro do security definer
revoke all on function public.formularios_limpa_respostas(jsonb, jsonb)
  from public, anon;
grant execute on function public.formularios_limpa_respostas(jsonb, jsonb)
  to authenticated;

revoke all on function public.formulario_por_token(text) from public;
grant execute on function public.formulario_por_token(text)
  to anon, authenticated;

revoke all on function public.submeter_resposta_formulario(text, jsonb)
  from public;
grant execute on function public.submeter_resposta_formulario(text, jsonb)
  to anon, authenticated;

commit;
