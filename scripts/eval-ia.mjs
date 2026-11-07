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
//   EVAL_MODELOS           — lista separada por vírgula de slugs pra forçar
//                            o modelo de cada request (ex.: "beam-free").
//                            Cada slug roda o corpus inteiro uma vez.
//   IA_EVAL_KEY            — o override de modelo só vale com o header
//                            x-ia-eval-key batendo o env do SERVIDOR; a
//                            mesma env vai aqui (eval-gate.yml usa
//                            "eval-ci-key" — chave de porta interna, não
//                            segredo real)
//   --gate                 — veredito de gate pro CI (eval-gate.yml): sai
//                            != 0 quando há itens ERRO (infra quebrada:
//                            HTTP != SSE, evento error, stream cortado)
//                            ou quando a pass rate dos casos JULGÁVEIS
//                            cai abaixo do piso (EVAL_GATE_PISO, default
//                            0.6 — aceita "60" como porcentagem).
// A saída lista caso a caso: PASS/FAIL/ERRO, tools vistas no stream e o
// trecho da resposta. Sem --gate, qualquer não-PASS sai com exit 1.
// Por que o piso é baixo: os modelos *-free erram mais (tool-choice e
// rubrica fina) e um piso alto tornaria o gate flakível a cada PR. O
// gate existe pra pegar regressão CATASTRÓFICA — provider fora, auth
// quebrado, prompt detonado derrubando a taxa pra ~0 — não a finura,
// que fica pro run manual do /ia (grade casos×modelos×repetições).

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const casos = JSON.parse(
  readFileSync(join(raiz, "tests/evals/casos.json"), "utf8")
);
const LIVE = process.argv.includes("--live");
const GATE = process.argv.includes("--gate");

const ok = (id, det = "", modelo) => ({ id, pass: true, det, modelo });
const falha = (id, det = "", modelo) => ({ id, pass: false, det, modelo });
// erro = infra quebrada (não é nota de rubrica): o gate reprova na hora,
// porque com a plataforma no chão o veredito dos casos não vale nada
const erroItem = (id, det = "", modelo) => ({
  id,
  pass: false,
  erro: true,
  det,
  modelo,
});

