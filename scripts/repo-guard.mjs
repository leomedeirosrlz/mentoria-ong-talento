#!/usr/bin/env node
// repo-guard — regras objetivas e baratas contra regressão de agente de IA.
// READ-ONLY: não escreve nada no repo. Sai 1 se alguma regra falhar.
//
// Uso:
//   node scripts/repo-guard.mjs                 # gate de PR (base = origin/main)
//   BASE_REF=origin/staging node scripts/repo-guard.mjs
//   node scripts/repo-guard.mjs --verbose
//
// Requer histórico (actions/checkout com fetch-depth: 0) só para a R1.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const VERBOSE = process.argv.includes("--verbose");
const BASE = process.env.BASE_REF || "origin/main";

// Baseline histórico: migrations aplicadas via MCP antes da convenção de 4
// dígitos. São imutáveis e ficam fora da checagem de numeração.
const LEGADO_NOME = new Set([
  "20261028224422_mcp_apply_migration.sql",
  "20261031020338_mcp_apply_migration.sql",
]);

const resultados = [];
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" });
const lista = (cmd, args) => sh(cmd, args).split("\n").filter(Boolean);

function regra(nome, fn) {
  try {
    const r = fn() ?? {};
    resultados.push({ nome, status: "PASS", ...r });
  } catch (e) {
    if (e.codigo === "WARN") resultados.push({ nome, status: "WARN", detalhe: e.message });
    else resultados.push({ nome, status: "FAIL", detalhe: e.message });
  }
}
const falha = (msg) => { throw new Error(msg); };
const aviso = (msg) => { const e = new Error(msg); e.codigo = "WARN"; throw e; };

// ── R1 · migrations existentes no base não podem ser editadas/removidas ──
regra("R1 migrations imutáveis", () => {
  let base;
  try { base = sh("git", ["merge-base", BASE, "HEAD"]).trim(); }
  catch { falha(`não achei merge-base com ${BASE} — checkout precisa de fetch-depth: 0`); }
  const out = sh("git", ["diff", "--name-status", "--diff-filter=MDR", base, "HEAD", "--", "supabase/migrations"]).trim();
  if (out) falha(`migration do base alterada/removida:\n${out}`);
  const novas = sh("git", ["diff", "--name-status", "--diff-filter=A", base, "HEAD", "--", "supabase/migrations"]).trim();
  return { detalhe: `${novas ? novas.split("\n").length : 0} migration(s) nova(s), 0 alterada(s)` };
});

// ── R2 · create table/view nas migrations precisa existir em database.types.ts ──
regra("R2 types cobre migrations", () => {
  const dir = "supabase/migrations";
  const arquivos = lista("git", ["ls-files", dir]).filter((f) => f.endsWith(".sql")).sort();
  const semComentario = (sql) =>
    sql
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/--[^\n]*/g, " ")
      // corpos dollar-quoted ($fn$, $$) podem conter DDL de exemplo
      .replace(/\$[a-zA-Z_]*\$[\s\S]*?\$[a-zA-Z_]*\$/g, " ");

  const criados = new Set();
  const removidos = new Set();
  for (const f of arquivos) {
    const sql = semComentario(readFileSync(f, "utf8"));
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) criados.add(m[1]);
    for (const m of sql.matchAll(/drop\s+(?:table|view|materialized\s+view)\s+(?:if\s+exists\s+)?public\.(\w+)/gi)) removidos.add(m[1]);
  }
  const types = readFileSync("src/lib/database.types.ts", "utf8");
  const pub = types.slice(types.indexOf("  public: {"));
  const declaradas = new Set([...pub.matchAll(/^ {6}(\w+): \{/gm)].map((m) => m[1]));
  const vivas = [...criados].filter((t) => !removidos.has(t));
  const faltando = vivas.filter((t) => !declaradas.has(t));
  if (faltando.length) falha(`objeto criado em migration e ausente em database.types.ts: ${faltando.join(", ")} — rode supabase gen types`);
  return { detalhe: `${vivas.length} objetos vivos, 0 fora do types` };
});

