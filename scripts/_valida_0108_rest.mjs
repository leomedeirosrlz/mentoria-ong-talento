// valida 0108 (trilha_lembretes + processar_lembretes_trilha, REALIZA-169)
// contra o stack local (kong :54321) — fixtures próprias via service key,
// mesmo pipeline da app (RLS + grants de verdade). Em staging roda também,
// mas a seção "marco avança" (p_hoje futuro) é LOCAL-ONLY: queimaria o
// marco vencida das trilhas reais antes da hora.
// uso: node scripts/_valida_0108_rest.mjs
//
// personas/fixtures (tudo _v108-*, removido no fim):
//   esp global            _v108-esp@realiza.test (mentor das 4 duplas esp)
//   coord global          _v108-coord-g@realiza.test
//   coord escopada        _v108-coord-s@realiza.test (papel coordenacao
//                         escopo 'Turma V108B' — NÃO pode receber o ping
//                         das duplas 'Turma V108')
//   logins reais          e2e-coord@realiza.test (lê o ledger),
//                         mentor@realiza.test (não lê — policy coord-only)
//   service/anon          apikeys do stack — `supabase status`
//                         (ou envs PGRST_URL/PGRST_ANON_KEY/PGRST_SERVICE_KEY)
//
// O QUE VALIDA (acceptance.md):
//   1) RPC inalcançável por anon/mentor/coord via REST; service executa
//   2) dias=12 → marco 15d p/ especialista; dias=5 → 15d+7d juntos;
//      dias=-2 → vencida p/ esp + coord global (escopada NÃO); dias=-90 →
//      só vencida (sem "faltam 15 dias" retroativo); pausada/null/dpp → 0
//   3) dedup: 2 calls paralelos + re-run → zero rows/notifs novos
//   4) ledger select coord-only (mentor GET → []; coord GET → rows)
//   5) conteúdo: título/corpo/href/created_by null conforme o sdd
//   6) sem auto-close: a dupla vencida segue 'ativa' depois do run
//   7) [local] p_hoje futuro avança a dupla A pra 'vencida' — marcos não
//      retroativam o que já saiu e o marco novo dispara 1×

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
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
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
const rpc = (p, body) => svc(`rpc/${p}`, { method: "POST", body: JSON.stringify(body ?? {}) });

