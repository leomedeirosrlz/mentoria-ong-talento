// valida 0105 (fixes do review multi-agent) contra o stack local
// (kong :54321) com logins GoTrue reais + service key — mesmo pipeline da
// app (RLS + claims de verdade). Só roda no stack local.
// uso: node scripts/_valida_0105_rest.mjs
//
// personas:
//   coordenacao e2e        e2e-coord@realiza.test
//   mentor da dupla de…0300 mentor@realiza.test (demo seed local)
//   especialista da …00e0  esp-e2e@realiza.test
//   2º especialista        esp2Profile (nunca loga — alvo do rematch)
//   service/anon           apikeys do stack — `supabase status`
//                            (ou envs PGRST_URL/PGRST_ANON_KEY/PGRST_SERVICE_KEY)
//
// O QUE VALIDA:
//   1) cap 3-por-vínculo também em UPDATE OF vinculo (antes só INSERT)
//   2) dupla fechada = histórico: PATCH em contato, reemitir_convite e
//      salvar_consolidado todos barrados com a dupla encerrada
//   3) rematch DPP carimba encerrada_em + motivo (antes era "só status")
//   4) rematch de trilha especialista faz o rito completo: carimbo +
//      motivo + link §13 emitido pro especialista que sai + notificação —
//      e a RPC de leitura devolve token só pro respondente, formulario_id
//      pra coord
// Restaura as fixtures no final (duplas voltam a ativa, sucessor/links/
// notas/notifs criados saem).

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

const DUPLA = "de000000-0000-4000-8000-000000000300"; // DPP demo (mentor@)
const DUPLA_ESP = "e2e00000-0000-4000-8000-0000000000e0"; // trilha esp (espProfile)
const ESP_PROFILE = "e2e00000-0000-4000-8000-000000000060";
const ESP2_PROFILE = "e2e00000-0000-4000-8000-0000000000c0";
const DUPLA_DPP2 = "e2e00000-0000-4000-8000-000000000070"; // DPP do reserva
const MENTORADO_LIVRE = "e2e00000-0000-4000-8000-000000000080";
const FORM_ESP = "5eed0001-0000-4000-8000-000000000008";
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

const rpc = (fn, args, opts) => api(`rpc/${fn}`, { method: "POST", body: args, ...opts });
const svc = (path, opts) => api(path, { ...opts, key: SVC_KEY });
const jwts = {};
const as = (email) => (jwts[email] ??= login(email));

const COORD = "e2e-coord@realiza.test";
const MENTOR = "mentor@realiza.test";
const ESP = "esp-e2e@realiza.test";

// ---------- restauração ----------

const restaurarDupla = async (id, statusOriginal = "ativa") =>
  svc(`duplas?id=eq.${id}`, {
    method: "PATCH",
    body: { status: statusOriginal, encerrada_em: null, motivo_encerramento: null, devolutiva_pdm: null },
  });

const cleanup = async () => {
  await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  await svc(`terceiros_consolidacao?dupla_id=eq.${DUPLA}`, { method: "DELETE" });
  // sucessoras de rematch: o autoemit minta links filhos no insert — sem
  // apagar os filhos antes, o DELETE da dupla bate na FK e morre quieto
  const succ = (await svc(
    `duplas?remanejada_de=in.(${DUPLA_DPP2},${DUPLA_ESP})&select=id`)).data ?? [];
  if (succ.length) {
    const ids = succ.map((s) => s.id).join(",");
    for (const t of ["formulario_links", "avaliacao_links", "avaliacoes_encontro",
      "chamados", "chamados_fila", "encaminhamentos", "encerramentos",
      "encontro_notas", "encontros", "interacoes", "supervisoes",
      "terceiros_consolidacao", "terceiros_contatos"]) {
      await svc(`${t}?dupla_id=in.(${ids})`, { method: "DELETE" });
    }
    await svc(`solicitacoes_especialista?or=(dupla_id.in.(${ids}),dupla_dpp_id.in.(${ids}))`,
      { method: "DELETE" });
    await svc(`duplas?id=in.(${ids})`, { method: "DELETE" });
  }
  await svc(`formulario_links?dupla_id=eq.${DUPLA_ESP}&formulario_id=eq.${FORM_ESP}`, { method: "DELETE" });
  await svc(`notificacoes?profile_id=eq.${ESP_PROFILE}&tipo=eq.avaliacao_pendente`, { method: "DELETE" });
  await svc(`notificacoes?profile_id=eq.${ESP2_PROFILE}&tipo=eq.avaliacao_pendente`, { method: "DELETE" });
  await svc(`pessoa_notas?texto=like.*remanejamento*`, { method: "DELETE" });
  await restaurarDupla(DUPLA);
  await restaurarDupla(DUPLA_DPP2);
  await restaurarDupla(DUPLA_ESP);
};

