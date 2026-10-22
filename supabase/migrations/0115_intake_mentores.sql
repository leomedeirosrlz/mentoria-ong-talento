-- 0115 · Intake de mentores nativo (REALIZA-70, com as capacidades da
-- REALIZA-36 que a engine ainda não tinha). Transforma o forms engine no
-- substituto do Google Forms de inscrição de mentores:
--
--   · link REUTILIZÁVEL (formulario_links.multi_uso + origem='intake') —
--     o mesmo /f/<token> aceita N respostas anônimas. Links manuais seguem
--     de uso único, agora garantido por trigger com advisory lock (a
--     unique(link_id) saía de cena pra multi-resposta caber na tabela —
--     resposta_unica_guard serializa o check-and-insert por link);
--   · tipos de campo novos nos campos jsonb: 'arquivo' (upload pra bucket
--     privado form-anexos, registrado em formulario_anexos pelo RPC
--     form_anexo_put — anon nunca ganha write no bucket) e
--     'grid_disponibilidade' (grade seg–sex × 09h–19h que grava o
--     canônico {celulas:[{dia,periodo}]} da 0100 + a marcação horária
--     verbatim em `horas` pra leitura da coordenação). Meta de definição
--     nova: visible_if {campo, em[]} (pergunta condicional) e
--     permite_outro (select/multi_select com "Outro" de texto livre,
--     serializado "Outro: <texto>");
--   · formulario_respostas.promovido_profile_id — carimbo da promoção:
--     a coordenação transforma uma resposta no cadastro (via dialog de
--     pessoa pré-preenchido) e a resposta fica marcada, sem apagar a
--     trilha de auditoria;
--   · seed do formulário oficial "Matching de Mentores"
--     (sistema='intake_mentor') — verbatim do Google Form mapeado em
--     docs/planos/forms-google-mapeamento.md, UMA grade só (a duplicata
--     do form antigo era artefato de cópia — _decisoes.md);
--   · formularios_limpa_respostas ganha p_link_id (3º arg): o caminho de
--     'arquivo' só vale se vier de formulario_anexos do PRÓPRIO link —
--     apontar pro arquivo de outra inscrição é rejeitado. A assinatura
--     antiga de 2 args é dropada (única chamadora é a própria
--     submeter_resposta_formulario);
--   · submeter_resposta_formulario reescrita POR CIMA da 0109: preserva
--     verbatim TODOS os ramos (identidade opcional via claims, gate
--     outra_pessoa, sanitizer, usado_em, checklist 360, projeção PDM,
--     notificação) e acrescenta os tetos do multi-uso (500 total,
--     50/dia) com advisory lock por link.
--
-- Ordem de merge com o backlog: a 36 (upload/anexos) funde neste arquivo
-- como dependência implementada; a 69 (intake de mentorado) reusa
-- multi_uso + RPCs e faz append do enum/seed 'intake_mentorado' — o
-- CHECK já aceita o valor pra reduzir conflito (o form só existe quando
-- a 69 semear); a 20/181 que reescrevem a RPC devem mergear os ramos —
-- não basta recolar a 0109.

-- ---------- links multi-uso ----------

alter table public.formulario_links
  add column multi_uso boolean not null default false,
  add column origem text not null default 'manual'
    check (origem in ('manual', 'intake'));

comment on column public.formulario_links.multi_uso is
  'Link de campanha (intake): aceita N respostas anônimas e nunca carimba usado_em; o guard de uso único não se aplica.';
comment on column public.formulario_links.origem is
  'manual = link emitido pela coordenação pra um destinatário; intake = link de inscrição reutilizável (divulgação pública).';

-- ---------- promoção da resposta → cadastro ----------

alter table public.formulario_respostas
  add column promovido_profile_id uuid references public.profiles(id);

comment on column public.formulario_respostas.promovido_profile_id is
  'Carimbo da promoção: a resposta de intake virou o cadastro deste profile. A resposta segue intacta como trilha de auditoria.';

-- a unique de 0036 morria no multi-uso; sai do constraint e vira índice
-- de apoio ao guard (mesma cobertura, sem a restrição)
alter table public.formulario_respostas
  drop constraint if exists formulario_respostas_link_id_key;

create index if not exists formulario_respostas_link_idx
  on public.formulario_respostas (link_id);

