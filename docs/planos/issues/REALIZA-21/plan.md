# REALIZA-21 — Plano de implementação

Checklist de intenções por encontro. Modelo novo `encontro_intencoes` [NOVO]
(mesmo desenho de `encontro_notas`), checklist editável no card do encontro,
carry-over pro próximo encontro, aviso na Minha agenda, leitura no detalhe do
encontro. Contrato completo do modelo em `sdd.md`; UX em `design.md`.

## Ordem sugerida

PR único pequeno, ou dois: (1) migration + action + types; (2) UI + demo.
A migration precisa ir ao **staging antes/junto do push da branch** e a
**prod antes do merge** (schema-contract CI quebra se o types declarar coluna
que o remoto não tem).

## Passo 1 — Migration `supabase/migrations/0106_encontro_intencoes.sql`

Nome e número seguem a sequência (última é `0105_review_fixes.sql`). Padrão das
010x: header comentado, idempotente (`create table if not exists`,
`drop policy if exists`), RLS via `my_role()`/`my_profile_id()`.

```sql
-- REALIZA-21 — checklist de intenções por encontro.
-- Chave (dupla_id, numero) como encontro_notas (0015): a intenção precede o
-- agendamento e segue o nº do guia na remarcação/não-aconteceu. Fechamento
-- deriva de `feito`+`feito_em` — sem enum novo (pendente é feito=false).

create table if not exists public.encontro_intencoes (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  texto text not null check (char_length(texto) between 1 and 280),
  feito boolean not null default false,
  feito_em timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encontro_intencoes enable row level security;
create index if not exists encontro_intencoes_dupla_idx
  on public.encontro_intencoes (dupla_id);
create index if not exists encontro_intencoes_pendentes_idx
  on public.encontro_intencoes (dupla_id, numero) where not feito;

-- feito_em carimba a transição — antes do update, sem confiar no caller
create or replace function public.intencao_carimba_feito()
returns trigger language plpgsql as $$
begin
  if new.feito and not old.feito then new.feito_em := now();
  elsif not new.feito then new.feito_em := null; end if;
  return new;
end $$;
create trigger encontro_intencoes_feito
  before update on public.encontro_intencoes
  for each row execute function public.intencao_carimba_feito();
create trigger encontro_intencoes_touch
  before update on public.encontro_intencoes
  for each row execute function public.touch_updated_at();

-- policies verbatim do escopo de encontro_notas (0015)
create policy encontro_intencoes_select on public.encontro_intencoes for select
  using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id()
             or d.supervisor_id = public.my_profile_id()))
  );
create policy encontro_intencoes_mentor_write on public.encontro_intencoes for all
  using (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id())
  ) with check (
    public.my_role() = 'coordenacao'
    or exists (select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id())
  );
```

O jovem **não** lê (sem ramo mentorado — é o mesmo escopo de `encontro_notas`,
plano privado do mentor; ver `sdr.md`).

## Passo 2 — Tipos

`src/lib/types.ts` (perto de `EncontroNota`, `:469-477`):

```ts
/** Intenção do mentor pro encontro N — chave (dupla_id, numero) como a nota;
 *  pendente = feito=false; carry-over é por numero, não por encontro_id. */
export type EncontroIntencao = {
  id: string;
  dupla_id: string;
  numero: number;
  texto: string;
  feito: boolean;
  feito_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
```

- `Dupla` (`:479-512`): `intencoes?: EncontroIntencao[];` ao lado de `notas`.
- `src/lib/queries.ts:342-351` — `DUPLA_SELECT`: adicionar
  `intencoes:encontro_intencoes(*)` na linha dos embeds de `duplas` (mesmo
  nível de `notas:encontro_notas(*)`).
- `src/lib/database.types.ts` — **regenerar** após aplicar a migration no
  remoto (schema-contract).

## Passo 3 — Actions (`src/lib/actions.ts`, junto a `salvarNotaEncontro` ~:2985)

Três actions pequenas, contrato `{error}`/`{ok}`, mesma guarda da nota:
`demoAtivo()` → `me()` → `temPapel(eu,'mentor_dpp')||temPapel(eu,'mentor_especialista')`
→ `duplas.status === 'ativa'` → teto de nº (DPP pelo `cronograma_id` da dupla —
copiar o bloco `maxNum` de `salvarNotaEncontro:3002-3013`).

- `criarIntencao(duplaId, numero, texto)` — `trim`, 1–280 chars, insert com
  `created_by: eu.id`. `revalidatePath('/agenda')` + ficha.
- `marcarIntencao(id, feito)` — update `feito` (o trigger carimba `feito_em`);
  o RLS já escopa à própria dupla. Mesma revalidate.
- `removerIntencao(id)` — delete por id; mentor remove item digitado errado.
  Mesma revalidate.

Sem RPC — a policy `for all` cobre update/delete do mentor; a action é o
contrato (mesma arquitetura de `salvarNotaEncontro`).

## Passo 4 — Componente `src/components/intencoes-encontro.tsx` [NOVO]

