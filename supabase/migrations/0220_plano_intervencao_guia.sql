begin;

-- chamados: proveniência 'liza'
alter table public.chamados drop constraint chamados_origem_check;
alter table public.chamados add constraint chamados_origem_check
  check (origem = any (array['manual','registro','avaliacao_jovem','liza']));

create table public.dupla_intervencoes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  plano_id uuid references public.dupla_planos (id) on delete set null,
  tipo text not null check (tipo in
    ('troca_mentor','troca_mentorado','pausa','dpp_para_esp','encerramento')),
  evidencias jsonb not null default '[]'::jsonb,
  destino text not null check (destino in ('auxiliar','coordenacao')),
  status text not null default 'sugerida'
    check (status in ('sugerida','encaminhada','descartada')),
  saida text check (saida in ('chamado','mensagem')),
  chamado_id uuid references public.chamados (id) on delete set null,
  motivo text,
  sugerida_por uuid references public.profiles (id),
  sugerida_via text not null default 'app' check (sugerida_via in ('app','liza')),
  created_at timestamptz not null default now(),
  destinada_em timestamptz
);
create index dupla_intervencoes_dupla on public.dupla_intervencoes (dupla_id, created_at desc);

create table public.encontro_guia_ajustes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null check (numero between 1 and 24),
  ajustes jsonb not null default '[]'::jsonb,
  criado_por uuid references public.profiles (id),
  via text not null default 'app' check (via in ('app','liza')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dupla_id, numero)
);

alter table public.dupla_intervencoes enable row level security;
alter table public.encontro_guia_ajustes enable row level security;

grant select on public.dupla_intervencoes to authenticated;
grant select on public.encontro_guia_ajustes to authenticated;

create policy dupla_intervencoes_select on public.dupla_intervencoes
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = dupla_intervencoes.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))));
create policy encontro_guia_ajustes_select on public.encontro_guia_ajustes
  for select using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
       where d.id = encontro_guia_ajustes.dupla_id
         and (d.mentor_id = public.my_profile_id()
              or public.supervisiona_dupla(d.id))));

-- ============ intervencao_sugerir — a Liza propõe, nunca executa ============
create or replace function public.intervencao_sugerir(
  p_dupla uuid,
  p_tipo text,
  p_evidencias jsonb,
  p_destino text,
  p_plano uuid default null,
  p_motivo text default null,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d record;
  v_id uuid;
begin
  select d.id, d.status, d.mentor_id, d.supervisor_id
    into v_d from public.duplas d where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or v_d.mentor_id = public.my_profile_id()
    or public.supervisiona_dupla(p_dupla)
  ) then
    return jsonb_build_object('error', 'sem permissão nesta dupla');
  end if;
  if v_d.status not in ('ativa','pausada') then
    return jsonb_build_object('error', 'a dupla não está mais viva');
  end if;
  if p_tipo not in ('troca_mentor','troca_mentorado','pausa','dpp_para_esp','encerramento') then
    return jsonb_build_object('error', 'tipo de intervenção inválido');
  end if;
  if p_destino not in ('auxiliar','coordenacao') then
    return jsonb_build_object('error', 'destino inválido');
  end if;
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;
  if p_plano is not null and not exists (
    select 1 from public.dupla_planos pl
     where pl.id = p_plano and pl.dupla_id = p_dupla) then
    return jsonb_build_object('error', 'plano não é desta dupla');
  end if;

  insert into public.dupla_intervencoes
    (dupla_id, plano_id, tipo, evidencias, destino, motivo,
     sugerida_por, sugerida_via)
  values (p_dupla, p_plano, p_tipo, coalesce(p_evidencias, '[]'::jsonb),
          p_destino, nullif(btrim(p_motivo), ''),
          public.my_profile_id(), p_via)
  returning id into v_id;

  -- aviso pro destino da intervenção (auxiliar da turma = supervisor da
  -- dupla; coordenação = equipe inteira)
  insert into public.notificacoes (profile_id, tipo, titulo, corpo, href, created_by)
    select p.id, 'plano_intervencao',
           'Intervenção sugerida pela Liza',
           'A Liza sugeriu uma intervenção pra uma dupla — veja o contexto na ficha.',
           '/duplas/' || p_dupla, public.my_profile_id()
      from profiles p
     where p.ativo and p.id is distinct from public.my_profile_id()
       and (p_destino = 'coordenacao' and has_papel(p.id, 'coordenacao')
            or (p_destino = 'auxiliar' and p.id = v_d.supervisor_id));

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function public.intervencao_sugerir(uuid, text, jsonb, text, uuid, text, text) from public, anon;
grant execute on function public.intervencao_sugerir(uuid, text, jsonb, text, uuid, text, text) to authenticated;