-- uso único por link manual, agora com serialização real: o insert pega
-- um advisory lock por link (escopo da transação) antes do EXISTS — dois
-- submits concorrentes no mesmo link ordenam um atrás do outro e o
-- segundo enxerga a linha do primeiro (a checagem no RPC — update
-- usado_em gateado — continua como caminho amigável; o trigger é a
-- garantia física contra escritores fora do RPC, ex.: a reescrita da 20)
create or replace function public.resposta_unica_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_multi boolean;
begin
  select multi_uso into v_multi
  from public.formulario_links
  where id = new.link_id;
  if v_multi then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('form-resposta:' || new.link_id::text)::bigint
  );
  if exists (
    select 1 from public.formulario_respostas where link_id = new.link_id
  ) then
    raise exception 'este link já foi respondido'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists resposta_unica_guard on public.formulario_respostas;
create trigger resposta_unica_guard
  before insert on public.formulario_respostas
  for each row execute function public.resposta_unica_guard();

-- ---------- oficial: o enum aceita os intakes ----------

alter table public.formularios
  drop constraint if exists formularios_sistema_check;
alter table public.formularios
  add constraint formularios_sistema_check check (
    sistema in (
      'anamnese', 'avaliacao_360', 'autoavaliacao_mentor',
      'visao', 'roda_vida', 'pdm', 'metas',
      'avaliacao_especialista',
      'intake_mentor', 'intake_mentorado'
    )
  );

-- ---------- anexos: metadados + bucket privado ----------

create table public.formulario_anexos (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.formulario_links(id) on delete cascade,
  campo_id text not null,
  path text not null unique,
  nome text not null,
  tamanho int not null,
  created_at timestamptz not null default now()
);
create index formulario_anexos_link_idx
  on public.formulario_anexos (link_id);

comment on table public.formulario_anexos is
  'Metadados dos uploads do intake público (REALIZA-70). path aponta pro objeto no bucket form-anexos: "<link_id>/<uuid>.<ext>". O upload passa por RPC definer (form_anexo_put registra) + admin (grava o objeto); a leitura sai por /api/form-anexo/<id> com signed URL curto.';

alter table public.formulario_anexos enable row level security;

create policy formulario_anexos_coord on public.formulario_anexos
  for all using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

grant select on public.formulario_anexos to authenticated;
grant insert, delete on public.formulario_anexos to service_role;
revoke all on public.formulario_anexos from anon;

insert into storage.buckets (id, name, public)
values ('form-anexos', 'form-anexos', false)
on conflict (id) do nothing;

-- leitura: coordenacao autenticada, e só de objetos REGISTRADOS em
-- formulario_anexos (o resto — upload órfão — não existe pra ninguém
-- além do service role)
create policy "form-anexos select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-anexos'
    and public.my_role() = 'coordenacao'
    and exists (
      select 1 from public.formulario_anexos a where a.path = name
    )
  );
-- insert/delete: nenhuma policy pra authenticated/anon — o objeto só
-- entra via service client depois do form_anexo_put validar

