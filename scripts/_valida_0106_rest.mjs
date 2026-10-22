// valida 0106 (resumo_acessos, REALIZA-183) contra o stack local
// (kong :54321) com logins GoTrue reais + service key — mesmo pipeline da
// app (RLS + grants de verdade). Só roda no stack local / staging manual —
// não entra no CI automatizado (não há job que suba o stack; os demais
// _valida_*_rest seguem a mesma convenção: `supabase start` + node).
// uso: node scripts/_valida_0106_rest.mjs
//
// personas:
//   coordenacao e2e   e2e-coord@realiza.test
//   mentor            mentor@realiza.test
//   service/anon      apikeys do stack — `supabase status`
//                     (ou envs PGRST_URL/PGRST_ANON_KEY/PGRST_SERVICE_KEY)
//
// O QUE VALIDA (aceite §Segurança/RLS):
//   7) anon: GET e POST → erro de permissão (grant revogado)
//   8) mentor autenticado: GET → [] (policy coord-only devolve vazio)
//   9) coord: GET vê as rows; service role: insert → 201
//  10) update/delete por anon/mentor/coord → negado (append-only)

import { execSync } from "node:child_process";

let BASE = process.env.PGRST_URL;
let ANON_KEY = process.env.PGRST_ANON_KEY;
let SVC_KEY = process.env.PGRST_SERVICE_KEY;
if (!BASE || !ANON_KEY || !SVC_KEY) {
  const out = execSync("pnpm exec supabase status -o json", {
    encoding: "utf8",
  });
  const st = JSON.parse(out.slice(out.indexOf("{")));
  BASE ??= st.API_URL;
  ANON_KEY ??= st.PUBLISHABLE_KEY ?? st.ANON_KEY;
  SVC_KEY ??= st.SECRET_KEY ?? st.SERVICE_ROLE_KEY;
}

const SLUG = "valida-0106-x";
const SENHAS = ["realiza123", "e2e-senha-teste"]; // demo | e2e

let ok = 0, falhas = 0;
const check = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log(`  ok ${nome}`); }
  else { falhas++; console.log(`FALHA ${nome} ${extra}`); }
};

async function login(email) {
  for (const password of SENHAS) {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return (await res.json()).access_token;
  }
  throw new Error(`login falhou: ${email}`);
}

async function api(path, { method = "GET", token, key = ANON_KEY, body } = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const txt = await res.text();
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { status: res.status, data };
}

const svc = (p, o) => api(p, { ...o, key: SVC_KEY });
const as = (token) => (p, o) => api(p, { ...o, token });

const run = async () => {
  await svc(`resumo_acessos?slug=eq.${SLUG}`, { method: "DELETE" });

  const [coord, mentor] = await Promise.all([
    login("e2e-coord@realiza.test"),
    login("mentor@realiza.test"),
  ]);
  const coordApi = as(coord);
  const mentorApi = as(mentor);

  // ─── 7) anon sem grant nenhum ──────────────────────────────────────
  let r = await api(`resumo_acessos?select=id&limit=1`);
  check("anon GET negado", r.status === 401 || r.status === 403,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);
  r = await api("resumo_acessos", { method: "POST",
    body: { slug: SLUG, ip_hash: "a".repeat(64) } });
  check("anon POST negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);

  // ─── 9) service role insere (é o caminho do page.tsx) ──────────────
  r = await svc("resumo_acessos", { method: "POST", body: {
    slug: SLUG,
    ip_hash: "b".repeat(64),
    user_agent: "valida-0106/1.0",
    params: { turma: "T2", gran: "duplas", col: "mentor" },
  } });
  check("service insert 201", r.status === 201 && r.data?.[0]?.id,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  const row = r.data?.[0];
  check("insert sem ip grava null + params default",
    row?.params?.turma === "T2" && typeof row?.acessado_em === "string");
  r = await svc("resumo_acessos", { method: "POST",
    body: { slug: SLUG } });
  check("insert mínimo (só slug) usa defaults", r.status === 201 &&
    r.data?.[0]?.ip_hash === null && r.data?.[0]?.params != null,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

  // ─── 8) mentor autenticado: select concede, RLS esvazia ────────────
  r = await mentorApi(`resumo_acessos?select=*`);
  check("mentor GET devolve [] (policy coord-only)",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);
  r = await mentorApi("resumo_acessos", { method: "POST",
    body: { slug: SLUG, ip_hash: "c".repeat(64) } });
  check("mentor POST negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);

  // ─── 9) coord lê ──────────────────────────────────────────────────
  r = await coordApi(`resumo_acessos?slug=eq.${SLUG}&select=slug,ip_hash,user_agent,params`);
  check("coord GET vê as rows do slug",
    r.status === 200 && Array.isArray(r.data) && r.data.length >= 2 &&
    r.data[0].slug === SLUG && r.data[0].ip_hash?.length === 64,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

  // ─── 10) append-only: update/delete negados pra todo JWT ───────────
  const alvo = `resumo_acessos?slug=eq.${SLUG}`;
  r = await coordApi(alvo, { method: "PATCH", body: { slug: "outro" } });
  check("coord PATCH negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);
  r = await coordApi(alvo, { method: "DELETE" });
  check("coord DELETE negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);
  r = await mentorApi(alvo, { method: "PATCH", body: { slug: "outro" } });
  check("mentor PATCH negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);
  r = await api(alvo, { method: "PATCH", body: { slug: "outro" } });
  check("anon PATCH negado", r.status === 401 || r.status === 403,
    `status=${r.status}`);

  // slug gigante estoura o CHECK 1–120
  r = await svc("resumo_acessos", { method: "POST",
    body: { slug: "s".repeat(121) } });
  check("CHECK de slug rejeita >120c", r.status >= 400,
    `status=${r.status}`);

  await svc(`resumo_acessos?slug=eq.${SLUG}`, { method: "DELETE" });
};

await run().finally(() =>
  svc(`resumo_acessos?slug=eq.${SLUG}`, { method: "DELETE" }));
console.log(`\n${ok} ok · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
