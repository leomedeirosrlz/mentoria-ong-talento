# Plano — ops & infra, rodada nov/2026

**Spec:** `specs/005-ops-nov/spec.md` · **Status:** Approved (US1) · US2 desenho aprovável, implementação adiada

## Resumo técnico

- **US1 (REALIZA-37):** parser puro do ViaCEP (`src/lib/viacep.ts`) +
  server action `buscarCep` (`src/lib/actions-endereco.ts`, timeout 5s,
  `revalidate` 24h, fixture em demo) + bloco de endereço controlado no
  `DadosCivisFields`. `parseCivis` intocado — autofill é conveniência,
  nunca caminho de validação.
- **US2 (REALIZA-98):** coluna `duplas.dupla_dpp_id` self-FK + backfill +
  preenchimento nos 3 caminhos de escrita (RPCs de aceite, `createDupla`,
  `rematch_dupla`). **Spec-only nesta PR** — o desenho fica registrado
  para implementação dedicada.
- Não se cria: wrapper de fetch genérico, endpoint REST próprio,
  migration de 98 nesta branch.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 ·
  Base UI · Phosphor.
- Supabase (Postgres + Auth + Storage + RPC); local só para e2e via
  `supabase start`.
- `DadosCivisFields` (`src/components/assinatura-form.tsx`) é o bloco
  compartilhado: `AssinaturaForm` (logado + `/assinar/[token]` público),
  `pessoas-dialogs.tsx` (novo/editar pessoa, `compacto`), `pessoa-actions.tsx`,
  `mentorado-actions.tsx` (`civis_` compacto + `resp_` completo).
- Testes: Vitest (domínio puro) · Playwright `demo` (sem login) e `app`
  (backend real) · schema-contract no CI.
- Antes de codar: `pnpm exec next typegen`.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Autofill funcional de ponta a ponta com estados idle/buscando/ok/não-encontrado/falha; sem placeholder | spec US1 + e2e demo |
| A2 RLS | Nenhuma policy nova; US1 não toca banco. US2 (futuro): coluna lida pelas policies de `duplas`, escritas só por RPCs definer já existentes | — |
| A3 escritas/domínio | `buscarCep` devolve union `ok/nao_encontrado/erro`, nunca lança; parser puro em `src/lib/viacep.ts` | `tests/viacep.test.ts` |
| A4 rota pública | Nenhuma rota nova; a action é chamada de `/assinar/*` como qualquer server action — POST same-origin já coberto pelo `isPublic` | `tests/middleware-publico.test.ts` intacto |
| A5 LGPD | ViaCEP entra como operador novo em `docs/lgpd/base-legal.md` §4 recebendo só o CEP; hint in-situ no campo | base-legal + UI |
| A6 UI | Kit `Input`/`Label`; spinner `CircleNotch`; copy pt-BR sem travessão; status com texto, nunca só cor | `npx eslint src/` |
| A7 demo | `demoRole()` → fixture fixo; e2e demo determinístico sem rede | `tests/e2e/demo/viacep.spec.ts` |
| A8 gates | DoD padrão + spec e2e demo novo | saída no PR |
| A9 migrations | Nenhuma migration nesta PR (US2 documentada, não aplicada) | — |
| A10 spec | Esta spec | `specs/005-ops-nov/` |

## Arquitetura da mudança (paths reais)

```text
src/lib/viacep.ts              # [NOVO] parser puro + cepNormalizado
src/lib/actions-endereco.ts    # [NOVO] "use server" buscarCep
src/components/assinatura-form.tsx  # DadosCivisFields: bloco controlado + status
tests/viacep.test.ts           # [NOVO] vitest do parser
tests/e2e/demo/viacep.spec.ts  # [NOVO] autofill em /assinar/<token> demo
docs/lgpd/base-legal.md        # operador ViaCEP na §4
src/app/(app)/duplas/[id]/page.tsx  # fix 54: PDM só em trilha DPP
supabase/migrations/           # (US2 — NÃO nesta PR)
```

