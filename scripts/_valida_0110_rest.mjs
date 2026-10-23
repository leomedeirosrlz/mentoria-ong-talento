// valida 0110 (relatórios públicos com senha, REALIZA-170) contra o stack
// local (kong :54321) com logins GoTrue reais + service key — mesmo
// pipeline da app (RLS + grants + RPCs definer de verdade). Só roda no
// stack local / staging manual — não entra no CI automatizado (não há job
// que suba o stack; os demais _valida_*_rest seguem a mesma convenção:
// `supabase start` + node).
// uso: node scripts/_valida_0110_rest.mjs
//
// personas:
//   coordenacao e2e   e2e-coord@realiza.test
//   mentor            mentor@realiza.test
//   service/anon      envs obrigatórias: PGRST_URL / PGRST_ANON_KEY /
//                     PGRST_SERVICE_KEY. NÃO há fallback p/ `supabase
//                     status` — um stack local descoberto em silêncio já
//                     gerou falhas fantasma; sem env, o script aborta.
//
// O QUE VALIDA (aceite §Segurança/RLS/auditoria):
//   · anon não lê relatorio_links (grant revogado) nem chama gestão
//   · relatorio_link_info: shell do link sem dados (malformado → não existe)
//   · abrir_relatorio: sem_link/senha/errada/limite/ok — e cada resultado
//     vira linha em resumo_acessos (ok, motivo)
//   · rate-limit por (slug, ip_hash): 5 falhas/15min → 'limite'
//   · allowlist de dados: grade sem expor_contato não devolve email/whatsapp
//   · gestão: criar devolve senha clara 1x (hash bcrypt no banco, nunca o
//     texto), redefinir troca, revogar fecha (motivo 'revogado'), stats
//     coord-only sem senha_hash no payload

const BASE = process.env.PGRST_URL;
const ANON_KEY = process.env.PGRST_ANON_KEY;
const SVC_KEY = process.env.PGRST_SERVICE_KEY;
{
  const faltam = [
    ["PGRST_URL", BASE],
    ["PGRST_ANON_KEY", ANON_KEY],
    ["PGRST_SERVICE_KEY", SVC_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (faltam.length) {
    console.error(
      `abortado — faltam envs: ${faltam.join(", ")}. ` +
      "Aponte o stack explicitamente (ex.: staging, com .env.staging " +
      "carregado: PGRST_URL=$E2E_SUPABASE_URL " +
      "PGRST_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING " +
      "PGRST_SERVICE_KEY=$E2E_SUPABASE_SERVICE_ROLE_KEY). Sem fallback " +
      "pra `supabase status` de propósito: resolver o stack local em " +
      "silêncio produziu falhas fantasma.");
    process.exit(2);
  }
}

const SLUG = "valida0110x1";
const SLUG_LIM = "valida0110lim";
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
  // PostgREST hosted resolve o PAPEL pelo Bearer — apikey sozinha sempre
  // vira `anon` (mesmo com a service_role JWT nela). O service portanto
  // vai nos DOIS headers, como faz o seed-e2e-staging.mjs / supabase-js.
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
    },
    body: body == null ? undefined
      : typeof body === "string" ? body : JSON.stringify(body),
  });
  let data = null;
  const txt = await res.text();
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { status: res.status, data };
}

const svc = (p, o) => api(p, { ...o, key: SVC_KEY });
const as = (token) => (p, o) => api(p, { ...o, token });
const rpc = (fn, args, o = {}) => api(`rpc/${fn}`, { method: "POST", body: args, ...o });
// ip_hash tem CHECK char_length 16..128 (o app grava SHA-256 = 64 hex).
// ips curtos ("ipA") reprovam o insert do log → rate-limit nunca conta e
// os checks de auditoria falham — fixtures aqui imitam o shape real.
const IP = { A: "a".repeat(64), LIM: "b".repeat(64), LIM2: "c".repeat(64),
  B: "d".repeat(64), C: "e".repeat(64), D: "f".repeat(64) };
const abrir = (slug, senha, ip = IP.A, ua = "valida-0110/1.0") =>
  rpc("abrir_relatorio", { p_slug: slug, p_senha: senha, p_ip_hash: ip, p_ua: ua });

