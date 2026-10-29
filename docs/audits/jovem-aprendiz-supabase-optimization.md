# Optimization Checklist — "Gestão de Jovem Aprendiz" (Supabase backend)

**App:** https://jovemaprendiz.realiza.vc (Next.js + Supabase PostgREST/Auth/Storage)
**Audit basis:** observables only (no source access). Cron `email-drain` @ 1/min; `email_log`: 1431 `delivery_delayed`, 258 bounced / 3336; DB recently stuck in `RESTARTING` due to bloat.
**Scope:** app-side + ops/DB-side. Realiza.vc (mentoria) repo referenced only as a **model** of good patterns, not as this app.

> Note: realizavc is a different app. Patterns borrowed from it below are explicitly labeled (model).

---

## 0. Executive summary

The DB going `RESTARTING` is almost certainly a combination of (a) connection exhaustion / bloat from unbounded or repeated selects on a free/low tier, (b) a per-minute cron doing small writes that accumulate dead tuples, and (c) an email pipeline generating retry storms. The fix is not one change: it's a set of independent levers — pooler, pagination/select discipline, cron batching/backoff, caching of static catalogs, and DB hygiene (VACUUM/autovacuum + PITR). None of these require knowing the app's exact schema; they are mechanical.

Estimated total effort: **~3–5 dev-days app code + ~1 day ops**, split across 4 sprints. Start with the critical items (pooler, cron, PITR, VACUUM) — those alone should stop the restarts.

---

## 1. Connection handling (CRITICAL)

### Observed risk
- Vercel serverless functions (and any edge runtime) open a fresh Postgres connection per invocation. Direct connections to Supabase (`db.<ref>.supabase.co:5432`) exhaust the small connection budget on free/low tiers and are the #1 cause of "database is restarting / connection refused" on Supabase.
- Realiza.vc (model) uses `@supabase/ssr` + `@supabase/supabase-js` clients pointed at `NEXT_PUBLIC_SUPABASE_URL` (the REST/Auth/Storage endpoint), which already goes through Supabase's gateway — **not** direct Postgres. That's the correct shape. The jovem app must not be using a raw `pg`/Prisma client with a direct `DATABASE_URL`.

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 1.1 | Verify `NEXT_PUBLIC_SUPABASE_URL` (and any `SUPABASE_URL`/`DATABASE_URL`) points at the **REST endpoint** (`https://<ref>.supabase.co`), never at `db.<ref>.supabase.co`. | Ops/Config | 0.5h | Critical |
| 1.2 | If the app uses a direct Postgres driver (Prisma/Drizzle/`pg`) for anything, **switch to Supavisor transaction-mode pooler**: host `aws-0-<region>.pooler.supabase.com`, port **6543**, user `postgres.<ref>`. Set `?pgbouncer=true` for Prisma. | Code+Ops | 0.5–1d | Critical |
| 1.3 | Never create a Supabase client per request inside hot paths; reuse a singleton per runtime (module scope) for the service-role client used by crons. Realiza.vc instantiates clients inside request scope via `cookies()` (required for RLS) but the cron/service client should be a module singleton. | Code | 0.5d | High |
| 1.4 | Disable `autoRefreshToken` on server-side/service clients; they don't need session refresh. | Code | 0.25h | Medium |
| 1.5 | Confirm Vercel function region matches the Supabase region (latency + connection setup cost). | Ops | 0.25h | Medium |

### Verification
- `select count(*) from pg_stat_activity;` during a traffic spike should stay well under the tier limit (free tier ≈ 60 direct / 200 pooled).
- No `ECONNRESET`/`remaining connection slots reserved` in Sentry/logs.

---

## 2. Query patterns that cause bloat (HIGH)

Without source, audit by symptoms. The DB bloat + restart strongly suggests several of these. Each is a concrete code change.

### 2.1 Unbounded `select("*")` / unpaginated lists
- Any list endpoint (alunos, turmas, registros, email_log) that does `select("*")` without `.limit()`/`.range()` pulls the whole table on every render. On a growing `email_log` (3336+ rows) this is fatal.
- **Action:** paginate every list with `.range(from, to)` + `{ count: "exact", head: true }` for totals; never `select("*")` — enumerate columns (realiza.vc does this explicitly because column grants break `*`).
- **Effort:** 1–2d. **Priority:** High.