const run = async () => {
  await cleanup(); // idempotente entre runs

  const mentor = await as(MENTOR);
  const coord = await as(COORD);
  const esp = await as(ESP);

  // ---------- 1) cap por vínculo em UPDATE ----------

  for (let i = 1; i <= 3; i++) {
    const r = await api("terceiros_contatos", { method: "POST", token: mentor,
      body: { dupla_id: DUPLA, nome: `Amigo ${i}`, vinculo: "amigo" } });
    if (r.status >= 300) throw new Error(`seed amigo ${i}: ${JSON.stringify(r.data)}`);
  }
  let r = await api("terceiros_contatos", { method: "POST", token: mentor,
    body: { dupla_id: DUPLA, nome: "Pessoa Solta", vinculo: "outro" } });
  const solto = r.data?.[0];
  check("seed 3 amigos + 1 outro", !!solto?.id);

  // o buraco: PATCH vinculo outro→amigo com 3 amigos vivos tem que bater no cap
  r = await api(`terceiros_contatos?id=eq.${solto.id}`, { method: "PATCH", token: mentor,
    body: { vinculo: "amigo" } });
  check("UPDATE de vinculo respeita o cap 3 (outro→amigo negado)",
    r.status >= 400, `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 140)}`);
  const aindaOutro = (await svc(`terceiros_contatos?id=eq.${solto.id}&select=vinculo`)).data?.[0];
  check("vinculo ficou 'outro' após a tentativa", aindaOutro?.vinculo === "outro");

  // mover pra um vínculo com vaga funciona
  r = await api(`terceiros_contatos?id=eq.${solto.id}`, { method: "PATCH", token: mentor,
    body: { vinculo: "colega" } });
  check("UPDATE de vinculo dentro do cap passa (outro→colega)",
    r.status === 200 && r.data?.[0]?.vinculo === "colega");

  // PATCH idempotente no mesmo vínculo não se auto-conta (cap com a própria row fora)
  const amigo1 = (await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}&vinculo=eq.amigo&select=id&limit=1`)).data[0];
  r = await api(`terceiros_contatos?id=eq.${amigo1.id}`, { method: "PATCH", token: mentor,
    body: { vinculo: "amigo", nome: "Amigo 1 (renomeado)" } });
  check("UPDATE no mesmo vínculo não se auto-conta", r.status === 200);

  // ---------- 2) dupla fechada = histórico ----------

  const antes = (await svc(`duplas?id=eq.${DUPLA}&select=status`)).data?.[0]?.status ?? "ativa";
  // DPP fecha "só de status": duplas_encerramento_esp reserva os campos de
  // fechamento à trilha especialista — setar encerrada_em aqui daria 23514
  const c = await svc(`duplas?id=eq.${DUPLA}`, { method: "PATCH",
    body: { status: "encerrada" } });
  if (c.status >= 300) throw new Error(`fechar dupla: ${JSON.stringify(c.data)}`);

  // PATCH num contato pendente: a policy nova exige dupla viva — some da RLS
  r = await api(`terceiros_contatos?id=eq.${solto.id}`, { method: "PATCH", token: mentor,
    body: { nome: "Não devia editar" } });
  check("PATCH em contato de dupla encerrada não atualiza nada",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);

  // DELETE idem — cancelar convite em dupla morta apagava histórico
  r = await api(`terceiros_contatos?id=eq.${solto.id}`, { method: "DELETE", token: mentor });
  check("DELETE em contato de dupla encerrada não apaga nada",
    r.status === 200 && Array.isArray(r.data) && r.data.length === 0,
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);

  r = await rpc("reemitir_convite_terceiro", { p_contato_id: solto.id }, { token: mentor });
  check("reemitir_convite_terceiro barra dupla encerrada",
    r.status >= 400 && JSON.stringify(r.data).includes("encerrada"),
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 140)}`);

  r = await rpc("salvar_consolidado_terceiros",
    { p_dupla_id: DUPLA, p_consolidado: "síntese tardia", p_publicar: true },
    { token: mentor });
  check("salvar_consolidado_terceiros barra dupla encerrada",
    r.status >= 400, `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 140)}`);

  // lado público: token de dupla morta se apresenta como expirado e o
  // submit é recusado — resposta sem destino não entra
  const tokSolto = (await svc(`terceiros_contatos?id=eq.${solto.id}&select=token`)).data?.[0]?.token;
  r = await rpc("terceiro_por_token", { p_token: tokSolto });
  check("por_token apresenta link de dupla encerrada como expirado",
    r.status === 200 && r.data?.status === "expirado", JSON.stringify(r.data));
  r = await rpc("submeter_resposta_terceiro",
    { p_token: tokSolto, p_pontos_fortes: "tudo", p_a_melhorar: "nada" });
  check("submeter_resposta_terceiro recusa dupla encerrada",
    r.status >= 400, `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 140)}`);

  // 'concluida' segue viva pro consolidado (rito do ciclo aberto — a
  // síntese tardia ainda chega na jovem), mas nada mais se mexe
  await svc(`duplas?id=eq.${DUPLA}`, { method: "PATCH", body: { status: "concluida" } });
  r = await rpc("salvar_consolidado_terceiros",
    { p_dupla_id: DUPLA, p_consolidado: "síntese publicada após conclusão", p_publicar: true },
    { token: mentor });
  check("consolidado publica em dupla concluida",
    r.status === 200 && r.data?.ok === true, `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);
  r = await rpc("reemitir_convite_terceiro", { p_contato_id: solto.id }, { token: mentor });
  check("reemitir segue barrado em concluida (convite é coisa de trilha viva)",
    r.status >= 400, `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);

  await restaurarDupla(DUPLA, antes);
  await svc(`terceiros_contatos?dupla_id=eq.${DUPLA}`, { method: "DELETE" });

  // ---------- 3) rematch DPP com carimbo ----------

  r = await rpc("rematch_dupla",
    { p_dupla_id: DUPLA_DPP2, p_lado: "mentorado", p_novo_id: MENTORADO_LIVRE,
      // motivo longo de propósito: sem o left(...,300) estourava o check de
      // 300 chars com 23514 opaco — a UI manda até ~430
      p_motivo: "validacao 0105 ".padEnd(420, "x"), p_registrar_nota: true },
    { token: coord });
  const novaDpp = typeof r.data === "string" ? r.data : r.data?.rematch_dupla;
  check("rematch DPP cria a sucessora", r.status === 200 && !!novaDpp,
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 140)}`);

  const fechadaDpp = (await svc(
    `duplas?id=eq.${DUPLA_DPP2}&select=status,encerrada_em,motivo_encerramento`)).data?.[0];
  check("DPP rematada fecha por status (campos NULL — reserva do esp)",
    fechadaDpp?.status === "encerrada" && fechadaDpp.encerrada_em == null &&
    fechadaDpp.motivo_encerramento == null, JSON.stringify(fechadaDpp));
  const notaDpp = (await svc(
    `pessoa_notas?mentorado_id=eq.e2e00000-0000-4000-8000-000000000060&texto=like.*remanejamento*validacao%200105*&select=id`)).data;
  check("rematch DPP registra a nota de saída", notaDpp.length >= 1);
  // trilha DPP não emite form de especialista
  const linksDpp = (await svc(
    `formulario_links?dupla_id=eq.${DUPLA_DPP2}&formulario_id=eq.${FORM_ESP}&select=id`)).data;
  check("rematch DPP não emite avaliação de especialista", linksDpp.length === 0);

  // ---------- 4) rematch especialista = rito completo ----------

  // 0117: sem a devolutiva o rematch esp aborta — a dupla segue viva
  r = await rpc("rematch_dupla",
    { p_dupla_id: DUPLA_ESP, p_lado: "mentor", p_novo_id: ESP2_PROFILE,
      p_motivo: "mudou de cidade", p_registrar_nota: true },
    { token: coord });
  check("rematch esp sem devolutiva é barrado",
    r.status >= 400 && JSON.stringify(r.data)?.includes("devolutiva"),
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 160)}`);

  r = await rpc("rematch_dupla",
    { p_dupla_id: DUPLA_ESP, p_lado: "mentor", p_novo_id: ESP2_PROFILE,
      p_motivo: "mudou de cidade", p_registrar_nota: true,
      p_devolutiva: "validacao 0117: metas de leitura atingidas; manter o clube no PDM" },
    { token: coord });
  const novaEsp = typeof r.data === "string" ? r.data : r.data?.rematch_dupla;
  check("rematch esp cria a sucessora", r.status === 200 && !!novaEsp,
    `status=${r.status} ${JSON.stringify(r.data)?.slice(0, 180)}`);

  const fechadaEsp = (await svc(
    `duplas?id=eq.${DUPLA_ESP}&select=status,encerrada_em,motivo_encerramento,devolutiva_pdm`)).data?.[0];
  check("esp rematada carimba status+data+motivo sistêmico+devolutiva",
    fechadaEsp?.status === "encerrada" && !!fechadaEsp.encerrada_em &&
    fechadaEsp.motivo_encerramento?.includes("Remanejamento") &&
    fechadaEsp.motivo_encerramento?.includes("especialista") &&
    fechadaEsp.devolutiva_pdm?.includes("validacao 0117"),
    JSON.stringify(fechadaEsp));

  const linkEsp = (await svc(
    `formulario_links?dupla_id=eq.${DUPLA_ESP}&formulario_id=eq.${FORM_ESP}&select=token,dest_profile_id,usado_em`)).data?.[0];
  check("link §13 emitido pro especialista que sai",
    linkEsp?.dest_profile_id === ESP_PROFILE && !!linkEsp.token && linkEsp.usado_em == null,
    JSON.stringify(linkEsp));

  const notif = (await svc(
    `notificacoes?profile_id=eq.${ESP_PROFILE}&tipo=eq.avaliacao_pendente&select=href&order=created_at.desc&limit=1`)).data?.[0];
  check("notificação avaliacao_pendente chega com /f/<token>",
    notif?.href === `/f/${linkEsp?.token}`, JSON.stringify(notif));

  const sucessora = (await svc(
    `duplas?id=eq.${novaEsp}&select=mentor_id,trilha,status,remanejada_de`)).data?.[0];
  check("sucessora esp herda trilha e aponta a origem",
    sucessora?.mentor_id === ESP2_PROFILE && sucessora?.trilha === "especialista" &&
    sucessora?.status === "ativa" && sucessora?.remanejada_de === DUPLA_ESP,
    JSON.stringify(sucessora));

  // RPC de leitura: token só pro especialista; coord vê estado + form
  r = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: esp });
  check("especialista recebe token + formulario_id",
    r.data?.token === linkEsp?.token && r.data?.formulario_id === FORM_ESP &&
    r.data?.respondido === false, JSON.stringify(r.data));
  r = await rpc("avaliacao_esp_da_dupla", { p_dupla: DUPLA_ESP }, { token: coord });
  check("coord recebe estado + formulario_id, sem token",
    r.data?.formulario_id === FORM_ESP && r.data?.respondido === false &&
    !("token" in (r.data ?? {})) || r.data?.token == null,
    JSON.stringify(r.data));
};

await run().finally(cleanup);
console.log(`\n${ok} ok · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