// ─── datas determinísticas ────────────────────────────────────────────
// fim = iniciada_em + 3 meses no SQL; o JS espelha com setUTCMonth. A
// trava day<=28 elimina a diferença de clamp (JS rola pro dia 1; PG prende
// no último dia do mês) — com dia <= 28 os dois mundos coincidem sempre.
const HOJE = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const addDias = (d, n) => {
  const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x;
};
const add3Meses = (d) => {
  const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + 3); return x;
};
const diffDias = (a, b) =>
  Math.round((Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
    - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 864e5);
function iniciadaPara(diasAlvo) {
  for (let delta = 80; delta <= 100; delta++) {
    const ini = addDias(HOJE, -delta);
    const fim = add3Meses(ini);
    if (ini.getUTCDate() > 28 || fim.getUTCDate() > 28) continue;
    if (diffDias(fim, HOJE) === diasAlvo) return ymd(ini);
  }
  throw new Error(`sem iniciada pro alvo ${diasAlvo}d`);
}

const TURMA = "Turma V108";
const TURMA_B = "Turma V108B";
const P = {}; // ids das fixtures
const DUP = {}; // duplas A..F
const EMAILS = {
  esp: "_v108-esp@realiza.test",
  coordG: "_v108-coord-g@realiza.test",
  coordS: "_v108-coord-s@realiza.test",
};

async function criaFixtures() {
  // profiles — role no insert cria o papel global via trigger 0085
  for (const [k, email, role] of [
    ["esp", EMAILS.esp, "mentor_especialista"],
    ["coordG", EMAILS.coordG, "coordenacao"],
    ["coordS", EMAILS.coordS, null],
  ]) {
    const r = await svc("profiles", {
      method: "POST",
      body: JSON.stringify({ email, nome: `V108 ${k}`, role, ativo: true }),
    });
    if (r.status !== 201) throw new Error(`profile ${k}: ${JSON.stringify(r.data)}`);
    P[k] = r.data[0].id;
  }
  await svc("mentor_profiles", {
    method: "POST",
    body: JSON.stringify({
      profile_id: P.esp, tipo: "especialista", capacidade_especialista: 10,
    }),
  });
  for (const md of ["a", "b", "c", "d", "e"]) {
    const r = await svc("mentorados", {
      method: "POST",
      body: JSON.stringify({ nome: `Mentorado V108 ${md}` }),
    });
    if (r.status !== 201) throw new Error(`mentorado ${md}: ${JSON.stringify(r.data)}`);
    P[`md_${md}`] = r.data[0].id;
  }
  // cronograma pra dupla DPP (a fixture E prova trilha≠esp → 0)
  const cr = await svc("cronogramas?select=id&limit=1");
  P.cronograma = Array.isArray(cr.data) && cr.data[0]?.id;

  const defs = [
    // alvo dentro da janela: A só 15d · B 15d+7d · C e F vencida · D pausada
    // (turma B alimenta o label do escopo da coordS) · F vencida antiga
    ["a", "especialista", "ativa", iniciadaPara(12), TURMA],
    ["b", "especialista", "ativa", iniciadaPara(5), TURMA],
    ["c", "especialista", "ativa", iniciadaPara(-2), TURMA],
    ["d", "especialista", "pausada", iniciadaPara(-2), TURMA_B],
    // F vencida há ~3 meses: qualquer data ≪ -15 serve — fora do range do
    // iniciadaPara por desenho
    ["f", "especialista", "ativa", ymd(addDias(HOJE, -185)), TURMA],
  ];
  // E: trilha dpp → ignorada pelo scan; precisa de cronograma (CHECK 0061)
  if (P.cronograma) {
    defs.push(["e", "dpp", "ativa", iniciadaPara(-2), TURMA]);
  } else {
    console.log("  -- sem cronograma: dupla dpp (E) não criada");
  }
  for (const [k, trilha, status, ini, turma] of defs) {
    const r = await svc("duplas", {
      method: "POST",
      body: JSON.stringify({
        mentor_id: P.esp,
        mentorado_id: P[`md_${k}`],
        turma,
        cronograma_id: trilha === "dpp" ? P.cronograma : null,
        trilha, status, iniciada_em: ini,
        demanda: "fixture _valida_0108",
      }),
    });
    if (r.status !== 201) throw new Error(`dupla ${k}: ${JSON.stringify(r.data)}`);
    DUP[k] = r.data[0].id;
  }
  // coord escopada a OUTRA turma: o papel nasce manual (role=null não
  // cria papel; o insert aqui valida o label 'Turma V108B' já existente
  // via dupla D)
  const r = await svc("profile_papeis", {
    method: "POST",
    body: JSON.stringify({
      profile_id: P.coordS, papel: "coordenacao", escopo_turma: TURMA_B,
    }),
  });
  if (r.status !== 201) throw new Error(`papel coordS: ${JSON.stringify(r.data)}`);
}

const ledgerDa = (dupla) =>
  svc(`trilha_lembretes?dupla_id=eq.${dupla}&select=marco,destino,notificacao_id`);
const notifsDo = (profile, tipo, href) =>
  svc(`notificacoes?profile_id=eq.${profile}&tipo=eq.${tipo}` +
      `${href ? `&href=eq.${encodeURIComponent(href)}` : ""}` +
      `&select=tipo,titulo,corpo,href,created_by`);

async function limpa() {
  const ids = Object.values(DUP);
  if (ids.length) {
    // pings das fixtures (href aponta pras duplas — pega esp E coords reais)
    for (const id of ids) {
      await svc(`notificacoes?href=eq.${encodeURIComponent(`/duplas/${id}`)}`,
        { method: "DELETE" });
    }
    // links de jornada que a dupla dpp possa ter mintado no insert
    await svc(`formulario_links?dupla_id=in.(${ids.join(",")})`,
      { method: "DELETE" });
    await svc(`duplas?id=in.(${ids.join(",")})`, { method: "DELETE" });
  }
  const pids = [P.esp, P.coordG, P.coordS].filter(Boolean);
  if (pids.length) {
    await svc(`profiles?id=in.(${pids.join(",")})`, { method: "DELETE" });
  }
  const mids = ["a", "b", "c", "d", "e"].map((k) => P[`md_${k}`]).filter(Boolean);
  if (mids.length) {
    await svc(`mentorados?id=in.(${mids.join(",")})`, { method: "DELETE" });
  }
}

const run = async () => {
  await limpa(); // resíduo de run anterior
  await criaFixtures();
  const [coord, mentor] = await Promise.all([
    login("e2e-coord@realiza.test"),
    login("mentor@realiza.test"),
  ]);
  const coordApi = as(coord);
  const mentorApi = as(mentor);

  // ─── 1) grants da RPC ───────────────────────────────────────────────
  let r = await api("rpc/processar_lembretes_trilha", {
    method: "POST", body: JSON.stringify({ p_hoje: ymd(HOJE) }),
  });
  check("anon executa a RPC → negado",
    r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await mentorApi("rpc/processar_lembretes_trilha", {
    method: "POST", body: JSON.stringify({ p_hoje: ymd(HOJE) }),
  });
  check("mentor executa a RPC → negado",
    r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await coordApi("rpc/processar_lembretes_trilha", {
    method: "POST", body: JSON.stringify({ p_hoje: ymd(HOJE) }),
  });
  check("coord executa a RPC → negado",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  // ─── 2) run paralela (idempotência sob concorrência) ────────────────
  const [r1, r2] = await Promise.all([
    rpc("processar_lembretes_trilha", { p_hoje: ymd(HOJE) }),
    rpc("processar_lembretes_trilha", { p_hoje: ymd(HOJE) }),
  ]);
  check("service executa (2 paralelas) → 200 ok",
    r1.status === 200 && r1.data?.ok === true &&
    r2.status === 200 && r2.data?.ok === true,
    `${r1.status}/${r2.status}`);

  const marcos = async (d) =>
    ((await ledgerDa(d)).data ?? []).map(
      (x) => `${x.marco}:${x.destino}`).sort();

  // A: dias=12 → só 15d/especialista
  let m = await marcos(DUP.a);
  check("A (12d) → [15d/especialista]",
    JSON.stringify(m) === JSON.stringify(["15d:especialista"]),
    JSON.stringify(m));
  // B: dias=5 → 15d e 7d juntos (marcos em atraso dentro da janela)
  m = await marcos(DUP.b);
  check("B (5d) → [15d,7d]/especialista",
    JSON.stringify(m) ===
    JSON.stringify(["15d:especialista", "7d:especialista"]),
    JSON.stringify(m));
  // C: dias=-2 → vencida p/ esp + coordenacao
  m = await marcos(DUP.c);
  check("C (-2d) → [vencida/esp + vencida/coord]",
    JSON.stringify(m) ===
    JSON.stringify(["vencida:coordenacao", "vencida:especialista"]),
    JSON.stringify(m));
  // D pausada e E dpp → nada
  m = await marcos(DUP.d);
  check("D (pausada) → []", m.length === 0, JSON.stringify(m));
  if (DUP.e) {
    m = await marcos(DUP.e);
    check("E (dpp) → []", m.length === 0, JSON.stringify(m));
  }
  // F: vencida há ~90d com ledger vazio → SÓ vencida (aceite §5: nada de
  // "faltam 15 dias" retroativo)
  m = await marcos(DUP.f);
  check("F (-90d) → [vencida ×2], sem marcos futuros",
    JSON.stringify(m) ===
    JSON.stringify(["vencida:coordenacao", "vencida:especialista"]),
    JSON.stringify(m));

  // ─── 3) conteúdo das notificações ───────────────────────────────────
  r = await notifsDo(P.esp, "trilha_prazo");
  check("esp recebeu 5 trilha_prazo (A1+B2+C1+F1)",
    r.status === 200 && r.data.length === 5,
    `n=${r.data?.length}`);
  const porHref = (h) => r.data.filter((n) => n.href === h);
  check("href = /duplas/<id> em todas",
    r.data.every((n) => /^\/duplas\/[0-9a-f-]{36}$/.test(n.href)));
  check("created_by null (automação)",
    r.data.every((n) => n.created_by === null));
  check("título 15d/7d/vencida conforme o sdd",
    porHref(`/duplas/${DUP.a}`)[0]?.titulo.includes("15 dias") &&
    porHref(`/duplas/${DUP.b}`).some((n) => n.titulo.includes("7 dias")) &&
    porHref(`/duplas/${DUP.c}`)[0]?.titulo.includes("3 meses"),
    JSON.stringify(r.data.map((n) => n.titulo)));
  check("corpo cita o mentorado (A)",
    (porHref(`/duplas/${DUP.a}`)[0]?.corpo ?? "").includes("Mentorado V108 a"));

  r = await svc(`notificacoes?tipo=eq.trilha_prazo_coord&select=profile_id,href`);
  const coordPings = Array.isArray(r.data) ? r.data : [];
  const coordsDa = (h) =>
    coordPings.filter((n) => n.href === h).map((n) => n.profile_id);
  check("vencida: coord global recebeu trilha_prazo_coord (C e F)",
    coordsDa(`/duplas/${DUP.c}`).includes(P.coordG) &&
    coordsDa(`/duplas/${DUP.f}`).includes(P.coordG));
  check("vencida: coord escopada a outra turma NÃO recebeu",
    !coordsDa(`/duplas/${DUP.c}`).includes(P.coordS) &&
    !coordsDa(`/duplas/${DUP.f}`).includes(P.coordS));
  check("15d/7d não pingam coord (A e B sem trilha_prazo_coord)",
    coordsDa(`/duplas/${DUP.a}`).length === 0 &&
    coordsDa(`/duplas/${DUP.b}`).length === 0);

  // ledger aponta a notificação do especialista (1:1)
  r = await svc(`trilha_lembretes?dupla_id=eq.${DUP.a}&select=notificacao_id`);
  check("ledger da A aponta a notificação enviada",
    r.data?.[0]?.notificacao_id != null);

  // ─── 4) dedup: re-run não duplica ────────────────────────────────────
  r = await rpc("processar_lembretes_trilha", { p_hoje: ymd(HOJE) });
  check("re-run mesma data → ok", r.status === 200 && r.data?.ok === true);
  const notifEsp1 = (await notifsDo(P.esp, "trilha_prazo")).data.length;
  check("re-run: zero pings novos pro esp (dedup pela unique)",
    notifEsp1 === 5, `n=${notifEsp1}`);
  m = await marcos(DUP.f);
  check("re-run: ledger da F segue com 2 rows",
    m.length === 2, JSON.stringify(m));

  // ─── 5) RLS do ledger ────────────────────────────────────────────────
  r = await mentorApi("trilha_lembretes?select=id");
  check("mentor GET trilha_lembretes → []",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status}`);
  r = await coordApi(`trilha_lembretes?dupla_id=eq.${DUP.a}&select=marco`);
  check("coord GET trilha_lembretes → vê a row",
    r.status === 200 && r.data?.[0]?.marco === "15d");
  r = await coordApi("trilha_lembretes", {
    method: "POST",
    body: JSON.stringify({ dupla_id: DUP.a, marco: "15d", destino: "especialista" }),
  });
  check("coord POST trilha_lembretes → negado (só a RPC escreve)",
    r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await api(`trilha_lembretes?select=id&limit=1`);
  check("anon GET trilha_lembretes → negado",
    r.status === 401 || r.status === 403, `status=${r.status}`);

  // ─── 6) sem auto-close: vencida segue 'ativa' ────────────────────────
  r = await svc(`duplas?id=eq.${DUP.c}&select=status`);
  check("dupla vencida segue 'ativa' (nenhum encerramento automático)",
    r.data?.[0]?.status === "ativa", JSON.stringify(r.data));

  // ─── 7) [local] p_hoje futuro: A avança pra 'vencida' 1× ─────────────
  if (LOCAL) {
    const futuro = ymd(addDias(HOJE, 20));
    r = await rpc("processar_lembretes_trilha", { p_hoje: futuro });
    check("p_hoje futuro: A ganha vencida×2 (15d já saiu, não retroativa)",
      r.status === 200 && r.data?.ok === true);
    m = await marcos(DUP.a);
    check("A agora tem [15d, vencida×2] — 7d nunca saiu (pulado)",
      JSON.stringify(m) === JSON.stringify(
        ["15d:especialista", "vencida:coordenacao", "vencida:especialista"]),
      JSON.stringify(m));
  } else {
    console.log("  -- seção p_hoje futuro pulada (só em stack local)");
  }
};

await run().finally(limpa);
console.log(`\n${ok} ok · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