const run = async () => {
  // fixture: link público sem senha + link com senha (hash bcrypt da
  // senha "valida110" — crypt compara, o claro nunca toca o banco)
  await svc(`resumo_acessos?slug=like.valida0110*`, { method: "DELETE" });
  await svc(`relatorio_links?slug=like.valida0110*`, { method: "DELETE" });
  // bulk insert exige o MESMO set de chaves nos objetos (PGRST102) —
  // senha_hash vai explícito como null no link livre
  const seed = await svc("relatorio_links", { method: "POST", body: [
    { slug: SLUG, turma: "Turma Valida 0110", titulo: "Valida 0110 livre",
      senha_hash: null,
      config: { tipo: "grade", turma: "Turma Valida 0110", granularidade: "pessoas" } },
    // senha do fixture: "e2esenha" (bcrypt real — a RPC compara crypt e o
    // claro nunca é coluna)
    { slug: SLUG_LIM, turma: "Turma Valida 0110", titulo: "Valida 0110 limite",
      senha_hash: "$2a$06$Dzv.FvJmWlGJ4.z1ej3Lr.M189wAXHR/6Ca4tFG5q6q8D.90vCu3i",
      config: { tipo: "grade", granularidade: "pessoas" } },
  ] });
  check("seed links via service", seed.status === 201 && seed.data?.length === 2,
    `status=${seed.status} ${JSON.stringify(seed.data).slice(0, 200)}`);

  const [coord, mentor] = await Promise.all([
    login("e2e-coord@realiza.test"),
    login("mentor@realiza.test"),
  ]);
  const coordApi = as(coord);
  const mentorApi = as(mentor);

  // ─── tabela: anon não lê nada ─────────────────────────────────────
  let r = await api(`relatorio_links?select=slug&limit=1`);
  check("anon GET relatorio_links negado", r.status === 401 || r.status === 403,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);

  // ─── info pública: shell sem dados ────────────────────────────────
  r = await rpc("relatorio_link_info", { p_slug: SLUG });
  check("info: link existe e não pede senha",
    r.status === 200 && r.data?.existe === true && r.data?.precisa_senha === false,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await rpc("relatorio_link_info", { p_slug: "x" });
  check("info: slug malformado → existe:false (sem oráculo)",
    r.status === 200 && r.data?.existe === false,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await rpc("relatorio_link_info", { p_slug: "valida0110naoexiste" });
  check("info: slug inexistente → existe:false",
    r.status === 200 && r.data?.existe === false);

  // ─── abrir: link sem senha devolve dados allowlisted ──────────────
  r = await abrir(SLUG, null);
  check("abrir livre → ok:true com config+dados",
    r.status === 200 && r.data?.ok === true && r.data?.config?.tipo === "grade" &&
    Array.isArray(r.data?.dados?.duplas) && Array.isArray(r.data?.dados?.profiles),
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  const prof0 = r.data?.dados?.profiles?.[0];
  check("grade sem expor_contato: profiles sem email/whatsapp",
    !prof0 || (!("email" in prof0) && !("whatsapp" in prof0)),
    JSON.stringify(prof0 ?? {}).slice(0, 160));

  // ─── auditoria: sucesso e falha viram linha com motivo ────────────
  r = await svc(`resumo_acessos?slug=eq.${SLUG}&select=ok,motivo&order=acessado_em`);
  check("sucesso gravou ok=true",
    r.status === 200 && r.data?.some((a) => a.ok === true),
    JSON.stringify(r.data).slice(0, 160));

  r = await abrir(SLUG_LIM, "senha-errada", IP.LIM);
  check("senha errada → motivo senha",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "senha",
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

  // ─── rate-limit: 5 falhas/15min por (slug, ip_hash) ───────────────
  for (let i = 0; i < 4; i++) await abrir(SLUG_LIM, "senha-errada", IP.LIM);
  r = await abrir(SLUG_LIM, "senha-errada", IP.LIM);
  check("6ª falha mesmo ip → motivo limite",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "limite",
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await abrir(SLUG_LIM, "qualquer", IP.LIM2);
  check("ip diferente ainda passa (cap global são 50/24h)",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "senha",
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await svc(`resumo_acessos?slug=eq.${SLUG_LIM}&select=ok,motivo&ok=eq.false`);
  check("falhas gravadas com motivo (senha + limite)",
    r.status === 200 && r.data?.length >= 6 &&
    r.data.some((a) => a.motivo === "senha") && r.data.some((a) => a.motivo === "limite"),
    JSON.stringify(r.data).slice(0, 200));

  // ─── gestão: gate por papel ───────────────────────────────────────
  r = await rpc("criar_relatorio_link", { p_titulo: "X", p_config: { tipo: "grade" } });
  check("anon não cria link", r.status === 401 || r.status === 403 ||
    (r.status === 200 && r.data?.ok === false),
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);
  r = await mentorApi("rpc/criar_relatorio_link", { method: "POST",
    body: { p_titulo: "X", p_config: { tipo: "grade" } } });
  check("mentor não cria (sem_permissao)",
    r.status === 200 && r.data?.ok === false && r.data?.erro === "sem_permissao",
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);
  r = await coordApi("rpc/criar_relatorio_link", { method: "POST", body: {
    p_titulo: "Valida 0110 criado",
    p_config: { tipo: "grade", turma: "Turma Valida 0110", granularidade: "duplas" },
    p_validade: "30 days",
  } });
  check("coord cria → slug + senha xxxx-xxxx",
    r.status === 200 && r.data?.ok === true && typeof r.data?.slug === "string" &&
    /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(r.data?.senha),
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  const slugCriado = r.data?.slug;
  const senhaCriada = r.data?.senha;

  // hash bcrypt no banco — a senha clara não é coluna
  r = await svc(`relatorio_links?slug=eq.${slugCriado}&select=senha_hash,expira_em`);
  check("hash bcrypt gravado (não o texto)",
    r.status === 200 && r.data?.[0]?.senha_hash?.startsWith("$2a$") &&
    r.data?.[0]?.senha_hash !== senhaCriada && r.data?.[0]?.expira_em != null,
    JSON.stringify(r.data).slice(0, 160));

  // a senha devolvida abre o link de verdade
  r = await abrir(slugCriado, senhaCriada);
  check("senha criada abre o link",
    r.status === 200 && r.data?.ok === true &&
    r.data?.config?.granularidade === "duplas",
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await abrir(slugCriado, "senha-errada", IP.B);
  check("senha errada no link novo → motivo senha",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "senha");

  // redefinir: nova senha funciona, a antiga morre
  const idCriado = (await svc(`relatorio_links?slug=eq.${slugCriado}&select=id`)).data?.[0]?.id;
  check("resolveu id do link criado", typeof idCriado === "string");
  // p_id SEMPRE presente no body — `undefined` serializa pra {} e a RPC
  // cai no PGRST202 "sem parâmetros", escondendo o motivo real da falha
  r = await coordApi("rpc/redefinir_senha_relatorio_link", { method: "POST",
    body: { p_id: idCriado ?? null } });
  check("redefinir devolve nova senha",
    r.status === 200 && r.data?.ok === true && /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(r.data?.senha),
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  const senhaNova = r.data?.senha;
  r = await abrir(slugCriado, senhaCriada, IP.C);
  check("senha antiga morreu na rotação",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "senha");
  r = await abrir(slugCriado, senhaNova, IP.C);
  check("senha nova abre", r.status === 200 && r.data?.ok === true);

  // revogar: motivo revogado, idempotente
  r = await coordApi("rpc/revogar_relatorio_link", { method: "POST",
    body: { p_id: idCriado ?? null } });
  check("revogar ok", r.status === 200 && r.data?.ok === true);
  r = await abrir(slugCriado, senhaNova, IP.D);
  check("link revogado → motivo revogado",
    r.status === 200 && r.data?.ok === false && r.data?.motivo === "revogado");
  r = await coordApi("rpc/revogar_relatorio_link", { method: "POST",
    body: { p_id: idCriado ?? null } });
  check("revogar idempotente", r.status === 200 && r.data?.ok === true);

  // ─── stats: coord vê painel sem senha_hash; mentor recebe [] ──────
  r = await mentorApi("rpc/relatorio_links_stats", { method: "POST", body: {} });
  check("stats pra mentor → [] (gate has_papel)",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await coordApi("rpc/relatorio_links_stats", { method: "POST", body: {} });
  const meu = Array.isArray(r.data) ? r.data.find((l) => l.slug === slugCriado) : null;
  check("stats coord: link listado com acessos e sem hash",
    r.status === 200 && meu != null && meu.acessos >= 1 &&
    meu.protegido === true && !("senha_hash" in meu),
    `status=${r.status} ${JSON.stringify(meu).slice(0, 200)}`);

  // cleanup
  await svc(`resumo_acessos?slug=like.valida0110*`, { method: "DELETE" });
  await svc(`relatorio_links?slug=like.valida0110*`, { method: "DELETE" });
  if (slugCriado)
    await svc(`resumo_acessos?slug=eq.${slugCriado}`, { method: "DELETE" });
  if (slugCriado)
    await svc(`relatorio_links?slug=eq.${slugCriado}`, { method: "DELETE" });

  console.log(`\n${ok} ok · ${falhas} falhas`);
  process.exit(falhas ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(1); });
