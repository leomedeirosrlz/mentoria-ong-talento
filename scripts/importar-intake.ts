/** Importa o intake real (CSVs canônicos + anexos) no Supabase remoto.
 *
 *  Uso:
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-intake.ts
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-intake.ts --apply
 *
 *  Sem --apply é dry-run: valida tudo e mostra o plano, sem escrever nada.
 *  A URL vem de SUPABASE_URL ou do NEXT_PUBLIC_SUPABASE_URL do .env.local.
 *  Service key só por variável de ambiente — nunca em arquivo.
 *
 *  Passos: (1) profiles+mentor_profiles do equipe.csv, (2) mentorados.csv,
 *  (3) anexos do manifest -> bucket `documentos` (row antes do upload, como
 *  a policy exige) e fotos -> bucket `avatares` + avatar_path. Idempotente:
 *  e-mail/nome já existente pula; documento com path já registrado pula.
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  emailValido,
  fichaLinha,
  mapRole,
  normEmail,
  normNome,
  normWhatsapp,
  papelNulo,
  parseCsv,
  type LinhaImportada,
} from "../src/lib/importar";
import { nomeProprio } from "../src/lib/utils";
import { parseDisponibilidade } from "../src/lib/ciclo";

const APPLY = process.argv.includes("--apply");
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const DIR = dirArg?.slice(6) ?? "intake-out";

function envLocal(k: string): string {
  try {
    const m = new RegExp(`^${k}=(.+)$`, "m").exec(
      readFileSync(".env.local", "utf-8")
    );
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const URL = process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL) {
  console.error("SUPABASE_URL ausente (nem env nem .env.local).");
  process.exit(1);
}
if (APPLY && !KEY) {
  console.error("--apply precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
// dry-run usa a anon key se houver — só precisa ler
const supabase = createClient(
  URL,
  KEY || envLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "dry-run"
);

const puladas: string[] = [];
const ok = (s: string) => console.log(`  ok  ${s}`);
const pula = (s: string) => {
  puladas.push(s);
  console.log(`  >>  ${s}`);
};

function saneiaNome(n: string): string {
  return (
    n
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo"
  );
}

// ---------- 1) equipe (profiles + mentor_profiles) ----------

async function importaEquipe(linhas: LinhaImportada[]) {
  console.log(`\n== equipe.csv: ${linhas.length} linhas`);
  const { data: existentes } = await supabase
    .from("profiles")
    .select("email");
  const noBanco = new Set(
    (existentes ?? []).map((p: { email: string }) => p.email.toLowerCase())
  );
  const vistos = new Set<string>();
  const validas: Record<string, unknown>[] = [];
  const fichaMentor: Record<string, Record<string, unknown>> = {};

  for (const r of linhas) {
    const nome = nomeProprio(r.nome);
    const email = normEmail(r.email);
    const whatsapp = normWhatsapp(r.whatsapp);
    const papelPreenchido = String(r.papel ?? "").trim() !== "";
    const semPapel = papelPreenchido && papelNulo(r.papel);
    const role = semPapel
      ? null
      : papelPreenchido
        ? mapRole(r.papel)
        : "mentor_dpp";
    if (!nome || !emailValido(email)) {
      pula(`${r.nome || r.email || "?"}: nome vazio ou e-mail inválido`);
      continue;
    }
    if (r.whatsapp.trim() && !whatsapp) {
      pula(`${nome}: whatsapp inválido (use DDD + número)`);
      continue;
    }
    if (!semPapel && role === null) {
      pula(`${nome}: papel não reconhecido`);
      continue;
    }
    const ficha = fichaLinha(r, "pessoa");
    if ("error" in ficha) {
      pula(`${nome}: ${ficha.error}`);
      continue;
    }
    const exp = normNome(String(r.experiencia_previa ?? ""));
    const form = normNome(String(r.formacao_externa ?? ""));
    if (exp.length > 2000 || form.length > 2000) {
      pula(`${nome}: experiência/formação passa de 2.000 caracteres`);
      continue;
    }
    const eMentor = role === "mentor_dpp" || role === "mentor_especialista";
    const disp = eMentor
      ? parseDisponibilidade(String(r.disponibilidade ?? ""))
      : null;
    if (disp && "error" in disp) {
      pula(`${nome}: ${disp.error}`);
      continue;
    }
    if (noBanco.has(email) || vistos.has(email)) {
      pula(`${email}: já existe`);
      continue;
    }
    vistos.add(email);
    validas.push({ nome, email, whatsapp, role, ...ficha });
    if (exp || form || disp) {
      fichaMentor[email] = {
        experiencia_previa: exp || null,
        formacao_externa: form || null,
        ...(disp ? { disponibilidade: disp } : {}),
      };
    }
  }
  console.log(`  ${validas.length} válidas para insert`);
  if (!APPLY || !validas.length) return;

  const { data: inseridas, error } = await supabase
    .from("profiles")
    .insert(validas)
    .select("id, role, email");
  if (error) {
    console.error(`  FALHA insert profiles: ${error.message}`);
    return;
  }
  ok(`${inseridas?.length ?? 0} profiles criados`);

  const mentores = (inseridas ?? [])
    .filter(
      (p: { role: string | null }) =>
        p.role === "mentor_dpp" || p.role === "mentor_especialista"
    )
    .map((p: { id: string; role: string; email: string }) => ({
      profile_id: p.id,
      tipo: p.role === "mentor_dpp" ? "dpp" : "especialista",
      ...(fichaMentor[p.email.toLowerCase()] ?? {}),
    }));
  if (mentores.length) {
    const { error: mpErr } = await supabase
      .from("mentor_profiles")
      .insert(mentores);
    if (mpErr) pula(`mentor_profiles: ${mpErr.message}`);
    else ok(`${mentores.length} mentor_profiles criados`);
  }
}

// ---------- 2) mentorados ----------

async function importaMentorados(linhas: LinhaImportada[]) {
  console.log(`\n== mentorados.csv: ${linhas.length} linhas`);
  const { data: existentes } = await supabase
    .from("mentorados")
    .select("nome, whatsapp");
  const nomes = new Set(
    (existentes ?? []).map((m: { nome: string }) =>
      normNome(m.nome).toLowerCase()
    )
  );
  const was = new Set(
    (existentes ?? [])
      .map((m: { whatsapp: string | null }) => normWhatsapp(m.whatsapp ?? ""))
      .filter(Boolean)
  );
  const vistos = new Set<string>();
  const vistosWa = new Set<string>();
  const validas: Record<string, unknown>[] = [];

  for (const r of linhas) {
    const nome = nomeProprio(r.nome);
    const whatsapp = normWhatsapp(r.whatsapp);
    const email = normEmail(r.email);
    if (!nome) {
      pula("linha sem nome");
      continue;
    }
    if (email && !emailValido(email)) {
      pula(`${nome}: e-mail inválido`);
      continue;
    }
    if (r.whatsapp.trim() && !whatsapp) {
      pula(`${nome}: whatsapp inválido (use DDD + número)`);
      continue;
    }
    const ficha = fichaLinha(r, "mentorado");
    if ("error" in ficha) {
      pula(`${nome}: ${ficha.error}`);
      continue;
    }
    const chave = nome.toLowerCase();
    if (
      nomes.has(chave) ||
      (whatsapp && was.has(whatsapp)) ||
      vistos.has(chave) ||
      (whatsapp && vistosWa.has(whatsapp))
    ) {
      pula(`${nome}: já existe`);
      continue;
    }
    vistos.add(chave);
    if (whatsapp) vistosWa.add(whatsapp);
    validas.push({
      nome,
      email: email || null,
      whatsapp,
      ong_origem: String(r.ong ?? "").trim() || null,
      notas: String(r.notas ?? "").trim() || null,
      ...ficha,
    });
  }
  console.log(`  ${validas.length} válidas para insert`);
  if (!APPLY || !validas.length) return;
  const { error } = await supabase.from("mentorados").insert(validas);
  if (error) console.error(`  FALHA insert mentorados: ${error.message}`);
  else ok(`${validas.length} mentorados criados`);
}

// ---------- 3) anexos ----------

type ManifestEntry = {
  nome: string;
  email: string;
  tipo_pessoa: "profile" | "mentorado";
  documentos: { tipo: string; arquivo: string; nome_original: string }[];
};

async function importaAnexos() {
  const manifestPath = `${DIR}/manifest-anexos.json`;
  if (!existsSync(manifestPath)) return;
  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync(manifestPath, "utf-8")
  );
  console.log(`\n== manifest-anexos.json: ${manifest.length} pessoas`);

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, email, nome");
  const { data: ments } = await supabase
    .from("mentorados")
    .select("id, nome");
  const profPorEmail = new Map(
    (profs ?? []).map((p: { id: string; email: string }) => [
      p.email.toLowerCase(),
      p.id,
    ])
  );
  const mentPorNome = new Map(
    (ments ?? []).map((m: { id: string; nome: string }) => [
      normNome(m.nome).toLowerCase(),
      m.id,
    ])
  );
  const { data: docsExist } = await supabase
    .from("documentos_pessoa")
    .select("profile_id, mentorado_id, nome");
  // reexecução não duplica: pessoa + nome_original já registrado pula
  const docsRegistrados = new Set(
    (docsExist ?? []).map(
      (d: { profile_id: string | null; mentorado_id: string | null; nome: string | null }) =>
        `${d.profile_id ?? d.mentorado_id}:${d.nome}`
    )
  );

  let enviados = 0;
  for (const p of manifest) {
    const id =
      p.tipo_pessoa === "mentorado"
        ? mentPorNome.get(normNome(p.nome).toLowerCase())
        : profPorEmail.get(p.email.toLowerCase());
    if (!id) {
      pula(`anexos: ${p.nome} não encontrado(a) no banco`);
      continue;
    }
    for (const doc of p.documentos ?? []) {
      if (!existsSync(doc.arquivo)) {
        pula(`anexo ausente: ${doc.arquivo}`);
        continue;
      }
      const nome = saneiaNome(basename(doc.arquivo));
      if (doc.tipo === "avatar") {
        // bucket público `avatares`: <profile_id>/<arquivo> (0014)
        const path = `${id}/${nome}`;
        if (APPLY) {
          const buf = readFileSync(doc.arquivo);
          const { error } = await supabase.storage
            .from("avatares")
            .upload(path, buf, {
              upsert: true,
              contentType: mime(extname(doc.arquivo)),
            });
          if (error) {
            pula(`avatar ${p.nome}: ${error.message}`);
            continue;
          }
          await supabase
            .from("profiles")
            .update({ avatar_path: path })
            .eq("id", id)
            .is("avatar_path", null);
        }
        enviados++;
        continue;
      }
      if (docsRegistrados.has(`${id}:${doc.nome_original.slice(0, 300)}`)) {
        continue;
      }
      // documento do intake: row primeiro (a policy de storage exige o path
      // já registrado), upload depois — mesma ordem do fluxo da UI
      const path = `documentos/${crypto.randomUUID()}-${nome}`;
      if (APPLY) {
        const { error: insErr } = await supabase
          .from("documentos_pessoa")
          .insert({
            [p.tipo_pessoa === "mentorado" ? "mentorado_id" : "profile_id"]:
              id,
            tipo: doc.tipo,
            path,
            nome: doc.nome_original.slice(0, 300),
          });
        if (insErr) {
          pula(`doc ${doc.nome_original}: ${insErr.message}`);
          continue;
        }
        const buf = readFileSync(doc.arquivo);
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, buf, {
            contentType: mime(extname(doc.arquivo)),
          });
        if (upErr) {
          await supabase.from("documentos_pessoa").delete().eq("path", path);
          pula(`upload ${doc.nome_original}: ${upErr.message}`);
          continue;
        }
      }
      enviados++;
    }
  }
  console.log(
    `  ${enviados} arquivos ${APPLY ? "enviados" : "a enviar"}`
  );
}

function mime(ext: string): string {
  return (
    {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".jfif": "image/jpeg",
      ".tif": "image/tiff",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }[ext.toLowerCase()] ?? "application/octet-stream"
  );
}

// ---------- main ----------

const equipe = parseCsv(readFileSync(`${DIR}/equipe.csv`, "utf-8")).linhas;
const mentorados = parseCsv(
  readFileSync(`${DIR}/mentorados.csv`, "utf-8")
).linhas;

if (!APPLY) {
  console.log("DRY-RUN — sem escrita. Revalide com --apply.\n");
  // dry-run não lê o banco sem service key; mostra só a validação local
  if (!KEY) {
    for (const r of equipe) {
      const f = fichaLinha(r, "pessoa");
      if ("error" in f) pula(`${r.nome}: ${f.error}`);
    }
    for (const r of mentorados) {
      const f = fichaLinha(r, "mentorado");
      if ("error" in f) pula(`${r.nome}: ${f.error}`);
    }
    console.log(`\nequipe: ${equipe.length} linhas | mentorados: ${mentorados.length} linhas`);
    console.log(`puladas na validação local: ${puladas.length}`);
    process.exit(0);
  }
}

await importaEquipe(equipe);
await importaMentorados(mentorados);
await importaAnexos();
console.log(`\n== fim (${APPLY ? "APLICADO" : "dry-run"}) — ${puladas.length} puladas`);