### 2.2 N+1 in server components / route handlers
- Nested loops issuing one query per row (e.g., for each aluno fetch turma, mentor, registros). Realiza.vc avoids this by using PostgREST embeds (`duplas(... mentor:profiles(...), mentorado:mentorados(...))`) in a single select.
- **Action:** collapse N+1 into embedded selects or RPCs; use `Promise.all` for independent reads (realiza.vc pattern in `getMe`).
- **Effort:** 1–2d. **Priority:** High.

### 2.3 Heavy nested embeds on hot paths
- `DUPLA_SELECT`-style mega-joins (dupla → encontros → registros → autor) are expensive and re-run per page. Cache them.
- **Action:** split "list" (light columns) from "detail" (full embed); never fetch full tree for a list view.
- **Effort:** 1d. **Priority:** Medium.

### 2.4 Repeated identical reads within a request
- Realiza.vc wraps every read in `React.cache(...)` so a render tree calling `getMe()` 5 times hits the DB once. Without this, a single page can issue 10–30 duplicate queries.
- **Action:** wrap server-side reads in `React.cache` (or a request-scoped memo). **Priority:** High. **Effort:** 0.5d.

### 2.5 `select("*")` on wide tables / jsonb
- `select("*")` on tables with jsonb/text blobs (form responses, email bodies) multiplies payload and memory. Enumerate columns.
- **Effort:** 0.5d. **Priority:** Medium.

### 2.6 Writes that trigger bloat
- Per-minute cron doing `insert`/`update` on `email_log` without batching → dead tuples accumulate; autovacuum can't keep up on free tier.
- **Action:** batch inserts (single multi-row insert), avoid per-row updates for status flips where a single `update ... where id in (...)` works; see §3.
- **Effort:** 0.5d. **Priority:** High.

### 2.7 Missing indexes on filter columns
- Filters like `status`, `created_at`, `recipient`, `turma_id` need indexes; otherwise each cron scan is a seq scan that bloats I/O.
- **Action (DB):** `EXPLAIN (ANALYZE, BUFFERS)` the cron's query; add indexes on the columns used in `.eq()`/`.in()`/`.gte()`/`.order()`. Use partial indexes for "pending" rows (`where status = 'pending'`).
- **Effort:** 0.5d. **Priority:** High.

---

## 3. Email pipeline (CRITICAL — the cron)

### Observed
- `email-drain` hits `https://jovemaprendiz.realiza.vc/api/public/email/drain` **every minute**.
- `email_log`: 1431 `delivery_delayed`, 258 bounced / 3336. `delivery_delayed` is Resend's webhook status for messages that took too long / were deferred — usually a sign of: sending to invalid/old addresses, hitting Resend rate limits, or a retry storm re-sending the same messages.

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 3.1 | **Make drain idempotent + batched.** Fetch a bounded batch (e.g., 50–100) of `pending` rows with `FOR UPDATE SKIP LOCKED`, send via Resend `batch.send` (max 100/call, as realiza.vc does), mark `sent`/`failed` in one update. Never one email per invocation. | Code | 1d | Critical |
| 3.2 | **Retry with exponential backoff**, not immediate re-drain. Add `attempts`, `next_attempt_at`, `last_error`. On failure: `next_attempt_at = now() + 2^attempts minutes` (cap 6h). Drain only picks rows where `next_attempt_at <= now()`. After N attempts (e.g., 5), move to `dead` (no more retries) — prevents infinite retry storms. | Code+DB | 1d | Critical |
| 3.3 | **Dedup before sending.** `delivery_delayed` often means the same address gets re-queued. Add a unique constraint on `(recipient, template, logical_key)` or a `dedup_key` column; upsert with `on conflict do nothing`. | DB+Code | 0.5d | High |
| 3.4 | **Validate addresses before enqueue.** Reject malformed/role addresses (`noreply@`, `postmaster@`) at enqueue; verify domain MX optionally. Bounces (258) are expensive. | Code | 0.5d | Medium |
| 3.5 | **Stop draining every minute when idle.** If the last run found 0 pending rows, back off to every 5 min (or use a Vercel cron at 5 min). Or gate: only run if `count(pending) > 0`. Per-minute crons on a sleeping DB keep it awake and contribute to restart pressure. | Config | 0.25h | High |
| 3.6 | **Clean up `email_log`.** Add retention: delete rows older than 30–90 days (or archive to cold storage). 3336 rows today × daily growth will bloat. Run as a weekly job, not per-minute. | DB+Code | 0.5d | High |
| 3.7 | **Handle Resend webhooks.** Implement `/api/webhooks/resend` to receive `delivered`/`bounced`/`complained`/`delayed` and update `email_log.status` + set address as `suppressed` on bounce/complaint. Without this, `delivery_delayed` stays forever and retries never learn. | Code | 1d | High |
| 3.8 | **Suppress list.** Maintain a `email_suppressions (address, reason, created_at)` table; check before enqueue and before send. This alone cuts bounces. | DB+Code | 0.5d | High |
| 3.9 | **Rate-limit the drain endpoint.** It's public (`/api/public/...`). Require a bearer `CRON_SECRET` (realiza.vc pattern: `autorizarCron` → 401 JSON, never redirect) so random traffic can't trigger it. Add IP allowlist / Vercel cron only. | Code | 0.25d | Critical |
| 3.10 | **Circuit breaker on Resend.** If Resend returns 429/5xx for 3 consecutive batches, stop draining for 10 min and alert. Prevents hammering a degraded provider. | Code | 0.5d | Medium |
| 3.11 | **Investigate `delivery_delayed` root cause.** Check Resend dashboard: is it a single domain? A single recipient domain with greylisting? SPF/DKIM/DMARC misconfig causes deferrals. Verify DNS records for the sending domain. | Ops | 0.5d | High |

