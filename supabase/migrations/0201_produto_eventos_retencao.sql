-- 0201 — retenção de produto_eventos (REALIZA-417 fase B). Duas peças:
--
-- produto_eventos_dia — rollup diário por dia civil de São Paulo
-- (papel × superfície × ação → eventos + pessoas únicas). O cru tem 90d
-- de vida; o rollup é o que sobra pra série histórica longa — os painéis
-- fixos só consultam janela ≤90d, então nenhuma leitura muda.
--
-- produto_eventos_reter(p_dias) — o job diário (tick) chama: primeiro
-- fecha o rollup de TODOS os dias civis completos presentes no cru
-- (upsert, idempotente e auto-curativo — um dia pulado se recompõe na
-- próxima rodada), depois apaga o cru mais velho que a janela. A ordem
-- importa: o rollup de um dia só existe porque o cru ainda estava lá.
--
-- Grants no padrão da 0197: nada pra app — quem escreve é a RPC definer;
-- o rollup é agregado e coord-only (mesma policy da tabela-mãe).

begin;

create table if not exists public.produto_eventos_dia (
  dia date not null,
  papel text not null,
  superficie text not null,
  acao text not null,
  eventos integer not null,
  pessoas integer not null,
  primary key (dia, papel, superficie, acao)
);

alter table public.produto_eventos_dia enable row level security;

revoke all on public.produto_eventos_dia from public, anon, authenticated;
grant select on public.produto_eventos_dia to authenticated;

drop policy if exists produto_eventos_dia_select
  on public.produto_eventos_dia;
create policy produto_eventos_dia_select on public.produto_eventos_dia
  for select using (public.my_role() = 'coordenacao');

create or replace function public.produto_eventos_reter(p_dias integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_rolled integer;
  v_removidos integer;
begin
  if p_dias is null or p_dias < 1 then
    raise exception 'p_dias inválido';
  end if;

  -- rollup dos dias civis completos (America/Sao_Paulo, mesmo fuso dos
  -- buckets dos painéis): hoje ainda está aberto, fica pro próximo tick
  insert into public.produto_eventos_dia
    (dia, papel, superficie, acao, eventos, pessoas)
  select
    (e.created_at at time zone 'America/Sao_Paulo')::date,
    e.papel,
    e.superficie,
    e.acao,
    count(*)::integer,
    count(distinct e.profile_id)::integer
  from public.produto_eventos e
  where (e.created_at at time zone 'America/Sao_Paulo')::date
        < (now() at time zone 'America/Sao_Paulo')::date
  group by 1, 2, 3, 4
  on conflict (dia, papel, superficie, acao) do update
    set eventos = excluded.eventos,
        pessoas = excluded.pessoas;
  get diagnostics v_rolled = row_count;

  -- o cru envelheceu: apaga tudo além da janela. O rollup do período já
  -- está garantido pelo upsert acima, então a série longa não perde nada
  delete from public.produto_eventos
   where created_at
         < (now() - make_interval(days => p_dias));
  get diagnostics v_removidos = row_count;

  return jsonb_build_object(
    'linhas_rollup', v_rolled,
    'removidos', v_removidos
  );
end;
$$;

-- job-only: chamado pelo tick via service_role, nunca pela sessão do app
revoke all on function public.produto_eventos_reter(integer)
  from public, anon, authenticated;
grant execute on function public.produto_eventos_reter(integer)
  to service_role;

commit;
