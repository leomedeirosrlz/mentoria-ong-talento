begin;

-- 0123 — REALIZA-215: rede de segurança da jornada pela data oficial.
--
-- O encontro corrente da dupla era só "maior realizado + 1": um mentor
-- que atrasa o registro segurava a jornada da jovem inteira — a janela
-- do guia já aberta nunca emitia. A régua ganha um segundo pino, o
-- calendário oficial da turma (ciclo_eventos do cronograma da dupla), e
-- vale o mais avançado dos dois — nunca regride:
--
--   encontro corrente = mínimo(16, máximo de:
--     (a) maior nº de encontro 'realizado' + 1 — o registro destrava;
--     (b) quantos encontros oficiais do cronograma já passaram há MAIS de
--         7 dias DESDE QUE A DUPLA COMEÇOU (iniciada_em) + 1 — a data
--         destrava quando o registro não vem. Conta, e não o nº oficial:
--         dupla que entra com a turma no 5º encontro tem a própria
--         numeração (começa no 1º), e nascer com o 5º aberto entregaria
--         metas e afins no dia da formação. A folga de uma semana cobre
--         o registro tardio normal.
--   )
--
-- (b) só vale pra dupla 'ativa' — a pausada tem o tempo congelado e não
-- avança pela data — e sem cronograma só (a) conta. A trilha de
-- especialista nem chega aqui: sai no gate de cima, como sempre. A mesma
-- régua mora em encCorrenteDe (src/lib/jornada.ts) — mudou aqui, muda lá.
--
-- Quem chama quando só a data passou (nenhum encontro mudou, nenhuma
-- dupla nasceu): a auto-cura do jovem_jornada(), que já performa
-- jornada_autoemit a cada visita da jovem (0099) — a emissão acontece no
-- primeiro load depois que a janela abriu pela data, sem trigger novo.

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
  select d.id, d.status, d.trilha, d.cronograma_id, d.iniciada_em
    into v_dupla
    from duplas d
   where d.id = p_dupla_id;
  if not found
     or v_dupla.trilha = 'especialista'
     or v_dupla.status not in ('ativa', 'pausada') then
    return;
  end if;

  -- encontro corrente = o mais avançado de dois pinos, teto 16:
  --  (a) maior realizado + 1 — o registro do mentor destrava a semana
  --      seguinte (a âncora original, 0099);
  --  (b) quantos encontros oficiais do cronograma da dupla passaram há
  --      MAIS de 7 dias desde iniciada_em + 1 — a rede de segurança contra
  --      registro atrasado (0123); conta, não nº, por causa do ingresso
  --      tardio. O `v_dupla.status = 'ativa'` dentro do
  --      where congela a dupla pausada sem precisar de case; cronograma_id
  --      null não casa nada e (b) vale 1. É greatest(): a régua nunca
  --      regride por data.
  select least(16, greatest(
           coalesce((
             select max(e.numero)
               from encontros e
              where e.dupla_id = p_dupla_id
                and e.status = 'realizado'
           ), 0) + 1,
           (
             select count(*)::int
               from ciclo_eventos ce
              where ce.cronograma_id = v_dupla.cronograma_id
                and ce.tipo = 'encontro'
                and ce.data >= coalesce(v_dupla.iniciada_em::date, '-infinity'::date)
                and ce.data < (now() at time zone 'America/Sao_Paulo')::date - 7
                and v_dupla.status = 'ativa'
           ) + 1
         ))
    into v_enc;

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

-- backfill — a régua nova abre janelas já vencidas por data nas duplas
-- vivas: emite o que ficou preso atrás do registro atrasado (idempotente
-- por desenho: respondido descansa, pendente é reusado pelo core)
select public.jornada_autoemit(d.id)
  from duplas d
 where d.trilha is distinct from 'especialista'
   and d.status in ('ativa', 'pausada');

commit;
