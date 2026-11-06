#!/usr/bin/env node
// Eval da Liza — um ponto de entrada, dois modos (sdd D6, pacote nov/2026):
//
//   node scripts/eval-ia.mjs            → contrato (padrão, CI-safe)
//   node scripts/eval-ia.mjs --live     → live contra um ambiente real
//
// CONTRATO é determinístico: o roteador puro roda aqui mesmo (TS sem
// dependências, o Node 26 faz strip de tipos) e o resto — gate de papel,
// prompt por papel — delega pra `vitest run tests/evals/contrato.test.ts`,
// que compartilha o mesmo casos.json.
//
// LIVE é opt-in e faz HTTP de verdade contra /api/ia/chat:
//   EVAL_BASE_URL  — ex.: http://localhost:3000 ou a URL do preview
//   EVAL_COOKIE    — header Cookie da sessão (copiado do DevTools logado;
//                    o endpoint exige sessão, PAT não serve pro chat)
// A saída lista caso a caso: PASS/FAIL, tools vistas no stream e o trecho
// da resposta. Falha sai com exit 1. Live não roda em CI — a credencial é
// de quem dispara.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const casos = JSON.parse(
  readFileSync(join(raiz, "tests/evals/casos.json"), "utf8")
);
const LIVE = process.argv.includes("--live");

const ok = (id, det = "") => ({ id, pass: true, det });
const falha = (id, det = "") => ({ id, pass: false, det });

// ---------- contrato: roteador puro aqui, resto no vitest ----------

async function roteador() {
  const { rotearTier } = await import(
    join(raiz, "src/lib/ia/roteador.ts")
  );
  return casos.contrato.tier.map((c) =>
    rotearTier(c.msg, c.opts ?? {}) === c.espera
      ? ok(c.id)
      : falha(c.id, `tier deu ${rotearTier(c.msg, c.opts ?? {})}, esperava ${c.espera}`)
  );
}

// ---------- live: POST /api/ia/chat, SSE → tools + texto ----------

async function live() {
  const base = process.env.EVAL_BASE_URL;
  const cookie = process.env.EVAL_COOKIE;
  if (!base || !cookie) {
    console.error(
      "live precisa de EVAL_BASE_URL e EVAL_COOKIE (cookie da sessão logada)"
    );
    process.exit(2);
  }
  const resultados = [];
  for (const c of casos.live) {
    try {
      const res = await fetch(`${base}/api/ia/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ mensagem: c.msg, conversaId: `eval-${c.id}` }),
      });
      if (!res.ok) {
        resultados.push(falha(c.id, `HTTP ${res.status}`));
        continue;
      }
      const { tools, texto } = await lerSse(res);
      const problemas = [];
      if (c.tools_esperadas) {
        const padrao = new RegExp(c.tools_esperadas.join("|"));
        if (!tools.some((t) => padrao.test(t)))
          problemas.push(`nenhuma tool de ${c.tools_esperadas} (viu: ${tools.join(",") || "—"})`);
      }
      if (c.tools_nao_pode) {
        const padrao = new RegExp(c.tools_nao_pode.join("|"));
        const vazou = tools.filter((t) => padrao.test(t));
        if (vazou.length) problemas.push(`tool proibida: ${vazou.join(",")}`);
      }
      for (const re of c.resposta_contem ?? [])
        if (!new RegExp(re, "i").test(texto))
          problemas.push(`resposta sem /${re}/`);
      for (const re of c.resposta_nao_contem ?? [])
        if (new RegExp(re, "i").test(texto))
          problemas.push(`resposta COM /${re}/`);
      resultados.push(
        problemas.length
          ? falha(c.id, problemas.join("; "))
          : ok(c.id, `tools: ${tools.join(",") || "—"}`)
      );
    } catch (e) {
      resultados.push(falha(c.id, String(e)));
    }
  }
  return resultados;
}

/** Lê o SSE da rota: {type:"tool"} guarda o nome, os deltas montam o texto. */
async function lerSse(res) {
  const tools = [];
  let texto = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() ?? "";
    for (const l of linhas) {
      if (!l.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(l.slice(5).trim());
        if (ev.type === "tool" && ev.nome) tools.push(ev.nome);
        if (ev.type === "delta" && ev.t) texto += ev.t;
        if (ev.type === "text" && ev.t) texto += ev.t;
      } catch {
        /* linha parcial/comentário */
      }
    }
  }
  return { tools, texto };
}

// ---------- main ----------

const resultados = LIVE ? await live() : await roteador();
let saiuVitest = 0;
if (!LIVE) {
  // gate/prompt rodam no vitest com os mesmos casos — a saída dele já
  // detalha por id; aqui só agrega o veredito
  const v = spawnSync("npx", ["vitest", "run", "tests/evals/contrato.test.ts"], {
    cwd: raiz,
    stdio: "inherit",
  });
  saiuVitest = v.status ?? 1;
}

let falhas = 0;
for (const r of resultados) {
  if (!r.pass) falhas++;
  console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}${r.det ? ` — ${r.det}` : ""}`);
}
console.log(
  `\n${resultados.length - falhas}/${resultados.length} casos de ${LIVE ? "live" : "roteador"} ok` +
    (LIVE ? "" : ` · contrato vitest: ${saiuVitest === 0 ? "ok" : "FALHOU"}`)
);
process.exit(falhas || saiuVitest ? 1 : 0);
