-- 0186: o fechamento automático avisa também a CONTA do jovem.
--
-- CONTEXTO
-- dupla_encerramento_auto (0102/0156) notifica equipe e mentor quando o
-- último encontro do cronograma cai — o sino do jovem ficava de fora
-- porque até a 0066/0171 o mentorado não tinha login. Com a conta
-- vinculada (mentorados.profile_id) ele recebe o mesmo marco — paridade
-- com os caminhos manuais (createDupla/updateDupla/registrarEncerramento/
-- remanejarDupla), que já fan-out pro profile do jovem.
--
-- O insert vai por trigger security definer — notificacoes_insert não se
-- aplica a este caminho (mesmo desenho dos avisos de equipe/mentor acima).
-- O href é /jovem: a ficha /duplas/<id> é da staff; a home dele mostra a
-- dupla e o resumo da jornada.

begin;

-- corpo verbatim da 0156 — o que muda: a leitura da ficha já traz
-- profile_id e o ramo "último encontro" ganha o insert pro jovem
create or replace function public.dupla_encerramento_auto()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d record;
  v_janela int[];   -- números dos encontros efetivos (pós-início da dupla)
  v_ultimo int;
  v_feitos int;
  v_href text;
  v_mentorado text;
  v_jovem_profile uuid;
begin
  if new.numero is null then
    return new;
  end if;

  select id, trilha, status, cronograma_id, iniciada_em, mentor_id,
         supervisor_id, mentorado_id
    into d
    from public.duplas
   where id = new.dupla_id;

  if d.id is null
     or d.trilha is distinct from 'dpp'
     or d.status not in ('ativa', 'pausada')
     or d.cronograma_id is null then
    return new;
  end if;

  -- janela efetiva = passos 'encontro' do cronograma a partir do início da
  -- dupla (mesma poda de jornadaDaDupla em ciclo.ts: o que veio antes dela
  -- entrar não conta). Dupla que começa no enc. 7 tem ~10 passos, não 16.
  select array_agg(e.numero order by e.numero)
    into v_janela
    from public.ciclo_eventos e
   where e.cronograma_id = d.cronograma_id
     and e.tipo = 'encontro'
     and e.numero is not null
     and (d.iniciada_em is null or e.data is null or e.data >= d.iniciada_em);

  if v_janela is null then
    return new;
  end if;
  v_ultimo := v_janela[array_length(v_janela, 1)];

  select count(distinct en.numero) into v_feitos
    from public.encontros en
   where en.dupla_id = d.id
     and en.status = 'realizado'
     and en.numero = any (v_janela);

  v_href := '/duplas/' || d.id;
  select nome, profile_id into v_mentorado, v_jovem_profile
    from public.mentorados where id = d.mentorado_id;

  -- último encontro do cronograma → a jornada terminou de fato. Avaliado
  -- ANTES do aviso de reta final: o último caindo com 2 buracos no meio
  -- tem restante=2 e é o último ao mesmo tempo — fechar é o que importa
  -- (avisar "faltam 2" ali seria mentira: os 2 que faltam já passaram).
  if new.numero = v_ultimo then
    update public.duplas set status = 'concluida'
     where id = d.id and status in ('ativa', 'pausada');

    -- a row do rito nasce 'pendente' (ou preserva a que já existia):
    -- decidido_por segue sendo a coordenação
    insert into public.encerramentos (dupla_id, tipo) values (d.id, 'pendente')
      on conflict (dupla_id) do nothing;

    -- equipe: o fechamento automático pede o rito — copy carrega a ação
    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_formada',
           'Dupla concluiu a jornada',
           'Último encontro de ' || coalesce(v_mentorado, 'a dupla')
             || ' registrado — falta o checklist de encerramento na ficha.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null;

    -- mentor: paridade com o fluxo manual — sem filtro de ator, a conclusão
    -- é efeito do registro dele e ele precisa saber
    if d.mentor_id is not null then
      insert into public.notificacoes
        (profile_id, tipo, titulo, corpo, href, created_by)
      values (d.mentor_id, 'dupla_formada',
        'Sua dupla concluiu a jornada',
        'O último encontro com ' || coalesce(v_mentorado, 'seu mentorado')
          || ' foi registrado. O resumo segue na ficha da dupla.',
        v_href, public.my_profile_id());
    end if;

    -- jovem com conta: a conclusão chega ao sino dele também. O resumo da
    -- jornada mora na página dele — a ficha /duplas não abre pro papel.
    if v_jovem_profile is not null then
      insert into public.notificacoes
        (profile_id, tipo, titulo, corpo, href, created_by)
      values (v_jovem_profile, 'dupla_formada',
        'Sua dupla concluiu a jornada',
        'O último encontro da jornada foi registrado. O resumo fica na sua página.',
        '/jovem', public.my_profile_id());
    end if;

    return new;
  end if;

  -- faltam 2 → um aviso por destinatário, uma vez por dupla. O advisory
  -- lock por dupla serializa transições concorrentes (import + registro do
  -- mentor na mesma janela) — convenção da 0099/0094 — e o dedup no
  -- tipo+href torna o aviso fire-once (o restante só desce: realizado é
  -- imutável e o número identifica o passo).
  if array_length(v_janela, 1) - v_feitos = 2 then
    perform pg_advisory_xact_lock(hashtext('reta_final:' || d.id::text));

    insert into public.notificacoes
      (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'dupla_reta_final',
           'Dupla na reta final',
           coalesce(v_mentorado, 'A dupla')
             || ' e o mentor têm 2 encontros pela frente — dá pra adiantar o encerramento.',
           v_href, public.my_profile_id()
      from (
        select id from public.profiles where role = 'coordenacao' and ativo
        union select d.supervisor_id
      ) p
     where p.id is not null
       and not exists (
         select 1 from public.notificacoes n
          where n.profile_id = p.id
            and n.tipo = 'dupla_reta_final'
            and n.href = v_href
       );
  end if;

  return new;
end $function$;

commit;
