-- 0164 ia_evals — evals persistidos e parametrizáveis da Liza, na área de
-- uso (/ia, coord-only). Um run = casos × modelos × repetições; cada célula
-- vira um item pendente que a UI executa um a um (uma request HTTP por item
-- — o run nunca estoura timeout de função) até fechar. O snapshot dos casos
-- vai na linha: editar tests/evals/casos.json depois não reescreve o
-- histórico. Métricas (tokens/custo/duração) saem do evento 'resposta' que
-- a própria request do chat grava — o item correla por request_id.
--
-- RLS: coordenação lê/escreve tudo (é a dona do painel). O claim do item é
-- atômico via RPC definer (skip locked) pra duas abas não pegarem o mesmo.

begin;

create table public.ia_eval_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  status text not null default 'pendente'
    check (status in ('pendente', 'rodando', 'concluido', 'falhou')),
  ambiente text not null check (char_length(ambiente) between 1 and 40),
  papel text not null check (papel in ('staff', 'mentorado')),
  modelos text[] not null check (cardinality(modelos) between 1 and 8),
  repeticoes int not null check (repeticoes between 1 and 10),
  casos jsonb not null,                 -- snapshot [{id,msg,rubrica,pagina}]
  resumo jsonb,                         -- {total,ok,falhas,erros,medias,fim}
  erro text
);

comment on table public.ia_eval_runs is
  'Run de eval da Liza: grade casos×modelos×repetições disparada do /ia; '
  'casos vêm snapshotados do corpus — histórico não muda com o arquivo.';

create table public.ia_eval_itens (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ia_eval_runs (id) on delete cascade,
  caso_id text not null,
  msg text not null,
  pagina text,
  modelo text not null,
  repeticao int not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'rodando', 'ok', 'falhou', 'erro')),
  rubrica jsonb,                        -- tools_esperadas/contem/nao_contem…
  request_id uuid,
  latencia_ms int,
  tokens_in int,
  tokens_out int,
  custo_usd numeric(12, 6),
  modelo_usado text,                    -- slug real que respondeu (≠ se fallback)
  tools_usadas text[],
  resposta_trecho text,
  detalhe text,                         -- por que falhou/deu erro
  executado_em timestamptz,
  unique (run_id, caso_id, modelo, repeticao)
);

comment on table public.ia_eval_itens is
  'Uma célula do run (caso×modelo×repetição): pendente → rodando → ok/'
  'falhou/erro. Métricas copiadas do evento resposta via request_id.';

alter table public.ia_eval_runs enable row level security;
alter table public.ia_eval_itens enable row level security;

create policy ia_eval_runs_coord on public.ia_eval_runs
  for all to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

create policy ia_eval_itens_coord on public.ia_eval_itens
  for all to authenticated
  using (public.my_role() = 'coordenacao')
  with check (public.my_role() = 'coordenacao');

create index ia_eval_itens_run_idx
  on public.ia_eval_itens (run_id, status, id);
create index ia_eval_runs_criado_idx
  on public.ia_eval_runs (created_at desc);

-- Claim atômico do próximo item pendente do run (pra a UI executar um por
-- request). FOR UPDATE SKIP LOCKED: duas abas não pegam o mesmo item.
create or replace function public.ia_eval_pegar_item(p_run uuid)
returns public.ia_eval_itens
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.ia_eval_itens;
begin
  if public.my_role() <> 'coordenacao' then
    raise exception 'sem permissão';
  end if;
  update public.ia_eval_itens i
     set status = 'rodando'
   where i.id = (
     select id from public.ia_eval_itens
      where run_id = p_run and status = 'pendente'
      order by id
      limit 1
      for update skip locked
   )
   returning * into v_item;
  if v_item.id is not null then
    update public.ia_eval_runs set status = 'rodando' where id = p_run;
  end if;
  return v_item;
end;
$$;

revoke all on function public.ia_eval_pegar_item(uuid) from public, anon;
grant execute on function public.ia_eval_pegar_item(uuid) to authenticated;

commit;