-- ============ intervencao_abrir_chamado — saída "chamado" ============
-- Abre o chamado com origem 'liza' carregando o contexto da intervenção
-- na mensagem e marca a intervenção como encaminhada, numa transação só.
create or replace function public.intervencao_abrir_chamado(
  p_intervencao uuid,
  p_categoria text,
  p_assunto text,
  p_mensagem text,
  p_descricao_outro text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_i record;
  v_id uuid;
  v_numero text;
begin
  select * into v_i from public.dupla_intervencoes i
   where i.id = p_intervencao for update;
  if not found then
    return jsonb_build_object('error', 'intervenção não encontrada');
  end if;
  if v_i.status <> 'sugerida' then
    return jsonb_build_object('error', 'essa intervenção já foi encaminhada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.duplas d
        where d.id = v_i.dupla_id and d.mentor_id = public.my_profile_id())
    or public.supervisiona_dupla(v_i.dupla_id)
  ) then
    return jsonb_build_object('error', 'sem permissão nesta dupla');
  end if;
  if p_categoria is null or p_categoria not in
     ('agenda','metodologia','plataforma','urgencia','outro') then
    return jsonb_build_object('error', 'categoria inválida');
  end if;
  if p_categoria = 'outro' and
     (p_descricao_outro is null or char_length(btrim(p_descricao_outro)) < 2) then
    return jsonb_build_object('error', 'descreva em poucas palavras o assunto do chamado');
  end if;
  if p_assunto is null or char_length(p_assunto) < 2
     or char_length(p_assunto) > 200 then
    return jsonb_build_object('error', 'assunto precisa ter entre 2 e 200 caracteres');
  end if;
  if p_mensagem is not null and char_length(p_mensagem) > 5000 then
    return jsonb_build_object('error', 'mensagem passa de 5000 caracteres');
  end if;

  insert into public.chamados
    (autor_id, dupla_id, categoria, descricao_outro, assunto, mensagem, origem)
  values (public.my_profile_id(), v_i.dupla_id, p_categoria,
          nullif(btrim(p_descricao_outro), ''), btrim(p_assunto),
          nullif(p_mensagem, ''), 'liza')
  returning id, numero into v_id, v_numero;

  perform chamado_evento(v_id,
    'Chamado aberto a partir de sugestão da Liza por ' ||
    coalesce((select nome from profiles where id = public.my_profile_id()), 'autor') || '.');
  perform chamado_notifica_equipe(v_id, 'chamado_aberto',
    'Chamado ' || v_numero || ' aberto',
    'Categoria ' || p_categoria || ': ' || btrim(p_assunto));

  update public.dupla_intervencoes
     set status = 'encaminhada', saida = 'chamado', chamado_id = v_id,
         destinada_em = now()
   where id = p_intervencao;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero);
end $$;

revoke all on function public.intervencao_abrir_chamado(uuid, text, text, text, text) from public, anon;
grant execute on function public.intervencao_abrir_chamado(uuid, text, text, text, text) to authenticated;

