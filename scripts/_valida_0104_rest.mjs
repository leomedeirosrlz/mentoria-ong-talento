// valida 0104 (avaliação geral da trilha de especialista) contra o stack
// local (kong :54321) com logins GoTrue reais + service key — mesmo pipeline
// da app (RLS + claims de verdade). Só roda no stack local.
// uso: node scripts/_valida_0104_rest.mjs
//
// personas (fixtures e2e locais):
//   especialista da trilha e2e…0150  hib-e2e@realiza.test (híbrido: DPP + esp)
//   não-dono                        e2e-mentor@realiza.test
//   service/anon                    apikeys do stack — `supabase status`
//
// O QUE VALIDA:
//   form oficial semeou + CHECK novo · encerrar emite link+notificação no
//   mesmo commit · dedup no reencerramento · resposta logada carimba
//   respondido_por_profile_id · estranho não encerra · DPP não aceita.
// Restaura a fixture no final (dupla volta a ativa, link/resposta/notif
// criados saem).

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
const DUPLA_ESP = "e2e00000-0000-4000-8000-000000000150";
const DUPLA_DPP = "e2e00000-0000-4000-8000-000000000030";
const SENHA = "e2e-senha-teste";

let ok = 0, falhas = 0;
const check = (nome, cond) => {
  if (cond) { ok++; console.log(`  ok ${nome}`); }
  else { falhas++; console.log(`FALHA ${nome}`); }
};

async function login(email) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!res.ok) throw new Error(`login falhou: ${email} ${res.status}`);
  return (await res.json()).access_token;
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

const rpc = (fn, args, opts) => api(`rpc/${fn}`, { method: "POST", body: args, ...opts });
const svc = (path, opts) => api(path, { ...opts, key: SVC_KEY });
const jwts = {};
const as = (email) => (jwts[email] ??= login(email));

// fixture: a trilha tem que estar aberta e sem links/respostas de runs
// anteriores (o dedup por (form,dest,dupla) reusa link velho — sujo ou já
// respondido — e o teste precisa ver a emissão acontecer de verdade)
await svc(`duplas?id=eq.${DUPLA_ESP}`, {
  method: "PATCH",
  body: { status: "ativa", encerrada_em: null, motivo_encerramento: null, devolutiva_pdm: null },
});
const linksVelhos = (await svc(
  `formulario_links?dupla_id=eq.${DUPLA_ESP}&formulario_id=eq.5eed0001-0000-4000-8000-000000000008&select=id,token`
)).data ?? [];
for (const l of linksVelhos) {
  await svc(`formulario_respostas?link_id=eq.${l.id}`, { method: "DELETE" });
  await svc(`notificacoes?href=eq./f/${l.token}`, { method: "DELETE" });
  await svc(`formulario_links?id=eq.${l.id}`, { method: "DELETE" });
}

const espTok = await as("hib-e2e@realiza.test");
const dppTok = await as("e2e-mentor@realiza.test");

// acha o mentor_id da trilha (o especialista dono) via service
const [dupla] = (await svc(`duplas?id=eq.${DUPLA_ESP}&select=mentor_id,status,trilha`)).data;
check("fixture trilha esp", dupla?.trilha === "especialista");

// ── 1. o form oficial semeou ──────────────────────────────────────
const [form] = (await svc(`formularios?select=id,sistema,ativo&sistema=eq.avaliacao_especialista`)).data;
check("form avaliacao_especialista existe e ativo", !!form?.id && form.ativo === true);

// estranho não lê (RLS coord-only na tabela de forms)
const rFormEsp = await api(`formularios?id=eq.${form.id}`, { token: espTok });
check("especialista não lê formularios (coord-only)", rFormEsp.status === 200 && rFormEsp.data.length === 0);

// ── 2. encerramento emite link + notificação ──────────────────────
const rClose = await rpc("encerrar_trilha_especialista", {
  p_dupla: DUPLA_ESP,
  p_tipo: "concluida",
  p_motivo: "validação 0104 — objetivos alcançados",
  p_devolutiva: "Devolutiva de validação da 0104: meta batida, seguir no PDM.",
}, { token: espTok });
check("especialista encerra a trilha", rClose.status === 204 || rClose.status === 200 || (rClose.status === 201));

const links = (await svc(
  `formulario_links?formulario_id=eq.${form.id}&dupla_id=eq.${DUPLA_ESP}&select=id,token,dest_profile_id,usado_em,expira_em,contexto`
)).data;
check("link emitido pro especialista", links.length === 1 && links[0].dest_profile_id === dupla.mentor_id);
check("token ≥20", (links[0]?.token ?? "").length >= 20);
const TOKEN = links[0]?.token;

const notifs = (await svc(
  `notificacoes?profile_id=eq.${dupla.mentor_id}&tipo=eq.avaliacao_pendente&href=eq./f/${TOKEN}&select=id`
)).data;
check("notificação avaliacao_pendente pro especialista", notifs.length === 1);

