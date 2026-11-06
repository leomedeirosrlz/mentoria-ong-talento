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
// LIVE é opt-in e faz HTTP de verdade contra /api/ia/chat (o endpoint
// exige sessão do app; PAT não serve pro chat):
//   EVAL_BASE_URL          — ex.: http://localhost:3000 ou a URL do preview
//   EVAL_EMAIL/EVAL_SENHA  — conta de teste do ambiente (ex.: jovem@ ou
//                            coord@realiza.test no staging); o script entra
//                            por senha e monta o cookie sozinho
//   EVAL_SUPABASE_URL/EVAL_SUPABASE_ANON_KEY — Supabase do MESMO ambiente
//                            do EVAL_BASE_URL (sem fallback pro .env.local,
//                            que aponta pra produção)
//   EVAL_COOKIE            — alternativa manual: header Cookie copiado do
//                            DevTools de uma sessão logada
//   EVAL_PAPEL             — "mentorado" ou "staff": roda só os casos desse
//                            papel (+ os "qualquer"); sem ela, roda todos
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

/** Entra por senha e devolve o header Cookie no formato do app: o
 *  createServerClient do @supabase/ssr escreve os mesmos cookies
 *  (nome sb-<ref>-auth-token, chunks, base64-) que o middleware lê. O
 *  token só vive neste processo. */
async function cookieDeSessao() {
  const { EVAL_EMAIL: email, EVAL_SENHA: senha } = process.env;
  const url = process.env.EVAL_SUPABASE_URL;
  const anon = process.env.EVAL_SUPABASE_ANON_KEY;
  if (!email || !senha) return null;
  if (!url || !anon) {
    console.error(
      "EVAL_EMAIL/EVAL_SENHA precisam de EVAL_SUPABASE_URL e EVAL_SUPABASE_ANON_KEY do mesmo ambiente"
    );
    process.exit(2);
  }
  const { createServerClient } = await import("@supabase/ssr");
  const jar = new Map();
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (lista) =>
        lista.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name)
        ),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    console.error(`login do eval falhou: ${error.message}`);
    process.exit(2);
  }
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function live() {
  const base = process.env.EVAL_BASE_URL;
  const cookie = (await cookieDeSessao()) ?? process.env.EVAL_COOKIE;
  if (!base || !cookie) {
    console.error(
      "live precisa de EVAL_BASE_URL e de EVAL_EMAIL+EVAL_SENHA (ou EVAL_COOKIE)"
    );
    process.exit(2);
  }
  const resultados = [];
  // caso de outro papel daria FAIL falso (tool que a conta nem pode usar)
  const papel = process.env.EVAL_PAPEL;
  const doPapel = casos.live.filter(
    (c) => !papel || c.papel_esperado === "qualquer" || c.papel_esperado === papel
  );
  if (papel && doPapel.length < casos.live.length)
    console.log(`(${casos.live.length - doPapel.length} caso(s) de outro papel pulados)`);
  for (const c of doPapel) {
    try {
      const res = await fetch(`${base}/api/ia/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        // mesmo contrato do componente: histórico + rota atual
        body: JSON.stringify({
          messages: [{ role: "user", content: c.msg }],
          ...(c.pagina ? { pagina: c.pagina } : {}),
        }),
        // sessão inválida vira 307 pro /login: seguir o redirect devolvia
        // HTML sem evento nenhum e caso só de "não pode" passava falso
        redirect: "manual",
      });
      const tipo = res.headers.get("content-type") ?? "";
      if (!res.ok || !tipo.includes("text/event-stream")) {
        resultados.push(
          falha(c.id, `HTTP ${res.status}, content-type ${tipo || "vazio"}`)
        );
        continue;
      }
      const { tools, texto, erro, terminou } = await lerSse(res);
      const problemas = [];
      if (!terminou) problemas.push("stream sem evento done nem error");
      if (erro) problemas.push(`erro no stream: ${erro}`);
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

/** Lê o SSE da rota (route.ts): "token" monta o texto ("reset" zera — a
 *  rodada foi refeita), "done" traz as tools usadas, "error" a falha.
 *  `terminou` = chegou done ou error (stream cortado no meio não conta). */
async function lerSse(res) {
  let tools = [];
  let texto = "";
  let erro = null;
  let terminou = false;
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
        if (ev.type === "token" && ev.c) texto += ev.c;
        if (ev.type === "reset") texto = "";
        if (ev.type === "done") {
          tools = ev.tools ?? [];
          terminou = true;
        }
        if (ev.type === "error") {
          erro = ev.e ?? "erro";
          terminou = true;
        }
      } catch {
        /* linha parcial/comentário */
      }
    }
  }
  return { tools, texto, erro, terminou };
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