// burst do eval × limite de 20 msg/60s por profile (ia_contexto_e_limite):
// o 429 é pacing, não falha de produto — o script espera a janela
// deslizar e re-tenta em vez de carimbar ERRO de infra à toa
const TENTATIVAS_429 = 4;
const ESPERA_429_MS = 12_000;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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
async function cookieDeSessao(papel) {
  // conta por papel: EVAL_PAPEL=mentorado usa EVAL_EMAIL_JOVEM/_SENHA_JOVEM
  // (sem fallback cruzado — papel errado testa o toolset errado)
  const jovem = papel === "mentorado";
  const email = jovem ? process.env.EVAL_EMAIL_JOVEM : process.env.EVAL_EMAIL;
  const senha = jovem ? process.env.EVAL_SENHA_JOVEM : process.env.EVAL_SENHA;
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
  // caso de outro papel daria FAIL falso (tool que a conta nem pode usar)
  const papel = process.env.EVAL_PAPEL;
  const cookie = (await cookieDeSessao(papel)) ?? process.env.EVAL_COOKIE;
  if (!base || !cookie) {
    console.error(
      papel === "mentorado"
        ? "live mentorado precisa de EVAL_BASE_URL e de EVAL_EMAIL_JOVEM+EVAL_SENHA_JOVEM (ou EVAL_COOKIE)"
        : "live precisa de EVAL_BASE_URL e de EVAL_EMAIL+EVAL_SENHA (ou EVAL_COOKIE)"
    );
    process.exit(2);
  }
  const resultados = [];
  const doPapel = casos.live.filter(
    (c) => !papel || c.papel_esperado === "qualquer" || c.papel_esperado === papel
  );
  if (papel && doPapel.length < casos.live.length)
    console.log(`(${casos.live.length - doPapel.length} caso(s) de outro papel pulados)`);
  // EVAL_MODELOS: cada slug roda o corpus inteiro (override via
  // x-ia-eval-key + campo modelo — a rota ignora os dois sem a chave
  // casando o IA_EVAL_KEY do servidor). Vazia = uma passada sem override,
  // o tier resolve pela config viva como sempre.
  const corridas = (process.env.EVAL_MODELOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const modelo of corridas.length ? corridas : [null]) {
    for (const c of doPapel) {
      try {
        let res;
        for (let t = 0; t <= TENTATIVAS_429; t++) {
          res = await fetch(`${base}/api/ia/chat`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie,
              "x-ia-eval-key": process.env.IA_EVAL_KEY ?? "",
            },
            // mesmo contrato do componente: histórico + rota atual
            body: JSON.stringify({
              messages: [{ role: "user", content: c.msg }],
              ...(c.pagina ? { pagina: c.pagina } : {}),
              ...(modelo ? { modelo } : {}),
            }),
            // sessão inválida vira 307 pro /login: seguir o redirect devolvia
            // HTML sem evento nenhum e caso só de "não pode" passava falso
            redirect: "manual",
          });
          if (res.status !== 429) break;
          if (t < TENTATIVAS_429) await espera(ESPERA_429_MS);
        }
        const tipo = res.headers.get("content-type") ?? "";
        if (!res.ok || !tipo.includes("text/event-stream")) {
          resultados.push(
            erroItem(c.id, `HTTP ${res.status}, content-type ${tipo || "vazio"}`, modelo)
          );
          continue;
        }
        const { tools, texto, erro, terminou } = await lerSse(res);
        // stream cortado ou evento error (provider fora, orçamento da
        // rota estourado) = infra, não rubrica
        if (!terminou || erro) {
          resultados.push(
            erroItem(
              c.id,
              erro ? `erro no stream: ${erro}` : "stream sem done nem error",
              modelo
            )
          );
          continue;
        }
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
            ? falha(c.id, problemas.join("; "), modelo)
            : ok(c.id, `tools: ${tools.join(",") || "—"}`, modelo)
        );
      } catch (e) {
        resultados.push(erroItem(c.id, String(e), modelo));
      }
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
let erros = 0;
for (const r of resultados) {
  if (r.erro) erros++;
  else if (!r.pass) falhas++;
  const modelo = r.modelo ? ` [${r.modelo}]` : "";
  console.log(
    `${r.pass ? "PASS" : r.erro ? "ERRO" : "FAIL"} ${r.id}${modelo}${r.det ? ` — ${r.det}` : ""}`
  );
}

if (LIVE) {
  // ERRO não entra na taxa: não é rubrica, é a plataforma no chão — o
  // gate já reprova só pela existência dele. A taxa mede o que o modelo
  // fez quando a infra respondeu.
  const julgados = resultados.length - erros;
  const aprovados = julgados - falhas;
  const pisoRaw = Number(process.env.EVAL_GATE_PISO ?? 0.6);
  const piso = pisoRaw > 1 ? pisoRaw / 100 : pisoRaw;
  const taxa = julgados ? aprovados / julgados : 0;
  // --gate: reprova por erro de infra OU taxa abaixo do piso — um FAIL
  // isolado de rubrica não derruba o PR (a régua fina é do run manual)
  const reprovou = erros > 0 || (GATE && taxa < piso);
  console.log(
    `\n${aprovados}/${julgados} casos de live ok` +
      ` · erros de infra: ${erros}` +
      (GATE
        ? ` · pass rate ${(taxa * 100).toFixed(0)}% (piso ${(
            piso * 100
          ).toFixed(0)}%) — gate ${reprovou ? "REPROVADO" : "ok"}`
        : "")
  );
  // sem --gate mantém a régua antiga: qualquer não-PASS reprova
  process.exit(reprovou || (!GATE && falhas + erros > 0) ? 1 : 0);
}

console.log(
  `\n${resultados.length - falhas}/${resultados.length} casos de roteador ok` +
    ` · contrato vitest: ${saiuVitest === 0 ? "ok" : "FALHOU"}`
);
process.exit(falhas || saiuVitest ? 1 : 0);