### Why `delivery_delayed` specifically
Resend's `email.delayed` event fires when a message is deferred by the receiving MTA (greylisting, rate limit, reputation). 1431/3336 (43%) is very high — typical healthy is <2%. Likely causes: (i) sending from a domain with incomplete SPF/DKIM, (ii) high volume to a single provider (Gmail/Outlook) triggering temp-fails, (iii) retrying the same deferred message every minute without backoff (each retry is another deferral). Fixing backoff + suppression + DNS usually drops this under 5%.

---

## 4. Caching (MEDIUM-HIGH)

### What to cache (static-ish catalogs)
- `calendario` / `turmas` / `componentes curriculares` / `disciplinas` / `series` — change rarely. Cache with a TTL (e.g., 5 min) or invalidate on admin write.
- Realiza.vc uses `React.cache` for per-request dedup + relies on RLS. For cross-request caching in Next.js, use `unstable_cache` (tagged) or a small in-memory/Redis cache.
- Auth-derived per-user data (profile, role) → `React.cache` per request (model).

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 4.1 | Wrap catalog reads in `unstable_cache(fn, key, { revalidate: 300, tags })` and invalidate tags on admin writes. | Code | 0.5–1d | High |
| 4.2 | Add `Cache-Control` / `revalidate` to public read endpoints (catalogs) so Vercel edge caches them. | Code | 0.25d | Medium |
| 4.3 | Don't cache user-scoped or RLS-scoped data in a shared cache without the user key in the cache key — security bug. | Code (review) | 0.25d | High |
| 4.4 | Cache `email_log` counts/aggregates, not the raw table. | Code | 0.25d | Low |

---

## 5. Error handling & resilience (MEDIUM)

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 5.1 | Server actions return `{ error }` / `{ ok }`, never throw, and the UI degrades gracefully (realiza.vc convention). Wrap all Supabase calls; on error log + return error. | Code | 1d | High |
| 5.2 | Distinguish **transient** (timeout, 5xx, connection reset) vs **permanent** (4xx, RLS denial) errors. Retry only transient, with jitter. | Code | 0.5d | Medium |
| 5.3 | Add request timeouts to Supabase calls (e.g., 10s) so a slow DB can't hang a serverless function until its 60s maxDuration. | Code | 0.25d | High |
| 5.4 | Graceful degradation: if a non-critical read fails (notifications, comunicados), render the page without that section (realiza.vc does this — returns `[]` with `console.error`). | Code | 0.5d | Medium |
| 5.5 | Circuit breaker around the DB: if 5 consecutive failures, return cached/stale or a friendly error page for 30s instead of hammering. | Code | 0.5d | Low |
| 5.6 | Sentry (or equivalent) with PII scrubbing on tokens/emails in URLs (realiza.vc uses `sentry-scrub.ts`); enable `onRequestError` in `instrumentation.ts`. | Code+Ops | 0.5d | Medium |

