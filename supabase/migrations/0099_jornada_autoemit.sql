begin;

-- 0099 — REALIZA-152: auto-emissão dos instrumentos da jornada.
--
-- Até aqui o link de cada instrumento (visao/metas/pdm/roda_vida) só nascia
-- por gesto humano — mentor ou coord clicavam "Gerar link" na ficha e
-- mandavam por WhatsApp. A jornada já sabe a hora certa (janelas do guia
-- por nº de encontro + o encontro corrente da dupla), então a emissão vira
-- automática:
--
--   * a dupla é criada → instrumentos do enc. 1 (roda inicial, visão, PDM)
--     já estão disponíveis — a Roda da Vida existe antes mesmo do 1º
--     encontro acontecer;
--   * o mentor registra o encontro N → a janela do N+1 abre e o próximo
--     instrumento emite sozinho (metas destrava ao registrar o enc. 1);
--   * a jovem abre "Minha jornada" → a RPC auto-cura qualquer lacuna
--     (duplas antigas, importações, forms reativados) — rede de segurança;
--   * a dupla é encerrada/remanejada → os links pendentes dela expiram —
--     a resposta nunca cai numa dupla morta (a sucessora minta os seus).
--
-- Dois descansos são garantidos: instrumento respondido nunca re-emite
-- (re-emissão é gesto humano — revisão do PDM, nova rodada manual), e o
-- vínculo fica auditável em contexto.origem ('auto' × 'instrumentos').
--
-- O 360º NÃO entra: a emissão dele é decisão de encerramento da
-- coordenação (pode mirar outros destinatários) — segue manual por
-- gerarLinksParaDupla. O gate humano do emitir_link_instrumento continua
-- idêntico pros usos manuais (re-emissão de link expirado etc.).
--
-- 1) emitir_instrumento_core — o miolo do emitir_link_instrumento (0096,
--    re-emitido na 0097) sem o gate de papel: form lookup + ativo +
--    momento da roda + reúso de link pendente/órfão + insert. Função
--    interna — execute revogado: só callable dentro de outras definer.

