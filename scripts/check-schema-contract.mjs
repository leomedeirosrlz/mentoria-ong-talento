#!/usr/bin/env node
// check-schema-contract — trava o drift que aconteceu com a 0061/0062:
// código (e database.types.ts) esperando colunas que o remoto não tem.
//
// Lê as colunas de cada tabela em `src/lib/database.types.ts` (Row: {...})
// e compara com o que o PostgREST do remoto expõe (GET /rest/v1/ → OpenAPI).
// Falha se o código declara coluna ausente no remoto; avisa (não falha) se o
// remoto tem coluna que o types não conhece — types desatualizado, não bug.
//
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/check-schema-contract.mjs

import { readFileSync } from "node:fs";

const URL_ = process.env.E2E_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error("schema-contract: falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

// ---- extrai Row keys por tabela do types gerado ----
const src = readFileSync("src/lib/database.types.ts", "utf8");
const tabelas = new Map(); // tabela -> Set<coluna>

// `Tables:` aparece duas vezes no arquivo gerado — o primeiro é do
// __InternalSupabase (vazio). O que interessa é o do schema public.
const publicStart = src.indexOf("  public: {");
const tablesStart = src.indexOf("Tables: {", publicStart);
if (publicStart < 0 || tablesStart < 0) {
  console.error("schema-contract: bloco public.Tables não encontrado em database.types.ts");
  process.exit(2);
}
// Views vem logo depois de Tables no arquivo gerado
const tablesEnd = src.indexOf("\n    Views:", tablesStart);
const tablesBlock = src.slice(tablesStart, tablesEnd > 0 ? tablesEnd : undefined);

// cada tabela abre com `      nome: {` (6 espaços)
for (const m of tablesBlock.matchAll(/^ {6}(\w+): \{/gm)) {
  const nome = m[1];
  const resto = tablesBlock.slice(m.index);
  const rowM = resto.match(/Row: \{([\s\S]*?)\n        \}/);
  if (!rowM) continue;
  const cols = new Set();
  for (const linha of rowM[1].split("\n")) {
    const cm = linha.match(/^\s*("?[\w]+"?)\??:/);
    if (cm) cols.add(cm[1].replaceAll('"', ""));
  }
  tabelas.set(nome, cols);
}
console.log(`schema-contract: ${tabelas.size} tabelas declaradas em database.types.ts`);

// ---- schema real do remoto via OpenAPI do PostgREST ----
const res = await fetch(`${URL_}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error(`schema-contract: GET /rest/v1/ → ${res.status}`);
  process.exit(2);
}
const openapi = await res.json();
const remote = openapi.definitions ?? {};

let erros = 0;
let avisos = 0;
for (const [tabela, cols] of tabelas) {
  const def = remote[tabela];
  if (!def) {
    console.error(`✗ tabela ausente no remoto: ${tabela}`);
    erros++;
    continue;
  }
  const remotas = new Set(Object.keys(def.properties ?? {}));
  for (const c of cols) {
    if (!remotas.has(c)) {
      console.error(`✗ ${tabela}.${c} — código declara, remoto não tem`);
      erros++;
    }
  }
  for (const c of remotas) {
    if (!cols.has(c)) {
      console.warn(`⚠ ${tabela}.${c} — remoto tem, types não conhece (regenerar types)`);
      avisos++;
    }
  }
}

if (erros) {
  console.error(`\nschema-contract: ${erros} divergência(s) — código à frente do schema remoto. Provável migration não aplicada.`);
  process.exit(1);
}
console.log(`schema-contract: ok (${avisos} aviso(s) de types desatualizado)`);
