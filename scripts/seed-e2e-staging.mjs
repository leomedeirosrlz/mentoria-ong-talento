#!/usr/bin/env node
// seed-e2e-staging — fixtures mínimas pro e2e de app (backend real) num
// Supabase de TESTE descartável: o stack local do CI (`supabase start` no
// runner — e2e-app.yml) ou um projeto staging remoto. Idempotente.
//
// Uso (depois das migrations + seed.sql do domínio estarem aplicados):
//
//   E2E_SUPABASE_URL=http://127.0.0.1:54321 \  # ou https://<staging>.supabase.co
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   E2E_MENTOR_PASSWORD=<senha-de-teste> \
//   node scripts/seed-e2e-staging.mjs
//
// Cria: profile mentor_dpp + auth user (senha_em setada → pula definir-senha),
// mentorado e dupla DPP ativa no 1º cronograma; profile coordenacao + auth
// user (mesmo esquema de senha); um mentor reserva com a 2ª dupla; um
// mentorado livre (fila "Aguardando par" + alvo do remanejo) e um par livre
// pra importação CSV. IDs fixos e2e00000-*, que o workflow usa pra cleanup
// determinístico.

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const SENHA = process.env.E2E_MENTOR_PASSWORD;
// coord usa a mesma senha do mentor quando E2E_COORD_PASSWORD não vem — um
// segredo de teste a menos no CI local
const SENHA_COORD = process.env.E2E_COORD_PASSWORD || SENHA;

if (!URL_ || !KEY || !SENHA) {
  console.error("uso: E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY e E2E_MENTOR_PASSWORD");
  process.exit(2);
}
if (URL_.includes("yhjzmxleotahijinjepl")) {
  // mesmo hard-stop do helpers.ts — este script escreve de verdade
  console.error("E2E_SUPABASE_URL aponta pra produção — abortado");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, "Content-Type": "application/json", Prefer: "return=representation" };

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  dupla: "e2e00000-0000-4000-8000-000000000030",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  mentorReserva: "e2e00000-0000-4000-8000-000000000050",
  mentorado2: "e2e00000-0000-4000-8000-000000000060",
  dupla2: "e2e00000-0000-4000-8000-000000000070",
  mentoradoLivre: "e2e00000-0000-4000-8000-000000000080",
  mentorImport: "e2e00000-0000-4000-8000-000000000090",
  mentoradoImport: "e2e00000-0000-4000-8000-0000000000a0",
};
const EMAIL = "e2e-mentor@realiza.test";
const COORD_EMAIL = "e2e-coord@realiza.test";
// turma que o spec de cronograma cria pelo builder — prefixo único pro
// cleanup não depender de id conhecido
const TURMA_E2E_PREFIX = "E2E ";

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...HJ, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
const del = (path) => rest(path, { method: "DELETE" });
const patch = (path, body) =>
  rest(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });

// ---- cronograma existente (o seed.sql do domínio já criou um) ----
const [cron] = await rest("cronogramas?select=id,turma&order=inicio_em&limit=1");
if (!cron) {
  console.error("nenhum cronograma no staging — rode `supabase db push` (migrations + seed) antes");
  process.exit(1);
}
console.log(`cronograma: ${cron.id} (${cron.turma})`);

// ---- limpeza de leftovers de runs anteriores ----
// o afterEach dos specs é a regra; isto é o piso pra quando um run morre no
// meio — sem ele, um remanejo/cronograma/import pendurado quebrava o run
// seguinte em cascata (dupla2 encerrada, "par já existe", turma duplicada).
{
  await del(`duplas?remanejada_de=eq.${IDS.dupla2}`); // sucessoras de remanejo
  await del(`duplas?mentor_id=eq.${IDS.mentorImport}`); // par do import CSV
  await del(`duplas?mentorado_id=eq.${IDS.mentoradoLivre}`); // qualquer vínculo do livre
  await patch(`duplas?id=eq.${IDS.dupla2}`, { status: "ativa" });
  const e2eProfiles = [IDS.mentorProfile, IDS.coordProfile, IDS.mentorReserva, IDS.mentorImport].join(",");
  const e2eMentorados = [IDS.mentorado, IDS.mentorado2, IDS.mentoradoLivre, IDS.mentoradoImport].join(",");
  // nota de saída do remanejo + notificações "dupla_formada" dos specs
  await del(
    `pessoa_notas?texto=like.*remanejamento*&or=(profile_id.in.(${e2eProfiles}),mentorado_id.in.(${e2eMentorados}))`
  );
  await del(`notificacoes?profile_id=in.(${e2eProfiles})`);
  // cronogramas criados pelo spec de turmas — eventos primeiro: a FK
  // ciclo_eventos.cronograma_id (0061) não tem ON DELETE CASCADE
  const crons = await rest(`cronogramas?select=id&turma=like.${encodeURIComponent(TURMA_E2E_PREFIX)}*`);
  if (crons?.length) {
    const ids = crons.map((c) => c.id).join(",");
    await del(`ciclo_eventos?cronograma_id=in.(${ids})`);
    await del(`cronogramas?id=in.(${ids})`);
    console.log(`limpeza: ${crons.length} cronograma(s) E2E removidos`);
  }
}