--    p_origem carimba contexto.origem: 'instrumentos' no gesto manual,
--    'auto' na emissão da jornada — auditoria de quem mintou o link.
create or replace function public.emitir_instrumento_core(
  p_dupla_id uuid, p_sistema text, p_created_by uuid,
  p_origem text default 'instrumentos'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_form record;
  v_link record;
  v_rodas int;
  v_momento text;
begin
  -- defesa em profundidade: o gate valida, mas o core é callable de
  -- qualquer definer futura — 360º/anamnese nunca saem por este caminho
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;

  -- um link por (dupla, instrumento): serializa a corrida entre o trigger
  -- do encontro, a auto-cura do jovem_jornada e o clique manual do mentor
  -- (o reúso read-then-insert abaixo não se enxerga entre transações)
  perform pg_advisory_xact_lock(hashtext(p_dupla_id::text || ':' || p_sistema));

  select d.id, d.mentorado_id
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
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
             || jsonb_build_object('origem', p_origem)
             || case
                  when v_momento is not null
                       and contexto ->> 'momento' is null
                    then jsonb_build_object('momento', v_momento)
                  else '{}'::jsonb end
     where id = v_link.id
       and (dupla_id is distinct from v_dupla.id
            or contexto ->> 'origem' is distinct from p_origem
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
    jsonb_build_object('origem', p_origem)
      || case
           when v_momento is not null
             then jsonb_build_object('momento', v_momento)
           else '{}'::jsonb end,
    p_created_by
  )
  returning id, token into v_link;

  return jsonb_build_object('token', v_link.token, 'reutilizado', false);
end $$;

-- interna: nunca endereçável via PostgREST — só callable dentro de outras
-- security definer (privilégio do owner, como nas demais helpers internas)
revoke all on function public.emitir_instrumento_core(uuid, text, uuid, text)
  from public, anon, authenticated;

-- 2) emitir_link_instrumento vira gate + core — mensagens e regras
--    byte-a-byte iguais às da 0097 (a auditoria conta com elas).
create or replace function public.emitir_link_instrumento(
  p_dupla_id uuid, p_sistema text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
begin
  if p_sistema not in ('visao', 'roda_vida', 'pdm', 'metas') then
    raise exception 'instrumento inválido';
  end if;

  select d.id, d.mentor_id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found then
    raise exception 'dupla não encontrada';
  end if;

  -- escopo do emissor: coordenação ou o mentor DPP da dupla — e a jornada
  -- precisa estar viva nos dois casos (0097: o ramo coord não checava
  -- trilha/status e conseguia emitir instrumento em dupla especialista,
  -- cujo link virava órfão invisível, e em dupla encerrada).
  -- autorização primeiro: quem não pode nem ver a dupla recebe o erro
  -- genérico — os diferenciais de trilha/status vazariam a classificação
  -- pra qualquer autenticado que chutasse o UUID (execute é de
  -- authenticated, como sempre foi)
  if (
    public.my_role() = 'coordenacao'
    or (
      public.has_papel('mentor_dpp'::public.app_role)
      and v_dupla.mentor_id = public.my_profile_id()
    )
  ) is not true then
    raise exception 'sem permissão pra enviar instrumento desta dupla';
  end if;
  if v_dupla.trilha = 'especialista' then
    raise exception 'trilha de especialista não usa os instrumentos da jornada DPP';
  elsif v_dupla.status not in ('ativa', 'pausada') then
    raise exception 'jornada encerrada — instrumento é ferramenta de dupla viva';
  end if;

  return public.emitir_instrumento_core(
    p_dupla_id, p_sistema, public.my_profile_id(), 'instrumentos'
  );
end $$;

-- 3) jornada_autoemit — emite o que a janela do guia já abriu pra esta
--    dupla. Idempotente (o core reusa link pendente). Falha de um
--    instrumento não derruba os outros nem a operação que disparou
--    (warning em vez de exception — trigger/RPC seguem).
create or replace function public.jornada_autoemit(p_dupla_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_enc int;
  v_rodas int;
  v_sistema text;
begin
  -- jornada é trilha DPP viva: especialista não tem instrumentos do guia
  -- e dupla encerrada é capítulo fechado (mesma régua do gate do emitir)
  select d.id, d.status, d.trilha
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found
     or v_dupla.trilha = 'especialista'
     or v_dupla.status not in ('ativa', 'pausada') then
    return;
  end if;

  -- encontro corrente = maior realizado + 1, teto 16 — a mesma âncora da
  -- home do mentor e da lib de jornada (encCorrente). O registro do mentor
  -- é o que destrava a semana seguinte.
  select least(16, coalesce(max(e.numero), 0) + 1)
    into v_enc
    from encontros e
   where e.dupla_id = p_dupla_id
     and e.status = 'realizado';

  -- janelas do guia — espelho do ESTACOES da lib (src/lib/jornada.ts);
  -- mudou lá, muda aqui: visao/pdm/roda_inicial enc. 1, metas enc. 2,
  -- roda_formal enc. 12. A roda tem as duas pontas na mesma linha:
  -- respondidas=0 → emissão vale a inicial (enc. 1); ≥1 → a formal,
  -- que só abre no enc. 12 (antes disso nada emite mesmo com resposta).
  foreach v_sistema in array array['visao', 'pdm', 'roda_vida', 'metas']
  loop
    if not exists (
      select 1 from formularios f
       where f.sistema = v_sistema and f.ativo
    ) then
      continue; -- form encerrado/ausente: a emissão manual segue barrada
    end if;
    if v_sistema = 'metas' and v_enc < 2 then
      continue;
    end if;
    -- instrumento cumprido descansa: uma resposta registrada encerra a
    -- emissão automática daquele sistema — re-emissão vira gesto humano
    -- (revisão do PDM, nova rodada), senão a estação 'feito' ressuscitaria
    -- como 'a fazer' a cada trigger com um link zombie esperando a jovem.
    -- Única exceção legítima é a roda: respondidas=1 vale a inicial e a
    -- formal segue devendo no enc. 12.
    if v_sistema = 'roda_vida' then
      select count(*) into v_rodas
        from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = 'roda_vida'
         and x.dupla_id = p_dupla_id
         and x.usado_em is not null;
      if v_rodas >= 2 or (v_rodas = 1 and v_enc < 12) then
        continue; -- as duas pontas cumpridas, ou ainda não chegou a formal
      end if;
    elsif exists (
      select 1 from formulario_links x
        join formularios xf on xf.id = x.formulario_id
       where xf.sistema = v_sistema
         and x.dupla_id = p_dupla_id
         and x.usado_em is not null
    ) then
      continue;
    end if;
    begin
      perform public.emitir_instrumento_core(
        p_dupla_id, v_sistema, null, 'auto'
      );
    exception when others then
      raise warning 'jornada_autoemit(%, %): %', p_dupla_id, v_sistema, sqlerrm;
    end;
  end loop;
end $$;

revoke all on function public.jornada_autoemit(uuid)
  from public, anon, authenticated;

-- 4) jovem_jornada() — auto-cura no primeiro load e em cada visita: é a
--    rede de segurança pra duplas criadas antes da migration, dados
--    importados e forms reativados. O perform roda antes de projetar os
--    instrumentos, então o link recém-emitido já sai no payload.
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

  -- REALIZA-152: garante que toda janela aberta já tem link — a emissão
  -- deixa de depender do gesto manual do mentor/coord
  perform public.jornada_autoemit(v_dupla.id);

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