// ── 3. dedup no reencerramento ────────────────────────────────────
// reabre pela service (updateDupla limpa os carimbos), re-encerra:
// o link existente bloqueia nova emissão — nem link nem notificação
// duplicam.
await svc(`duplas?id=eq.${DUPLA_ESP}`, {
  method: "PATCH",
  body: { status: "ativa", encerrada_em: null, motivo_encerramento: null, devolutiva_pdm: null },
});
const rClose2 = await rpc("encerrar_trilha_especialista", {
  p_dupla: DUPLA_ESP, p_tipo: "encerrada",
  p_motivo: "validação 0104 — segundo fechamento",
  p_devolutiva: "Devolutiva do segundo fechamento de validação.",
}, { token: espTok });
check("reencerramento funciona", rClose2.status === 204 || rClose2.status === 200 || rClose2.status === 201);
const links2 = (await svc(
  `formulario_links?formulario_id=eq.${form.id}&dupla_id=eq.${DUPLA_ESP}&select=id`
)).data;
check("dedup: 1 link por (form,dest,dupla)", links2.length === 1);
const notifs2 = (await svc(
  `notificacoes?profile_id=eq.${dupla.mentor_id}&tipo=eq.avaliacao_pendente&href=eq./f/${TOKEN}&select=id`
)).data;
check("dedup: notificação não duplica", notifs2.length === 1);

// ── 3b. avaliacao_esp_da_dupla — caminho de volta ao link ─────────
// a ficha relê o estado pela RPC definer: token só pro especialista da
// trilha (respondente), coord vê o estado, estranho não vê nada.
const coordTok = await as("e2e-coord@realiza.test");
const rLeEsp = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: espTok });
check("especialista recebe o token de volta",
  rLeEsp.data?.respondido === false && rLeEsp.data?.token === TOKEN);
const rLeCoord = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: coordTok });
check("coord vê o estado sem o token",
  rLeCoord.data?.respondido === false && rLeCoord.data?.token == null);
const rLeOutro = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: dppTok });
check("estranho não vê nada", rLeOutro.data == null);
const rLeDpp = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_DPP }, { token: coordTok });
check("dupla DPP retorna null", rLeDpp.data == null);

// ── 4. resposta pelo /f/<token> logado ────────────────────────────
const rPub = await rpc("formulario_por_token", { p_token: TOKEN }, { token: espTok });
if (rPub.data?.status !== "pendente")
  console.log("    ↳ por_token:", rPub.status, JSON.stringify(rPub.data).slice(0, 160));
check("token abre a definição do form",
  rPub.status === 200 && rPub.data?.status === "pendente" && !!rPub.data?.formulario?.campos);

const rSub = await rpc("submeter_resposta_formulario", {
  p_token: TOKEN,
  p_respostas: {
    experiencia: 5, atendeu_demanda: 4,
    resultados: "Bia apresentou o projeto sozinha.",
    apoio_coordenacao: 5,
    participaria_outra: "sim",
  },
}, { token: espTok });
check("especialista responde o form", rSub.status === 200 || rSub.status === 201 || rSub.status === 204);

const [resp] = (await svc(
  `formulario_respostas?link_id=eq.${links[0].id}&select=id`
)).data;
const [linkDepois] = (await svc(
  `formulario_links?id=eq.${links[0].id}&select=usado_em,respondido_por_profile_id`
)).data;
check("resposta gravada + carimba o autor no link",
  !!resp?.id && linkDepois?.respondido_por_profile_id === dupla.mentor_id);

// a leitura definer vira "respondido" — a ficha mostra o carimbo e o CTA some
const rLeDepois = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: coordTok });
check("estado vira respondido após o submit",
  rLeDepois.data?.respondido === true && !!rLeDepois.data?.respondido_em);

// ── 5. negativos ──────────────────────────────────────────────────
const rOutro = await rpc("encerrar_trilha_especialista", {
  p_dupla: DUPLA_ESP, p_tipo: "concluida",
  p_motivo: "tentativa de terceiro",
  p_devolutiva: "devolutiva de terceiro com dez caracteres",
}, { token: dppTok });
check("outro mentor não encerra", rOutro.status >= 400);

const rDpp = await rpc("encerrar_trilha_especialista", {
  p_dupla: DUPLA_DPP, p_tipo: "concluida",
  p_motivo: "tentativa em dupla dpp",
  p_devolutiva: "devolutiva de teste com dez caracteres",
}, { token: dppTok });
check("dupla DPP recusa", rDpp.status >= 400 && /especialista/i.test(JSON.stringify(rDpp.data)));

// ── cleanup: fixture volta ao estado original ─────────────────────
await svc(`formulario_respostas?link_id=eq.${links[0].id}`, { method: "DELETE" });
await svc(`formulario_links?id=eq.${links[0].id}`, { method: "DELETE" });
await svc(`notificacoes?profile_id=eq.${dupla.mentor_id}&href=eq./f/${TOKEN}`, { method: "DELETE" });
await svc(`duplas?id=eq.${DUPLA_ESP}`, {
  method: "PATCH",
  body: { status: "ativa", encerrada_em: null, motivo_encerramento: null, devolutiva_pdm: null },
});

console.log(`\n── 0104: ${ok} ok · ${falhas} falhas ──`);
process.exit(falhas ? 1 : 0);