// ── R3 · nenhum .env* nem segredo versionado ──
regra("R3 sem segredo no repo", () => {
  const arquivos = lista("git", ["ls-files"]);
  const env = arquivos.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !/\.(example|sample|template)$/.test(f));
  if (env.length) falha(`arquivo .env versionado: ${env.join(", ")}`);

  const RE = /(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|re_[A-Za-z0-9]{24,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----|eyJhbGciOiJIUzI1NiIs[A-Za-z0-9_-]{20,})/;
  const PULA = /(^pnpm-lock\.yaml$|\.(png|jpe?g|gif|webp|svg|pdf|docx|xlsx|ico|woff2?|ttf|mp4|zip|dbml|sqlite)$)/i;
  const hits = [];
  for (const f of arquivos) {
    if (PULA.test(f)) continue;
    let st; try { st = statSync(f); } catch { continue; }
    if (st.size > 2_000_000) continue;
    const linhas = readFileSync(f, "utf8").split("\n");
    linhas.forEach((l, i) => { if (RE.test(l)) hits.push(`${f}:${i + 1}`); });
  }
  if (hits.length) falha(`possível segredo commitado: ${hits.slice(0, 10).join(", ")}`);
  return { detalhe: `${arquivos.length} arquivos varridos` };
});

// ── R4 · bloco nextjs-agent-rules intacto ──
regra("R4 AGENTS.md/CLAUDE.md", () => {
  const agents = readFileSync("AGENTS.md", "utf8");
  for (const marcador of ["<!-- BEGIN:nextjs-agent-rules -->", "<!-- END:nextjs-agent-rules -->", "node_modules/next/dist/docs/"]) {
    if (!agents.includes(marcador)) falha(`AGENTS.md perdeu "${marcador}"`);
  }
  const claude = readFileSync("CLAUDE.md", "utf8");
  if (!/@AGENTS\.md/.test(claude)) falha("CLAUDE.md perdeu o import @AGENTS.md");
  return { detalhe: "marcadores + import presentes" };
});

// ── R5 · links relativos em markdown não quebram ──
regra("R5 links de docs", () => {
  const arquivos = lista("git", ["ls-files", "*.md"]);
  const quebrados = [];
  let total = 0;
  for (const f of arquivos) {
    const texto = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const m of texto.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:|#|\/)/.test(href)) continue; // "/rota" = rota do app, não arquivo
      const alvo = href.split("#")[0];
      if (!alvo) continue;
      total++;
      if (!existsSync(resolve(dirname(f), decodeURI(alvo)))) quebrados.push(`${f} → ${href}`);
    }
  }
  if (quebrados.length) falha(`link relativo quebrado:\n${quebrados.slice(0, 15).join("\n")}`);
  return { detalhe: `${total} links em ${arquivos.length} arquivos md` };
});

// ── R6 · actionlint (se o binário existir) ──
regra("R6 actionlint", () => {
  let bin = process.env.ACTIONLINT || "";
  if (!bin) for (const c of ["/tmp/opencode/actionlint", "actionlint"]) {
    try { sh(c, ["--version"]); bin = c; break; } catch { /* segue */ }
  }
  if (!bin) aviso("actionlint não instalado — rode via raven-actions/actionlint no CI");
  try { sh(bin, ["-no-color"]); }
  catch (e) { falha(`actionlint:\n${(e.stdout || "").toString().slice(0, 2000)}`); }
  return { detalhe: "workflows válidos" };
});

