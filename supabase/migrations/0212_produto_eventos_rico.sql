-- 0212 — telemetria rica fase 2 (REALIZA-453/454, spec 008 US2/US3).
-- Dois gestos novos na whitelist: 'permanencia' (duração da estadia,
-- emitida na saída da superfície) e 'rolagem' (maior marco de
-- profundidade alcançado: 0/25/50/75/100 — nunca por evento de scroll).
-- Sem mudança de tabela nem de grant: meta jsonb já carrega as chaves
-- novas (dur_ms, prof) — a whitelist da RPC é a borda.
-- Corpo copiado verbatim da 0203 (comentário do meta.ts incluído, segue
-- valendo) com três deltas:
--   1. 'permanencia' + 'rolagem' na lista;
--   2. teto de bytes do meta (1KB) — sem ele um payload adulterado vira
--      linha gigante no cru; fora da régua o gesto é pulado, não
--      truncado (truncar produziria jsonb quebrado);
--   3. lote 20 → 30: três gestos automáticos por superfície (pageview +
--      permanencia + rolagem) + cliques enchem a fila mais rápido na
--      saída — o alinhamento com o beacon evita descarte na rajada.

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
      'nudge', 'form_emitido', 'material_aberto', 'lembrete_whatsapp',
      'permanencia', 'rolagem'
    )
      and e.acao is not null
      and e.superficie is not null and e.superficie <> ''
      and jsonb_typeof(coalesce(e.meta, '{}'::jsonb)) = 'object'
      and octet_length(coalesce(e.meta, '{}'::jsonb)::text) <= 1024
    limit 30;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- mesma moldura de permissões da 0197/0198/0203: sem acesso pra anon;
-- authenticated executa (o grant já existia — reafirmado pra migration
-- ficar auto-contida; grant é idempotente).
revoke all on function public.registrar_produto_eventos(jsonb)
  from public, anon;
grant execute on function public.registrar_produto_eventos(jsonb)
  to authenticated;

commit;
