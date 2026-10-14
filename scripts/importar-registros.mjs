#!/usr/bin/env node
// importar-registros — importa as respostas do form semanal externo
// ("Avaliação semanal das Mentorias") como encontros realizados +
// registros, via RPC importar_registros (0082).
//
// Uso:
//   SUPABASE_URL=https://<proj>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/importar-registros.mjs --csv=respostas.csv            # dry-run
//   node scripts/importar-registros.mjs --csv=respostas.csv --apply    # grava
//   node scripts/importar-registros.mjs --csv=respostas.csv --apply \
//        --resolve 12=<dupla-uuid>                                    # linha revisar resolvida à mão
//
// Sem --apply NADA escreve — imprime o que faria, linha a linha. Linhas
// 'revisar' (match ambíguo/ausente, data suspeita) não entram no apply a
// menos que você as resolva com --resolve <n>=<dupla_id> (n = número da
// linha do relatório); pra resolver pela interface, use o botão
// "Importar respostas" em /registros (mesma RPC, Select visual).
//
// Reusa a lib real — src/lib/importar-registros.ts é TS puro self-contained
// (import type apaga na transpilação), então o Node 22.18+ carrega direto
// via type stripping, sem transpilador. A escrita é exclusiva da RPC —
// aqui só leitura do universo + montagem do payload.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const CSV = csvArg?.slice(6) ?? "";
const RESOLVE = new Map(
  process.argv
    .filter((a) => a.startsWith("--resolve="))
    .flatMap((a) =>
      a
        .slice(10)
        .split(",")
        .map((p) => p.split("="))
        .filter(([n, id]) => /^\d+$/.test(n) && id)
        .map(([n, id]) => [Number(n), id.trim()])
    )
);

function envLocal(k) {
  try {
    const m = new RegExp(`^${k}=(.+)$`, "m").exec(readFileSync(".env.local", "utf-8"));
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const URL = process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!CSV) {
  console.error("uso: --csv=<arquivo> [--apply] [--resolve <n>=<dupla_id>,...]");
  process.exit(2);
}
if (!URL || !KEY) {
  console.error("precisa de SUPABASE_URL (ou .env.local) e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(2);
}

const lib = await import("../src/lib/importar-registros.ts").catch((e) => {
  console.error(`falhou carregando a lib (rode com Node 22.18+): ${e.message}`);
  process.exit(2);
});
const { parseCsvRegistros, processaLinhas, itemRpc } = lib;

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- universo (mesmo recorte da action) ----------

const [{ data: mentores }, { data: mentorados }, { data: duplas }, { data: encs }] =
  await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, nome_social")
      .in("role", ["mentor_dpp", "mentor_especialista"]),
    supabase.from("mentorados").select("id, nome, nome_social"),
    supabase
      .from("duplas")
      .select(
        "id, mentor_id, mentorado_id, status, trilha, mentor:profiles!duplas_mentor_id_fkey(nome), mentorado:mentorados!duplas_mentorado_id_fkey(nome)"
      ),
    supabase.from("encontros").select("dupla_id, numero, status, registros(id)"),
  ]);

const norm = (v) => (Array.isArray(v) ? v[0] ?? null : v);
const duplasRef = (duplas ?? []).map((d) => {
  const mentor = norm(d.mentor);
  const mentorado = norm(d.mentorado);
  return {
    id: d.id,
    mentor_id: d.mentor_id,
    mentorado_id: d.mentorado_id,
    status: d.status,
    trilha: d.trilha,
    mentorNome: mentor?.nome ?? "?",
    mentoradoNome: mentorado?.nome ?? "?",
  };
});
const encInfo = new Map(
  (encs ?? []).map((e) => [
    `${e.dupla_id}|${e.numero}`,
    (Array.isArray(e.registros) ? e.registros.length : e.registros ? 1 : 0) > 0
      ? "atualiza"
      : "anexa",
  ])
);
const universo = { mentores: mentores ?? [], mentorados: mentorados ?? [], duplas: duplasRef };

// ---------- parse + match ----------

const texto = readFileSync(CSV, "utf-8");
const { linhas: cruas, ignoradas } = parseCsvRegistros(texto);
const { linhas, stats } = processaLinhas(cruas, universo);