- `"use client"`, props `{ duplaId, numero, itens, pendentesAnteriores, somenteLeitura }`.
- Gramática visual do `NotaEncontro` (Collapsible da Base UI — mesmo import
  `@base-ui/react/collapsible`, caret, min-h-11 trigger) e do checkbox de
  `JovemCombinados`/`EncaminhamentosList` (input sr-only + quadrado estilizado,
  label clicável — teclado de graça).
- Header: `Intenções` + contador `N pendentes` quando houver (scent de estado,
  como o preview de 1ª linha da nota).
- Itens do `numero` atual: checkbox → `marcarIntencao`; input "Adicionar
  intenção…" (Enter confirma, `criarIntencao`); item próprio tem botão remover
  (× ghost) → `removerIntencao`.
- `pendentesAnteriores`: linha separada "De antes:" com os itens `feito=false`
  de `numero < atual`, cada um taggeado `do Nº encontro`, também com checkbox
  (marcar ali mesmo — não obriga voltar ao card de origem).
- `somenteLeitura` (coord/sup/dupla inativa): lista sem inputs — só quando há
  itens, senão `null` (mesmo contrato do ramo read-only da nota).
- Estados: pending no item que está salvando (opacity + disable por id —
  padrão `pendingId` de `JovemCombinados`); toast de erro nos padrões da casa;
  demo = UI funciona localmente sem chamar action (espelhar o gate `demo` do
  `NotaEncontro:45-57` — itens ficam no estado local, sem toast DEMO_MSG).

## Passo 5 — Encaixe na ficha (`src/app/(app)/duplas/[id]/page.tsx`)

- Derivar `intencoes` do `dupla.intencoes` (embed do passo 2).
- `EncontroRow` ganha props `intencoes: EncontroIntencao[]` (do `passo.numero`)
  e `pendentesAnteriores: EncontroIntencao[]` (`numero < passo.numero`,
  `!feito`).
- Renderizar `<IntencoesEncontro>` no mesmo bloco da nota
  (`:1689-1698`), abaixo do `NotaEncontro` — mesma section `border-t`.
- A derivação do carry-over é 3 linhas de filter/sort — inline no mapa de
  `renderEncontro`, sem lib nova.

## Passo 6 — Aviso na Minha agenda (`src/lib/agenda-minha.ts`)

`avisosDaDupla` (`:304-354`) ganha um terceiro bloco, depois dos combinados:

```ts
const intPendentes = (d.intencoes ?? []).filter((i) => !i.feito);
if (intPendentes.length > 0) {
  const maisAntigo = Math.min(...intPendentes.map((i) => i.numero));
  avisos.push({
    id: `int-${d.id}`,
    escopo, duplaId: d.id, encontro: null,
    titulo: `Intenções em aberto · ${nome1} · ${d.turma}`,
    detalhe: `${intPendentes.length} ${intPendentes.length === 1 ? "item" : "itens"} — o mais antigo é do ${maisAntigo}º encontro.`,
    href: `/duplas/${d.id}`,
    cta: "Ver intenções",
    remarcar: false,
  });
}
```

Uma linha só (não um aviso por item — a fila é resumida por desenho). Teste em
`tests/agenda-minha.test.ts`: dupla com 2 pendentes → 1 aviso `int-*`;
todas feitas → 0.

## Passo 7 — Detalhe do encontro (`src/components/encontro-detalhe-dialog.tsx`)

Bloco read-only ao lado de "Plano do mentor" (`:186-193`): quando
`dupla.intencoes` tiver itens do `encontro.numero`, renderizar lista com
`feito ? line-through` + label "Intenções do mentor". Sem checkbox (o dialog é
de coord/sup — leitura).

## Passo 8 — Demo

- `src/lib/demo/data.ts`: fixtures `intencoes` por dupla (faixa de ids nova no
  mapa de ids em `:144-146` — ex. `16xx`), 2–3 itens misturando feito/pendente
  na dupla de destaque + 1 pendente antiga pra exercitar o carry-over.
- `src/lib/demo/client-stub.ts:160` — `case "encontro_intencoes":` retornando
  `d.duplas.flatMap((x) => (x.intencoes ?? []))` (idêntico a `encontro_notas`).
- `src/lib/demo/queries.ts` — `demoDuplas` inclui `intencoes` no objeto.
- Actions: `demoAtivo()` já devolve `DEMO_MSG` — o componente (passo 4) não
  chama action em demo, então o checklist demo funciona 100% em estado local.

## Passo 9 — Gates

- `npx tsc --noEmit`, `npx eslint src/`, `pnpm test` (Vitest: teste novo do
  passo 6 + qualquer helper puro que surgir).
- Migration → staging, validar RLS com usuário mentor/jovem de fixture
  (`scripts/_valida_*.mjs` pattern), depois prod antes do merge.
- e2e: estender spec demo de ficha/agenda (ver acceptance.md) — demo não
  escreve; cenário app de criar/marcar intenção vai pra `tests/e2e/app`.

## Rollback

Migration aditiva — rollback = `drop table encontro_intencoes` + reverter o
embed no `DUPLA_SELECT` (o types regenerado volta junto). Sem dados a migrar.
