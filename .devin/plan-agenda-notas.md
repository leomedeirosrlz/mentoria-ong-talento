# Plano — anotações / plano de aula na agenda

Pedido: "espaço pra anotações ou planos de aula direto na agenda". O caso real
do mentor: preparar o encontro ANTES dele (`registros` é pós-encontro — follow-up,
não preparação).

## 1. Decisão — nota por encontro do ciclo, chave (dupla_id, numero)

**Granularidade: por encontro (nº do guia).** "Plano de aula" é inerentemente
sobre o Nº encontro; nota por dia livre vira diário solto (segunda superfície,
mais clutter) e bloco único por dupla vira parede de texto sem âncora. O nº
ancora a nota no trilho 1–16 que agenda e ficha já exibem — ela aparece no dia
oficial mesmo quando a dupla remarcou.

**Tabela nova, não coluna em `encontros`:** a row de `encontros` só nasce no
agendamento — "anotar no 5º que ainda não marquei" exigiria row fantasma sem
`data_hora`, corrompendo status/semáforo. `(dupla_id, numero)` existe sem
`encontros` e sobrevive a remarcação, `nao_aconteceu` e cancelamento.

## 2. Migration `supabase/migrations/0015_encontro_notas.sql`

```sql
-- ===== anotações do mentor por encontro do ciclo =====
-- Plano de aula e lembretes pré-encontro. Chave (dupla_id, numero) — não FK pra
-- encontros: a nota pode existir antes do agendamento e segue o nº mesmo quando
-- o encontro é remarcado ou marcado como não-aconteceu.
create table public.encontro_notas (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  numero smallint not null,
  texto text not null default '' check (char_length(texto) <= 10000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dupla_id, numero)
);

alter table public.encontro_notas enable row level security;
create index encontro_notas_dupla_idx on public.encontro_notas (dupla_id);

-- mesmo escopo de encaminhamentos (0001): coord lê/escreve tudo; mentor escreve
-- na própria dupla; supervisor só lê as supervisionadas
create policy encontro_notas_select on public.encontro_notas for select
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id
        and (d.mentor_id = public.my_profile_id() or d.supervisor_id = public.my_profile_id())
    )
  );

create policy encontro_notas_mentor_write on public.encontro_notas for all
  using (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id()
    )
  ) with check (
    public.my_role() = 'coordenacao'
    or exists (
      select 1 from public.duplas d
      where d.id = dupla_id and d.mentor_id = public.my_profile_id()
    )
  );

create trigger encontro_notas_touch
  before update on public.encontro_notas
  for each row execute function public.touch_updated_at();
```

**Quem vê**: espelha `encaminhamentos` — leitura coord+mentor+supervisor,
escrita coord+mentor. UI v1 renderiza só pro mentor (`ehMentor`); coord/sup
recebem o dado via RLS pra superfície futura, sem nada novo na agenda deles.

## 3. Dados e action

- `types.ts`: `EncontroNota` (id, dupla_id, numero, texto, created_by,
  created_at, updated_at) + `Dupla.notas?: EncontroNota[]`.
- `queries.ts` (`DUPLA_SELECT`): `notas:encontro_notas(*)` — mesma viagem do
  embed de encontros, zero round-trip; lookup
  `dupla.notas?.find(n => n.numero === numero)`.
- `actions.ts` (seção nova "notas", perto de `salvarRegistro`):
  `salvarNotaEncontro(duplaId, numero, texto)` — `me()`; valida `numero` contra
  `max(ciclo_eventos.numero)` tipo encontro; rejeita dupla `status !== 'ativa'`;
  `texto.trim()` vazio → `delete`; senão maybeSingle→update/insert preservando
  `created_by`; `revalidatePath("/agenda")` + `/duplas/${duplaId}`; retorna
  `{ok}|{error}`.

## 4. UI — divulgação progressiva, zero poluição

**`src/components/nota-encontro.tsx` (novo, client):** `<details>` nativo (mesma
gramática do "Próximos encontros") — summary "Anotações" + chevron; com `nota`
existente o summary ganha dot `bg-[var(--brand-lime)]` + sufixo "com anotações".
Indicador fica no detalhe, **não na célula do grid** (já tem 4 glifos). Aberto:
`Textarea` (rows=4, placeholder "Plano do encontro, lembretes, links…") com
**autosave** — onChange → debounce 800ms → `salvarNotaEncontro`; flush no
onBlur; caption `text-xs` "Salvando…"/"Salvo às HH:mm"; erro → `toast.error`.
Campo único = autosave, não botão (mesma filosofia do rascunho do
RegistroForm). Descoberta: o summary está visível pro mentor em todo dia de
encontro — self-explanatory, sem tour.

**Montagem:**
- `agenda-calendario.tsx` — detalhe do dia, dentro do bloco do evento oficial
  (`e.tipo === 'encontro' && e.numero != null`, após instrumentos/cobertura):
  `ehMentor` + dupla ativa → `<NotaEncontro>`; >1 dupla → uma por dupla rotulada
  pelo nome do mentorado. Encontro de dupla no dia sem oficial de mesmo nº →
  editor sob a lista "Sua dupla".
- `duplas/[id]/page.tsx` (`EncontroRow`) — mesmo componente em região inset
  `border-t` do card: `souMentor && ativa` → editor; `!ativa && nota` → texto
  read-only. A ficha é onde se prepara o 7º encontro semanas antes — a agenda
  sozinha não cobre esse fluxo.

## 5. Edge cases

- **Sem agendamento**: coberto — âncora é o evento oficial (nº), não a row.
- **Dupla pausada/encerrada**: UI esconde editor (nota read-only se existir);
  action rejeita escrita.
- **formacao/recesso/marco**: sem nota — plano é de encontro.
- **Texto apagado → delete**: "tem anotação" = row existe (indicador trivial).
- **Fuso**: sem datas na tabela; "Salvo às" em TZ SP.
- **Remarcação**: nota segue o nº — nunca se perde.
- **Coord edita nota do mentor**: `created_by` preservado no update.

## 6. Arquivos a tocar

1. `supabase/migrations/0015_encontro_notas.sql` (novo — aplicar via MCP supabase)
2. `src/lib/types.ts` — `EncontroNota`, `Dupla.notas`
3. `src/lib/queries.ts` — `DUPLA_SELECT`
4. `src/lib/actions.ts` — `salvarNotaEncontro`
5. `src/components/nota-encontro.tsx` (novo)
6. `src/components/agenda-calendario.tsx` — detalhe do dia + "Sua dupla"
7. `src/app/(app)/duplas/[id]/page.tsx` — `EncontroRow` (prop `nota`)

## 7. Riscos

- Autosave por tecla → debounce + só envia se dirty; `revalidatePath` por save é
  barato (React.cache); não chamar `router.refresh()` no autosave — a
  revalidação natural basta.
- `DUPLA_SELECT` ganha um embed — ≤16 rows/dupla, custo irrelevante.
- Trilha `mentor_especialista` (5 encontros, backlog conhecido): a validação por
  `max(numero)` já funciona sem trabalho extra.
- Privacidade: scratch do mentor mas legível por coord/sup (padrão do app); se
  surgir pedido de espaço privado, basta restringir o select policy.

## Verificação

`npx tsc --noEmit` · `npx eslint src/` · aplicar `0015` no remoto via MCP ·
testar RLS por role (mentor escreve só na própria dupla; supervisor lê; mentor
não lê nota de outra dupla).
