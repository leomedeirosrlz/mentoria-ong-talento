-- 0231 — roteiros semanais do plano (REALIZA-521)
-- Um roteiro por (plano, numero, versao); o vigente publicado é único.
-- Leitura pelos quatro papéis com acesso à dupla; escrita só por RPCs
-- definer (qualquer um dos quatro pode revisar/editar/publicar).
begin;

create table public.dupla_plano_roteiros (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  plano_id uuid not null references public.dupla_planos (id) on delete cascade,
  numero smallint not null check (numero between 1 and 24),
  versao int not null default 1,
  plano_versao int not null,
  conteudo jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho','publicado','substituido')),
  gerado_por uuid references public.profiles (id),
  gerado_via text not null default 'app' check (gerado_via in ('app','liza','job')),
  gerado_em timestamptz not null default now(),
  editado_por uuid references public.profiles (id),
  publicado_por uuid references public.profiles (id),
  publicado_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (plano_id, numero, versao)
);

create index dupla_plano_roteiros_dupla on public.dupla_plano_roteiros (dupla_id, numero);

create unique index dupla_plano_roteiros_vigente
  on public.dupla_plano_roteiros (plano_id, numero)
  where status = 'publicado';

alter table public.dupla_plano_roteiros enable row level security;
grant select on public.dupla_plano_roteiros to authenticated;

create policy dupla_plano_roteiros_select on public.dupla_plano_roteiros
  for select using (
    public.has_papel('coordenacao'::public.app_role)
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_plano_roteiros.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))
    )
    or (public.my_role() = 'mentorado'
        and exists (select 1 from public.jovem_duplas jd
                    where jd.id = dupla_plano_roteiros.dupla_id))
  );

-- helper: o caller tem acesso à dupla do plano?
create or replace function public.pode_roteiro_plano(p_plano uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dupla_planos p
      join public.duplas d on d.id = p.dupla_id
     where p.id = p_plano
       and (d.mentor_id = public.my_profile_id()
            or public.supervisiona_dupla(d.id)
            or public.has_papel('coordenacao'::public.app_role)
            or (public.my_role() = 'mentorado' and d.mentorado_id = public.my_mentorado_id()))
  );
$$;
create or replace function public.roteiro_salvar(
  p_plano uuid,
  p_numero smallint,
  p_conteudo jsonb,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p record;
  v_id uuid;
begin
  if p_via not in ('app','liza','job') then
    return jsonb_build_object('error', 'origem inválida');
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'array' then
    return jsonb_build_object('error', 'conteúdo inválido');
  end if;
  select p.id, p.dupla_id, p.status, p.versao
    into v_p from public.dupla_planos p where p.id = p_plano;
  if not found then return jsonb_build_object('error', 'plano não encontrado'); end if;
  if not public.pode_roteiro_plano(p_plano) then
    return jsonb_build_object('error', 'sem acesso ao plano');
  end if;
  if v_p.status not in ('aceito','ativo') then
    return jsonb_build_object('error', 'o plano precisa estar aceito');
  end if;
  if p_numero is null or not exists (
    select 1 from jsonb_array_elements_text(v_p.escopo->'numeros') n where n::int = p_numero
  ) then return jsonb_build_object('error', 'encontro fora do plano'); end if;

  insert into public.dupla_plano_roteiros
    (dupla_id, plano_id, numero, versao, plano_versao, conteudo, status,
     gerado_por, gerado_via, editado_por)
  values (v_p.dupla_id, p_plano, p_numero, 1, v_p.versao, p_conteudo, 'rascunho',
          public.my_profile_id(), p_via, public.my_profile_id())
  on conflict (plano_id, numero, versao) do update
    set conteudo = excluded.conteudo,
        editado_por = public.my_profile_id(),
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.roteiro_publicar(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_r record;
begin
  select * into v_r from public.dupla_plano_roteiros r where r.id = p_id for update;
  if not found then return jsonb_build_object('error', 'roteiro não encontrado'); end if;
  if not public.pode_roteiro_plano(v_r.plano_id) then
    return jsonb_build_object('error', 'sem acesso ao plano');
  end if;
  update public.dupla_plano_roteiros
     set status = 'substituido'
   where plano_id = v_r.plano_id and numero = v_r.numero
     and status = 'publicado' and id <> p_id;
  update public.dupla_plano_roteiros
     set status = 'publicado', publicado_por = public.my_profile_id(),
         publicado_em = now(), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pode_roteiro_plano(uuid) from public, anon;
grant execute on function public.pode_roteiro_plano(uuid) to authenticated;
revoke all on function public.roteiro_salvar(uuid, smallint, jsonb, text) from public, anon;
grant execute on function public.roteiro_salvar(uuid, smallint, jsonb, text) to authenticated;
revoke all on function public.roteiro_publicar(uuid) from public, anon;
grant execute on function public.roteiro_publicar(uuid) to authenticated;

commit;
