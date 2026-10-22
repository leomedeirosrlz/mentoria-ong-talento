// valida 0111 (relatorio_links + turma_inscricoes, REALIZA-167) contra o
// stack local (kong :54321) — fixtures próprias via service key, mesmo
// pipeline da app (RLS + grants de verdade). Em staging roda também: o
// slug seed 't2-x7k4m9qf2w8j' é literal e existe nos dois ambientes; o
// backfill da fila T2 é por nome e simplesmente não resolve fora de prod.
// uso: node scripts/_valida_0111_rest.mjs
//
// personas/fixtures (tudo _v111-*, removido no fim):
//   profile fixture   _v111-mentor@realiza.test (pessoa da inscrição mentor)
//   mentorado fixture Mentorado V111            (pessoa da inscrição jovem)
//   logins reais      e2e-coord@realiza.test (coord: CRUD integral),
//                     e2e-mentor@realiza.test (mentor: lê [] nas duas)
//   service/anon      apikeys do stack — `supabase status`
//                     (ou envs PGRST_URL/PGRST_ANON_KEY/PGRST_SERVICE_KEY)
//
// O QUE VALIDA (acceptance.md):
//   1) grants: anon negado nas duas tabelas; coord lê relatorio_links e
//      vê o slug seed da T2; escrita em relatorio_links via REST por
//      authenticated negada (v1 é service/SQL — a 170 traz as RPCs)
//   2) RLS coord-only em turma_inscricoes: mentor lê [] e não insere
//   3) constraints: XOR das colunas de pessoa, coerência papel×coluna,
//      status inválido, duplicado (turma, pessoa), slug curto/inválido
//   4) coord CRUD em turma_inscricoes: insert/update/delete ok
//   5) a prova da issue: link T3 criado por SQL puro (service) recebe slug
//      default url-safe e revoga setando revogado_em — zero deploy
//   6) inscrição 'aguardando' de T3 existe no escopo dela e não vaza no
//      filtro de T2 (mesma query que a página roda)

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

const TURMA = "Turma V111";
const TURMA_T3 = "T3 · 2027";
const P = {}; // ids das fixtures
const EMAIL = "_v111-mentor@realiza.test";

async function limpa() {
  await svc(
    `turma_inscricoes?turma=in.(${encodeURIComponent(`"${TURMA}","${TURMA_T3}"`)})`,
    { method: "DELETE" });
  await svc(
    `relatorio_links?turma=eq.${encodeURIComponent(TURMA_T3)}`,
    { method: "DELETE" });
  if (P.profile) await svc(`profiles?id=eq.${P.profile}`, { method: "DELETE" });
  if (P.mentorado) {
    await svc(`mentorados?id=eq.${P.mentorado}`, { method: "DELETE" });
  }
}

async function criaFixtures() {
  const p = await svc("profiles", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, nome: "V111 mentor", ativo: true }),
  });
  if (p.status !== 201) throw new Error(`profile: ${JSON.stringify(p.data)}`);
  P.profile = p.data[0].id;
  const m = await svc("mentorados", {
    method: "POST",
    body: JSON.stringify({ nome: "Mentorado V111" }),
  });
  if (m.status !== 201) throw new Error(`mentorado: ${JSON.stringify(m.data)}`);
  P.mentorado = m.data[0].id;
}

