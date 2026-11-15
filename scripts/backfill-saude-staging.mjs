#!/usr/bin/env node
// backfill-saude-staging — roda o MESMO job do tick (/api/jobs/saude-snapshots)
// de pé num processo local contra o staging: recalcula o semáforo de cada
// dupla ativa/pausada dia a dia no range --desde→hoje e grava via a RPC
// gravar_saude_snapshots (fonte='backfill'). Idempotente: a unique
// (dupla_id, dia) faz re-run ser no-op.
//
// Uso:
//   E2E_SUPABASE_URL=https://<staging>.supabase.co \
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   node scripts/backfill-saude-staging.mjs [--desde=YYYY-MM-DD]

import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("uso: E2E_SUPABASE_URL + E2E_SUPABASE_SERVICE_ROLE_KEY [--desde=YYYY-MM-DD]");
  process.exit(2);
}
if (URL_.includes("yhjzmxleotahijinjepl")) {
  console.error("E2E_SUPABASE_URL aponta pra produção — abortado");
  process.exit(2);
}

// createAdminClient lê estas envs — aponta o client do job pro staging.
process.env.NEXT_PUBLIC_SUPABASE_URL = URL_;
process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(ROOT, "src") },
});
const { rodarSaudeSnapshots } = await jiti.import(
  path.join(ROOT, "src/lib/jobs.ts")
);
const { toDateStr } = await jiti.import(
  path.join(ROOT, "src/lib/ciclo.ts")
);

const hoje = toDateStr(new Date());
const desdeArg = process.argv
  .find((a) => a.startsWith("--desde="))
  ?.split("=")[1];
const desde =
  desdeArg ?? toDateStr(new Date(Date.now() - 30 * 864e5));

console.log(`backfill ${desde} → ${hoje} (${URL_})`);
const r = await rodarSaudeSnapshots({ hoje, desde });
console.log(JSON.stringify(r, null, 2));
process.exit(r.ok ? 0 : 1);
