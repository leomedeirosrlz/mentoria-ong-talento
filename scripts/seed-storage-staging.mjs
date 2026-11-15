#!/usr/bin/env node
// seed-storage-staging — sobe placeholders pros paths de storage que as
// linhas do banco apontam mas o bucket não tem (REALIZA-412): os seeds de
// dados inserem rows com path, mas nunca fizeram upload — /api/<tipo>/[id]
// assinava URL de objeto inexistente e toda mídia quebrava (avatar 404,
// evidência, termo, material de arquivo).
//
// Service role — passa por cima das policies de storage (form-anexos
// incluso, que só aceita service no insert) e lê qualquer tabela sem
// depender de grant por coluna.
//
// Idempotente e conservador: só cria o que falta (x-upsert desligado),
// nunca sobrescreve objeto real. Avatares demo usam o SVG de verdade de
// public/demo/avatars quando o nome bate.
//
// Uso:
//   E2E_SUPABASE_URL=https://<staging>.supabase.co \
//   E2E_SUPABASE_SERVICE_ROLE_KEY=… \
//   node scripts/seed-storage-staging.mjs [--apply]
//
// Sem --apply só lista os faltantes (dry-run).

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!URL_ || !KEY) {
  console.error("uso: E2E_SUPABASE_URL + E2E_SUPABASE_SERVICE_ROLE_KEY [--apply]");
  process.exit(2);
}
if (URL_.includes("yhjzmxleotahijinjepl")) {
  console.error("E2E_SUPABASE_URL aponta pra produção — abortado");
  process.exit(2);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const HJ = { ...H, "Content-Type": "application/json" };

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...HJ, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// ---------- inventário: tabela.coluna → bucket ----------

// cada fonte declara o select do PostgREST; a coluna pode estar fora do
// grant direto (profiles.documento_path entra pela view profiles_contato).
// upload=false quando a policy do bucket exige service_role.
const FONTES = [
  { tabela: "registro_anexos", col: "path", bucket: "registro-anexos" },
  { tabela: "chamado_anexos", col: "path", bucket: "chamado-anexos" },
  { tabela: "formulario_anexos", col: "path", bucket: "form-anexos" },
  { tabela: "materiais", col: "path", bucket: "materiais", where: "path=not.is.null&path=not.like.doc:*" },
  { tabela: "documentos_pessoa", col: "path", bucket: "documentos" },
  { tabela: "mentorados_curriculo", col: "curriculo_path", bucket: "documentos" },
  { tabela: "mentorados", col: "documento_path", bucket: "documentos" },
  { tabela: "profiles_contato", col: "documento_path", bucket: "documentos" },
  { tabela: "profiles", col: "avatar_path", bucket: "avatares" },
  { tabela: "mentorados", col: "avatar_path", bucket: "avatares" },
];

async function pathsDaFonte({ tabela, col, where }) {
  const q = where ? `&${where}` : `&${col}=not.is.null`;
  const rows = await rest(`${tabela}?select=${col}${q}`);
  return rows.map((r) => r[col]).filter(Boolean);
}

// ---------- listagem recursiva do bucket ----------

async function listarBucket(bucket) {
  const objetos = new Set();
  async function walk(prefix) {
    for (let offset = 0; ; offset += 1000) {
      const res = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: HJ,
        body: JSON.stringify({ prefix, limit: 1000, offset }),
      });
      if (!res.ok) throw new Error(`list ${bucket}${prefix} → ${res.status}`);
      const items = await res.json();
      if (items.length === 0) return;
      for (const it of items) {
        if (it.id == null) await walk(`${prefix}${it.name}/`); // pasta
        else objetos.add(`${prefix}${it.name}`);
      }
      if (items.length < 1000) return;
    }
  }
  await walk("");
  return objetos;
}

// ---------- placeholders ----------

function svgAvatar(nome) {
  const ini = (nome || "?")
    .replace(/^termo-/, "")
    .replace(/\..*$/, "")
    .slice(0, 2)
    .toUpperCase();
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#d6e4a8"/><text x="48" y="60" font-family="sans-serif" font-size="34" font-weight="600" fill="#35401a" text-anchor="middle">${ini}</text></svg>`
  );
}

// 1×1 PNG — o storage serve o contentType declarado no upload, então
// extensão .jpg com PNG dentro não quebra (o browser lê o mime da resposta)
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function pdfMinimo(titulo) {
  const safe = String(titulo).replace(/[\\()]/g, " ").slice(0, 80);
  const stream = `BT /F1 14 Tf 56 756 Td (${safe}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const xref = [0];
  objs.forEach((o, i) => {
    xref.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of xref.slice(1)) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(out);
}

function conteudoPara(path) {
  const nome = basename(path);
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "svg") {
    // avatar demo: usa o SVG de verdade quando o nome bate
    try {
      return { body: readFileSync(`public/demo/avatars/${nome}`), type: "image/svg+xml" };
    } catch {
      return { body: svgAvatar(nome), type: "image/svg+xml" };
    }
  }
  if (ext === "pdf") return { body: pdfMinimo(nome), type: "application/pdf" };
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    return { body: PNG_1PX, type: "image/png" };
  return { body: Buffer.from(`${nome}\n`), type: "text/plain" };
}

// ---------- main ----------

const faltantes = [];
for (const f of FONTES) {
  const paths = await pathsDaFonte(f);
  let objetos;
  try {
    objetos = await listarBucket(f.bucket);
  } catch (e) {
    console.error(`  ! ${f.bucket}: ${e.message} — paths ainda contados`);
    objetos = new Set();
  }
  const faltando = paths.filter((p) => !objetos.has(p));
  const rotulo = `(${f.tabela}.${f.col})`.padEnd(44);
  console.log(
    `${f.bucket.padEnd(16)} ${rotulo} ${paths.length} paths, ${objetos.size} objetos, ${faltando.length} faltando`
  );
  for (const p of faltando) faltantes.push({ bucket: f.bucket, path: p });
}

if (faltantes.length === 0) {
  console.log("\nnada faltando — storage em dia");
  process.exit(0);
}
console.log(`\n${faltantes.length} objetos faltando${APPLY ? "" : " (dry-run — --apply sobe)"}`);
if (!APPLY) {
  for (const f of faltantes) console.log(`  ${f.bucket}/${f.path}`);
  process.exit(0);
}

let ok = 0;
for (const { bucket, path } of faltantes) {
  const { body, type } = conteudoPara(path);
  const res = await fetch(`${URL_}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...H, "Content-Type": type, "x-upsert": "false" },
    body,
  });
  if (res.ok) ok++;
  else console.error(`  ! ${bucket}/${path} → ${res.status}: ${await res.text()}`);
}
console.log(`${ok} objetos criados`);
