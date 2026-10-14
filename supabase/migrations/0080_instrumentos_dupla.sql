-- 0080: lote fundação dos instrumentos nativos do programa (REALIZA-117)
--
-- Os quatro instrumentos do guia DPP viram formulários oficiais sobre a
-- engine (0036/0042): Construindo a sua Visão, Roda da Vida, PDM e
-- Definindo Minhas Metas. O preenchimento segue a jornada de link
-- tokenizado (/f/<token>) — mentorado responde sem login — e o resultado
-- é dado estruturado, não documento morto.
--
-- O que muda:
--   1) `formularios.sistema` ganha 4 valores novos (visão, roda, pdm,
--      metas) — o índice único parcial da 0042 já garante um por
--      instrumento.
--   2) Dois tipos de campo novos na fronteira (formularios_limpa_respostas):
--      · 'secao' — rótulo de estrutura (título + descrição), nunca espera
--        resposta: pulado antes da regra de obrigatório e nunca gravado;
--      · 'escala_1_10' — satisfação 1–10 (a Roda da Vida avalia 16 áreas).
--   3) Regressão da 0070 reparada: a reescrita das RPCs públicas derrubou
--      o que a 0042 tinha adicionado — `sistema` no payload do token (o
--      selo "instrumento oficial" do /f/<token>), o carimbo
--      checklist.avaliacao_360_enviada no encerramento e a notificação
--      'formulario_respondido' pra coordenação. As versões abaixo são a
--      fusão: gates de identidade da 0070 + wiring da 0042.
--   4) RPC `emitir_link_instrumento(dupla, sistema)`: emissão escopada de
--      link pro mentorado da dupla — coordenação pra qualquer dupla e o
--      próprio mentor pra dupla ativa/pausada dele (o guia é do mentor:
--      é ele quem "entrega o instrumento"). Reusa link pendente vigente
--      pro mesmo destinatário, como a action gerarLinksFormulario.
--   5) RPC `instrumentos_da_dupla(dupla)`: leitura estruturada das respostas
--      dos instrumentos da dupla — coord, mentor e supervisor da dupla e o
--      próprio mentorado (o dado é dele e é documento de trabalho da
--      dupla). Só os 4 sistemas de trabalho saem por aqui: anamnese (dado
--      sensível de intake), 360º e autoavaliação seguem coord-only.
--   6) Seed idempotente dos 4 instrumentos (ids 5eed0001-…-04..07), campos
--      fiéis aos textos-fonte (docs/fontes: guia-dpp-pdf.txt §5/§6/§8 e
--      definindo-minhas-metas.txt). Ids de campo estáveis e convencionados
--      (meta_N/is_N/prazo_N, quadrante por 'secao') — é o que torna a
--      resposta aproveitável (radar da roda, lista de metas) sem tipo de
--      campo dedicado por instrumento.

begin;

-- ---------- 1) vocabulário de sistema ----------

alter table public.formularios drop constraint formularios_sistema_check;
alter table public.formularios add constraint formularios_sistema_check
  check (sistema in (
    'anamnese', 'avaliacao_360', 'autoavaliacao_mentor',
    'visao', 'roda_vida', 'pdm', 'metas'
  ));

-- ---------- 2) tipos novos na fronteira ----------

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

    -- seção é estrutura, não pergunta (0080): nunca espera resposta e nada
    -- que venha com esse id é gravado — nem a regra de obrigatório se aplica
    if v_tipo = 'secao' then
      continue;
    end if;

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

-- ---------- 3) RPCs públicas — fusão 0070 + 0042 ----------

create or replace function public.formulario_por_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_nome text;
  v_identidade text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
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
    )
  );
end $$;

