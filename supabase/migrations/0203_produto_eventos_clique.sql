-- 0203 — ação 'clique' em produto_eventos (REALIZA-433, telemetria
-- rica fase 1). O beacon passa a emitir um gesto por pointerdown real
-- (x/y/vw/vh + alvo opt-in no meta) pro heatmap de uso por superfície.
-- Sem mudança de tabela nem de grant: a whitelist da RPC é a borda —
-- corpo copiado verbatim da 0198 (inclusive o comentário do meta.ts,
-- que continua valendo) com 'clique' a mais na lista.

begin;

-- O beacon carimba `meta.ts` (epoch ms do client) porque o lote grava
-- num statement só — transaction_timestamp() empataria os 20 eventos e
-- a sessionização dos caminhos perderia a ordem real. created_at usa o
-- ts quando ele é plausível (relógio do client não é confiável: aceita
-- até 1h no passado, 5min no futuro; fora disso cai no now() do banco).
create or replace function public.registrar_produto_eventos(p_eventos jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_papel text;
  v_n int := 0;
begin
  v_profile := public.my_profile_id();
  if v_profile is null then
    return 0;
  end if;
  v_papel := public.my_role();

  insert into public.produto_eventos (profile_id, papel, superficie, acao, meta, created_at)
    select
      v_profile,
      coalesce(v_papel, 'desconhecido'),
      left(e.superficie, 64),
      e.acao,
      coalesce(e.meta, '{}'::jsonb),
      case
        when (e.meta->>'ts') ~ '^\d+$'
          and to_timestamp((e.meta->>'ts')::double precision / 1000)
              between now() - interval '1 hour' and now() + interval '5 minutes'
        then to_timestamp((e.meta->>'ts')::double precision / 1000)
        else now()
      end
    from jsonb_to_recordset(
      case when jsonb_typeof(p_eventos) = 'array' then p_eventos else '[]'::jsonb end
    ) as e(superficie text, acao text, meta jsonb)
    where e.acao in (
      'pageview', 'clique', 'busca', 'sort', 'dialog',
      'nudge', 'form_emitido', 'material_aberto', 'lembrete_whatsapp'
    )
      and e.acao is not null
      and e.superficie is not null and e.superficie <> ''
      and jsonb_typeof(coalesce(e.meta, '{}'::jsonb)) = 'object'
    limit 20;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- mesma moldura de permissões da 0197/0198: sem acesso pra anon;
-- authenticated executa (o grant já existia — reafirmado pra migration
-- ficar auto-contida; grant é idempotente).
revoke all on function public.registrar_produto_eventos(jsonb)
  from public, anon;
grant execute on function public.registrar_produto_eventos(jsonb)
  to authenticated;

commit;
