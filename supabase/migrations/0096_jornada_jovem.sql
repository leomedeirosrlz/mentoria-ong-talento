-- WP7 · REALIZA-140 — "Minha jornada": dados da jornada do jovem.
--
-- A página /jovem/materiais deixa de ser uma biblioteca plana e vira um
-- hub narrativo de 7 estações canônicas do guia (Roda inicial → Visão →
-- Metas → PDM → Avaliação do encontro → Roda formal → 360º), com datas
-- do cronograma da turma DELA. Três blockers de contrato:
--
--   1) ciclo_eventos é staff-only por RLS — o jovem não lia o próprio
--      cronograma (sem fase real, sem "enc. N de 16", sem janela).
--   2) avaliacao_360 ficava fora de instrumentos_da_dupla e o jovem não
--      lê formulario_links — nenhum caminho pra saber que o 360º dele
--      foi emitido.
--   3) entregas não traziam contexto/created_at/usado_em — impossível
--      distinguir Roda inicial × formal (mesmo `sistema`, duas
--      aplicações) ou datar cada parada.
--
-- Mudanças, todas aditivas:
--
--   · instrumentos_da_dupla — entregas ganham contexto/created_at/
--     usado_em/expira_em. Consumidores atuais leem só as chaves antigas;
--     os campos novos são superset estrito do payload.
--   · jovem_jornada() — RPC definer auto-escopada (my_mentorado_id):
--     dupla DPP mais recente do caller + cronograma da turma + os 4
--     instrumentos (reusa instrumentos_da_dupla, já ampliada — o gate
--     interno revalida o claim) + as entregas 360º endereçadas a ele.
--     Sem view sobre formulario_links/ciclo_eventos: projeta só o que
--     a jornada precisa, no padrão de trilha_do_jovem (0092).
--   · painel_instrumentos_jornada() — RPC definer coord/supervisor:
--     por dupla DPP ativa/pausada, as entregas por sistema (status +
--     created_at + destino — SEM respostas, SEM tokens) + contagem de
--     avaliações de encontro. A estação/roda se resolve no cliente com
--     a mesma lógica da lib de jornada; o payload fica pequeno e não
--     vaza conteúdo pro painel agregado.

-- 1) instrumentos_da_dupla — corpo de 0093 verbatim + campos aditivos
--    por entrega (contexto, created_at, usado_em, expira_em).
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
                     -- submit segue protegido pelo gate de identidade (0070).
                     -- Exceção WP7: quando o caller é o mentorado da dupla,
                     -- entregas endereçadas a OUTRO destinatário saem sem
                     -- token (ela não entrega link — evita bearer theft).
                     'token', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else l.token end,
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
                     -- token/respostas nulos em entregas NÃO endereçadas
                     -- ao mentorado quando o caller é ele: um link "pro
                     -- mentor" (insert manual coord) não pode vazar
                     -- bearer token nem resposta pra jovem — ela não
                     -- entrega link a ninguém e anon+token=posse (0070).
                     'respostas', case
                       when l.dest_mentorado_id is null
                            and v_dupla.mentorado_id = public.my_mentorado_id()
                         then null
                       else r.respostas end,
                     -- WP7: a jornada precisa datar a parada e distinguir
                     -- Roda inicial (enc. 1) da formal (enc. 12–14). São
                     -- metadados do link, não conteúdo novo — por isso
                     -- whitelist de chaves (contexto é jsonb livre da
                     -- coord; nunca devolver o objeto inteiro).
                     'contexto', coalesce((
                       select jsonb_object_agg(cx.key, cx.value)
                         from jsonb_each(l.contexto) as cx(key, value)
                        where cx.key in ('origem','momento','encontro','dupla_id')
                     ), '{}'::jsonb),
                     'created_at', l.created_at,
                     'usado_em', l.usado_em,
                     'expira_em', l.expira_em
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

-- 2) jovem_jornada — a dupla DPP do caller + o cronograma da turma dele +
--    os instrumentos + o 360º. Tudo que a página "Minha jornada" precisa
--    num contrato só; sem expor ciclo_eventos nem formulario_links.
create or replace function public.jovem_jornada()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ment uuid;
  v_dupla record;