---

## 6. Monitoring & alerting (MEDIUM)

### What to monitor
- **DB:** size, bloat (`pg_stat_user_tables.n_dead_tup`), autovacuum lag, connection count (`pg_stat_activity`), slow queries (`pg_stat_statements`), replication lag if any.
- **Cron:** drain success rate, batch size, duration, failures; alert if 2 consecutive failures or if pending queue grows > threshold for >15 min.
- **Email:** delivery rate, `delivery_delayed` %, bounce %, complaint %; alert if delayed % > 10% or bounce % > 2% over 1h.
- **App:** p95 latency of server actions and page loads, 5xx rate, Supabase error rate.
- **Infra:** Vercel function duration/cold starts, Supabase project status (restarts).

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 6.1 | Enable Supabase **Database Webhooks / Log Drains** to a sink (Datadog/Grafana/Loki) or at least the built-in Logs Explorer. | Ops | 0.5d | Medium |
| 6.2 | Add a `/api/health` endpoint that runs `select 1` + checks pending email queue size; wire to an uptime monitor (UptimeRobot/BetterStack) every 1 min. | Code+Ops | 0.25d | Medium |
| 6.3 | Alert on DB size growth > X%/day and on `n_dead_tup` > threshold (autovacuum not keeping up). | Ops | 0.5d | High |
| 6.4 | Track email metrics in a small `email_metrics_daily` aggregate (sent, delayed, bounced) to make trends visible. | Code+DB | 0.5d | Low |

---

## 7. Backup / PITR (CRITICAL — ops)

- Supabase free tier has **no PITR** and only daily backups with 7-day retention. A bloat-induced restart that corrupts data is unrecoverable beyond 7 days.
- **Action:** upgrade the project to at least the Pro plan to enable **Point-in-Time Recovery** (PITR) with a recovery window (e.g., 7 days). This is the single most important ops change for a production app with real users.
- Also: schedule a weekly `pg_dump` to external storage (S3) as a belt-and-suspenders backup, and test restore quarterly.
- **Effort:** 0.5d ops + plan cost. **Priority:** Critical.

---

## 8. Rate limiting / abuse protection (HIGH)

Public endpoints (`/api/public/email/drain`, auth, forms) are abuse targets.

### Recommendations
| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 8.1 | Protect `/api/public/email/drain` with `CRON_SECRET` bearer (see 3.9) — it should not be callable by the public at all. | Code | 0.25d | Critical |
| 8.2 | Rate-limit auth endpoints (magic link / OTP / password) per IP and per email (e.g., 5 req / 15 min). Supabase has built-in rate limits but they're coarse; add an edge middleware or use Upstash/Vercel KV. | Code+Ops | 0.5d | High |
| 8.3 | Rate-limit public form submission endpoints (if any) per IP + honeypot field. | Code | 0.25d | Medium |
| 8.4 | Add a global middleware rate limit on `/api/*` (e.g., 100 req/min/IP) as a baseline. | Code | 0.25d | Medium |
| 8.5 | Ensure Supabase RLS is enabled on **every** table and that anon has no write grants except where intended. Audit with `select * from pg_tables where rowsecurity = false`. | DB | 0.5d | Critical |
| 8.6 | Disable unused Supabase features (Realtime, Storage) if not used, to reduce attack surface and connection load. | Ops | 0.25h | Low |

---

## 9. DB hygiene (the bloat itself) (CRITICAL — ops)

The restart was caused by bloat; fixing code alone won't reclaim space.

| # | Action | Type | Effort | Priority |
|---|--------|------|--------|----------|
| 9.1 | Run `VACUUM (FULL, ANALYZE)` on the largest tables during a maintenance window (this rewrites the table and reclaims disk; takes locks — schedule off-hours). | Ops/DB | 0.5d | Critical |
| 9.2 | Tune autovacuum for high-churn tables (`email_log`, `sessions`, logs): lower `autovacuum_vacuum_scale_factor` (e.g., 0.05) and `autovacuum_vacuum_threshold`. | DB | 0.25d | High |
| 9.3 | Set per-table `fillfactor` lower (e.g., 80) on hot update tables to reduce page splits. | DB | 0.25d | Medium |
| 9.4 | Add a weekly `REINDEX` / bloat check job. Supabase provides `pg_stat_user_tables` — alert on `n_dead_tup > 20% of n_live_tup`. | Ops | 0.5d | Medium |
| 9.5 | Check for long-running transactions / idle-in-transaction sessions (`pg_stat_activity` where `state = 'idle in transaction'`) — these block VACUUM. Kill them. | Ops | 0.25h | High |
| 9.6 | Review table sizes: `select schemaname, relname, pg_size_pretty(pg_total_relation_size(...))`. Drop unused indexes (each index adds write bloat). | DB | 0.5d | Medium |

