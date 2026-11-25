-- 0163 ia_confirmacoes — protocolo de confirmação das tools de escrita do
-- registry de IA (plano ia-chatbot-mcp §3). Toda tool `escreve` roda em duas
-- chamadas: a primeira NÃO muta nada — grava uma linha aqui e devolve
-- {pendente_confirmacao: {confirmacao_id, resumo, args}}; a segunda repete os
-- mesmos argumentos + confirmacao_id, e a RPC de consumo executa UM update
-- atômico (consumido_em) — token expirado, de outra pessoa, de outra tool,
-- com args divergentes ou já consumido falha fechado. O par criar/consumir
-- roda sob o JWT do próprio usuário (chat = sessão, MCP = impersonação):
-- my_profile_id() é o dono nas duas pontas, então a linha também é a
-- auditoria "quem pediu prévia do quê e confirmou quando".
--
-- Sem policies: a tabela não é lida nem escrita direto — só pelas duas RPCs
-- definer. Args ficam em jsonb canônico (hash sha256 casa a repetição byte a
-- byte); o resumo é o texto que o client mostrou na aprovação.

begin;

create table public.ia_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  tool text not null,
  args jsonb not null,
  args_hash text not null,
  resumo text not null check (char_length(btrim(resumo)) between 1 and 2000),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
    default now() + interval '10 minutes',
  consumido_em timestamptz
);

comment on table public.ia_confirmacoes is
  'Prévia pendente de tool de escrita (Liza/MCP): a 1ª chamada grava e não '
  'executa; a 2ª consome atomicamente com o mesmo tool+args_hash do dono.';

alter table public.ia_confirmacoes enable row level security;
-- nenhuma policy: acesso só via as RPCs definer abaixo

create index ia_confirmacoes_dono_idx
  on public.ia_confirmacoes (profile_id, criado_em desc);

-- cria a prévia. Devolve o id que o client repassa na confirmação.
create or replace function public.ia_confirmacao_criar(
  p_tool text, p_args jsonb, p_resumo text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_dono uuid := public.my_profile_id();
begin
  if v_dono is null then
    raise exception 'sem sessão ativa';
  end if;

  -- limpeza oportunista do próprio dono: expiradas não-confirmadas não
  -- precisam viver pra sempre — manter só a janela de auditoria recente
  delete from public.ia_confirmacoes
   where profile_id = v_dono
     and expira_em < now() - interval '1 day';

  insert into public.ia_confirmacoes
    (profile_id, tool, args, args_hash, resumo)
  values (
    v_dono,
    p_tool,
    coalesce(p_args, '{}'::jsonb),
    encode(extensions.digest(coalesce(p_args, '{}'::jsonb)::text, 'sha256'), 'hex'),
    p_resumo
  )
  returning id into v_id;

  return v_id;
end $$;

comment on function public.ia_confirmacao_criar(text, jsonb, text) is
  'Grava a prévia de uma tool de escrita (dono = JWT) e devolve o '
  'confirmacao_id — expira em 10min, consumo via ia_confirmacao_consumir.';

-- consome a prévia na 2ª chamada: update atômico prova identidade (dono),
-- integridade (mesma tool + mesmo hash de args) e uso único numa viagem só.
-- Devolve o resumo guardado; sem linha = inválida/expirada/usada/divergente.
create or replace function public.ia_confirmacao_consumir(
  p_id uuid, p_tool text, p_args jsonb
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_resumo text;
begin
  update public.ia_confirmacoes c
     set consumido_em = now()
   where c.id = p_id
     and c.profile_id = public.my_profile_id()
     and c.tool = p_tool
     and c.args_hash = encode(
           extensions.digest(coalesce(p_args, '{}'::jsonb)::text, 'sha256'),
           'hex')
     and c.consumido_em is null
     and c.expira_em > now()
  returning c.resumo into v_resumo;

  return v_resumo;
end $$;

comment on function public.ia_confirmacao_consumir(uuid, text, jsonb) is
  'Consome a prévia de escrita: uso único, só o dono, mesma tool e mesmo '
  'hash de args — null = confirmacao_id inválido, expirado ou já usado.';

revoke all on function public.ia_confirmacao_criar(text, jsonb, text)
  from public, anon;
grant execute on function public.ia_confirmacao_criar(text, jsonb, text)
  to authenticated;
revoke all on function public.ia_confirmacao_consumir(uuid, text, jsonb)
  from public, anon;
grant execute on function public.ia_confirmacao_consumir(uuid, text, jsonb)
  to authenticated;

-- ============ solicitacoes_mural: nomes sociais + especialista desejado ==
-- A view (0125) expunha só o civil de mentorado/especialista e nenhum nome
-- pro especialista_desejado_id (pedido 'sugerida' lia "esperando
-- especialista" sem dizer quem). Mesma projeção na MESMA ordem de colunas
-- (or replace só permite coluna nova no fim) + as 3 colunas novas — o
-- predicado de escopo não muda.
create or replace view public.solicitacoes_mural as
select
  s.id,
  s.mentorado_id,
  s.dupla_dpp_id,
  s.demanda,
  s.motivo,
  s.especialista_desejado_id,
  s.especialista_id,
  s.dupla_id,
  s.status,
  case
    when s.status in ('aberta','contra_proposta')
         and s.slot_proposto is not null
         and s.slot_proposto <= now() then 'expirada'
    else s.status
  end as status_efetivo,
  s.slot_proposto,
  s.origem,
  s.turma,
  s.justificativa_recusa,
  s.created_by,
  s.created_at,
  s.respondida_em,
  m.nome as mentorado_nome,
  p.nome as especialista_nome,
  ed.devolutiva_pdm,
  ed.encerrada_em as trilha_encerrada_em,
  -- colunas novas (fim): nome de exibição + quem o jovem desejou
  m.nome_social as mentorado_nome_social,
  p.nome_social as especialista_nome_social,
  coalesce(eds.nome_social, eds.nome) as especialista_desejado_nome
from public.solicitacoes_especialista s
join public.mentorados m on m.id = s.mentorado_id
left join public.profiles p on p.id = s.especialista_id
left join public.profiles eds on eds.id = s.especialista_desejado_id
left join public.duplas ed on ed.id = s.dupla_id
where
  public.my_role() = 'coordenacao'
  or exists (
    select 1 from public.duplas d
    where d.id = s.dupla_dpp_id
      and (d.mentor_id = public.my_profile_id()
        or public.supervisiona_dupla(d.id)))
  or (s.status in ('aberta','contra_proposta')
      and public.has_papel('mentor_especialista'::public.app_role)
      and (s.especialista_desejado_id is null
           or s.especialista_desejado_id = public.my_profile_id()))
  or s.especialista_id = public.my_profile_id()
  or s.created_by = public.my_profile_id()
  or (public.my_role() = 'mentorado'
      and s.mentorado_id = public.my_mentorado_id());

commit;