begin
  -- mesmo gate da view jovem_duplas (0067): papel mentorado + id próprio
  v_ment := public.my_mentorado_id();
  if (public.my_role() = 'mentorado' and v_ment is not null) is not true then
    raise exception 'sem permissão';
  end if;

  -- a dupla DPP mais recente (reemparelhamento cria outra linha; trilhas
  -- de especialista não carregam a jornada do guia)
  select d.id, d.mentor_id, d.mentorado_id, d.cronograma_id
    into v_dupla
    from duplas d
   where d.mentorado_id = v_ment
     and d.trilha is distinct from 'especialista'
   -- dupla viva primeiro; depois a mais recente. desc aqui seria NULLS
   -- FIRST — uma encerrada sem iniciada_em ganharia da ativa (0090/0092
   -- já usam nulls last pelo mesmo motivo)
   order by (d.status in ('ativa','pausada')) desc,
            d.iniciada_em desc nulls last,
            d.created_at desc
   limit 1;
  if not found then
    -- jovem sem dupla: a página cai na biblioteca plana (comportamento atual)
    return null;
  end if;

  return jsonb_build_object(
    'dupla_id', v_dupla.id,
    'cronograma', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', e.numero,
               'data', e.data,
               'tipo', e.tipo,
               'fase', e.fase,
               'instrumentos', e.instrumentos
             ) order by e.data)
        from ciclo_eventos e
       where e.cronograma_id = v_dupla.cronograma_id
    ), '[]'::jsonb),
    -- reusa a RPC da ficha: o gate interno revalida mentorado_id e o
    -- payload já traz contexto/created_at desde esta migration
    'instrumentos', public.instrumentos_da_dupla(v_dupla.id),
    'avaliacao_360', coalesce((
      select jsonb_agg(jsonb_build_object(
               'link_id', l.id,
               'token', l.token,
               'status', case
                 when l.usado_em is not null then 'respondido'
                 when l.expira_em is not null and l.expira_em < now()
                   then 'expirado'
                 else 'pendente' end,
               'respondido_em', r.respondido_em,
               'respostas', r.respostas,
               -- mesma whitelist de contexto (chaves de máquina apenas)
               'contexto', coalesce((
                 select jsonb_object_agg(cx.key, cx.value)
                   from jsonb_each(l.contexto) as cx(key, value)
                  where cx.key in ('origem','momento','encontro','dupla_id')
               ), '{}'::jsonb),
               'created_at', l.created_at,
               'expira_em', l.expira_em
             ) order by l.created_at)
        from formulario_links l
        join formularios f on f.id = l.formulario_id
        left join formulario_respostas r on r.link_id = l.id
       where f.sistema = 'avaliacao_360'
         -- só o link da própria jovem: o 360º do mentor/terceiros da
         -- mesma dupla nunca aparece aqui
         and l.dest_mentorado_id = v_ment
         and (l.dupla_id = v_dupla.id or l.dupla_id is null)
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.jovem_jornada() from public, anon;
grant execute on function public.jovem_jornada() to authenticated;

-- 3) painel_instrumentos_jornada — visão agregada pra coordenação e
--    supervisor: por dupla DPP viva, o estado das entregas por sistema
--    (sem respostas e sem tokens) + contagem de avaliações de encontro.
--    A resolução de estações/janelas fica na lib, que já tem o
--    cronograma — a RPC só projeta o fato bruto, pequeno e não-pessoal.
create or replace function public.painel_instrumentos_jornada()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if (
    public.my_role() = 'coordenacao'
    or public.has_papel('supervisor'::public.app_role)
  ) is not true then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'dupla_id', d.id,
        'turma', d.turma,
        'cronograma_id', d.cronograma_id,
        'mentor_id', d.mentor_id,
        'mentor_nome', coalesce(pm.nome_social, pm.nome),
        'mentorado_id', d.mentorado_id,
        'jovem_nome', coalesce(m.nome_social, m.nome),
        'entregas', coalesce((
          select jsonb_object_agg(x.sistema, x.entregas)
            from (
              select f.sistema,
                     jsonb_agg(jsonb_build_object(
                       'status', case
                         when l.usado_em is not null then 'respondido'
                         when l.expira_em is not null and l.expira_em < now()
                           then 'expirado'
                         else 'pendente' end,
                       'created_at', l.created_at,
                       'destino', case
                         when l.dest_mentorado_id is not null then 'mentorado'
                         else 'mentor' end,
                       -- momento (inicial×formal) via a mesma whitelist —
                       -- sem contexto o painel diverge da jornada no corte
                       'contexto', coalesce((
                         select jsonb_object_agg(cx.key, cx.value)
                           from jsonb_each(l.contexto) as cx(key, value)
                          where cx.key in ('origem','momento','encontro','dupla_id')
                       ), '{}'::jsonb)
                     ) order by l.created_at) as entregas
                from formularios f
                join formulario_links l
                  on l.formulario_id = f.id
                 and l.dupla_id = d.id
                 and (l.dest_mentorado_id = d.mentorado_id
                      or l.dest_profile_id = d.mentor_id)
               where f.sistema in ('visao','metas','pdm','roda_vida','avaliacao_360')
               group by f.sistema
            ) x
        ), '{}'::jsonb),
        'avaliacoes_encontro', (
          select jsonb_build_object(
            'feitas', count(a.id),
            'realizados', count(e.id),
            -- posição real da dupla (não a da coorte): dupla tardia tem
            -- janela ainda aberta mesmo com a turma lá na frente
            'max_numero', max(e.numero)
          )
            from encontros e
            left join avaliacoes_encontro a on a.encontro_id = e.id
           where e.dupla_id = d.id
             and e.status = 'realizado'
        )
      )
      order by d.turma, coalesce(m.nome_social, m.nome)
    )
      from duplas d
      join profiles pm on pm.id = d.mentor_id
      join mentorados m on m.id = d.mentorado_id
     where d.trilha is distinct from 'especialista'
       and d.status in ('ativa', 'pausada')
       and (
         public.my_role() = 'coordenacao'
         or d.supervisor_id = public.my_profile_id()
       )
  ), '[]'::jsonb);