// ── R7 · versão de node única nos workflows (+ engines) ──
regra("R7 node version coerente", () => {
  const wfs = lista("git", ["ls-files", ".github/workflows"]).filter((f) => /\.ya?ml$/.test(f));
  const versoes = new Set();
  for (const f of wfs) for (const m of readFileSync(f, "utf8").matchAll(/node-version:\s*['"]?([^'"\n#]+)/g)) {
    const v = m[1].trim();
    if (/^\d+$/.test(v)) versoes.add(v);
  }
  if (versoes.size === 0) aviso("nenhum node-version numérico declarado nos workflows");
  if (versoes.size > 1) falha(`node-version divergente nos workflows: ${[...versoes].join(", ")}`);
  const versao = [...versoes][0];
  const majors = (rango) =>
    [...rango.matchAll(/(?:>=|\^|~)?\s*(\d+)(?:\.\d+)*/g)].map((m) => Number(m[1]));
  const engine = JSON.parse(readFileSync("package.json", "utf8")).engines?.node;
  if (!engine) aviso(`package.json sem "engines.node" — CI usa ${versao}`);
  else if (!majors(engine).includes(Number(versao)))
    falha(`engines.node="${engine}" não cobre a versão do CI (${versao})`);
  return { detalhe: `node ${versao} em ${wfs.length} workflows${engine ? ` · engines ${engine}` : ""}` };
});

// ── R8 · next-env.d.ts pertence ao `next dev`, não ao build ──
regra("R8 next-env.d.ts", () => {
  const src = readFileSync("next-env.d.ts", "utf8");
  if (/\.next\/types\//.test(src)) falha("next-env.d.ts foi sobrescrito por `next build`/`next typegen` (caminho .next/types). Desfaça com `git checkout -- next-env.d.ts` — o estado versionado é o do `next dev`.");
  return { detalhe: "aponta pro typegen de dev" };
});

// ── R9 · numeração de migration sempre crescente e sem repetição ──
regra("R9 numeração de migration", () => {
  let base;
  try { base = sh("git", ["merge-base", BASE, "HEAD"]).trim(); }
  catch { aviso("sem merge-base — numeração não checada"); }
  const nome = (f) => f.replace(/^.*\//, "");
  const prefixo = (f) => {
    if (LEGADO_NOME.has(nome(f))) return null;
    const m = nome(f).match(/^(\d{4})_[a-z0-9_]+\.sql$/);
    if (!m) falha(`nome fora da convenção NNNN_snake_case.sql: ${nome(f)}`);
    return Number(m[1]);
  };
  const agora = lista("git", ["ls-files", "supabase/migrations"]);
  const antes = lista("git", ["ls-tree", "--name-only", base, "supabase/migrations/"]);
  const nomesAntes = new Set(antes.map(nome));
  const novos = agora.filter((f) => !nomesAntes.has(nome(f)));
  const porPrefixo = new Map();
  for (const f of agora) {
    const p = prefixo(f);
    if (p === null) continue;
    if (!porPrefixo.has(p)) porPrefixo.set(p, []);
    porPrefixo.get(p).push(nome(f));
  }
  const repetidos = [...porPrefixo.values()].filter((fs) => fs.length > 1);
  if (repetidos.length) falha(`número de migration repetido: ${repetidos.map((fs) => fs.join(" + ")).join("; ")}`);
  const maxAntes = Math.max(...antes.map(prefixo).filter((n) => n !== null));
  const baixos = novos.map((f) => [prefixo(f), nome(f)]).filter(([p]) => p !== null && p <= maxAntes);
  if (baixos.length) falha(`migration nova com número ≤ ${maxAntes} do base: ${baixos.map(([, n]) => n).join(", ")}`);
  const resumo = novos.length > 4 ? `${novos.length} novas (${novos.slice(0, 3).map(nome).join(", ")}, …)` : novos.map(nome).join(", ") || "—";
  return { detalhe: `max base ${maxAntes}, ${resumo}` };
});

// ── R10 · scripts ESM com sintaxe válida + JSONs parseiam ──
regra("R10 scripts/json válidos", () => {
  const mjs = lista("git", ["ls-files", "scripts/*.mjs"]);
  const quebrados = [];
  for (const f of mjs) {
    try { sh("node", ["--check", f]); }
    catch (e) { quebrados.push(`${f}: ${(e.stderr || "").toString().split("\n")[0]}`); }
  }
  if (quebrados.length) falha(`script com sintaxe inválida:\n${quebrados.join("\n")}`);
  const jsons = lista("git", ["ls-files", "*.json"]).filter((f) => !/node_modules|tsconfig\.tsbuildinfo/.test(f));
  for (const f of jsons) {
    try { JSON.parse(readFileSync(f, "utf8")); }
    catch { falha(`JSON inválido: ${f}`); }
  }
  return { detalhe: `${mjs.length} scripts, ${jsons.length} json` };
});

// ── relatório ──
const largura = Math.max(...resultados.map((r) => r.nome.length));
for (const r of resultados) {
  const cor = r.status === "FAIL" ? "\x1b[31m" : r.status === "WARN" ? "\x1b[33m" : "\x1b[32m";
  console.log(`${cor}${r.status}\x1b[0m ${r.nome.padEnd(largura)}  ${VERBOSE || r.status !== "PASS" ? r.detalhe ?? "" : ""}`);
}
const falhas = resultados.filter((r) => r.status === "FAIL").length;
console.log(`\nrepo-guard: ${resultados.length - falhas}/${resultados.length} regras ok (base ${BASE})`);
process.exit(falhas ? 1 : 0);
