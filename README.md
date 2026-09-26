<div align="center">
  <a href="#root"><img src="./docs/banner.svg?v=2" alt="realiza.vc · operating panel for a social mentoring program" width="100%"/></a>
</div>

> 🇧🇷 [Versão em Português](docs/README.pt-BR.md) · the product, UI and data are pt-BR; this file is in English for reach.

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.3-a2ca44?style=flat-square&logo=nextdotjs&logoColor=ffffff&labelColor=262626" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-a2ca44?style=flat-square&logo=react&logoColor=ffffff&labelColor=262626" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-RLS_%2B_storage-a2ca44?style=flat-square&logo=supabase&logoColor=ffffff&labelColor=262626" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-a2ca44?style=flat-square&logo=tailwindcss&logoColor=ffffff&labelColor=262626" alt="Tailwind" />
  <img src="https://img.shields.io/badge/tests-156_pass-ffd531?style=flat-square&labelColor=262626" alt="tests" />
</p>

## What this is

Instituto Realiza.vc runs a social mentoring program: each volunteer mentor is paired with one mentorado for a structured cycle guided by the program's official guides (DPP). This repository is the panel the coordination team runs it on.

The unit of work is the `dupla`, a mentor + mentorado pair. The system covers its whole life: a matching board where pairs are formed, a 16-meeting journey on the official calendar, the weekly follow-up the mentor files after each meeting, a health semaphore recomputed on every read, e-signed terms, answer-by-link public forms, supervision records, and a demo mode at `/demo` that needs no login.

## Roles and access

Every read and write is scoped by Postgres RLS through `my_role()` / `my_profile_id()`:

| role | scope |
|---|---|
| `coordenacao` | everything: pairs, people, matching, forms, signatures, exports |
| `supervisor` | reads the pairs it supervises, files supervision sessions |
| `mentor_dpp` | writes only on its own pair: schedule, follow-ups, attachments |
| `mentor_especialista` | own pair plus the expert track (request → board → atomic accept) |
| public | `/demo`, `/f/[token]` form answers, `/assinar/[token]` guardian signature, `/privacidade` |

Signup is allowlist-only (migration `0045`): an e-mail logs in only if coordination pre-registered it in `profiles`. Sensitive fields (`*_pessoal`, `dados_civis`) are coord-only.

## Pair lifecycle

1. **Intake.** Coordination pre-registers mentors and mentorados (a CSV importer exists for the intake spreadsheet). Nobody signs themselves up.
2. **Matching.** The board crosses each side's availability grid and affinity; a mentorado under 18 flags the need for a guardian signature.
3. **Active pair.** The pair books its own meetings inside the official calendar. Coordination does not schedule for them; it watches the semaphore and nudges through `wa.me` deep links with ready pt-BR messages.
4. **Closing.** A checklist covers the closing rite, the mentor's self-assessment lands by RPC, and the pair page prints a journey summary.

`dupla.status` walks `ativa → pausada → concluida | encerrada`. In parallel with the DPP track, a pair can run the `mentor_especialista` track: 5 meetings with no fixed dates, a 3-month deadline, and a PDM write-back when it closes.

## The 16-meeting journey

