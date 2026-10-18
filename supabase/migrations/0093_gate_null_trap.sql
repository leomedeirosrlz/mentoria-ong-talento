-- WP3 follow-up — NULL-trap nos gates IF das RPCs definer.
--
-- Defeito encontrado na revisão da 0092 e presente em duas funções
-- anteriores: predicados do tipo `if not (a or b or c)` onde operandos
-- avaliam NULL (supervisor_id/mentorado_id nullable; my_role()/
-- my_profile_id()/my_mentorado_id() voltam NULL pra caller sem profile
-- ativo). Em PL/pgSQL `false or NULL` → NULL, `not (NULL)` → NULL e
-- `IF NULL` não dispara o raise — o acesso PASSA.
--
-- Casos concretos antes do fix:
--   · instrumentos_da_dupla: dupla sem supervisor + caller autenticado
--     qualquer → lia todos os instrumentos/respostas da dupla.
--   · emitir_link_instrumento: caller sem profile ativo (desligado) →
--     NULL or (false and …) → NULL → emitia link de instrumento.
--
-- O repositório já documenta o padrão certo (0037/0044 usam is distinct
-- from por isso mesmo). Fix: `(...) is not true` — cobre false E NULL.
-- `is distinct from` NÃO serviria aqui: comparar campo nullable com v_me
-- NULL avaliaria "iguais" e concederia.
--
-- Corpos verbatim das versões vigentes (0080 e 0090 respectivamente) —
-- só o predicado do IF muda.

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

  if (
    public.my_role() = 'coordenacao'
    or v_dupla.mentor_id = public.my_profile_id()
    or v_dupla.supervisor_id = public.my_profile_id()
    or v_dupla.mentorado_id = public.my_mentorado_id()
  ) is not true then
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

  select d.id, d.mentor_id, d.mentorado_id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação (qualquer dupla) ou o mentor DPP da dupla
  -- (jornada viva — instrumento é ferramenta de encontro da trilha DPP)
  if (
    public.my_role() = 'coordenacao'
    or (
      public.has_papel('mentor_dpp'::public.app_role)
      and v_dupla.trilha is distinct from 'especialista'
      and v_dupla.mentor_id = public.my_profile_id()
      and v_dupla.status in ('ativa', 'pausada')
    )
  ) is not true then
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