end $$;

revoke all on function public.painel_instrumentos_jornada() from public, anon;
grant execute on function public.painel_instrumentos_jornada() to authenticated;

-- 4) emitir_link_instrumento — grava contexto.momento ('inicial'|'formal')
--    nas entregas de roda_vida. Sem ele o corte inicial×formal fica por
--    created_at vs. data do enc. 12, que erra nos caminhos reais: dupla
--    emparelhada tarde (a primeira Roda dela É a leitura inicial, mesmo
--    depois do enc. 12), aplicação honesta atrasada e re-envio de link.
--    Regra: a primeira roda da dupla é 'inicial'; as seguintes, 'formal'.
--    Corpo verbatim da versão vigente (0093) + o cálculo/stamp de momento.
create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
  v_rodas int;
  v_momento text;
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

  -- WP7: momento da aplicação (roda_vida) — a régua são as RESPONDIDAS:
  -- nenhuma roda respondida ainda → esta emissão é da leitura inicial
  -- (re-envio de link expirado continua inicial); com ≥1 respondida, a
  -- aplicação seguinte é a formal. Contagem total erraria dos dois
  -- lados: inicial respondida + nova emissão sairia "inicial", e um
  -- re-envio de link morto sairia "formal" sem a inicial ter acontecido.
  v_momento := null;
  if p_sistema = 'roda_vida' then
    select count(*) into v_rodas
      from formulario_links x
      join formularios xf on xf.id = x.formulario_id
     where xf.sistema = 'roda_vida'
       and x.dupla_id = v_dupla.id
       and x.usado_em is not null;
    v_momento := case when v_rodas = 0 then 'inicial' else 'formal' end;
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
    -- passa a apontar pra esta — a resposta ganha o contexto certo.
    -- momento só é preenchido quando ausente: o valor já gravado vence.
    update formulario_links
       set dupla_id = v_dupla.id,
           contexto = contexto
             || '{"origem":"instrumentos"}'::jsonb
             || case
                  when v_momento is not null
                       and contexto ->> 'momento' is null
                    then jsonb_build_object('momento', v_momento)
                  else '{}'::jsonb end
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from 'instrumentos'
            or (v_momento is not null and contexto ->> 'momento' is null));
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
    '{"origem":"instrumentos"}'::jsonb
      || case
           when v_momento is not null
             then jsonb_build_object('momento', v_momento)
           else '{}'::jsonb end,
    public.my_profile_id()
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

revoke all on function public.emitir_link_instrumento(uuid, text)
  from public, anon;
grant execute on function public.emitir_link_instrumento(uuid, text)
  to authenticated;
