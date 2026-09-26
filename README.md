<div align="center">
  <a href="#root"><img src="./docs/banner.svg?v=1" alt="Realiza.vc — Programa de Mentoria Social" width="100%"/></a>
</div>

> 🇧🇷 [Versão em Português](docs/README.pt-BR.md) · the product, UI and data are pt-BR; this file is English for reach.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <pre lang="bash"><code>$ realiza.vc / briefing
------------------------------------------------
• product : ops platform, Programa de Mentoria Social
• entity  : dupla · mentor ↔ mentorado (matching)
• cycle   : 16 meetings · ciclo_eventos (Tuesdays)
• health  : semáforo · ok / atenção / risco
• auth    : magic link + cross-tab handoff (nonce)</code></pre>
    </td>
    <td width="50%" valign="top">
      <pre lang="python"><code>class Plataforma:
    stack    = ["next 16.3 + react 19", "tailwind v4 · base ui",
                "supabase · 54 migrations · rls"]
    auth     = "implicit flow + login_handoffs (10min ttl)"
    surfaces = ["/demo public", "/f/[token]", "/assinar"]
    tests    = 156      # vitest, pure domain fns
    pwa      = True</code></pre>
    </td>
  </tr>
</table>

### ❯ badges

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.3-a2ca44?style=flat-square&logo=nextdotjs&logoColor=ffffff&labelColor=262626" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-a2ca44?style=flat-square&logo=react&logoColor=ffffff&labelColor=262626" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-RLS_%2B_storage-a2ca44?style=flat-square&logo=supabase&logoColor=ffffff&labelColor=262626" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-a2ca44?style=flat-square&logo=tailwindcss&logoColor=ffffff&labelColor=262626" alt="Tailwind" />
  <img src="https://img.shields.io/badge/pnpm-11.3-a2ca44?style=flat-square&logo=pnpm&logoColor=ffffff&labelColor=262626" alt="pnpm" />
  <img src="https://img.shields.io/badge/tests-156_pass-ffd531?style=flat-square&labelColor=262626" alt="tests" />
  <img src="https://img.shields.io/badge/deploy-vercel-262626?style=flat-square&logo=vercel&logoColor=ffffff&labelColor=f1f2ec" alt="Vercel" />
</p>

---

### ❯ o_que_e

The operating platform behind Instituto Realiza.vc's **Programa de Mentoria Social**. Each volunteer mentor is matched with a mentorado for a cycle of 16 meetings; the app tracks whether pairs actually meet, what was agreed, and which pairs need attention, so the coordination team acts on a semaphore instead of chasing spreadsheets.

Not a generic CRM: the screens mirror the program guides (DPP). The weekly follow-up form, the closing checklist, the WhatsApp nudges and the expert-mentor track all exist because the guides say so.

---

### ❯ dominio

<div align="center">
  <img src="./docs/dominio.svg?v=1" alt="Domain: dupla, ciclo, registros, semáforo, RLS scope" width="100%"/>
</div>