create or replace function public.submeter_resposta_formulario(
  p_token text, p_respostas jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_limpo jsonb;
  v_id uuid;
  v_nome text;
begin
  select fl.id, fl.usado_em, fl.expira_em,
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

  update formulario_links
    set usado_em = now(),
        respondido_por_profile_id = public.my_profile_id()
    where id = l.id and usado_em is null;
  if not found then
    select r.id into v_id from formulario_respostas r where r.link_id = l.id;
    return v_id;
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

  -- toda resposta avisa a coordenação (0042, restaurado) — mentorado não
  -- tem login, o sino é como a equipe fica sabendo. O insert roda como
  -- owner da função, então a policy notificacoes_insert não se aplica a
  -- este caminho; o CHECK de tipo cobre o vocabulário.
  v_nome := coalesce(
    (select nome from profiles where id = l.dest_profile_id),
    (select nome from mentorados where id = l.dest_mentorado_id)
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

-- ---------- 4) emissão escopada de link de instrumento ----------

-- O mentor "entrega" o instrumento (guia §5/§8): coord pra qualquer dupla,
-- mentor DPP pra dupla ativa/pausada dele. Destino sempre o mentorado — os
-- quatro instrumentos são respondidos pelo jovem (o PDM é construído com o
-- mentor, mas quem escreve é ele). Devolve {token, reutilizado} — link
-- pendente vigente pro mesmo destinatário é reusado, não duplicado.
create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;

  select d.id, d.mentor_id, d.mentorado_id, d.status
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação (qualquer dupla) ou o mentor da dupla
  -- (jornada viva — instrumento é ferramenta de encontro)
  if not (
    public.my_role() = 'coordenacao'
    or (
      public.my_role() = 'mentor_dpp'
      and v_dupla.mentor_id = public.my_profile_id()
      and v_dupla.status in ('ativa', 'pausada')
    )
  ) then
    raise exception 'sem permissão pra enviar instrumento desta dupla';
  end if;

  select f.id, f.ativo into v_form
    from formularios f
   where f.sistema = p_sistema;
  if not found then
    raise exception 'instrumento oficial ainda não está cadastrado';
  end if;
  if not v_form.ativo then
    raise exception 'este instrumento está encerrado — reative em Formulários';
  end if;

  -- reusa link pendente vigente pro mesmo mentorado+form (um link vivo por
  -- destinatário por instrumento, como na action de emissão). Escopo da
  -- dupla: link dela ou órfão (dupla_id null — emitido por Formulários sem
  -- contexto); um link vivo apontando pra OUTRA dupla não é furtado.
  select l.id, l.token into v_link
    from formulario_links l
   where l.formulario_id = v_form.id
     and l.dest_mentorado_id = v_dupla.mentorado_id
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now())
     and (l.dupla_id = v_dupla.id or l.dupla_id is null)
   order by l.created_at desc
   limit 1;
  if found then
    -- link órfão de dupla (destinatário certo, dupla preenchida depois)
    -- passa a apontar pra esta — a resposta ganha o contexto certo
    update formulario_links
       set dupla_id = v_dupla.id,
           contexto = contexto || '{"origem":"instrumentos"}'::jsonb
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from 'instrumentos');
    return jsonb_build_object('token', v_link.token, 'reutilizado', true);
  end if;

  insert into formulario_links (
    formulario_id, token, dest_mentorado_id, dupla_id, contexto, created_by
  ) values (
    v_form.id,
    -- 24 bytes → 32 chars base64url, mesmo fator de posse da action
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    v_dupla.mentorado_id,
    v_dupla.id,
    '{"origem":"instrumentos"}'::jsonb,
    public.my_profile_id()
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

revoke all on function public.emitir_link_instrumento(uuid, text)
  from public, anon;
grant execute on function public.emitir_link_instrumento(uuid, text)
  to authenticated;

-- ---------- 5) leitura estruturada dos instrumentos da dupla ----------

-- Devolve um objeto por instrumento presente no banco:
--   {sistema, formulario_id, titulo, descricao, campos, ativo,
--    entregas: [{link_id, destino, status, respondido_em, respostas}]}
-- `respostas` só sai quando o link foi respondido — pendente/expirado não
-- carrega payload. Escopo: coord; mentor, supervisor e mentorado DA DUPLA
-- (documento de trabalho dela). Anamnese/360/autoavaliação não entram —
-- têm leitura própria e escopo mais fechado por desenho.
create or replace function public.instrumentos_da_dupla(p_dupla_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_out jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id, d.supervisor_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  if not (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or v_dupla.supervisor_id = public.my_profile_id()
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) then
    raise exception 'sem permissão pra ver instrumentos desta dupla';
  end if;

  select coalesce(jsonb_agg(inst order by ordem), '[]'::jsonb)
    into v_out
    from (
      select
        case f.sistema
          when 'visao' then 1 when 'metas' then 2
          when 'pdm' then 3 when 'roda_vida' then 4
        end as ordem,
        jsonb_build_object(
          'sistema', f.sistema,
          'formulario_id', f.id,
          'titulo', f.titulo,
          'descricao', f.descricao,
          'ativo', f.ativo,
          'campos', f.campos,
          'entregas', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'link_id', l.id,
                     -- o token sai junto: quem lê esta RPC é quem entrega
                     -- o link (mentor/coord) ou o próprio destinatário; o
                     -- submit segue protegido pelo gate de identidade (0070)
                     'token', l.token,
                     'destino', case
                       when l.dest_mentorado_id is not null then 'mentorado'
                       when l.dest_profile_id = v_dupla.mentor_id then 'mentor'
                       else 'outro' end,
                     'status', case
                       when l.usado_em is not null then 'respondido'
                       when l.expira_em is not null and l.expira_em < now()
                         then 'expirado'
                       else 'pendente' end,
                     'respondido_em', r.respondido_em,
                     'respostas', r.respostas
                   ) order by l.created_at)
              from formulario_links l
              left join formulario_respostas r on r.link_id = l.id
             where l.formulario_id = f.id
               and l.dupla_id = v_dupla.id
               -- só links endereçados à dupla: um genérico solto na ficha
               -- de outro lugar não vaza pra cá (dupla_id é o escopo)
               and (l.dest_mentorado_id = v_dupla.mentorado_id
                    or l.dest_profile_id = v_dupla.mentor_id)
          ), '[]'::jsonb)
        ) as inst
      from formularios f
      where f.sistema in ('visao', 'roda_vida', 'pdm', 'metas')
    ) s;

  return v_out;
