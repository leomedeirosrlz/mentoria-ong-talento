-- 0197 — produto_eventos (REALIZA-417): analytics de adoção in-house.
-- Uma row por gesto de produto (pageview de superfície, busca, sort,
-- nudge, emissão de instrumento…). Pergunta que responde: quais telas
-- cada papel usa de verdade → feature sem uso vira melhorar/matar/ensinar.
--
-- Mesma arquitetura de ia_eventos (0083): escrita SÓ via RPC definer —
-- profile_id e papel saem do JWT do caller (my_profile_id/my_role),
-- ninguém planta evento em nome de outro nem falsifica papel; payload
-- sem PII (superfície + ação + meta com ids apenas).
--
-- `acao` é whitelist na RPC — evento livre demais vira lixo analítico;
-- um ponto de coleta novo é uma migration de uma linha (lista abaixo).

begin;

create table if not exists public.produto_eventos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  papel text not null,
  superficie text not null,
  acao text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists produto_eventos_profile_idx
  on public.produto_eventos (profile_id, created_at desc);
create index if not exists produto_eventos_created_idx
  on public.produto_eventos (created_at desc);
create index if not exists produto_eventos_sup_idx
  on public.produto_eventos (superficie, acao, created_at desc);

alter table public.produto_eventos enable row level security;

-- mesmo recorte do ia_eventos: o auto-grant sai, volta só select (a
-- escrita é exclusiva da RPC); cada um lê os próprios eventos e a
-- coordenação lê tudo — a aba Adoção sai daqui sem grant novo.
revoke all on public.produto_eventos from public, anon, authenticated;
grant select on public.produto_eventos to authenticated;

drop policy if exists produto_eventos_select on public.produto_eventos;
create policy produto_eventos_select on public.produto_eventos for select
  using (
    profile_id = public.my_profile_id()
    or public.my_role() = 'coordenacao'
  );

-- Único caminho de escrita: lote de eventos vindos do beacon (sendBeacon
-- agrupa ~10 por chamada) ou emitidos server-side por actions. Roda como
-- dono (acima da RLS), mas profile/papel vêm do JWT do CALLER.
-- Validações baratas que salvam o dataset: lote ≤ 20, acao na whitelist,
-- strings curtas — o beacon roda solto no browser, a borda é aqui.
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

  insert into public.produto_eventos (profile_id, papel, superficie, acao, meta)
    select
      v_profile,
      coalesce(v_papel, 'desconhecido'),
      left(e.superficie, 64),
      e.acao,
      coalesce(e.meta, '{}'::jsonb)
    from jsonb_to_recordset(
      case when jsonb_typeof(p_eventos) = 'array' then p_eventos else '[]'::jsonb end
    ) as e(superficie text, acao text, meta jsonb)
    where e.acao in (
      'pageview', 'busca', 'sort', 'dialog',
      'nudge', 'form_emitido', 'material_aberto', 'lembrete_whatsapp'
    )
      and e.acao is not null
      and e.superficie is not null and e.superficie <> ''
      and jsonb_typeof(coalesce(e.meta, '{}'::jsonb)) = 'object'
    limit 20;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.registrar_produto_eventos(jsonb)
  from public, anon;
grant execute on function public.registrar_produto_eventos(jsonb)
  to authenticated;

commit;