// ---- profile do mentor (precisa existir ANTES do auth user pro trigger vincular) ----
let [mentor] = await rest(`profiles?select=id,user_id&email=eq.${EMAIL}`);
if (!mentor) {
  [mentor] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorProfile,
      email: EMAIL,
      nome: "Mentor E2E",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile mentor criado");
} else {
  console.log("profile mentor já existe");
}

// ---- auth user com senha (senha_em → o app não desvia pra /auth/definir-senha) ----
async function garantirAuthUser(email, senha, profile) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: HJ,
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { senha_em: new Date().toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`admin createUser ${email} → ${res.status}: ${await res.text()}`);
  const user = await res.json();
  // o trigger handle_new_user já vinculou user_id pelo e-mail
  console.log(`auth user criado: ${user.id} (${email})`);
  return user;
}

if (!mentor.user_id) {
  await garantirAuthUser(EMAIL, SENHA, mentor);
} else {
  console.log(`auth user mentor já vinculado: ${mentor.user_id}`);
}

// ---- profile da coordenação + auth user (login próprio dos specs de coord) ----
let [coord] = await rest(`profiles?select=id,user_id&email=eq.${COORD_EMAIL}`);
if (!coord) {
  [coord] = await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.coordProfile,
      email: COORD_EMAIL,
      nome: "Coordenação E2E",
      role: "coordenacao",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("profile coord criado");
} else {
  console.log("profile coord já existe");
}
if (!coord.user_id) {
  await garantirAuthUser(COORD_EMAIL, SENHA_COORD, coord);
} else {
  console.log(`auth user coord já vinculado: ${coord.user_id}`);
}

// ---- mentor reserva: tem a 2ª dupla; sem auth user (nunca loga) ----
const [reserva] = await rest(`profiles?select=id&id=eq.${IDS.mentorReserva}`);
if (!reserva) {
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorReserva,
      email: "e2e-mentor-reserva@realiza.test",
      nome: "Mentor E2E Reserva",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("mentor reserva criado");
}

// ---- mentor livre pro import CSV — profile sem dupla, sem auth ----
const [mImport] = await rest(`profiles?select=id&id=eq.${IDS.mentorImport}`);
if (!mImport) {
  await rest("profiles", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.mentorImport,
      email: "e2e-mentor-import@realiza.test",
      nome: "Mentor E2E Import",
      role: "mentor_dpp",
      ativo: true,
      onboarded_em: new Date().toISOString(),
    }),
  });
  console.log("mentor do import criado");
}

// ---- mentorados + duplas ----
const MENTORADOS = [
  { id: IDS.mentorado, nome: "Mentorada E2E" },
  { id: IDS.mentorado2, nome: "Mentorada E2E Dois" },
  // livre de propósito: alvo do remanejo e visível na fila "Aguardando par"
  { id: IDS.mentoradoLivre, nome: "Mentorada E2E Livre", ong_origem: "ONG E2E", whatsapp: "5511999000080" },
  { id: IDS.mentoradoImport, nome: "Mentorado E2E Import" },
];
for (const m of MENTORADOS) {
  const [existe] = await rest(`mentorados?select=id&id=eq.${m.id}`);
  if (!existe) {
    await rest("mentorados", { method: "POST", body: JSON.stringify(m) });
    console.log(`mentorado criado: ${m.nome}`);
  }
}

const DUPLAS = [
  { id: IDS.dupla, mentor_id: IDS.mentorProfile, mentorado_id: IDS.mentorado },
  { id: IDS.dupla2, mentor_id: IDS.mentorReserva, mentorado_id: IDS.mentorado2 },
];
for (const d of DUPLAS) {
  const [existe] = await rest(`duplas?select=id&id=eq.${d.id}`);
  if (!existe) {
    await rest("duplas", {
      method: "POST",
      body: JSON.stringify({
        ...d,
        turma: cron.turma,
        cronograma_id: cron.id,
        trilha: "dpp",
        status: "ativa",
        iniciada_em: "2026-09-08",
      }),
    });
    console.log(`dupla criada: ${d.id}`);
  }
}

console.log("\nseed e2e ok. Secrets/envs pro CI:");
console.log(`  E2E_MENTOR_EMAIL=${EMAIL}`);
console.log("  E2E_MENTOR_PASSWORD=<a que você passou>");
console.log(`  E2E_DUPLA_ID=${IDS.dupla}`);
console.log(`  E2E_COORD_EMAIL=${COORD_EMAIL}`);
console.log("  E2E_COORD_PASSWORD=<a que você passou, ou a do mentor>");
console.log(`  E2E_DUPLA2_ID=${IDS.dupla2}`);
console.log("  E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY = do staging");