end $$;

revoke all on function public.instrumentos_da_dupla(uuid) from public, anon;
grant execute on function public.instrumentos_da_dupla(uuid) to authenticated;

-- ---------- 6) seed dos instrumentos oficiais ----------
-- Textos fiéis aos fontes (guia-dpp-pdf §5 Visão, §8 Roda; definindo-
-- minhas-metas.txt; guia-dpp-pdf §6 PDM). Convenções que tornam a resposta
-- estruturada: a 'secao' que precede cada grupo de escala_1_10 é o
-- quadrante da roda; metas são meta_N + is_N + prazo_N (PDM) ou
-- meta_N + porque_N (Definindo Metas).

insert into public.formularios (id, titulo, descricao, campos, sistema) values
(
  '5eed0001-0000-4000-8000-000000000004',
  'Construindo a sua Visão',
  'Exercício de imaginação e projeção entregue ao(à) jovem ao final do primeiro encontro (guia DPP §5): o "filme" da vida ideal vira a Declaração de Visão, o norte de toda a mentoria.',
  '[
    {"id":"s_antes","tipo":"secao","label":"Antes de responder","obrigatorio":false,"descricao":"Acomode-se com conforto e respire fundo algumas vezes, até se sentir tranquilo(a). Agora imagine um filme em que você é o personagem principal, vivendo a situação ideal que sonha para a sua vida pessoal e profissional. Você está sentindo o mais alto nível de realização que já experimentou, com orgulho e alegria por ter chegado até ali. Visualize as cenas do dia a dia dessa vida."},
    {"id":"filme","tipo":"texto_longo","label":"Descreva o que está acontecendo com você nessa situação ideal. Narre as cenas desse filme.","obrigatorio":true},
    {"id":"aspectos","tipo":"texto_longo","label":"Quais são os aspectos mais significativos dessa situação ideal?","obrigatorio":true},
    {"id":"ser_fazer","tipo":"texto_longo","label":"Nessa situação, o que você está conseguindo ser ou fazer que tanto desejava?","obrigatorio":true},
    {"id":"deixou","tipo":"texto_longo","label":"O que você deixou de fazer, ou o que não está mais acontecendo, que tanto lhe desagradava?","obrigatorio":true},
    {"id":"valoriza","tipo":"texto_longo","label":"O que você mais valoriza nessa situação ideal?","obrigatorio":true},
    {"id":"s_declaracao","tipo":"secao","label":"Sua Declaração de Visão","obrigatorio":false,"descricao":"Uma frase que resuma o que você deseja ser, alcançar ou conquistar. Comece por um verbo no futuro (\"Serei\", \"Alcançarei\", \"Conquistarei\") e inclua um prazo."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Minha Declaração de Visão","obrigatorio":true}
  ]'::jsonb,
  'visao'
),
(
  '5eed0001-0000-4000-8000-000000000005',
  'Definindo Minhas Metas',
  'Template do mentorado da sequência da Visão (PDF oficial): da Declaração de Visão para 3 a 5 metas com o porquê de cada uma — a dupla revisa no encontro seguinte com o modelo SMART.',
  '[
    {"id":"s_visao","tipo":"secao","label":"Minha visão de futuro","obrigatorio":false,"descricao":"No encontro anterior você construiu sua Declaração de Visão: uma frase que representa o que você deseja ser, alcançar ou conquistar. Agora o passo é pensar: quais conquistas preciso alcançar para tornar essa visão realidade? Metas são resultados que você deseja alcançar — ligados à sua visão e importantes pra você."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Minha Declaração de Visão (copie ou reescreva a frase que você criou)","obrigatorio":true},
    {"id":"preciso_criar","tipo":"texto","label":"Para me aproximar da minha visão, o que eu preciso CRIAR?","obrigatorio":false},
    {"id":"preciso_aprender","tipo":"texto","label":"O que eu preciso APRENDER?","obrigatorio":false},
    {"id":"preciso_melhorar","tipo":"texto","label":"O que eu preciso MELHORAR?","obrigatorio":false},
    {"id":"preciso_eliminar","tipo":"texto","label":"O que eu preciso ELIMINAR?","obrigatorio":false},
    {"id":"s_metas","tipo":"secao","label":"Minhas metas","obrigatorio":false,"descricao":"Preencha de 3 a 5 metas. Dica: comece cada meta com um verbo de ação — Desenvolver, Concluir, Aprender, Melhorar, Conseguir, Criar, Organizar."},
    {"id":"meta_1","tipo":"texto","label":"Minha meta 1","obrigatorio":true},
    {"id":"porque_1","tipo":"texto_longo","label":"Por que a meta 1 é importante pra mim?","obrigatorio":true},
    {"id":"meta_2","tipo":"texto","label":"Minha meta 2","obrigatorio":true},
    {"id":"porque_2","tipo":"texto_longo","label":"Por que a meta 2 é importante pra mim?","obrigatorio":true},
    {"id":"meta_3","tipo":"texto","label":"Minha meta 3","obrigatorio":true},
    {"id":"porque_3","tipo":"texto_longo","label":"Por que a meta 3 é importante pra mim?","obrigatorio":true},
    {"id":"meta_4","tipo":"texto","label":"Minha meta 4","obrigatorio":false},
    {"id":"porque_4","tipo":"texto_longo","label":"Por que a meta 4 é importante pra mim?","obrigatorio":false},
    {"id":"meta_5","tipo":"texto","label":"Minha meta 5","obrigatorio":false},
    {"id":"porque_5","tipo":"texto_longo","label":"Por que a meta 5 é importante pra mim?","obrigatorio":false},
    {"id":"s_revisao","tipo":"secao","label":"Antes do nosso próximo encontro…","obrigatorio":false,"descricao":"Revise suas metas e marque. Você não precisa deixá-las perfeitas agora — no próximo encontro vocês revisam juntos com o modelo SMART (clara, mensurável, alcançável, relevante e com prazo)."},
    {"id":"rev_ajudam","tipo":"sim_nao","label":"Minhas metas realmente me ajudam a chegar onde quero?","obrigatorio":true},
    {"id":"rev_importantes","tipo":"sim_nao","label":"Elas são importantes pra mim?","obrigatorio":true},
    {"id":"rev_claras","tipo":"sim_nao","label":"Consigo explicar claramente o que quero alcançar?","obrigatorio":true},
    {"id":"meta_principal","tipo":"select","label":"Qual dessas metas é mais importante pra você neste momento?","obrigatorio":true,"opcoes":["Meta 1","Meta 2","Meta 3","Meta 4","Meta 5"]}
  ]'::jsonb,
  'metas'
),
(
  '5eed0001-0000-4000-8000-000000000006',
  'Plano de Desenvolvimento do Mentorado (PDM)',
  'O documento central da mentoria (guia DPP §6): a Declaração de Visão com as três metas principais — cada uma com indicador de sucesso (IS) e prazo (P) — e o mapa de desdobramento em submetas.',
  '[
    {"id":"s_visao","tipo":"secao","label":"Visão e metas","obrigatorio":false,"descricao":"O norte da mentoria: a Declaração de Visão e as metas principais. Cada meta leva um indicador de sucesso (IS) — como você vai saber que cumpriu — e um prazo (P)."},
    {"id":"declaracao_visao","tipo":"texto_longo","label":"Declaração de Visão","obrigatorio":true},
    {"id":"meta_1","tipo":"texto","label":"Meta 1","obrigatorio":true},
    {"id":"is_1","tipo":"texto","label":"Indicador de sucesso (IS) da meta 1","obrigatorio":true},
    {"id":"prazo_1","tipo":"data","label":"Prazo (P) da meta 1","obrigatorio":true},
    {"id":"meta_2","tipo":"texto","label":"Meta 2","obrigatorio":false},
    {"id":"is_2","tipo":"texto","label":"Indicador de sucesso (IS) da meta 2","obrigatorio":false},
    {"id":"prazo_2","tipo":"data","label":"Prazo (P) da meta 2","obrigatorio":false},
    {"id":"meta_3","tipo":"texto","label":"Meta 3","obrigatorio":false},
    {"id":"is_3","tipo":"texto","label":"Indicador de sucesso (IS) da meta 3","obrigatorio":false},
    {"id":"prazo_3","tipo":"data","label":"Prazo (P) da meta 3","obrigatorio":false},
    {"id":"s_submetas","tipo":"secao","label":"Mapa de submetas","obrigatorio":false,"descricao":"Para cada meta, pergunte \"o que eu preciso fazer para conseguir isso?\". As respostas são as submetas — repita a pergunta até chegar a algo realizável de imediato, com indicador de sucesso e prazo em todas."},
    {"id":"submetas_1","tipo":"texto_longo","label":"Desdobramento da meta 1 (submetas, indicadores e prazos)","obrigatorio":false},
    {"id":"submetas_2","tipo":"texto_longo","label":"Desdobramento da meta 2","obrigatorio":false},
    {"id":"submetas_3","tipo":"texto_longo","label":"Desdobramento da meta 3","obrigatorio":false}
  ]'::jsonb,
  'pdm'
),
(
  '5eed0001-0000-4000-8000-000000000007',
  'Roda da Vida',
  'Aplicada a partir do 5º mês (guia DPP §8): de 1 a 10, o grau de satisfação do(a) jovem em cada uma das 16 áreas da vida, nos quatro quadrantes. O desenho das notas vira a roda — base pra eleger áreas prioritárias e metas SMART.',
  '[
    {"id":"s_como","tipo":"secao","label":"Como funciona","obrigatorio":false,"descricao":"De 1 a 10, qual é o seu grau de satisfação com cada área da sua vida neste momento? Não existe resposta certa — marque o que você sente hoje, não o que gostaria de sentir."},
    {"id":"s_pessoal","tipo":"secao","label":"Pessoal","obrigatorio":false},
    {"id":"p_saude","tipo":"escala_1_10","label":"Saúde e disposição","obrigatorio":true},
    {"id":"p_intelecto","tipo":"escala_1_10","label":"Intelecto e cultura","obrigatorio":true},
    {"id":"p_equilibrio","tipo":"escala_1_10","label":"Equilíbrio emocional","obrigatorio":true},
    {"id":"p_independencia","tipo":"escala_1_10","label":"Independência","obrigatorio":true},
    {"id":"s_profissional","tipo":"secao","label":"Profissional","obrigatorio":false},
    {"id":"pr_carreira","tipo":"escala_1_10","label":"Carreira e trabalho","obrigatorio":true},
    {"id":"pr_financas","tipo":"escala_1_10","label":"Finanças","obrigatorio":true},
    {"id":"pr_escola","tipo":"escala_1_10","label":"Escola / universidade","obrigatorio":true},
    {"id":"pr_contribuicao","tipo":"escala_1_10","label":"Contribuição social","obrigatorio":true},
    {"id":"s_relacionamentos","tipo":"secao","label":"Relacionamentos","obrigatorio":false},
    {"id":"r_familia","tipo":"escala_1_10","label":"Família","obrigatorio":true},
    {"id":"r_amigos","tipo":"escala_1_10","label":"Amigos","obrigatorio":true},
    {"id":"r_amoroso","tipo":"escala_1_10","label":"Relacionamento amoroso","obrigatorio":true},
    {"id":"r_social","tipo":"escala_1_10","label":"Vida social","obrigatorio":true},
    {"id":"s_qualidade","tipo":"secao","label":"Qualidade de vida","obrigatorio":false},
    {"id":"q_hobbies","tipo":"escala_1_10","label":"Hobbies e diversão","obrigatorio":true},
    {"id":"q_atividade","tipo":"escala_1_10","label":"Atividade física","obrigatorio":true},
    {"id":"q_realizacao","tipo":"escala_1_10","label":"Realização e felicidade","obrigatorio":true},
    {"id":"q_espiritualidade","tipo":"escala_1_10","label":"Espiritualidade","obrigatorio":true},
    {"id":"reflexao","tipo":"texto_longo","label":"Olhando pra sua roda: quais áreas você mais gostaria de melhorar? Por quê?","obrigatorio":true}
  ]'::jsonb,
  'roda_vida'
)
on conflict do nothing;

commit;
