# REALIZA-167 — software design

## 1. `relatorio_links` (versão mínima) [NOVO]

```sql
create table public.relatorio_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[A-Za-z0-9_-]{16,128}$')
    default translate(encode(extensions.gen_random_bytes(18),'base64'),'+/=','-_'),
  -- turma dona do link nesta versão; a 170 adiciona config tipo/filtros
  -- que podem não ser por-turma — a coluna vira nullable lá se precisar
  turma text not null check (char_length(turma) between 1 and 80),
  titulo text check (titulo is null or char_length(titulo) between 1 and 120),
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  revogado_em timestamptz
);
```

- Sem `senha_hash`/`config`/`expira_em` aqui — a 170 faz `alter table add
  column` (todos os campos dela são nullable ou têm default → alter barato,
  sem rewrite).
- Nome **decidido**: `relatorio_links`. Jira 167 diz `resumo_links` e 170 diz
  `relatorio_links` — mesma artefato ("base da 170"). Vence o nome da spec
  completa; `_done-R.md` registra o alias.
- RLS: `grant select to authenticated` + policy `my_role()='coordenacao'`
  (gestão). **Anon zero.** O `/resumo` valida slug por service role (admin)
  ou RPC — nunca grant anon.
- Seed:

```sql
insert into public.relatorio_links (slug, turma, titulo)
values ('t2-x7k4m9qf2w8j', 'T2 · 2026/2027', 'Resumo da turma — T2 · 2026/2027');
```

## 2. `turma_inscricoes` [NOVO]

```sql
create table public.turma_inscricoes (
  id uuid primary key default gen_random_uuid(),
  turma text not null check (char_length(turma) between 1 and 80),
  profile_id uuid references public.profiles(id) on delete cascade,
  mentorado_id uuid references public.mentorados(id) on delete cascade,
  papel_esperado text not null
    check (papel_esperado in ('mentor','mentorado')),
  status text not null default 'aguardando'
    check (status in ('aguardando','formada','desistiu')),
  nota text check (nota is null or char_length(nota) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, mentorado_id) = 1),
  -- coerência papel×coluna: mentor→profile_id, mentorado→mentorado_id
  check ((papel_esperado='mentor') = (profile_id is not null)),
  unique nulls not distinct (turma, profile_id, mentorado_id)
);
```

- `papel_esperado` denormaliza o lado esperado — a CHECK seguinte garante
  coerência com a coluna preenchida (mentor mora em `profiles`,
  mentorado em `mentorados`).
- `status`: `aguardando` (o que a fila mostra), `formada` (entrou em dupla —
  marcação opcional; a regra de exibição já é "tem dupla ativa → some da
  fila", o status é registro), `desistiu` (saiu da fila — some do relatório
  mas fica no histórico).
- RLS select: coord ∪ supervisor? A fila é visão de coord — **coord-only**
  v1 (supervisor não gerencia fila hoje). Insert/update/delete: coord-only
  via policy (gestão por SQL/coord v1 — UI depois).
- Seed T2 (do relatorio.ts:239-243):

```sql
insert into public.turma_inscricoes (turma, profile_id, papel_esperado) values
  ('T2 · 2026/2027', 'a6df198b-b46f-45f7-a5a1-a2dbed3325b9', 'mentor');
insert into public.turma_inscricoes (turma, mentorado_id, papel_esperado) values
  ('T2 · 2026/2027', '710fcd28-7b68-4456-bbfe-f2915553fb7c', 'mentorado'),
  ('T2 · 2026/2027', 'f78d2469-a6e6-4cfb-85bd-2b90bc5c68c4', 'mentorado');
```

## 3. `montarLinhas` — generalização

Hoje (`relatorio.ts:339`): `if (cfg.turma === "T2 · 2026/2027")` + loops com
os arrays. Vira:

```ts
export type InscricaoFila =
  | { papel_esperado: "mentor"; profile_id: string }
  | { papel_esperado: "mentorado"; mentorado_id: string };

montarLinhas(cfg, duplas, profs, mentorados, opts & { fila?: InscricaoFila[] })
```

- O bloco `if` sai; os dois loops correm sobre `opts.fila ?? []` — mesma
  regra `!ativosMentor/Jovem.has(id)` + `status='aguardando'` filtrado na
  query (ou no map — melhor na query, fonte única).
- `FILA_T2_*` e o check por string de turma **morrem**; `RESUMO_SLUG_T2`
  permanece **só** como seed documentado (remover do runtime — grep de
  despedida: `RESUMO_SLUG_T2` aparece em page.tsx:34 e relatorio-builder
  :187 — os dois mudam).
- Query nova `getTurmaInscricoesAguardando(turma)` em `queries.ts` —
  `React.cache`, retorna `InscricaoFila[]`.

## 4. `/resumo/[slug]` — gate novo

Troca `if (slug !== RESUMO_SLUG_T2) notFound()` por:

```ts
const { data: link } = await createAdminClient()
  .from("relatorio_links")
  .select("slug, turma, revogado_em")
  .eq("slug", slug).maybeSingle();
if (!link || link.revogado_em) notFound();
```

- E `cfg.turma` forçado pro `link.turma` quando a URL não trouxer? Decisão:
  nesta versão a config ainda vem da query string (comportamento atual — a
  170 é quem muda a autoridade pro config salvo). O gate só valida o slug.
  `link.turma` não força nada ainda — o recorte continua livre por query
  (estado atual preservado; a 170 o trava).
- `relatorio-builder` `linkCompartilhavel` (:187): troca a constante por
  `getResumoSlug(turma)` — query nova; sem link cadastrado pra turma → botão
  "Publicar" desabilita com hint "gere o link da turma" (criação v1 via SQL
  — UI de gestão é a 170).

## 5. Ponte pra 47 (documentada, não implementada)

- `turmas(id uuid, nome, ...)` futura: `alter turma_inscricoes add turma_id`,
  backfill por `turmas.nome = turma_inscricoes.turma`, idem `duplas.turma` e
  `cronogramas.turma`. A coluna text atual é o join bridge — por isso fica
  text aqui (não criar `turmas` agora).
- `relatorio_links.turma` idem.

## 6. Invariantes

- Uma pessoa na fila ≤1× por turma (unique) e nunca com as duas colunas
  (CHECK XOR).
- `aguardando`+dupla ativa → não aparece (regra de exibição, não o dado).
- Anon nunca lê `relatorio_links`/`turma_inscricoes` — revoke + sem policies.
- O slug público continua 404-fora-da-tabela — gate admin, não grant.