`ciclo_eventos` is the official calendar: 16 meetings, always on Tuesdays, with phase names and suggested instruments per meeting. The pair books each meeting itself (`unique(dupla_id, numero)`); after it happens, the mentor files the weekly follow-up (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`, combinados, attachments).

`jornadaDaDupla` (`src/lib/ciclo.ts`) turns that into a per-pair track where each node is in one of six states: done with follow-up, done pending follow-up, scheduled-but-past (limbo), scheduled, didn't happen, future. Milestones sit at the 1st, 8th (half), 13th (final stretch) and 16th meetings.

## The semaphore

`saudadeDaDupla` computes pair health on every read; nothing is persisted. Inputs: the pair's meetings and follow-ups, pending combinados, pair status and start date, and the official calendar. Expected meetings are calendar dates already past since the pair started, minus any covered by limbo; `atraso = expected - done`.

The first matching signal sets the color:

| color | fires when |
|---|---|
| `risco` | a follow-up flagged `precisa_apoio` while the pair is active or paused · `avaliacao` "baixa" plus a reported `dificuldade` on the latest follow-up · 2+ meetings behind |
| `atencao` | exactly 1 meeting behind · baixa or dificuldade alone · this week's official meeting is ≤5 days away and nothing is scheduled (preventive) · a done meeting went 24h+ without its follow-up, or a scheduled date passed unconfirmed (limbo) · an overdue combinado (`encaminhamento` past `prazo`) |
| `ok` | no signal matched. Paused, finished and closed pairs freeze at `ok`, but a support request still breaks through a pause |

The specialist track has no official calendar, so it can never be "behind": its semaphore reads only the pair's own signals. The priority order above is what `tests/ciclo-semaforo.test.ts` pins down (29 tests).

## Public surfaces

| route | what it does |
|---|---|
| `/demo` | the whole app on a fake dataset, no account |
| `/f/[token]` | answer a form through a per-person link, no login |
| `/assinar/[token]` | guardian signs a term through a single-use link |
| `/privacidade` | privacy notice |

The forms engine lets coordination build questionnaires (8 field types, up to 40 questions) and issue per-person token links; this is the channel that reaches the mentorado. The official program forms (Anamnese, Avaliação 360º, Autoavaliação) ship as immutable system forms, and a 360º answer ticks the closing checklist by itself.

Terms are versioned documents signed with CPF check digits, IP + user-agent + SHA-256 evidence, and a generated PDF (pdf-lib). `termo_ok` derives from the signature row; civil data lives in `dados_civis` (coord-only) and syncs back into the document when signed. CSP sets `frame-ancestors 'none'` so these public routes can't be iframed into a phishing page.

## Demo mode

<div align="center">
  <img src="./docs/demo.svg?v=2" alt="Public demo mode at /demo" width="720"/>
</div>

`/demo` runs the app without an account. A `demo_role` cookie picks one of the 4 personas, the real queries switch to an evergreen dataset (`src/lib/demo/data.ts`, dates derived from `new Date()`) that replicates each role's RLS scope, a stub supabase client answers the browser (`client-stub.ts`), and every mutation returns `DEMO_MSG` instead of writing. Each persona sees its own onboarding wizard once per visit.

## Auth

Magic link on the implicit flow plus a cross-tab handoff: the request mints a nonce, the mailed link lands on `/auth/link`, that tab publishes the session into `login_handoffs` (single-use, 10-minute TTL), and the tab that asked polls the handoff back. Login survives the e-mail opening in a different browser than the one that requested it.

## Architecture

- `src/lib/queries.ts`: server-side reads with `React.cache` + `auth.getClaims()` (local JWT validation, no round-trip).
- `src/lib/actions.ts`: server actions return `{ error }` or `{ ok }`, never throw.
- `src/lib/ciclo.ts`: pure domain (semaphore, journey, enum labels, date math, `waLink`), shared by app, demo dataset and tests.
- `src/lib/supabase/{server,client,middleware}.ts`: one client per context; middleware protects everything except `/login`, `/auth/*` and the public token routes.
- 54 SQL migrations, RLS-first; guarded writes go through RPCs (delete is coord-only, `realizado` is immutable, signup is allowlisted).
- Private buckets (`materiais`, `registro-anexos`) are served through signed URLs (300s) from scoped route handlers (`/api/material/[id]`, `/api/anexo/[id]`).

## Stack

| layer | tech |
|---|---|
| app | Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript |
| ui | Tailwind v4 · Base UI + shadcn · Phosphor Icons · motion 13 · sonner |
| data | Supabase (Postgres + Auth + Storage + RPC) · 54 migrations |
| docs | pdf-lib · Resend (transactional e-mail) |
| tooling | pnpm 11.3 · Vitest 5 · Vercel |

## Structure

```text
src/app/(app)/       authenticated shell: home, agenda, duplas, pessoas,
                     registros, formularios, materiais, perfil, assinar
src/app/auth/        magic-link landing, handoff confirm, set-password
src/app/{demo,f,assinar,login,privacidade}/
                     public surfaces (no session required)
src/app/api/         signed downloads, CSV export, nudge log
src/lib/             queries · actions · ciclo (domain) · demo/ · forms/ · documentos/
supabase/migrations/ 0001-0055 · RLS-first
tests/               156 unit tests over pure functions
```

## Setup

```bash
pnpm i

# .env.local points at the remote Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

pnpm dev      # http://localhost:3000 · public demo at /demo
pnpm test     # vitest run → 156 tests, 10 files
npx tsc --noEmit && npx eslint src/
```

Only e-mails pre-registered in `profiles` can log in. To look around without an account, open `/demo` and pick a role on the demo bar.

## Docs

`docs/README.pt-BR.md` · `AGENTS.md` (operating rules + live domain state) · `BACKLOG.md` (prioritized roadmap) · `docs/plano-mestre.md`, `docs/roteiro-demo.md` · `docs/fontes/` (official program guides, pt-BR).