---

## 10. Suggested rollout order

**Sprint 1 (stop the bleeding, ~1 day):**
1.1 pooler/URL verification · 3.9 drain auth · 8.5 RLS audit · 9.1 VACUUM FULL · 7.1 enable PITR · 3.5 cron cadence.

**Sprint 2 (email + query discipline, ~2 days):**
3.1/3.2 batch + backoff · 3.7 webhooks · 3.6 retention · 2.1 pagination · 2.4 React.cache · 2.7 indexes.

**Sprint 3 (resilience + cache, ~1.5 days):**
4.1 catalog caching · 5.1/5.3 error handling + timeouts · 3.3/3.8 dedup + suppressions · 3.11 DNS/Resend investigation.

**Sprint 4 (observability + polish, ~1 day):**
6.1/6.2/6.3 monitoring · 8.2/8.4 rate limits · 9.2/9.4 autovacuum tuning · 5.6 Sentry.

---

## 11. What requires app code vs. ops/DB

| Area | Code | Ops/DB |
|------|------|--------|
| Connection pooler | Possibly (if direct driver) | URL/config change |
| Query pagination/N+1/cache | Yes | Indexes |
| Email drain batching/backoff/webhooks/suppressions | Yes | Retention job |
| Catalog caching | Yes | — |
| Error handling/timeouts/circuit breaker | Yes | — |
| Monitoring/alerts | Endpoint | Dashboards/alerts |
| PITR/backups | — | Plan upgrade + cron |
| Rate limiting | Middleware | KV/edge config |
| DB hygiene (VACUUM/autovacuum) | — | DBA window |

---

## 12. Open questions (need source access to confirm)

1. Is the app using a direct Postgres driver anywhere, or only `@supabase/supabase-js`? (Determines §1 urgency.)
2. What does `email-drain` actually do — does it read `email_log` and call Resend, or enqueue from another table? (Determines §3 scope.)
3. Are lists paginated today, or `select("*")` unbounded? (Determines §2 urgency.)
4. Is there any caching layer (Redis/Upstash) already? (Determines §4 approach.)
5. Supabase plan tier and region? (Determines §7 and §1.5.)

If source access is granted later, re-run this audit against the actual code; the checklist above is the hypothesis list to verify first.

---

## Appendix A — model patterns borrowed from realizavc (mentoria, different app)

- **Server reads wrapped in `React.cache`** (`src/lib/queries.ts`) — per-request dedup; mandatory for any Next.js + Supabase app to avoid N×duplicate queries.
- **Server actions return `{ error }`/`{ ok }`, never throw** (`src/lib/actions.ts`) — lets the UI degrade.
- **Cron auth via bearer `CRON_SECRET`**, returning 401 JSON (never redirect), because `/api/jobs/*` is public in middleware (`src/lib/supabase/middleware.ts`, `src/app/api/jobs/tick/route.ts`).
- **Jobs run sequentially, not in parallel**, to avoid bursting a free-tier DB (`src/app/api/jobs/tick/route.ts`).
- **Email via Resend `batch.send` (max 100/call)** with `batchValidation: "permissive"` (`src/lib/email.ts`).
- **Explicit column lists** instead of `select("*")` — both for performance and because column grants break `*`.
- **`getClaims()` instead of `getUser()`** — validates JWT locally, no round-trip (`src/lib/queries.ts`).
- **Graceful degradation**: non-critical reads return `[]` + `console.error` instead of throwing (`getNotificacoes`, `getComunicados`).
- **Sentry scrubbing** of tokens/emails in URLs (`src/lib/sentry-scrub.ts` pattern).

These are recommendations to port, not code to copy verbatim (different domain/schema).
