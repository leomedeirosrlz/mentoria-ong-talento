-- comunicados.prioridade: separa informativo de importante/urgente.
-- Três níveis, default 'normal' — rows existentes viram informativas.
-- prioridade_ord é coluna gerada porque PostgREST não ordena por expressão
-- nem por texto na ordem semântica certa ('urgente' < 'importante' < 'normal'
-- alfabeticamente inverte a urgência).
alter table public.comunicados
  add column prioridade text not null default 'normal'
    check (prioridade in ('normal', 'importante', 'urgente'));

comment on column public.comunicados.prioridade is
  'normal = informativo · importante = pede atenção/ação · urgente = crítico ou com prazo';

alter table public.comunicados
  add column prioridade_ord smallint generated always as (
    case prioridade when 'urgente' then 0 when 'importante' then 1 else 2 end
  ) stored;

create index comunicados_ordem_idx
  on public.comunicados (prioridade_ord, created_at desc);

-- a validação em publicarComunicado (actions.ts) espelha este check —
-- valor inválido vira 'normal' antes do insert, o check é a rede de segurança.