-- ============ intervencao_fechar — saída "mensagem" ou descarte ============
create or replace function public.intervencao_fechar(
  p_intervencao uuid,
  p_saida text,
  p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_i record;
begin
  select * into v_i from public.dupla_intervencoes i
   where i.id = p_intervencao for update;
  if not found then
    return jsonb_build_object('error', 'intervenção não encontrada');
  end if;
  if v_i.status <> 'sugerida' then
    return jsonb_build_object('error', 'essa intervenção já foi encaminhada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.duplas d
        where d.id = v_i.dupla_id and d.mentor_id = public.my_profile_id())
    or public.supervisiona_dupla(v_i.dupla_id)
  ) then
    return jsonb_build_object('error', 'sem permissão nesta dupla');
  end if;
  if p_saida = 'mensagem' then
    update public.dupla_intervencoes
       set status = 'encaminhada', saida = 'mensagem', destinada_em = now()
     where id = p_intervencao;
  elsif p_saida = 'descartada' then
    update public.dupla_intervencoes
       set status = 'descartada', motivo = coalesce(nullif(btrim(p_motivo), ''), motivo),
           destinada_em = now()
     where id = p_intervencao;
  else
    return jsonb_build_object('error', 'saída inválida');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.intervencao_fechar(uuid, text, text) from public, anon;
grant execute on function public.intervencao_fechar(uuid, text, text) to authenticated;

-- ============ guia_ajuste_salvar / _limpar — guia personalizado ============
create or replace function public.guia_ajuste_salvar(
  p_dupla uuid,
  p_numero integer,
  p_ajustes jsonb,
  p_via text default 'app'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d record;
begin
  select d.id, d.mentor_id into v_d from public.duplas d where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or (public.my_role() = 'mentor_dpp' and v_d.mentor_id = public.my_profile_id())
  ) then
    return jsonb_build_object('error', 'sem permissão pra ajustar o guia desta dupla');
  end if;
  if p_numero is null or p_numero < 1 or p_numero > 24 then
    return jsonb_build_object('error', 'encontro inválido');
  end if;
  if p_via not in ('app','liza') then
    return jsonb_build_object('error', 'origem inválida');
  end if;
  if p_ajustes is null or jsonb_typeof(p_ajustes) <> 'array'
     or jsonb_array_length(p_ajustes) = 0 then
    return jsonb_build_object('error', 'envie ao menos um ajuste');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_ajustes) a
     where a->>'sugestao' is null or char_length(btrim(a->>'sugestao')) = 0
        or a->>'justificativa' is null or char_length(btrim(a->>'justificativa')) = 0
  ) then
    return jsonb_build_object('error', 'cada ajuste precisa de sugestão e justificativa');
  end if;

  insert into public.encontro_guia_ajustes
    (dupla_id, numero, ajustes, criado_por, via, updated_at)
  values (p_dupla, p_numero, p_ajustes, public.my_profile_id(), p_via, now())
  on conflict (dupla_id, numero)
  do update set ajustes = excluded.ajustes,
                criado_por = excluded.criado_por,
                via = excluded.via,
                updated_at = now();

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.guia_ajuste_salvar(uuid, integer, jsonb, text) from public, anon;
grant execute on function public.guia_ajuste_salvar(uuid, integer, jsonb, text) to authenticated;

create or replace function public.guia_ajuste_limpar(
  p_dupla uuid,
  p_numero integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d record;
begin
  select d.id, d.mentor_id into v_d from public.duplas d where d.id = p_dupla;
  if not found then
    return jsonb_build_object('error', 'dupla não encontrada');
  end if;
  if not (
    public.my_role() = 'coordenacao'
    or (public.my_role() = 'mentor_dpp' and v_d.mentor_id = public.my_profile_id())
  ) then
    return jsonb_build_object('error', 'sem permissão nesta dupla');
  end if;
  delete from public.encontro_guia_ajustes
   where dupla_id = p_dupla and numero = p_numero;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.guia_ajuste_limpar(uuid, integer) from public, anon;
grant execute on function public.guia_ajuste_limpar(uuid, integer) to authenticated;

commit;
