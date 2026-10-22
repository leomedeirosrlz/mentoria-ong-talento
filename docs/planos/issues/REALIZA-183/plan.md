# REALIZA-183 — plano de implementação

Descrição essencial (sem re-ler o Jira): o `/resumo/[slug]` público precisa de
log de acesso append-only — `slug`, `acessado_em`, `ip_hash` (SHA-256+salt, não
IP cru), `user_agent`, `params` (o recorte da URL). Escrita fire-and-forget no
server component via admin client; leitura coord-only.

## Passo 0 — convenções que este plano assume

- Próxima migration livre: **`0106`** (última é `0105_review_fixes.sql` — o
  implementador confirma o número no momento do PR; o que vale é o nome descritivo).
- Tabela nova herda `revoke` explícito de `anon`/`public` (molde 0103:80-99) —
  mesmo com o `alter default privileges` da 0032, a migration revoga de propósito.
- `service_role` (admin client `src/lib/supabase/admin.ts`) escreve sem grant
  extra — default privileges do Supabase dão ALL a objetos novos de `public`.
- Depois de aplicar em staging: `supabase gen types typescript` → regen de
  `src/lib/database.types.ts` (o e2e-app tem gate de freshness, `e2e-app.yml:44-68`).

## Passo 1 — migration `0106_resumo_acessos.sql`

```sql
-- 0106 resumo_acessos (REALIZA-183): log append-only de acessos ao /resumo
-- público. Slug livre (text) — a tabela de links (relatorio_links, 167/170)
-- chega depois e o log sobrevive à exclusão do link, como emails_enviados.
-- IP nunca cru: o app grava ip_hash (SHA-256 com salt de env). Sem writer no
-- JWT: insert só por service_role (admin client) — a página publica, ninguém
-- mais. Leitura coord-only.

begin;

create table public.resumo_acessos (
  id uuid primary key default gen_random_uuid(),
  -- slug textual (não FK): o link pode ser revogado/apagado e o rastro fica
  slug text not null check (char_length(slug) between 1 and 120),
  acessado_em timestamptz not null default now(),
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 16 and 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  -- o recorte pedido (?turma=&gran=&col=) — revela se o link circulou com
  -- colunas de contato ligadas
  params jsonb not null default '{}'::jsonb
);
comment on table public.resumo_acessos is
  'Log de acesso ao /resumo público (REALIZA-183). Append-only: insert por '
  'service_role; select coord-only. ip_hash = SHA-256(salt+ip), nunca IP cru.';

create index resumo_acessos_slug_em on public.resumo_acessos (slug, acessado_em desc);

alter table public.resumo_acessos enable row level security;

revoke all on public.resumo_acessos from public, anon;
-- authenticated não escreve nem apaga — select abaixo é o único grant
revoke insert, update, delete on public.resumo_acessos from authenticated;
grant select on public.resumo_acessos to authenticated;

create policy resumo_acessos_select on public.resumo_acessos
  for select to authenticated
  using (public.my_role() = 'coordenacao');

commit;
```

Sem `updated_at` (append-only). Sem trigger.

## Passo 2 — helper puro `src/lib/resumo-acesso.ts` [NOVO]

```ts
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Salt do pseudônimo de IP — env server-only (não NEXT_PUBLIC). */
const SALT = process.env.RESUMO_ACESSO_SALT ?? "realiza-resumo-acesso-v1";

export function hashIpAcesso(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 64);
}

export async function ipUaParams(sp: Record<string, string | undefined>) {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: fwd || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
    params: {
      turma: sp.turma ?? null,
      gran: sp.gran ?? null,
      col: sp.col ?? null,
    },
  };
}
```

## Passo 3 — escrita no `src/app/resumo/[slug]/page.tsx`

Depois do gate existente (`if (slug !== RESUMO_SLUG_T2) notFound();`, `:34`) e
antes dos selects, inserir:

```ts
// fire-and-forget: o acesso não espera o log — falha nunca derruba a página.
// (o insert do supabase-js é lazy: sem .then() nem await, nada é enviado)
void logAcessoResumo(slug, sp);
```

```ts
async function logAcessoResumo(slug: string, sp: Record<string, string | undefined>) {
  try {
    const { ip, ua, params } = await ipUaParams(sp);
    await createAdminClient().from("resumo_acessos").insert({
      slug,
      ip_hash: hashIpAcesso(ip),
      user_agent: ua?.slice(0, 500) ?? null,
      params,
    });
  } catch {
    // log é auditoria, não gate — engole qualquer falha de rede/env
  }
}
```

Detalhe: `logAcessoResumo` fica no próprio page.tsx ou em `src/lib/resumo-acesso.ts`
(recomendado — o mesmo arquivo concentra o salt). Em modo demo o caminho é o
mesmo (a página não tem ramo demo hoje — mantido).

## Passo 4 — env var

- `RESUMO_ACESSO_SALT`: adicionar em Vercel (prod + preview) e `.env.local`.
  Valor: string aleatória (ex.: `openssl rand -hex 16`). Sem ela, cai no
  fallback constante do código — funcional, mas o salt público reduz a proteção
  contra dicionário (ver sdr.md §IP). Documentar no README do env ou AGENTS.md
  §Env vars se tocado.

## Passo 5 — regen + gates

1. `supabase db push --db-url <staging>` → `pnpm seed:e2e` não precisa (tabela
   nova sem fixtures).
2. `supabase gen types typescript --linked` → commit `database.types.ts`.
3. `npx tsc --noEmit`, `npx eslint src/`, `pnpm test`.
4. Aplicar em **prod antes do merge** (ordem dura: migration remota → código),
   senão o `schema-contract` falha quando o código começa a escrever na tabela —
   aqui a escrita é via service role (fora do contract check), mas a leitura
   `select` da policy entra no types regen de qualquer forma.

## Rollback

`drop table public.resumo_acessos` + revert do page.tsx — sem dados dependentes.