-- 5) triggers — as três fontes de verdade da jornada:
--
--  a) o registro do mentor: encontro vira realizado → a janela do
--     encontro seguinte abre (registrarEncontro, retroativo e importação
--     passam todos por este caminho — mesmo padrão da 0071)
create or replace function public.jornada_autoemit_encontro()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.jornada_autoemit(new.dupla_id);
  return new;
end $$;

-- dois triggers: WHEN não pode referenciar old em INSERT. No update o
-- WHEN limita à transição pra realizado — salvarRegistro re-grava
-- status='realizado' a cada edição do registro e dispararia à toa.
drop trigger if exists encontros_jornada_autoemit on encontros;
drop trigger if exists encontros_jornada_autoemit_upd on encontros;
create trigger encontros_jornada_autoemit
  after insert on encontros
  for each row when (new.status = 'realizado')
  execute function jornada_autoemit_encontro();
create trigger encontros_jornada_autoemit_upd
  after update of status on encontros
  for each row
  when (old.status is distinct from 'realizado' and new.status = 'realizado')
  execute function jornada_autoemit_encontro();

--  b) a dupla nasce: os instrumentos do enc. 1 (roda inicial, visão, PDM)
--     ficam disponíveis antes do programa começar — e cada remanejo
--     re-minta os links da sucessora (a antecessora morre junto)
create or replace function public.jornada_autoemit_dupla()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.jornada_autoemit(new.id);
  return new;
end $$;

drop trigger if exists duplas_jornada_autoemit on duplas;
create trigger duplas_jornada_autoemit
  after insert on duplas
  for each row
  execute function jornada_autoemit_dupla();

--  c) a dupla morre: sem expiração, o link pendente da antecessora segue
--     vivo e respondível pra sempre — a resposta aterrissaria na dupla
--     encerrada enquanto a sucessora minta os dela (dois tokens válidos
--     pro mesmo instrumento). Remanejo/encerramento expira os pendentes
--     dos instrumentos da jornada; link usado nunca é tocado (a resposta
--     já registrada é história daquela dupla). Os 4 sistemas apenas:
--     formulários avulsos da dupla têm dono/prazo próprios.
create or replace function public.jornada_expirar_links_encerrada()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update formulario_links l
     set expira_em = now()
    from formularios f
   where f.id = l.formulario_id
     and f.sistema in ('visao', 'roda_vida', 'pdm', 'metas')
     and l.dupla_id = new.id
     and l.usado_em is null
     and (l.expira_em is null or l.expira_em > now());
  return new;
end $$;

drop trigger if exists duplas_jornada_expirar on duplas;
create trigger duplas_jornada_expirar
  after update of status on duplas
  for each row
  when (
    old.status in ('ativa', 'pausada')
    and new.status not in ('ativa', 'pausada')
  )
  execute function jornada_expirar_links_encerrada();

-- 6) backfill das duplas vivas — a migration deixa o mundo como se o
--    recurso sempre existiu (o perform é idempotente por desenho)
select public.jornada_autoemit(d.id)
  from duplas d
 where d.trilha is distinct from 'especialista'
   and d.status in ('ativa', 'pausada');

commit;