-- registro do upload: valida o token VIVO (link existe, form ativo, não
-- expirado e — pra link manual — ainda não usado), valida o campo ser
-- 'arquivo' na definição do form, valida mime/tamanho contra a definição
-- e o teto de 20 anexos por link, e só então grava a linha e devolve o
-- path que a action usa no storage
create or replace function public.form_anexo_put(
  p_token text,
  p_campo_id text,
  p_nome text,
  p_mime text,
  p_tamanho bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  v_campo jsonb;
  v_mimes text[];
  v_max bigint;
  v_ext text;
  v_path text;
  v_id uuid := gen_random_uuid();
begin
  select fl.id as link_id, fl.multi_uso, fl.usado_em, fl.expira_em,
         f.ativo, f.campos
  into l
  from public.formulario_links fl
  join public.formularios f on f.id = fl.formulario_id
  where fl.token = p_token;
  if l.link_id is null then
    raise exception 'link não encontrado' using errcode = 'P0002';
  end if;
  if not l.ativo then
    raise exception 'formulário inativo' using errcode = 'P0001';
  end if;
  if not l.multi_uso and l.usado_em is not null then
    raise exception 'link já respondido' using errcode = 'P0001';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado' using errcode = 'P0001';
  end if;

  select c into v_campo
  from jsonb_array_elements(l.campos) c
  where c->>'id' = p_campo_id and c->>'tipo' = 'arquivo';
  if v_campo is null then
    raise exception 'campo inválido para upload' using errcode = 'P0001';
  end if;

  v_mimes := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(
       coalesce(v_campo->'accept', '["application/pdf","image/png","image/jpeg","image/webp"]'::jsonb)
     ) x),
    '{}'::text[]
  );
  if not (p_mime = any(v_mimes)) then
    raise exception 'tipo de arquivo não aceito' using errcode = 'P0001';
  end if;
  v_max := coalesce((v_campo->>'max_mb')::bigint, 10) * 1024 * 1024;
  if p_tamanho is null or p_tamanho < 1 or p_tamanho > v_max then
    raise exception 'arquivo acima do tamanho permitido' using errcode = 'P0001';
  end if;
  if (select count(*) from public.formulario_anexos
      where link_id = l.link_id) >= 20 then
    raise exception 'limite de anexos do link atingido' using errcode = 'P0001';
  end if;

  v_ext := lower(substring(p_nome from '\.([^.]+)$'));
  if v_ext is null or v_ext !~ '^[a-z0-9]{1,10}$' then
    v_ext := 'bin';
  end if;
  v_path := l.link_id::text || '/' || v_id::text || '.' || v_ext;

  insert into public.formulario_anexos (id, link_id, campo_id, path, nome, tamanho)
  values (
    v_id, l.link_id, p_campo_id, v_path,
    left(coalesce(nullif(p_nome, ''), 'anexo'), 200),
    p_tamanho
  );
  return jsonb_build_object('id', v_id, 'path', v_path);
end;
$$;
grant execute on function public.form_anexo_put(text, text, text, text, bigint)
  to anon, authenticated;

-- ---------- sanitizer com visible_if + 'Outro' + arquivo + grid ----------
-- Verbatim da 0080 (versão viva — a 0109 não a reescreveu) + a fronteira
-- nova da 0115: a assinatura ganha p_link_id porque o campo 'arquivo' só
-- aceita path registrado em formulario_anexos do PRÓPRIO link (não dá pra
-- carimbar arquivo da inscrição de outra pessoa). A 2-arg morre — a única
-- chamadora é a própria submeter_resposta_formulario.
--
-- Regras novas:
--   · visible_if {campo, em[]}: quando a resposta saneada do campo-gatilho
--     (obrigatoriamente anterior — a definição valida referência pra trás)
--     não casa com nenhum valor de `em`, o campo é PULADO por completo:
--     nem validação de obrigatório, nem resíduo gravado;
--   · permite_outro (select/multi_select): aceita "Outro: <1-120 chars>"
--     além das opções declaradas — o texto livre entra serializado;
--   · 'arquivo': o valor é {path, nome, tamanho} e o path precisa existir
--     em formulario_anexos do link que está respondendo;
--   · 'grid_disponibilidade': {celulas:[{dia,periodo}]} no vocabulário
--     canônico da 0100 + `horas` verbatim [{dia,hora 9..19}] pra leitura
--     humana; fora disso cai no `else continue` dos tipos desconhecidos.

