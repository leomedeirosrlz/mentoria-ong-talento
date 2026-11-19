begin;

create table public.dupla_resumo_ia (
  dupla_id uuid primary key references public.duplas (id) on delete cascade,
  resumo jsonb not null,
  fontes_hash text not null,
  gerado_em timestamptz not null default now()
);

alter table public.dupla_resumo_ia enable row level security;
-- sem policy: nenhum select direto — a leitura passa pela RPC resumo_dupla
-- que aplica o recorte por papel; a escrita por gravar_resumo_duplas
-- (service_role, molde gravar_saude_snapshots).

create or replace function public.resumo_dupla(p_dupla uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d record;
  v_r record;
  v_lado text;
  v_resumo jsonb;
begin
  select d.id, d.mentor_id, d.mentorado_id into v_d
    from public.duplas d where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;

  v_lado := case
    when public.my_role() = 'coordenacao' or public.supervisiona_dupla(p_dupla)
      then 'staff'
    when v_d.mentor_id = public.my_profile_id() then 'mentor'
    when v_d.mentorado_id = public.my_mentorado_id() then 'mentorado'
  end;
  if v_lado is null then
    return jsonb_build_object('error', 'sem permissão nesta dupla');
  end if;

  select r.resumo, r.gerado_em into v_r
    from public.dupla_resumo_ia r where r.dupla_id = p_dupla;
  if not found then
    return jsonb_build_object('ok', true, 'resumo', null);
  end if;

  v_resumo := v_r.resumo;
  if v_lado = 'mentorado' then
    -- recorte do jovem: sem semáforo, sem motivos internos, sem sinais
    v_resumo := v_resumo - 'semaforo' - 'motivos' - 'sinais' - 'interno';
  end if;

  return jsonb_build_object('ok', true, 'resumo', v_resumo,
                            'gerado_em', v_r.gerado_em);
end $$;

revoke all on function public.resumo_dupla(uuid) from public, anon;
grant execute on function public.resumo_dupla(uuid) to authenticated;

create or replace function public.gravar_resumo_duplas(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'gravar_resumo_duplas: p_rows deve ser um array jsonb';
  end if;

  insert into public.dupla_resumo_ia (dupla_id, resumo, fontes_hash, gerado_em)
  select r.dupla_id, r.resumo, r.fontes_hash, now()
    from jsonb_populate_recordset(null::public.dupla_resumo_ia, p_rows) r
  on conflict (dupla_id) do update set
    resumo = excluded.resumo,
    fontes_hash = excluded.fontes_hash,
    gerado_em = now();

  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.gravar_resumo_duplas(jsonb) from public, anon, authenticated;

-- ============ registrar_produto_eventos — acoes plano_* ============
-- Verbatim da versão vigente (0215) + as acoes de adoção do plano
-- (desenho item 7). O type AcaoProduto e o ROTULO_ACAO acompanham no
-- código (produto-eventos.ts, adocao.ts).
create or replace function public.registrar_produto_eventos(p_eventos jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'permanencia', 'rolagem',
      'plano_proposto', 'plano_aceito', 'plano_contestado',
      'plano_passo', 'plano_intervencao', 'plano_guia'
    )
      and e.acao is not null
      and e.superficie is not null and e.superficie <> ''
      and jsonb_typeof(coalesce(e.meta, '{}'::jsonb)) = 'object'
      and octet_length(coalesce(e.meta, '{}'::jsonb)::text) <= 1024
    limit 30;
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

commit;