const rotulo = (l) =>
  `${l.mentorTxt || "?"} × ${l.mentoradoTxt || "?"} — ${l.numero ?? "?"}º encontro` +
  (l.dataIso ? ` (${l.dataIso.split("-").reverse().join("/")})` : "");

for (const l of linhas) {
  if (l.status === "revisar" && RESOLVE.has(l.n)) {
    const alvo = universo.duplas.find((d) => d.id === RESOLVE.get(l.n));
    if (alvo) {
      l.duplaId = alvo.id;
      l.mentorNome = alvo.mentorNome;
      l.mentoradoNome = alvo.mentoradoNome;
    }
  }
}

console.log(`\n== ${linhas.length} respostas no CSV` + (ignoradas ? ` (${ignoradas} linhas sem dado ignoradas)` : ""));
const aImportar = [];
for (const l of linhas) {
  const info = l.duplaId ? (encInfo.get(`${l.duplaId}|${l.numero}`) ?? "novo") : null;
  if (l.status === "ok" || l.duplaId) {
    const manual = l.status === "revisar" && RESOLVE.has(l.n) ? " [resolvida com --resolve]" : "";
    // linha 'revisar' que já traz dupla (só flag de campo — ano 1960 etc.)
    // entra no lote, mas o motivo fica à vista pra conferência
    const flag = l.status === "revisar" ? ` (confere: ${l.motivo})` : "";
    console.log(
      `  ✓ L${l.n} ${rotulo(l)} → ${l.mentoradoNome} × ${l.mentorNome} ` +
        `[${info === "novo" ? "encontro novo" : info === "atualiza" ? "ATUALIZA registro existente" : "anexa ao encontro"}]${manual}${flag}`
    );
    aImportar.push(l);
  } else if (l.status === "revisar") {
    console.log(`  ? L${l.n} ${rotulo(l)} — ${l.motivo}`);
    for (const c of l.candidatos.slice(0, 4)) {
      console.log(`      candidata: ${c.mentoradoNome} × ${c.mentorNome} (${c.status}) ${c.id}`);
    }
    if (!l.candidatos.length) console.log(`      (sem candidatas — veja a lista em /registros)`);
  } else {
    console.log(`  ✗ L${l.n} ${rotulo(l)} — ignorar: ${l.motivo}`);
  }
}
for (const [n] of RESOLVE) {
  if (!linhas.some((l) => l.n === n && l.duplaId))
    console.log(`  !! --resolve ${n}=… não aplicado (linha não estava em revisar ou id inválido)`);
}

if (!APPLY) {
  // 'a revisar' = revisar SEM dupla — as que já trazem duplaId entram no
  // lote do apply (a flag de campo vai à vista, não bloqueia)
  const aRevisar = linhas.filter((l) => l.status === "revisar" && !l.duplaId).length;
  console.log(
    `\n== dry-run: ${aImportar.length} a importar · ${aRevisar} a revisar · ${stats.ignorar} ignoradas.` +
      `\n   Nada foi escrito. Rode com --apply pra gravar (linhas a revisar só entram com --resolve).`
  );
  process.exit(0);
}

// ---------- apply: a RPC é o único write path ----------

const itens = aImportar.map((l) => itemRpc(l)).filter(Boolean);
if (!itens.length) {
  console.log("\nnada a importar.");
  process.exit(0);
}
const { data, error } = await supabase.rpc("importar_registros", { itens });
if (error) {
  console.error(`\nRPC falhou: ${error.message}`);
  process.exit(1);
}

let criados = 0,
  atualizados = 0,
  encNovos = 0,
  erros = 0;
for (const r of data ?? []) {
  const l = aImportar[r.i];
  if (r.erro) {
    erros++;
    console.log(`  ✗ L${l?.n ?? r.i}: ${r.erro}`);
  } else {
    if (r.registro_criado) criados++;
    else atualizados++;
    if (r.encontro_criado) encNovos++;
    console.log(
      `  ✓ L${l?.n ?? r.i}: encontro ${r.encontro_criado ? "criado" : "existente"}, registro ${r.registro_criado ? "criado" : "atualizado"}`
    );
  }
}
console.log(
  `\n== APLICADO — ${criados} registros criados, ${atualizados} atualizados, ${encNovos} encontros novos, ${erros} erros`
);
