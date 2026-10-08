#!/usr/bin/env node
// seed-e2e-staging — fixtures mínimas pro e2e de app (backend real) no
// Supabase de STAGING. Idempotente: re-rodar só confere/repara.
//
// Uso (depois de `supabase db push` no projeto de staging, que já aplica
// todas as migrations + seed.sql do domínio):
//
//   E2E_SUPABASE_URL=https://<staging>.supabase.co \
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   E2E_MENTOR_PASSWORD=<senha-de-teste> \
//   node scripts/seed-e2e-staging.mjs
//
// Cria: profile mentor_dpp + auth user (senha_em setada → pula definir-senha),
// mentorado e dupla DPP ativa no 1º cronograma — IDs fixos e2e00000-*, que o
// workflow usa pra cleanup determinístico.

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const SENHA = process.env.E2E_MENTOR_PASSWORD;

if (!URL_ || !KEY || !SENHA) {
  console.error("uso: E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY e E2E_MENTOR_PASSWORD");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, "Content-Type": "application/json", Prefer: "return=representation" };

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  dupla: "e2e00000-0000-4000-8000-000000000030",
};
const EMAIL = "e2e-mentor@realiza.test";

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...HJ, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// ---- cronograma existente (o seed.sql do domínio já criou um) ----
const [cron] = await rest("cronogramas?select=id,turma&order=inicio_em&limit=1");
if (!cron) {
  console.error("nenhum cronograma no staging — rode `supabase db push` (migrations + seed) antes");
  process.exit(1);
}
console.log(`cronograma: ${cron.id} (${cron.turma})`);

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
if (!mentor.user_id) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: HJ,
    body: JSON.stringify({
      email: EMAIL,
      password: SENHA,
      email_confirm: true,
      user_metadata: { senha_em: new Date().toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`admin createUser → ${res.status}: ${await res.text()}`);
  const user = await res.json();
  // o trigger handle_new_user já vinculou user_id pelo e-mail
  console.log(`auth user criado: ${user.id}`);
} else {
  console.log(`auth user já vinculado: ${mentor.user_id}`);
}

// ---- mentorado + dupla ----
const [m] = await rest(`mentorados?select=id&id=eq.${IDS.mentorado}`);
if (!m) {
  await rest("mentorados", {
    method: "POST",
    body: JSON.stringify({ id: IDS.mentorado, nome: "Mentorada E2E" }),
  });
  console.log("mentorada criada");
}

const [d] = await rest(`duplas?select=id&id=eq.${IDS.dupla}`);
if (!d) {
  await rest("duplas", {
    method: "POST",
    body: JSON.stringify({
      id: IDS.dupla,
      mentor_id: IDS.mentorProfile,
      mentorado_id: IDS.mentorado,
      turma: cron.turma,
      cronograma_id: cron.id,
      trilha: "dpp",
      status: "ativa",
      iniciada_em: "2026-09-08",
    }),
  });
  console.log("dupla criada");
}

console.log("\nseed e2e ok. Secrets pro CI:");
console.log(`  E2E_MENTOR_EMAIL=${EMAIL}`);
console.log("  E2E_MENTOR_PASSWORD=<a que você passou>");
console.log(`  E2E_DUPLA_ID=${IDS.dupla}`);
console.log("  E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY = do staging");
