-- 0111 parametrização de turma (REALIZA-167): duas tabelas mínimas que tiram
-- o "T2" do código — `relatorio_links` vira o dono do slug público do
-- /resumo (antes uma constante T2 no código) e `turma_inscricoes` guarda quem
-- pertence a qual turma antes do matching (antes um array de ids fixo).
--
--   * relatorio_links é a versão MÍNIMA da tabela que a REALIZA-170 completa:
--     slug + turma + revogação. Senha/config/expiração chegam na 0110 por
--     `alter table add column` — todos nullable/com default, alter barato.
--     O nome nasce `relatorio_links` (e não `resumo_links` do Jira) porque a
--     spec mais completa (170) é a dona do nome canônico — decisão
--     registrada em docs/planos/issues/_done-R.md.
--   * ORDEM × a 0110: em replay limpo a 0110 ordena ANTES e já cria as duas
--     tabelas `if not exists` no shape final — aqui todo bloco replanta de
--     forma convergente: grants/policies idênticos refazem (o `grant` de
--     escrita em turma_inscricoes que a 0110 omitiu de propósito — deny-all
--     temporário — é esta migration que planta), índices entram
--     `if not exists` e o seed do slug legado é `on conflict do nothing`.
--     Em prod a 0111 foi aplicada primeiro — ver comentário "ORDEM × a
--     0111" no cabeçalho da 0110.
--   * turma_inscricoes NÃO é papel de staff (isso é profile_papeis.
--     escopo_turma, 0085) nem dupla formada (duplas.turma) — é o participante
--     ainda sem par: mentor importado aguardando vaga, jovem inscrito pela
--     ONG sem matching. O relatório deriva "Sem dupla" dela; a fila
--     "Aguardando par" do matching continua derivando de mentorados/profiles
--     (são instrumentos diferentes — a inscrição é a allowlist explícita por
--     turma, a fila do matching é a derivação livre).
--   * turma é TEXT livre como duplas.turma — é a ponte documentada pra
--     REALIZA-47 (turmas(id,...) futura faz lookup texto→id aqui e em
--     duplas/cronogramas). Não criar `turmas` agora é decisão do Jira.
--   * anon continua com zero grants (0032): a validação do slug do /resumo
--     roda pelas RPCs definer da 0110 e a fila só sai na grade — nunca
--     select direto da tabela no público.
--
-- Idempotente de propósito (`if not exists` / `on conflict do nothing` /
-- `drop policy if exists`): número de migration trava na ordem de merge e
-- as irmãs do cluster R se aplicam em qualquer ordem.

begin;

-- ---------------------------------------------------------------- relatorio_links
create table if not exists public.relatorio_links (
  id uuid primary key default gen_random_uuid(),
  -- slug público do link — fator de posse. Formato url-safe; o piso é 12c
  -- (e não 16c do desenho original) porque o slug legado da T2, já em
  -- circulação, tem 15 — o CHECK barra "t3" sem quebrar o link vivo.
  -- Novos slugs saem do default: 18 bytes ~ 108 bits (~24c base64url).
  slug text not null unique
    check (slug ~ '^[A-Za-z0-9_-]{12,128}$')
    default translate(encode(extensions.gen_random_bytes(18),'base64'),'+/=','-_')),
  -- turma dona do link nesta versão; a 170 pode torná-la nullable quando o
  -- config guardar recortes não-por-turma
  turma text not null check (char_length(turma) between 1 and 80),
  titulo text check (titulo is null or char_length(titulo) between 1 and 120),
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  revogado_em timestamptz
);
comment on table public.relatorio_links is
  'Links públicos de relatório (/resumo/<slug>). Versão mínima da 167: slug '
  'imutável + turma + revogação. Senha/config/expiração chegam na 170 por '
  'alter table. Select coord-only; escrita só service role/SQL até lá. Anon '
  'zero grants — o /resumo valida o slug via service role e devolve o mesmo '
  '404 pra inexistente e revogado.';

alter table public.relatorio_links enable row level security;

-- mínimo privilégio explícito mesmo com o alter default privileges da 0032:
-- metadado de link público não pode vazar por grant esquecido
revoke all on public.relatorio_links from public, anon;
-- leitura pela UI interna (o builder de /relatorios resolve o slug da turma);
-- escrita NÃO vai por REST: criação/rotação/revogação são SQL service role
-- nesta versão — as RPCs de gestão são da 170
revoke insert, update, delete on public.relatorio_links from authenticated;
grant select on public.relatorio_links to authenticated;

drop policy if exists relatorio_links_select on public.relatorio_links;
create policy relatorio_links_select on public.relatorio_links
  for select to authenticated
  using (public.my_role() = 'coordenacao');

