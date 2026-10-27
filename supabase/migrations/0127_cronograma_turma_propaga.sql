-- 0127 · REALIZA-223 — rename de turma propaga pro selo da dupla e pros
-- snapshots por label.
--
-- CONTEXTO
-- `cronogramas.turma` é o label vivo; `duplas.turma` é o selo gravado no
-- pareamento. Renomear o cronograma não propagava: o selo congelava no
-- label velho ("2026/2027") e todo filtro que casava label-com-label
-- esvaziava a turma nova ("Turma Aberta - Jovens de ONGs"). A mesma
-- divergência atingia os snapshots sem FK: `turma_inscricoes.turma`,
-- `relatorio_links.turma` + `config->>'turma'`,
-- `solicitacoes_especialista.turma` e `profile_papeis.escopo_turma` (o
-- grant de escopo já lia resiliente — `supervisiona_dupla` casa
-- `d.turma` OU `c.turma`, 0125 — mas o label gravado ficava velho).
--
-- MODELO
-- `cronograma_id` é a âncora da dupla: AFTER UPDATE OF turma regrava o
-- selo das vinculadas e, quando o label velho fica ÓRFÃO (nenhum
-- cronograma o usa mais), migra os snapshots por label pro novo. Label
-- que continua vivo em outro cronograma não é mexido — turmas
-- distintas já dividiram o mesmo label histórico. No app a leitura de
-- filtro resolve o rótulo vivo (turmaDaDupla / join no cronograma); o
-- selo propagado serve exibição e os consumidores sem join (link
-- público salvo, fila de inscrições, sugestão de especialista).
--
-- O backfill abaixo aplica a mesma regra nas divergências já
-- existentes em produção.

begin;

-- ============ 1) mapa velho→novo — as duplas carregam os dois lados pelo
-- cronograma_id. Só migra snapshot de label_velho com destino
-- UNÍVOCO: se o mesmo label velho virou dois rótulos diferentes em
-- cronogramas diferentes, a linha sem FK não tem como dizer pra qual
-- turma ia — fica pra revisão manual em vez de migrar errado.
create temp table turma_renomeio on commit drop as
select label_velho, min(label_novo) as label_novo
  from (
    select distinct d.turma as label_velho, c.turma as label_novo
      from public.duplas d
      join public.cronogramas c on c.id = d.cronograma_id
     where d.turma is distinct from c.turma
  ) m
 group by label_velho
having count(*) = 1;

-- ============ 2) snapshots por label — só quando o label velho ficou
-- órfão (nenhum cronograma o usa mais). Label ainda vivo pode
-- pertencer a outro cronograma de fato.

-- fila de espera da turma (0110/0111). O unique (turma, profile_id,
-- mentorado_id) pode colidir se a pessoa já consta no label novo —
-- nesse caso a linha velha é duplicata e fica pra revisão manual.
update public.turma_inscricoes i
   set turma = m.label_novo
  from turma_renomeio m
 where i.turma = m.label_velho
   and not exists (
         select 1 from public.cronogramas c where c.turma = i.turma)
   and not exists (
         select 1 from public.turma_inscricoes i2
          where i2.turma = m.label_novo
            and i2.profile_id is not distinct from i.profile_id
            and i2.mentorado_id is not distinct from i.mentorado_id);

-- links públicos de relatório (0110): coluna e o recorte salvo no
-- config são snapshots independentes — um pode estar certo e o outro
-- velho, cada um migra no seu.
update public.relatorio_links l
   set turma = m.label_novo
  from turma_renomeio m
 where l.turma = m.label_velho
   and not exists (
         select 1 from public.cronogramas c where c.turma = l.turma);

update public.relatorio_links l
   set config = jsonb_set(l.config, '{turma}', to_jsonb(m.label_novo))
  from turma_renomeio m
 where l.config->>'turma' = m.label_velho
   and not exists (
         select 1 from public.cronogramas c
          where c.turma = l.config->>'turma');

-- demanda de especialista (0074): a turma sugerida congela no envio.
update public.solicitacoes_especialista s
   set turma = m.label_novo
  from turma_renomeio m
 where s.turma = m.label_velho
   and not exists (
         select 1 from public.cronogramas c where c.turma = s.turma);

-- escopo do auxiliar (0085/0125): o grant casa pelo label — sem o
-- backfill ele ficava apontando pro nome morto.
update public.profile_papeis pp
   set escopo_turma = m.label_novo
  from turma_renomeio m
 where pp.escopo_turma = m.label_velho
   and not exists (
         select 1 from public.cronogramas c
          where c.turma = pp.escopo_turma);

-- ============ 3) o selo das duplas — âncora é o cronograma_id, sempre
-- migra (a dupla "é" da turma do cronograma dela, não do label que
-- coincidia quando pareou).
update public.duplas d
   set turma = c.turma
  from public.cronogramas c
 where c.id = d.cronograma_id
   and d.turma is distinct from c.turma;

-- ============ 4) trigger — os próximos renames propagam sozinhos
create or replace function public.propagar_turma_do_cronograma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- selo das duplas: a âncora é o cronograma_id, propaga sempre.
  update public.duplas
     set turma = new.turma
   where cronograma_id = new.id
     and turma is distinct from new.turma;

  -- snapshots por label: só migram quando o label velho ficou órfão —
  -- enquanto outro cronograma o usa, o snapshot pode ser dele.
  if not exists (
    select 1 from public.cronogramas c where c.turma = old.turma
  ) then
    update public.turma_inscricoes i
       set turma = new.turma
     where i.turma = old.turma
       and not exists (
             select 1 from public.turma_inscricoes i2
              where i2.turma = new.turma
                and i2.profile_id is not distinct from i.profile_id
                and i2.mentorado_id is not distinct from i.mentorado_id);

    update public.relatorio_links
       set turma = new.turma
     where turma = old.turma;

    update public.relatorio_links
       set config = jsonb_set(config, '{turma}', to_jsonb(new.turma))
     where config->>'turma' = old.turma;

    update public.solicitacoes_especialista
       set turma = new.turma
     where turma = old.turma;

    update public.profile_papeis
       set escopo_turma = new.turma
     where escopo_turma = old.turma;
  end if;

  return new;
end;
$$;

comment on function public.propagar_turma_do_cronograma() is
  'REALIZA-223: rename de cronogramas.turma regrava duplas.turma das vinculadas (âncora = cronograma_id) e, quando o label velho fica órfão, migra os snapshots por label (turma_inscricoes, relatorio_links+config, solicitacoes_especialista, profile_papeis.escopo_turma).';

drop trigger if exists cronograma_turma_propaga on public.cronogramas;
create trigger cronograma_turma_propaga
  after update of turma on public.cronogramas
  for each row
  when (old.turma is distinct from new.turma)
  execute function public.propagar_turma_do_cronograma();

commit;

-- rollback: drop trigger cronograma_turma_propaga on public.cronogramas;
--           drop function public.propagar_turma_do_cronograma();
--           (o backfill de labels é dados — reverter exigiria o mapa
--           velho→novo, que o temp table não preserva: tirar snapshot
--           antes de aplicar, ou re-rodar a consulta das duplas quando
--           o selo ainda for o velho)