- `dupla`: mentor ↔ mentorado, formed on the matching board (availability grid, affinity, under-18 warning).
- `ciclo_eventos`: official calendar, 16 meetings always on Tuesdays. The semaphore compares meetings expected by today against meetings marked `realizado`.
- `encontros` / `registros`: the pair schedules its own meetings (`unique(dupla_id, numero)`); after each one the mentor files the weekly follow-up (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`) plus combinados and file attachments.
- `semáforo`: `risco` on support request, low rating + reported difficulty, or ≥2 overdue meetings; `atencao` on one overdue meeting, low rating, pending follow-up or overdue encaminhamento.
- `trilha` do mentor_especialista: a 5-step request track (request → board → atomic accept) with a 3-month deadline.
- `encerramento`: closing checklist per pair plus a print-friendly journey summary on the dupla page.

---

### ❯ papeis_e_escopo

All reads and writes are scoped by Postgres RLS through `my_role()` / `my_profile_id()`:

| papel | escopo |
|---|---|
| `coordenacao` | full access: pairs, people, forms, signatures, matching, exports |
| `supervisor` | reads supervised pairs, files supervisões |
| `mentor` | writes only on the own dupla: agenda, registros, attachments |
| `mentor_especialista` | own dupla + the expert trilha (request/accept flow) |
| público | `/demo`, `/f/[token]` forms, `/assinar/[token]` guardian signature, `/privacidade` |

Signup is allowlist-only (migration `0045`): an e-mail only logs in if the coordination pre-registered it in `profiles`. Sensitive fields (`*_pessoal`, `dados_civis`) are coord-only.

---

### ❯ features

- The **forms engine** lets the coordination build forms (8 field types) and issue per-person token links; the public answers at `/f/[token]` with no account. Official program forms (Anamnese Social, Avaliação 360º, Autoavaliação) ship immutable (`sistema=true`), and a 360º answer checks the closing checklist by itself.
- **Electronic signature** of terms: versioned documents, CPF validation with check digits, IP + user-agent + SHA-256 hash, and an evidence page embedded in the generated PDF (pdf-lib). Guardians sign through a public single-use link at `/assinar/[token]`, reissuable from the person page.
- **Magic-link handoff**: auth uses the implicit flow plus a nonce (`?h=`). The link lands on `/auth/link`, posts the session into `login_handoffs` via RPC, and the tab that requested it polls the handoff back (single-use, 10-minute TTL). Login survives the e-mail opening in a different browser than the one that asked.
- **Demo mode**: `/demo` runs without login: a `demo_role` cookie, a fake supabase-js client (`src/lib/demo/client-stub.ts`) and an evergreen dataset whose dates derive from `new Date()`.
- **WhatsApp nudges**: `wa.me` deep links with pt-BR message templates for late follow-ups and meeting reminders (`src/lib/whatsapp-msgs.ts`).
- **PWA**: installable manifest, maskable icons, self-hosted Mitr + JetBrains Mono via `next/font`.
- **Private media**: `materiais` and `registro-anexos` buckets served through signed URLs (300s) from scoped route handlers (`/api/material/[id]`, `/api/anexo/[id]`).

---

### ❯ arquitetura

- `src/lib/queries.ts` — server-side reads with `React.cache` + `auth.getClaims()` (local JWT validation, no network round-trip).
- `src/lib/actions.ts` — server actions return `{ error }` or `{ ok }`, never throw.
- `src/lib/ciclo.ts` — pure domain: semaphore (`saudadeDaDupla`), enum labels, date math, `waLink`.
- `src/lib/supabase/{server,client,middleware}.ts` — one client per context; middleware protects everything except `/login`, `/auth/*` and the public token routes.
- 54 SQL migrations, RLS-first; guarded writes go through RPCs (delete is coord-only, `realizado` is immutable, signup is allowlisted).
- CSP + `frame-ancestors 'none'` in `next.config.ts` so `/f/[token]` and `/assinar/[token]` can never be iframed into a phishing page.

---

### ❯ stack

| layer | tech |
|---|---|
| app | Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript |
| ui | Tailwind v4 · shadcn + Base UI · Phosphor Icons · motion 13 · sonner |
| data | Supabase (Postgres + Auth + Storage + RPC) · 54 migrations |
| docs | pdf-lib · Resend (transactional e-mail) |
| tooling | pnpm 11.3 · Vitest 5 · Vercel |

---

### ❯ quickstart

```bash
pnpm i

# .env.local — remote Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

pnpm dev    # http://localhost:3000 · public demo at /demo
```

Only e-mails pre-registered in `profiles` can log in (allowlist). To look around without an account, open `/demo` and pick a role on the demo bar.

---

### ❯ testes

```bash
pnpm test    # vitest run → 156 tests, 10 files, ~400ms
```

All pure domain functions: semaphore rules (`ciclo-semaforo`), scheduling and week math (`ciclo-agendamento`, `ciclo-semana`), formatting (`ciclo-formatacao`), closing checklist (`encerramento`), form schemas (`forms-schema`), intake CSV import (`importar`).

---

### ❯ estrutura

<pre lang="text"><code>src/app/(app)/       authenticated shell — agenda, duplas, pessoas, registros,
                     formularios, materiais, perfil, assinar
src/app/auth/        link landing, handoff confirm, definir-senha
src/app/{demo,f,assinar,login,privacidade}/
                     public surfaces (no session required)
src/app/api/         signed downloads, CSV export, nudge log
src/lib/             queries · actions · ciclo (domain) · demo/ · forms/ · documentos/
supabase/migrations/ 0001–0055 · RLS-first
tests/               156 unit tests over pure functions</code></pre>

---

### ❯ docs

`docs/README.pt-BR.md` · `AGENTS.md` (operating rules + live domain state) · `BACKLOG.md` (prioritized roadmap) · `docs/plano-mestre.md`, `docs/roteiro-demo.md` · `docs/fontes/` (official program guides, pt-BR).
