// Ingestão do corpus RAG do assistente: lê docs/rag/*.md, fatia em chunks por
// seção (~800 chars, overlap ~120) e grava em public.ia_chunks.
//
//   pnpm ingerir:guias          → dry-run (mostra docs/seções/chunks, nada escreve)
//   pnpm ingerir:guias --apply  → grava no Supabase de .env.local
//
// Identidade do chunk = (guia, secao, pagina) — a unique NULLS NOT DISTINCT de
// 0136 é a rede de segurança contra duplicatas. O write path é delete-por-guia
// + insert: PostgREST não consegue expressar o arbiter `ON CONFLICT (…)
// NULLS NOT DISTINCT`, então o upsert literal sairia como insert-e-falha.
// Delete+insert por documento é igualmente idempotente.
//
// Gate anti-PII: qualquer doc que contenha marcadores de dados pessoais reais
// (CPF, RG, nome do exemplar do termo, endereço do exemplar) é recusado — o
// termo de adesão fonte é um exemplar preenchido e nunca entra aqui.

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const DIR = new URL("../docs/rag/", import.meta.url).pathname;

function envLocal(k) {
  try {
    const m = new RegExp(`^${k}=(.+)$`, "m").exec(readFileSync(".env.local", "utf-8"));
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const SUPA_URL = process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const PII_MARCADORES = [
  /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
  /RG\s*n[º°o]\s*[\d.]/i, // RG nº seguido de número (placeholder "RG nº ___" passa)
  /espirito\s+santo/i,
  /ALCIDES\s+CANDIDO/i,
];

// ---------- frontmatter + seções ----------

function parseDoc(nome, raw) {
  const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!fm) throw new Error(`${nome}: sem frontmatter`);
  const meta = Object.fromEntries(
    fm[1].split("\n")
      .map((l) => /^([a-z_]+):\s*(.*)$/.exec(l.trim()))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/\s+/g, " ").trim()])
  );
  if (!meta.fonte || !meta.titulo) throw new Error(`${nome}: frontmatter sem fonte/titulo`);

  const body = fm[2];
  const partes = body.split(/^## /m).map((s) => s.trim()).filter(Boolean);
  const secoes = partes.map((p) => {
    const nl = p.indexOf("\n");
    const cab = nl === -1 ? p : p.slice(0, nl).trim();
    const resto = nl === -1 ? "" : p.slice(nl + 1).trim();
    const secao = cab.replace(/^# /, "").trim(); // primeira parte pode ser o h1 do doc
    return { secao, texto: resto ? `${cab}\n\n${resto}` : cab };
  });
  return { fonte: meta.fonte, titulo: meta.titulo, secoes };
}

// ---------- chunking ----------

const ALVO = 800;
const MAX = 900;
const OVERLAP = 120;

function fatiar(texto) {
  if (texto.length <= MAX) return [texto];
  const paras = texto.split(/\n{2,}/).filter((p) => p.trim());
  const chunks = [];
  let buf = "";
  const flush = () => {
    if (!buf.trim()) return;
    chunks.push(buf.trim());
    buf = buf.length > OVERLAP ? buf.slice(-OVERLAP).replace(/^.*?[.!?]\s/, "… ") : buf;
  };
  for (const p of paras) {
    if (p.length > MAX) {
      // parágrafo gigante (tabela, lista longa): fatia por janela
      flush();
      for (let i = 0; i < p.length; i += ALVO - OVERLAP)
        chunks.push("… " + p.slice(i, i + ALVO).trim());
      buf = "";
      continue;
    }
    if (buf.length + p.length + 2 > MAX) flush();
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  flush();
  return chunks.length ? chunks : [texto.slice(0, MAX)];
}

// ---------- main ----------

const arquivos = readdirSync(DIR).filter(
  (f) => f.endsWith(".md") && f !== "README.md"
).sort();
if (!arquivos.length) {
  console.error(`nenhum .md em ${DIR}`);
  process.exit(2);
}

const docs = [];
for (const f of arquivos) {
  const raw = readFileSync(join(DIR, f), "utf-8");
  const hits = PII_MARCADORES.filter((re) => re.test(raw)).map((re) => String(re));
  if (hits.length) {
    console.error(`✗ ${f}: RECUSADO — marcador(es) de PII: ${hits.join(", ")}`);
    process.exit(2);
  }
  const doc = parseDoc(f, raw);
  const chunks = doc.secoes.flatMap((s, si) =>
    fatiar(s.texto).map((texto, ci) => ({
      guia: doc.fonte,
      secao: s.secao.slice(0, 200),
      pagina: si * 100 + ci, // estável por seção+ordem dentro da seção
      texto: texto.slice(0, 4000),
    }))
  );
  docs.push({ arquivo: f, ...doc, chunks });
}

const total = docs.reduce((a, d) => a + d.chunks.length, 0);
console.log(`corpus: ${docs.length} docs · ${total} chunks`);
for (const d of docs) {
  console.log(
    `  ${d.arquivo.padEnd(42)} ${String(d.chunks.length).padStart(3)} chunks · ${d.secoes.length} seções · fonte=${d.fonte}`
  );
}
console.log(`\namostra:\n${docs[0].chunks[0].texto.slice(0, 300)}\n…`);

if (!APPLY) {
  console.log("\n== dry-run: nada foi escrito. Rode com --apply pra gravar.");
  process.exit(0);
}

if (!SUPA_URL || !KEY) {
  console.error("precisa de SUPABASE_URL (ou .env.local) e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(2);
}

const supabase = createClient(SUPA_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const d of docs) {
  const { error: delErr } = await supabase.from("ia_chunks").delete().eq("guia", d.fonte);
  if (delErr) {
    console.error(`✗ ${d.fonte}: delete falhou — ${delErr.message}`);
    process.exit(1);
  }
  const { error: insErr } = await supabase.from("ia_chunks").insert(d.chunks);
  if (insErr) {
    console.error(`✗ ${d.fonte}: insert falhou — ${insErr.message}`);
    process.exit(1);
  }
  console.log(`✓ ${d.fonte}: ${d.chunks.length} chunks`);
}

console.log(`\n== ingestão ok: ${total} chunks em ${docs.length} documentos.`);
