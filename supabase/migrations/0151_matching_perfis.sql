-- 0151 matching_perfis — perfil vetorial por pessoa pro pareamento
-- semântico (REALIZA-338). Uma linha por (dono_tipo, dono_id):
--   doc        = o texto exato que gerou o embedding (auditável — a
--                coordenação enxerga o que o vetor "viu")
--   doc_hash   = sha256 do doc — o recompute pula quando nada mudou
--   temas      = tags de vocabulário fechado extraídas por LLM (a camada
--                explicável — viram "temas em comum" no card de afinidade)
--   embedding  = vetor 512d (mesma dimensão do RAG, 0150 — Matryoshka do
--                text-embedding-3-small). NULL quando a API falha: temas
--                seguem salvos e o ranqueamento degrada sem ele.
-- Sem índice em embedding: seq scan exato em ~centenas de linhas, mesma
-- regra documentada na 0150 (HNSW só faria sentido acima de ~20k).
--
-- Escrita: só service role (nenhuma policy de escrita) — o recompute roda
-- server-side via after() nas actions de cadastro/edição/onboarding.
-- Leitura: só coordenação — doc e ranking expõem motivação/objetivos por
-- transitividade; não é dado pra mentor ler.
--
-- matching_ranquear é security invoker de propósito: quem não tem SELECT
-- na tabela recebe [] em vez de erro — o modo Parear simplesmente fica
-- na ordem atual (degradação, não bloqueio). similaridade = 1 − cosseno.

begin;

create table if not exists public.matching_perfis (
  dono_tipo text not null check (dono_tipo in ('mentor', 'mentorado')),
  dono_id uuid not null,
  doc text not null default '',
  doc_hash text not null,
  temas text[] not null default '{}',
  embedding extensions.vector(512),
  gerado_em timestamptz not null default now(),
  primary key (dono_tipo, dono_id)
);

alter table public.matching_perfis enable row level security;

create policy matching_perfis_select
  on public.matching_perfis for select to authenticated
  using (public.my_role() = 'coordenacao');

create or replace function public.matching_ranquear(
  p_tipo text,
  p_id uuid,
  p_outro_tipo text
)
returns table (dono_id uuid, similaridade real)
language sql stable security invoker set search_path = ''
as $$
  -- a linha base sai do join: sem embedding próprio, resultado vazio —
  -- o chamador degrada pra ordem atual sem precisar distinguir "sem vetor"
  -- de "sem permissão" (os dois viram o mesmo conjunto vazio)
  select mp.dono_id, (1 - (mp.embedding operator(extensions.<=>) b.embedding))::real
  from public.matching_perfis mp
  join public.matching_perfis b
    on b.dono_tipo = p_tipo
   and b.dono_id = p_id
  where mp.dono_tipo = p_outro_tipo
    and mp.embedding is not null
    and b.embedding is not null
  order by mp.embedding operator(extensions.<=>) b.embedding;
$$;

comment on function public.matching_ranquear(text, uuid, text) is
  'Ranqueamento semântico do pool oposto pro modo Parear (REALIZA-338):
   similaridade cosseno sobre matching_perfis. Invoker — RLS limita a
   coordenação; outros papéis recebem []. Sem vetor da pessoa-base: [].';

revoke all on function public.matching_ranquear(text, uuid, text)
  from public, anon;
grant execute on function public.matching_ranquear(text, uuid, text)
  to authenticated;

commit;