-- -------------------------------------------------------------- turma_inscricoes
create table if not exists public.turma_inscricoes (
  id uuid primary key default gen_random_uuid(),
  turma text not null check (char_length(turma) between 1 and 80),
  profile_id uuid references public.profiles(id) on delete cascade,
  mentorado_id uuid references public.mentorados(id) on delete cascade,
  -- lado esperado: denormalizado de propósito, o CHECK abaixo garante a
  -- coerência com a coluna preenchida (mentor mora em profiles, mentorado
  -- em mentorados — XOR do num_nonnulls)
  papel_esperado text not null
    check (papel_esperado in ('mentor','mentorado')),
  -- 'aguardando' é o que a fila do relatório mostra; 'formada' = entrou em
  -- dupla (marcação opcional — a regra de exibição já é "tem dupla ativa →
  -- some", o status fica como registro); 'desistiu' sai da fila mas fica
  -- no histórico
  status text not null default 'aguardando'
    check (status in ('aguardando','formada','desistiu')),
  -- nota operacional curta ("preferiu manhã", "veio pela ONG X") — sem dado
  -- sensível; clínico/contextual mora em pessoa_notas ou nos campos da ficha
  nota text check (nota is null or char_length(nota) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1),
  check ((papel_esperado = 'mentor') = (profile_id is not null)),
  -- uma pessoa na fila ≤1× por turma (nulls not distinct: o lado NULL não
  -- "diferencia" a linha — mesma régua do unique de profile_papeis, 0085)
  unique nulls not distinct (turma, profile_id, mentorado_id)
);
comment on table public.turma_inscricoes is
  'Fila de pertencimento por turma (REALIZA-167): quem é da turma SEM estar '
  'em dupla — mentor importado aguardando vaga, jovem inscrito sem matching. '
  'Substitui os arrays FILA_T2_* do relatório: a linha "Sem dupla" deriva '
  'daqui pra qualquer turma. Não é papel de staff (profile_papeis) nem dupla '
  'formada (duplas.turma). Coord-only integral; gestão v1 por SQL/REST coord, '
  'UI fica pra 47 ou follow-up.';

-- FKs não se auto-indexam (review dba): os dois lados do XOR levam índice —
-- o cascade do delete da pessoa e o lookup por pessoa na fila agradecem
create index if not exists turma_inscricoes_profile
  on public.turma_inscricoes (profile_id) where profile_id is not null;
create index if not exists turma_inscricoes_mentorado
  on public.turma_inscricoes (mentorado_id) where mentorado_id is not null;
-- consulta quente do relatório: fila aguardando de uma turma
create index if not exists turma_inscricoes_fila
  on public.turma_inscricoes (turma) where status = 'aguardando';

alter table public.turma_inscricoes enable row level security;

revoke all on public.turma_inscricoes from public, anon;
grant select, insert, update, delete on public.turma_inscricoes to authenticated;

drop policy if exists turma_inscricoes_coord on public.turma_inscricoes;
-- for all sem with check: a mesma expressão vale pras linhas existentes e
-- pras novas — gestão coord-only integral (a fila é instrumento dela; se o
-- supervisor um dia precisar ver a fila das supervisionadas, é follow-up
-- de policy, não de tabela)
create policy turma_inscricoes_coord on public.turma_inscricoes
  for all to authenticated
  using (public.my_role() = 'coordenacao');

-- ---------------------------------------------------------------- seeds
-- O slug legado da T2 em circulação vira row da tabela — a página passa a
-- validar contra ela e o link continua abrindo idêntico (a constante
-- RESUMO_SLUG_T2 morre no código no mesmo PR).
insert into public.relatorio_links (slug, turma, titulo) values
  ('t2-x7k4m9qf2w8j', 'T2 · 2026/2027', 'Resumo da turma — T2 · 2026/2027')
on conflict (slug) do nothing;

-- Backfill da fila T2 (as 3 inscrições que viviam hardcoded em FILA_T2_*).
-- CORREÇÃO do review dba: seed com uuid literal de prod quebrava o
-- `db push` do staging em FK (as pessoas não existem lá). Aqui a pessoa é
-- resolvida por NOME — id nunca entra literal no seed — então em staging o
-- select devolve zero linhas e nada é inserido (sem erro), e em prod o
-- backfill acontece no apply. Os nomes são os mesmos do roster de import
-- (scripts/importar-turma2.ts resolve gente por nome da mesma forma).
insert into public.turma_inscricoes (turma, profile_id, papel_esperado, nota)
  select 'T2 · 2026/2027', p.id, 'mentor',
         'Fila de pareamento da T2 (importada do relatório)'
    from public.profiles p
   where p.nome = 'Fernanda Arrelaro Santos'
on conflict do nothing;

insert into public.turma_inscricoes (turma, mentorado_id, papel_esperado, nota)
  select 'T2 · 2026/2027', m.id, 'mentorado',
         'Fila de pareamento da T2 (importada do relatório)'
    from public.mentorados m
   where m.nome in ('Luana Magalhães dos Santos', 'Wemilly Alves dos Santos')
on conflict do nothing;

commit;
