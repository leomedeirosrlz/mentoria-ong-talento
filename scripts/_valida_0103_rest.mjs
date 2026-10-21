// valida 0103 contra o stack local (kong :54321) com logins GoTrue reais —
// mesmo pipeline da app (RLS + claims de verdade). Só roda no stack local.
// uso: node scripts/_valida_0103_rest.mjs
//
// personas (seeds demo+e2e locais):
//   mentor da dupla de…0300  mentor@realiza.test
//   outro mentor DPP         hib-e2e@realiza.test   (não é mentor da de…0300)
//   jovem da dupla de…0300   jovem@realiza.test
//   service/anon             apikeys do stack — resolvidas via `supabase status`
//                            (ou envs PGRST_URL/PGRST_ANON_KEY/PGRST_SERVICE_KEY)

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
const DUPLA = "de000000-0000-4000-8000-000000000300";
const ESP = "e2e00000-0000-4000-8000-000000000150";
const SENHAS = ["realiza123", "e2e-senha-teste"]; // demo | e2e

async function login(email) {
  for (const password of SENHAS) {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.access_token;
    }
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
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const svc = (p, o) => api(p, { ...o, key: SVC_KEY });

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  if (cond) console.log(`  ok ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome} ${extra}`); }
};

const run = async () => {
  const [mentor, outro, jovem] = await Promise.all([
    login("mentor@realiza.test"), login("hib-e2e@realiza.test"), login("jovem@realiza.test"),
  ]);
  const as = (token) => (p, o) => api(p, { ...o, token });

  // cleanup de runs anteriores (idempotente)
  await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  await svc(`terceiros_consolidacao?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  await svc(`notificacoes?tipo=eq.terceiro_respondeu&href=eq./duplas/${DUPLA}`, { method: "DELETE" });

  // ─── 1) convite + cap + gates ──────────────────────────────────────
  console.log("1) convite/cap/gates");
  let r = await api("terceiros_contatos", {
    method: "POST", token: mentor,
    body: { dupla_id: DUPLA, nome: "Fulano Amigo", vinculo: "amigo", whatsapp: "11999990000" },
  });
  ok("mentor insere", r.status === 201 && r.data?.[0]?.token?.length >= 20, `${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  const amigo = r.data?.[0];
  if (!amigo) { console.log("sem fixture — abortando"); process.exit(1); }

  // o guia é 3+3+3 — cap por vínculo além do total de 9
  for (let i = 1; i <= 2; i++) {
    await api("terceiros_contatos", { method: "POST", token: mentor,
      body: { dupla_id: DUPLA, nome: `Amigo ${i}`, vinculo: "amigo" } });
  }
  r = await api("terceiros_contatos", { method: "POST", token: mentor,
    body: { dupla_id: DUPLA, nome: "Quarto Amigo", vinculo: "amigo" } });
  ok("4º do mesmo vínculo bloqueado", r.status >= 400 && JSON.stringify(r.data).includes("3 pessoas por"), `${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

  for (const vinculo of ["familiar", "colega"]) {
    for (let i = 1; i <= 3; i++) {
      await api("terceiros_contatos", { method: "POST", token: mentor,
        body: { dupla_id: DUPLA, nome: `${vinculo} ${i}`, vinculo } });
    }
  }
  r = await api("terceiros_contatos", { method: "POST", token: mentor,
    body: { dupla_id: DUPLA, nome: "Décimo", vinculo: "outro" } });
  ok("10º bloqueado", r.status >= 400 && JSON.stringify(r.data).includes("9 pessoas"), `${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

  r = await api("terceiros_contatos", { method: "POST", token: mentor,
    body: { dupla_id: ESP, nome: "Esp", vinculo: "amigo" } });
  ok("trilha especialista bloqueada", r.status === 401 || r.status === 403, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);

  r = await api("terceiros_contatos", { method: "POST", token: outro,
    body: { dupla_id: DUPLA, nome: "Intruso", vinculo: "amigo" } });
  ok("outro mentor bloqueado", r.status === 401 || r.status === 403, `${r.status}`);

  // ─── 2) colunas trancadas ──────────────────────────────────────────
  console.log("2) grants");
  const cid = (await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}&vinculo=eq.familiar&select=id&limit=1`)).data[0].id;
  r = await api(`terceiros_contatos?id=eq.${cid}`, { method: "PATCH", token: mentor,
    body: { nome: "Fulano Silva", whatsapp: "11988887777" } });
  ok("mentor edita nome/whatsapp", r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await api(`terceiros_contatos?id=eq.${cid}`, { method: "PATCH", token: mentor,
    body: { status: "expirado" } });
  ok("update status negado", r.status === 401 || r.status === 403, `${r.status}`);
  r = await api(`terceiros_contatos?id=eq.${cid}`, { method: "PATCH", token: mentor,
    body: { token: "x".repeat(24) } });
  ok("update token negado", r.status === 401 || r.status === 403, `${r.status}`);

  // ─── 3) fluxo público (anon) ───────────────────────────────────────
  console.log("3) fluxo público");
  r = await api("rpc/terceiro_por_token", { method: "POST", body: { p_token: amigo.token } });
  ok("por_token resolve", r.status === 200 && r.data?.status === "pendente" && r.data?.alvo?.jovem_nome, JSON.stringify(r.data).slice(0, 160));
  r = await api("rpc/submeter_resposta_terceiro", { method: "POST",
    body: { p_token: amigo.token, p_pontos_fortes: "Dedicado e persistente.", p_a_melhorar: "Arriscar mais." } });
  ok("submit grava", r.status === 200 || r.status === 204, `${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);
  r = await api("rpc/terceiro_por_token", { method: "POST", body: { p_token: amigo.token } });
  ok("status vira respondido", r.data?.status === "respondido", JSON.stringify(r.data).slice(0, 140));
  r = await api("rpc/submeter_resposta_terceiro", { method: "POST",
    body: { p_token: amigo.token, p_pontos_fortes: "x", p_a_melhorar: "y" } });
  ok("replay negado", r.status >= 400, `${r.status}`);
  const notifs = (await svc(`notificacoes?tipo=eq.terceiro_respondeu&href=eq./duplas/${DUPLA}&select=profile_id`)).data;
  ok("mentor notificado", notifs.some((n) => n.profile_id === "de000000-0000-4000-8000-000000000110"), JSON.stringify(notifs));
  ok("coords notificados", notifs.length >= 3, `${notifs.length}`);

  // ─── 4) visibilidade ───────────────────────────────────────────────
  console.log("4) RLS de leitura");
  r = await api(`terceiros_respostas?select=id,pontos_fortes,contato_id&contato_id=eq.${amigo.id}`, { token: mentor });
  ok("mentor lê identificado", r.status === 200 && r.data.length === 1 && r.data[0].pontos_fortes.includes("Dedicado"), `${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await api(`terceiros_respostas?select=id`, { token: outro });
  ok("outro mentor lê 0", r.data.length === 0, JSON.stringify(r.data));
  r = await api(`terceiros_contatos?select=id`, { token: jovem });
  ok("jovem lê 0 contatos", r.data.length === 0, JSON.stringify(r.data));
  r = await api(`terceiros_respostas?select=id`, { token: jovem });
  ok("jovem lê 0 respostas", r.data.length === 0);

  // ─── 5) consolidado ────────────────────────────────────────────────
  console.log("5) consolidado");
  r = await api("rpc/salvar_consolidado_terceiros", { method: "POST", token: mentor,
    body: { p_dupla_id: DUPLA, p_consolidado: "Dedicação e escuta aparecem; a trabalhar: pedir ajuda.", p_publicar: false } });
  ok("mentor salva rascunho", r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await api("terceiros_consolidacao?select=consolidado", { token: jovem });
  ok("rascunho invisível ao jovem", r.data.length === 0, JSON.stringify(r.data));
  r = await api("rpc/salvar_consolidado_terceiros", { method: "POST", token: mentor,
    body: { p_dupla_id: DUPLA, p_consolidado: "Dedicação e escuta aparecem; a trabalhar: pedir ajuda.", p_publicar: true } });
  ok("mentor publica", r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await api("terceiros_consolidacao?select=consolidado", { token: jovem });
  ok("publicado visível ao jovem", r.data.length === 1 && r.data[0].consolidado.includes("Dedicação"), JSON.stringify(r.data).slice(0, 140));
  r = await api("rpc/salvar_consolidado_terceiros", { method: "POST", token: mentor,
    body: { p_dupla_id: DUPLA, p_consolidado: "   ", p_publicar: true } });
  ok("publicar vazio negado", r.status >= 400, `${r.status}`);
  r = await api("rpc/salvar_consolidado_terceiros", { method: "POST", token: outro,
    body: { p_dupla_id: DUPLA, p_consolidado: "intruso", p_publicar: true } });
  ok("outro mentor não escreve", r.status >= 400, `${r.status}`);
  // trilha especialista não publica nem com o mentor da própria dupla
  const espMentor = await login("esp-e2e@realiza.test").catch(() => null);
  if (espMentor) {
    r = await api("rpc/salvar_consolidado_terceiros", { method: "POST", token: espMentor,
      body: { p_dupla_id: ESP, p_consolidado: "intruso", p_publicar: true } });
    ok("consolidado barrado na trilha esp", r.status >= 400, `${r.status}`);
  }

  // ─── 6) cancelamento / reemissão ───────────────────────────────────
  console.log("6) cancel/reemite");
  const pend = (await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}&status=eq.pendente&select=id,token&limit=2`)).data;
  r = await api(`terceiros_contatos?id=eq.${pend[0].id}`, { method: "DELETE", token: mentor });
  ok("mentor cancela pendente", r.status === 200 || r.status === 204, `${r.status}`);
  const resp = (await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}&status=eq.respondido&select=id`)).data[0];
  r = await api(`terceiros_contatos?id=eq.${resp.id}`, { method: "DELETE", token: mentor });
  const aindaLa = (await svc(`terceiros_contatos?id=eq.${resp.id}&select=id`)).data.length;
  ok("respondido protegido", (r.data == null || r.data.length === 0) && aindaLa === 1, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  // respondido é histórico: nem o cadastro se mexe (update pede pendente/expirado)
  r = await api(`terceiros_contatos?id=eq.${resp.id}`, { method: "PATCH", token: mentor,
    body: { nome: "Nome Mudado" } });
  ok("update em respondido negado", (r.data == null || r.data.length === 0), `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await api("rpc/reemitir_convite_terceiro", { method: "POST", token: mentor, body: { p_contato_id: pend[1].id } });
  ok("pendente reutiliza token", r.data?.token === pend[1].token && r.data?.reutilizado === true, JSON.stringify(r.data).slice(0, 160));
  // expiração lazy: pendente com prazo vencido também roda o token (não
  // devolve o morto — o lazy-expire marca 'expirado' antes do branch)
  await svc(`terceiros_contatos?id=eq.${pend[1].id}`, { method: "PATCH",
    body: { expira_em: new Date(Date.now() - 86400e3).toISOString() } });
  r = await api("rpc/reemitir_convite_terceiro", { method: "POST", token: mentor, body: { p_contato_id: pend[1].id } });
  ok("pendente-vencido ganha token novo", r.data?.token && r.data.token !== pend[1].token && r.data?.reutilizado === false, JSON.stringify(r.data).slice(0, 160));
  await svc(`terceiros_contatos?id=eq.${pend[1].id}`, { method: "PATCH", body: { status: "expirado" } });
  r = await api("rpc/reemitir_convite_terceiro", { method: "POST", token: mentor, body: { p_contato_id: pend[1].id } });
  ok("expirado ganha token novo", r.data?.token && r.data.token !== pend[1].token && r.data?.reutilizado === false, JSON.stringify(r.data).slice(0, 160));
  const novo = r.data?.token;
  r = await api("rpc/terceiro_por_token", { method: "POST", body: { p_token: novo } });
  ok("token novo abre pendente", r.data?.status === "pendente", JSON.stringify(r.data).slice(0, 120));

  // cleanup
  await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  await svc(`terceiros_consolidacao?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  await svc(`notificacoes?tipo=eq.terceiro_respondeu&href=eq./duplas/${DUPLA}`, { method: "DELETE" });

  console.log(falhas === 0 ? "── 0103 REST validada ──" : `── ${falhas} falhas ──`);
  process.exit(falhas === 0 ? 0 : 1);
};
run();