drop function if exists public.formularios_limpa_respostas(jsonb, jsonb);
create or replace function public.formularios_limpa_respostas(
  p_campos jsonb, p_respostas jsonb, p_link_id uuid
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
  v_outro boolean;
  v_val jsonb;
  v_txt text;
  v_num numeric;
  v_items jsonb;
  v_horas jsonb;
  v_el jsonb;
  v_vis jsonb;
  v_ref_val jsonb;
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

    -- seção é estrutura, não pergunta (0080): nunca espera resposta e nada
    -- que venha com esse id é gravado — nem a regra de obrigatório se aplica
    if v_tipo = 'secao' then
      continue;
    end if;

    -- pergunta condicional (0115): fora da condição, o campo some da
    -- validação e do jsonb gravado — v_out já carrega só os saneados, e a
    -- referência só aponta pra trás (validação da definição no app)
    v_vis := v_campo -> 'visible_if';
    if v_vis is not null and v_vis ? 'campo' and v_vis ? 'em' then
      v_ref_val := v_out -> (v_vis ->> 'campo');
      if not exists (
        select 1
        from jsonb_array_elements(v_vis -> 'em') e
        where e.value = v_ref_val
           or (jsonb_typeof(v_ref_val) = 'array'
               and v_ref_val @> jsonb_build_array(e.value))
      ) then
        continue;
      end if;
    end if;

    v_label := coalesce(nullif(btrim(v_campo ->> 'label'), ''), 'esta pergunta');
    v_obrig := coalesce((v_campo ->> 'obrigatorio')::boolean, false);
    v_opcoes := v_campo -> 'opcoes';
    v_outro := coalesce((v_campo ->> 'permite_outro')::boolean, false);
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
          -- "Outro" + texto livre (0115) — serializado "Outro: <texto>"
          if not (v_outro and v_txt ~ '^Outro: .{1,120}$') then
            raise exception 'Opção inválida em "%"', v_label;
          end if;
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

      when 'escala_1_10' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Formato inválido em "%"', v_label;
        end if;
        v_num := (v_val #>> '{}')::numeric;
        if v_num <> trunc(v_num) or v_num < 1 or v_num > 10 then
          raise exception 'Escolha uma nota de 1 a 10 em "%"', v_label;
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
            if not (v_outro and v_txt ~ '^Outro: .{1,120}$') then
              raise exception 'Opção inválida em "%"', v_label;
            end if;
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

      when 'arquivo' then
        -- {path, nome, tamanho} resolvido por form_anexo_put: o path tem
        -- de ser do diretório do próprio link E existir como linha
        -- registrada — sem isso o cliente declararia arquivo que nunca
        -- subiu (ou pior, o da inscrição vizinha)
        if jsonb_typeof(v_val) <> 'object'
           or (v_val ->> 'path') is null
           or (v_val ->> 'path') !~ ('^' || p_link_id::text
                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$')
           or not exists (
             select 1 from public.formulario_anexos a
             where a.link_id = p_link_id and a.path = v_val ->> 'path'
           ) then
          raise exception 'Anexe um arquivo válido em "%"', v_label;
        end if;
        v_out := jsonb_set(
          v_out, array[v_id],
          jsonb_build_object(
            'path', v_val ->> 'path',
            'nome', left(
              coalesce(nullif(v_val ->> 'nome', ''), 'anexo'), 200),
            'tamanho', least(
              greatest(coalesce((v_val ->> 'tamanho')::bigint, 0), 0),
              52428800)
          )
        );

      when 'grid_disponibilidade' then
        if jsonb_typeof(v_val) <> 'object' then
          raise exception 'Marque os horários livres em "%"', v_label;
        end if;
        -- celulas: o canônico da 0100, mesmo vocabulário do
        -- disponibilidade_ok (dia em 7, período em 3, só as 2 chaves)
        v_items := '[]'::jsonb;
        for v_el in select value from jsonb_array_elements(
                      coalesce(v_val -> 'celulas', '[]'::jsonb))
                    limit 80 loop
          if jsonb_typeof(v_el) = 'object'
             and v_el ? 'dia' and v_el ? 'periodo'
             and (select count(*) = 2 from jsonb_object_keys(v_el))
             and (v_el ->> 'dia') in
                 ('seg','ter','qua','qui','sex','sab','dom')
             and (v_el ->> 'periodo') in ('manha','tarde','noite')
             and not (v_items @> jsonb_build_array(v_el)) then
            v_items := v_items || jsonb_build_array(v_el);
          end if;
        end loop;
        -- horas: marcação verbatim seg–sex × 9..19 — só leitura humana
        -- (matching usa celulas); fora do vocabulário some na limpeza
        v_horas := '[]'::jsonb;
        for v_el in select value from jsonb_array_elements(
                      coalesce(v_val -> 'horas', '[]'::jsonb))
                    limit 80 loop
          if jsonb_typeof(v_el) = 'object'
             and v_el ? 'dia' and v_el ? 'hora'
             and (v_el ->> 'dia') in ('seg','ter','qua','qui','sex')
             and jsonb_typeof(v_el -> 'hora') = 'number'
             and (v_el ->> 'hora')::numeric =
                 trunc((v_el ->> 'hora')::numeric)
             and (v_el ->> 'hora')::int between 9 and 19
             and not exists (
               select 1 from jsonb_array_elements(v_horas) x
               where x ->> 'dia' = v_el ->> 'dia'
                 and (x ->> 'hora')::int = (v_el ->> 'hora')::int
             ) then
            v_horas := v_horas || jsonb_build_array(jsonb_build_object(
              'dia', v_el ->> 'dia', 'hora', (v_el ->> 'hora')::int));
          end if;
        end loop;
        if jsonb_array_length(v_items) = 0 then
          if v_obrig then
            raise exception 'Responda "%" antes de enviar', v_label;
          end if;
          continue;
        end if;
        v_out := jsonb_set(
          v_out, array[v_id],
          jsonb_build_object('celulas', v_items, 'horas', v_horas));

      else
        -- tipo desconhecido (schema evoluiu depois do envio): não grava o
        -- valor — melhor perder um campo do que guardar lixo
        continue;
    end case;
  end loop;
  return v_out;
end $$;

revoke all on function public.formularios_limpa_respostas(jsonb, jsonb, uuid)
  from public, anon;
grant execute on function public.formularios_limpa_respostas(jsonb, jsonb, uuid)
  to authenticated;

-- ---------- submit: multi-uso + tetos ----------
-- Verbatim da 0109 (última escritora — 0036/0042/0070/0080/0105 já vieram
-- nela: gate de identidade 0070, idempotência, checklist 360, projeção
-- PDM e notificação coord) + o ramo multi_uso da 0115: sem usado_em, com
-- tetos 500-total / 50-dia serializados por advisory lock no link.

create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
  v_nome text;
  v_total int;
  v_dia int;
begin
  select fl.id, fl.usado_em, fl.expira_em, fl.multi_uso,
         fl.dupla_id, fl.dest_profile_id, fl.dest_mentorado_id,
         f.id as f_id, f.titulo as f_titulo, f.sistema as f_sistema,
         f.ativo as f_ativo, f.campos
    into l
    from formulario_links fl
    join formularios f on f.id = fl.formulario_id
    where fl.token = p_token;
  if not found then
    raise exception 'link inválido';
  end if;

  -- gate de identidade (0070): autenticado não responde link de outra pessoa
  if auth.uid() is not null
     and ((l.dest_profile_id is not null
           and l.dest_profile_id is distinct from public.my_profile_id())
       or (l.dest_mentorado_id is not null
           and l.dest_mentorado_id is distinct from public.my_mentorado_id())) then
    raise exception 'este link é de outra pessoa';
  end if;

  -- idempotente: já respondido devolve a resposta existente. Link de
  -- intake nunca carimba usado_em, então nunca cai aqui — o guard de
  -- baixo confirma.
  if l.usado_em is not null then
    select r.id into v_id from formulario_respostas r
     where r.link_id = l.id
     order by r.respondido_em desc
     limit 1;
    return v_id;
  end if;
  if not l.f_ativo then
    raise exception 'formulário encerrado';
  end if;
  if l.expira_em is not null and l.expira_em < now() then
    raise exception 'link expirado';
  end if;

  -- tetos do link reutilizável (0115): 500 respostas no total e 50 por
  -- dia (anti-spam do link público divulgado). A contagem roda sob
  -- advisory lock por link — sem ele dois submits concorrentes liam o
  -- mesmo total e os dois passavam por cima do teto
  if l.multi_uso then
    perform pg_advisory_xact_lock(
      hashtext('form-intake:' || l.id::text)::bigint);
    select count(*) into v_total
      from formulario_respostas where link_id = l.id;
    if v_total >= 500 then
      raise exception 'Este link atingiu o limite de respostas.';
    end if;
    select count(*) into v_dia
      from formulario_respostas
     where link_id = l.id
       and respondido_em >=
           (date_trunc('day', now() at time zone 'America/Sao_Paulo')
              at time zone 'America/Sao_Paulo');
    if v_dia >= 50 then
      raise exception 'Recebemos muitas inscrições hoje. Tente enviar de novo amanhã.';
    end if;
  end if;

  v_limpo := public.formularios_limpa_respostas(l.campos, p_respostas, l.id);

  -- link manual: carimba usado_em e trava o reuso (o gate `and usado_em
  -- is null` mantém a idempotência sob concorrência). Link de intake:
  -- nada de carimbo — a resposta_unica_guard ignora multi_uso e a tabela
  -- aceita N linhas por link
  if not l.multi_uso then
    update formulario_links
       set usado_em = now(),
           respondido_por_profile_id = public.my_profile_id()
     where id = l.id and usado_em is null;
    if not found then
      select r.id into v_id from formulario_respostas r
       where r.link_id = l.id;
      return v_id;
    end if;
  end if;

  insert into formulario_respostas (link_id, respostas)
    values (l.id, v_limpo)
    returning id into v_id;

  -- wiring 360º (0042, restaurado): a resposta do instrumento oficial
  -- carimba o checklist do encerramento da dupla. Só UPDATE, nunca INSERT —
  -- a row nasce pela autoavaliação do mentor ou pela decisão da coordenação.
  -- `decidido_por is null` evita reescrever registro fechado e o falso-
  -- positivo do trigger encerramentos_decisor quando o respondente é um
  -- mentor logado (my_profile_id() lê o JWT do caller mesmo no definer).
  if l.f_sistema = 'avaliacao_360' and l.dupla_id is not null then
    update encerramentos
       set checklist = checklist || '{"avaliacao_360_enviada":true}'::jsonb
     where dupla_id = l.dupla_id
       and decidido_por is null;
  end if;

  -- projeção no PDM vivo (0109): visao/metas/pdm alimentam o documento
  -- relacional da dupla além do snapshot jsonb (que fica intacto). Bloco
  -- protegido: a projeção é re-jogável e nunca pode derrubar a entrega —
  -- mapa com >20 linhas, teto de metas ou dado legado estranho viram
  -- warning no log, não resposta perdida.
  if l.f_sistema in ('visao', 'metas', 'pdm') and l.dupla_id is not null then
    begin
      perform public.pdm_projeta_resposta(l.dupla_id, l.f_sistema, v_limpo);
    exception when others then
      raise warning 'pdm: projeção da resposta % (% na dupla %) falhou: %',
        v_id, l.f_sistema, l.dupla_id, sqlerrm;
    end;
  end if;

  -- toda resposta avisa a coordenação (0042, restaurado) — mentorado não
  -- tem login, o sino é como a equipe fica sabendo. No link de intake o
  -- nome sai da própria resposta (nome_civil) pra notificação já chegar
  -- contextualizada. O insert roda como owner da função, então a policy
  -- notificacoes_insert não se aplica a este caminho; o CHECK de tipo
  -- cobre o vocabulário.
  v_nome := coalesce(
    (select nome from profiles where id = l.dest_profile_id),
    (select nome from mentorados where id = l.dest_mentorado_id),
    case when l.multi_uso then nullif(v_limpo ->> 'nome_civil', '') end
  );
  insert into notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
  select c.id,
         'formulario_respondido',
         'Resposta de formulário',
         case
           when v_nome is not null
             then v_nome || ' respondeu "' || l.f_titulo || '"'
           else 'Chegou uma resposta de "' || l.f_titulo || '"'
         end,
         '/formularios/' || l.f_id,
         l.dest_profile_id
    from profiles c
   where c.role = 'coordenacao' and c.ativo
     -- quem respondeu não se notifica (coord testando o próprio form)
     and c.id is distinct from l.dest_profile_id;

  return v_id;
end $$;

-- grants preservados — resposta pública por token desde a 0036
revoke all on function public.submeter_resposta_formulario(text, jsonb)
  from public;
grant execute on function public.submeter_resposta_formulario(text, jsonb)
  to anon, authenticated;

-- ---------- seed: Matching de Mentores (oficial, imutável) ----------
-- verbatim do Google Form em docs/planos/forms-google-mapeamento.md.
-- UMA grade de disponibilidade (a segunda do form era cópia — _decisoes).

insert into public.formularios (
  id, titulo, descricao, campos, sistema
) values (
  '5eed0001-0000-4000-8000-000000000009',
  'Matching de Mentores',
  'Inscrição de mentores do Programa de Mentoria Realiza. Os dados ficam na plataforma; a coordenação lê as inscrições e cadastra quem for selecionado.',
  '[
    {"id":"sec_dados","tipo":"secao","label":"Dados pessoais","obrigatorio":false},
    {"id":"nome_civil","tipo":"texto","label":"Nome completo civil","obrigatorio":true},
    {"id":"nome_social","tipo":"texto","label":"Nome social","obrigatorio":false},
    {"id":"nascimento","tipo":"data","label":"Data de nascimento","obrigatorio":true},
    {"id":"genero","tipo":"select","label":"Gênero","obrigatorio":true,"opcoes":["Cisgênero feminino","Cisgênero masculino","Transgênero","Não binário","Prefiro não informar"]},
    {"id":"cor_raca","tipo":"select","label":"Cor/raça","obrigatorio":true,"opcoes":["Negra","Branca","Amarela","Parda","Indígena"],"permite_outro":true},
    {"id":"cidade","tipo":"texto","label":"Estado/município de residência","obrigatorio":true},
    {"id":"sec_trajetoria","tipo":"secao","label":"Trajetória pessoal e profissional","obrigatorio":false},
    {"id":"hobbies","tipo":"texto_longo","label":"Hobbies","obrigatorio":true,"descricao":"Até 3 hobbies"},
    {"id":"esportes","tipo":"texto_longo","label":"Esportes","obrigatorio":true,"descricao":"Assistir ou praticar"},
    {"id":"inspiracoes","tipo":"texto_longo","label":"Inspirações","obrigatorio":true,"descricao":"Até 3 inspirações"},
    {"id":"valores","tipo":"texto_longo","label":"Valores","obrigatorio":true,"descricao":"Até 3 valores"},
    {"id":"realizacoes","tipo":"texto_longo","label":"Principais realizações","obrigatorio":true,"descricao":"Pessoais ou profissionais"},
    {"id":"auto_descricao","tipo":"texto_longo","label":"Auto-descrição em parágrafo","obrigatorio":true},
    {"id":"companheiro","tipo":"texto_longo","label":"Como esposa/marido/companheiro(a) lhe descreveria?","obrigatorio":true},
    {"id":"sec_trabalho","tipo":"secao","label":"Trabalho e emprego","obrigatorio":false},
    {"id":"cargo","tipo":"texto","label":"Cargo","obrigatorio":true},
    {"id":"empresa","tipo":"texto","label":"Empresa/instituição","obrigatorio":true},
    {"id":"curriculo","tipo":"arquivo","label":"Currículo","obrigatorio":true,"max_mb":10},
    {"id":"linkedin","tipo":"texto","label":"LinkedIn","obrigatorio":false,"formato":"url"},
    {"id":"sec_contato","tipo":"secao","label":"Dados de contato","obrigatorio":false},
    {"id":"email","tipo":"texto","label":"E-mail","obrigatorio":true,"formato":"email"},
    {"id":"telefone","tipo":"texto","label":"Telefone","obrigatorio":true,"formato":"telefone"},
    {"id":"sec_mentoria","tipo":"secao","label":"A mentoria","obrigatorio":false},
    {"id":"formacao_erlich","tipo":"sim_nao","label":"Formação Erlich Mentoring","obrigatorio":true},
    {"id":"experiencia_previa","tipo":"sim_nao","label":"Experiência prévia como mentor","obrigatorio":true},
    {"id":"experiencia_descricao","tipo":"texto_longo","label":"Caso possua experiência prévia, descreva-a","obrigatorio":false,"visible_if":{"campo":"experiencia_previa","em":["sim"]}},
    {"id":"objetivos","tipo":"texto_longo","label":"Objetivos/expectativa","obrigatorio":true},
    {"id":"pref_genero_mentorado","tipo":"select","label":"Preferência de gênero do mentorado","obrigatorio":true,"opcoes":["Mentorado homem","Mentorada mulher","Sem preferência"]},
    {"id":"foto","tipo":"arquivo","label":"Foto de perfil","obrigatorio":true,"max_mb":10},
    {"id":"disponibilidade","tipo":"grid_disponibilidade","label":"Disponibilidade","obrigatorio":true},
    {"id":"sec_comprovantes","tipo":"secao","label":"Comprovantes","obrigatorio":false,"descricao":"Documentos para conferência da coordenação — ficam privados na plataforma."},
    {"id":"doc_identidade","tipo":"arquivo","label":"Anexo do RG ou CNH","obrigatorio":true,"max_mb":10},
    {"id":"comprovante_residencia","tipo":"arquivo","label":"Comprovante de residência","obrigatorio":true,"max_mb":10}
  ]'::jsonb,
  'intake_mentor'
)
on conflict (id) do nothing;