## Dados e migrations

### US1 — sem migration

`dados_civis` (jsonb, 0046) já guarda `endereco`; o autofill só muda o que
chega nos inputs antes do submit.

### US2 — desenho registrado (implementação adiada)

Migration nova, próximo número livre quando for escrita (o plano antigo
dizia 0063/0106 — ambos já ocupados):

```sql
alter table public.duplas
  add column dupla_dpp_id uuid references public.duplas(id) on delete set null;
alter table public.duplas
  add constraint duplas_dpp_pai check (
    dupla_dpp_id is null
    or (trilha = 'especialista' and dupla_dpp_id is distinct from id));
create index duplas_dpp_pai_idx
  on public.duplas(dupla_dpp_id) where dupla_dpp_id is not null;
update public.duplas d
   set dupla_dpp_id = s.dupla_dpp_id
  from public.solicitacoes_especialista s
 where s.dupla_id = d.id
   and s.dupla_dpp_id is not null
   and d.dupla_dpp_id is null;
```

- `on delete set null`: DPP apagada não derruba a trilha esp.
- O CHECK não exige a mãe ser `trilha='dpp'` — cross-row CHECK não existe
  em Postgres; a garantia vem da escrita (fontes já validadas por
  `solicitacao_integridade`, 0086).

Escritas a ajustar (conferir `pg_get_functiondef` no ambiente alvo — as
definições vivas são as das últimas migrations):

| Caminho | Onde | Delta |
|---|---|---|
| `aceitar_solicitacao` | última def: `0097_emitir_gate_dupla360.sql` | `dupla_dpp_id` no insert da dupla esp (valor `s.dupla_dpp_id`) |
| `sol_efetivar` | última def: `0101_especialistas_globais.sql:211-217` | idem |
| `rematch_dupla` | última def: `0205_rematch_links_jornada_redo.sql` | herdeira copia `antiga.dupla_dpp_id` |
| `createDupla` | `src/lib/actions.ts` (branch `trilha==='especialista'`, lookup de turma `:843`) | `select("id, turma")` + `dupla_dpp_id: dpp?.id ?? null` |

Consumidores: `actions-encerramento.ts:312-406` prefere
`dupla.dupla_dpp_id` com fallback pra solicitação (defensivo, barato).
View `jovem_duplas` (0067) lista colunas explicitamente — não vaza a
coluna nova. `database.types.ts` regen + `Dupla.dupla_dpp_id` em
`types.ts` + fixture demo.

**Risco → por que spec-only:** `rematch_dupla` foi redefinida 4 vezes
(0169→0170→0178→0205) e `aceitar_solicitacao`/`sol_efetivar` servem
pareamento em produção via action **e** tool da Liza (`ia/tools.ts:1887`).
Errar o corpo vigente quebra aceite/rematch silenciosamente. Sem stack
local resetável neste worktree, a verificação exige o `db push` em
staging + e2e-app — janela própria, não carona.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| `buscarCep` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (leitura externa, sem sessão) |
| US2: ler `dupla_dpp_id` | policies atuais de `duplas` (sem mudança) | | | | | sem grant |
| US2: escrever `dupla_dpp_id` | só via RPCs definer/criação (sem update direto novo) | | | | | — |

## Verificação

`pnpm exec next typegen` · `npx tsc --noEmit` · `npx eslint src/` ·
`pnpm test` · `pnpm guard` · e2e demo `viacep.spec.ts`.
US2 (na implementação): `db push` em staging + schema-contract + e2e app
(aceite gera mãe; rematch preserva mãe; REST confirma backfill).

## Complexidade e desvios

- US2 implementada **sem** migration nesta PR: desvio de escopo
  deliberado (brief ws7 permite spec-only quando o risco de backfill
  justifica) — a alternativa "aplicar agora" foi rejeitada pelo risco de
  reescrever RPCs definer de pareamento sem stack local resetável.
