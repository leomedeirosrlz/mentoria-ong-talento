-- 0062: ciclo_eventos deixa de ser "só um calendário de datas" e passa a
-- espelhar o cronograma oficial do PDF (REALIZA-30, spec
-- docs/planos/spec-realiza-30.md).
--
-- O PDF tem 4 seções — preparação, mentoria ativa, encerramento e
-- observações operacionais — e o modelo antigo só representava a 2ª:
--   tipo   — 'marco' sai; entram 'etapa_preparacao' e 'evento_encerramento'.
--            'formacao' fica (sync_formacao_ok/ehEventoFormacao filtram por ele).
--   data   — nullable: etapa entregue pela ONG parceira é "Concluída", não
--            tem data. CHECK garante que só etapa concluída fica sem data.
--   status — 'pendente' | 'concluida'; semântica real só pra etapa de
--            preparação (nos demais tipos permanece 'pendente').
--   observacao — regras/notas do PDF ("Reposição na mesma semana",
--            "Feriado municipal — confirmar local", "Encontro duplo").
--   ordem  — chave de ordenação única do cronograma. `data nulls last`
--            computado não basta: etapa concluída sem data cairia depois do
--            encerramento, o contrário do PDF. Não é unique — o wizard de
--            cronogramas (REALIZA-46) pode reordenar criando gaps.
--
-- Backfill de ordem: row_number() por cronograma ordenado por
-- (data, numero nulls last, id) — o tiebreak por id resolve formacao e
-- etapa de abertura no mesmo dia (04/09) com numero null. Inserts futuros
-- (REALIZA-31 cadastra as turmas reais, REALIZA-46 o wizard) fornecem
-- `ordem` explícita.
begin;

-- ============ 1) tipo: marco sai, entram etapa_preparacao + evento_encerramento
-- Reclassificação antes do CHECK novo: o remoto tem exatamente 1 marco
-- (verificado) — "Evento de encerramento do programa", que o PDF lista na
-- seção de encerramento.
update public.ciclo_eventos
   set tipo = 'evento_encerramento'
 where tipo = 'marco'
   and titulo = 'Evento de encerramento do programa';

-- qualquer 'marco' remanescente é preparação: o PDF só usa marcos pra etapas
-- de pré-ciclo, então o fallback fiel é etapa_preparacao. Todas as rows
-- antigas têm data (era NOT NULL), então o CHECK novo passa com status
-- 'pendente' mesmo — a semântica de "concluída sem data" é só pra rows novas.
update public.ciclo_eventos
   set tipo = 'etapa_preparacao'
 where tipo = 'marco';

alter table public.ciclo_eventos
  drop constraint if exists ciclo_eventos_tipo_check;
alter table public.ciclo_eventos
  add constraint ciclo_eventos_tipo_check
  check (tipo in ('etapa_preparacao', 'encontro', 'recesso',
                  'evento_encerramento', 'formacao'));

-- ============ 2) status + observacao + data nullable ============
alter table public.ciclo_eventos
  add column if not exists status text not null default 'pendente',
  add column if not exists observacao text;

alter table public.ciclo_eventos
  drop constraint if exists ciclo_eventos_status_check;
alter table public.ciclo_eventos
  add constraint ciclo_eventos_status_check
  check (status in ('pendente', 'concluida'));

comment on column public.ciclo_eventos.status is
  'Semântica viva só em etapa_preparacao (a ONG entrega triagem/matching '
  'concluído). Nos demais tipos permanece pendente — sem efeito de domínio.';

comment on column public.ciclo_eventos.observacao is
  'Notas operacionais do cronograma oficial: reposição, feriados, encontro duplo.';

-- data nullable só pra etapa já entregue: linha sem data precisa ser etapa
-- concluída; qualquer outro tipo — e etapa pendente — exige data
alter table public.ciclo_eventos
  alter column data drop not null;

alter table public.ciclo_eventos
  drop constraint if exists ciclo_eventos_data_check;
alter table public.ciclo_eventos
  add constraint ciclo_eventos_data_check
  check (data is not null or (tipo = 'etapa_preparacao' and status = 'concluida'));

-- meia-range não existe: sem início não há fim
alter table public.ciclo_eventos
  drop constraint if exists ciclo_eventos_data_fim_check;
alter table public.ciclo_eventos
  add constraint ciclo_eventos_data_fim_check
  check (data_fim is null or data is not null);

-- ============ 3) ordem: sequência do PDF, explícita ============
alter table public.ciclo_eventos
  add column if not exists ordem smallint;

-- backfill determinístico: data primeiro; no mesmo dia, evento numerado
-- antes; empate total (formacao × etapa de abertura, 04/09) resolve por id
with seq as (
  select id,
         row_number() over (
           partition by cronograma_id
           order by data, numero nulls last, id
         )::smallint as n
    from public.ciclo_eventos
)
update public.ciclo_eventos e
   set ordem = seq.n
  from seq
 where seq.id = e.id;

alter table public.ciclo_eventos
  alter column ordem set not null;

comment on column public.ciclo_eventos.ordem is
  'Chave de ordenação única do cronograma (sequência do PDF). Não é unique: '
  'reordenações do wizard podem criar gaps. Inserts fornecem ordem explícita.';

create index if not exists ciclo_eventos_cronograma_ordem_idx
  on public.ciclo_eventos (cronograma_id, ordem);

commit;

-- rollback manual (ordem reversa):
--   drop index if exists public.ciclo_eventos_cronograma_ordem_idx;
--   alter table public.ciclo_eventos drop column ordem;
--   alter table public.ciclo_eventos drop constraint ciclo_eventos_data_fim_check,
--     drop constraint ciclo_eventos_data_check;
--   alter table public.ciclo_eventos alter column data set not null; -- falha se houver etapa sem data
--   alter table public.ciclo_eventos drop constraint ciclo_eventos_status_check,
--     drop column observacao, drop column status;
--   alter table public.ciclo_eventos drop constraint ciclo_eventos_tipo_check;
--   update public.ciclo_eventos set tipo = 'marco'
--     where tipo in ('etapa_preparacao', 'evento_encerramento');
--   alter table public.ciclo_eventos add constraint ciclo_eventos_tipo_check
--     check (tipo in ('encontro', 'formacao', 'recesso', 'marco'));