const run = async () => {
  await limpa(); // resíduo de run anterior
  await criaFixtures();
  const [coord, mentor] = await Promise.all([
    login("e2e-coord@realiza.test"),
    login("e2e-mentor@realiza.test"),
  ]);
  const coordApi = as(coord);
  const mentorApi = as(mentor);

  // ─── 1) grants + RLS de relatorio_links ─────────────────────────────
  let r = await api("relatorio_links?select=slug&limit=1");
  check("anon GET relatorio_links → negado (zero grant)",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  r = await mentorApi("relatorio_links?select=slug&limit=1");
  check("mentor GET relatorio_links → [] (policy coord-only)",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} data=${JSON.stringify(r.data)}`);

  r = await coordApi("relatorio_links?select=slug,turma,revogado_em");
  check("coord GET relatorio_links → lista com o slug seed da T2",
    r.status === 200 &&
      r.data.some((l) => l.slug === "t2-x7k4m9qf2w8j" && !l.revogado_em),
    `status=${r.status} data=${JSON.stringify(r.data)}`);

  r = await coordApi("relatorio_links", {
    method: "POST",
    body: JSON.stringify({ turma: TURMA_T3 }),
  });
  check("coord POST relatorio_links → negado (sem grant de insert)",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  r = await coordApi("relatorio_links?slug=eq.t2-x7k4m9qf2w8j", {
    method: "PATCH",
    body: JSON.stringify({ revogado_em: new Date().toISOString() }),
  });
  check("coord PATCH relatorio_links → negado (sem grant de update)",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  // ─── 2) grants + RLS de turma_inscricoes ────────────────────────────
  r = await api("turma_inscricoes?select=id&limit=1");
  check("anon GET turma_inscricoes → negado (zero grant)",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  r = await mentorApi("turma_inscricoes?select=id&limit=1");
  check("mentor GET turma_inscricoes → [] (policy coord-only)",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} data=${JSON.stringify(r.data)}`);

  r = await mentorApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, mentorado_id: P.mentorado, papel_esperado: "mentorado",
    }),
  });
  check("mentor POST turma_inscricoes → negado (RLS)",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  // ─── 3) constraints (via coord — quem tem grant + policy) ───────────
  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, profile_id: P.profile, papel_esperado: "mentor",
    }),
  });
  check("coord insert mentor válido → 201",
    r.status === 201 && r.data?.[0]?.status === "aguardando",
    `status=${r.status} data=${JSON.stringify(r.data)}`);

  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, profile_id: P.profile, mentorado_id: P.mentorado,
      papel_esperado: "mentor",
    }),
  });
  check("insert com as duas colunas de pessoa → CHECK barra",
    r.status === 400 || r.status === 409, `status=${r.status}`);

  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({ turma: TURMA, papel_esperado: "mentor" }),
  });
  check("insert sem coluna de pessoa → CHECK barra",
    r.status === 400, `status=${r.status}`);

  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, mentorado_id: P.mentorado, papel_esperado: "mentor",
    }),
  });
  check("papel_esperado incoerente com a coluna → CHECK barra",
    r.status === 400, `status=${r.status}`);

  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, mentorado_id: P.mentorado, papel_esperado: "mentorado",
      status: "vip",
    }),
  });
  check("status fora do enum → CHECK barra",
    r.status === 400, `status=${r.status}`);

  r = await coordApi("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA, profile_id: P.profile, papel_esperado: "mentor",
    }),
  });
  check("duplicar (turma, pessoa) → unique barra",
    r.status === 409, `status=${r.status}`);

  // ─── 4) coord update/delete ─────────────────────────────────────────
  r = await coordApi(
    `turma_inscricoes?turma=eq.${encodeURIComponent(TURMA)}&profile_id=eq.${P.profile}`,
    { method: "PATCH", body: JSON.stringify({ status: "desistiu" }) });
  check("coord PATCH status → desistiu",
    r.status === 200 && r.data?.[0]?.status === "desistiu",
    `status=${r.status} data=${JSON.stringify(r.data)}`);

  r = await coordApi(
    `turma_inscricoes?turma=eq.${encodeURIComponent(TURMA)}&profile_id=eq.${P.profile}`,
    { method: "DELETE" });
  check("coord DELETE turma_inscricoes → ok",
    r.status === 200 || r.status === 204, `status=${r.status}`);

  // ─── 5) constraints do slug + a prova T3 (service = o "SQL" da v1) ──
  // titulo é not null no shape final (0110) — entra em todo insert pra a
  // falha ser o CHECK do slug, não o 23502 da coluna
  r = await svc("relatorio_links", {
    method: "POST",
    body: JSON.stringify({ slug: "t3", turma: TURMA_T3, titulo: "x" }),
  });
  check("slug curto manual → CHECK barra",
    r.status === 400, `status=${r.status}`);

  r = await svc("relatorio_links", {
    method: "POST",
    body: JSON.stringify({
      slug: "slug com espaço nao vale", turma: TURMA_T3, titulo: "x",
    }),
  });
  check("slug fora do alfabeto url-safe → CHECK barra",
    r.status === 400, `status=${r.status}`);

  r = await svc("relatorio_links", {
    method: "POST",
    body: JSON.stringify({ turma: TURMA_T3, titulo: "Resumo T3" }),
  });
  const slugT3 = r.data?.[0]?.slug;
  check("link T3 sem slug → default gera slug url-safe ≥12c",
    r.status === 201 && /^[A-Za-z0-9_-]{12,128}$/.test(slugT3 ?? ""),
    `status=${r.status} slug=${slugT3}`);

  // a inscrição T3 no escopo certo — a query que a página pública roda
  await svc("turma_inscricoes", {
    method: "POST",
    body: JSON.stringify({
      turma: TURMA_T3, mentorado_id: P.mentorado, papel_esperado: "mentorado",
    }),
  });
  r = await svc(
    `turma_inscricoes?select=turma,mentorado_id&status=eq.aguardando&turma=eq.${encodeURIComponent(TURMA_T3)}`);
  check("inscrição aguardando existe no escopo T3",
    r.data?.[0]?.mentorado_id === P.mentorado, JSON.stringify(r.data));
  r = await svc(
    `turma_inscricoes?select=id&status=eq.aguardando&turma=eq.${encodeURIComponent("T2 · 2026/2027")}&mentorado_id=eq.${P.mentorado}`);
  check("…e não aparece no filtro da T2",
    r.status === 200 && r.data.length === 0, JSON.stringify(r.data));

  // revogação: row segue existindo (o 404 idêntico é da página, não da REST)
  r = await svc(`relatorio_links?slug=eq.${slugT3}`, {
    method: "PATCH",
    body: JSON.stringify({ revogado_em: new Date().toISOString() }),
  });
  check("revogar link T3 → revogado_em setado, row preservada",
    r.status === 200 && !!r.data?.[0]?.revogado_em,
    `status=${r.status} data=${JSON.stringify(r.data)}`);
};

await run().finally(limpa);
console.log(`\n${ok} ok · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
