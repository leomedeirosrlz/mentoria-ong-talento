#!/usr/bin/env node
// Backfill do matching_perfis (REALIZA-338) — gera doc/temas/embedding
// pra cada mentor ativo (DPP, especialista ou híbrido) e mentorado ativo.
//
//   node scripts/vetorizar-pessoas.mjs           → dry-run (conta, nada grava)
//   node scripts/vetorizar-pessoas.mjs --apply   → grava no banco de STAGING_DB_URL
//   node scripts/vetorizar-pessoas.mjs --calibra → distribuição de similaridade
//                                                  (calibrar SUG_SIM_MIN da UI)
//
// Conexão: SUPABASE_DB_URL ou STAGING_DB_URL (de .env.staging) — acesso
// direto ao Postgres porque a tabela é service-role-only (RLS nega a
// anon key até na leitura). Apontar SEMPRE pro staging; prod só depois do
// merge com a DB URL de prod passada explicitamente.
//
// Temas usam IA_API_BASE/IA_API_KEY/IA_MODEL (provider do assistente) —
// sem eles o backfill grava embedding e deixa temas=[]; uma próxima
// execução com creds preenche só os temas faltantes (doc_hash guarda).
// Embeddings usam IA_EMBED_API_KEY (.env.staging já tem).
//
// O builder do doc é ESPELHO de src/lib/matching.ts#montarDocMatching —
// byte a byte: o doc_hash é sha256 do doc e qualquer divergência faz o
// runtime recomputar tudo de novo no próximo save (custo desnecessário).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const CALIBRA = process.argv.includes("--calibra");

function envLocal(k) {
  for (const f of [".env.staging", ".env.local"]) {
    try {
      const m = new RegExp(`^${k}=(.+)$`, "m").exec(readFileSync(f, "utf-8"));
      if (m?.[1]) return m[1].trim();
    } catch {
      // arquivo ausente → próximo
    }
  }
  return "";
}

const DB_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.STAGING_DB_URL ||
  envLocal("STAGING_DB_URL");
if (!DB_URL) {
  console.error("precisa de SUPABASE_DB_URL ou STAGING_DB_URL (ver .env.staging).");
  process.exit(2);
}
if (/yhjzmxleotahijinjepl/.test(DB_URL) && !process.env.CONFIRMO_PROD) {
  console.error(
    "DB URL aponta pra PRODUÇÃO — backfill de calibração é no staging. " +
      "Se for o backfill real de prod pós-merge, rode com CONFIRMO_PROD=1."
  );
  process.exit(2);
}

const sql = postgres(DB_URL, { ssl: "require", max: 4, prepare: false });

// ---------- núcleo — ESPELHO de src/lib/matching.ts (manter sincronizado) ----------

const ESCOLARIDADE_LABELS = {
  fundamental: "Ensino fundamental",
  medio: "Ensino médio",
  tecnico: "Curso técnico",
  superior: "Ensino superior",
  pos: "Pós-graduação",
};

const normaliza = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const FORM_KEY_DOC =
  /sonh|objetiv|meta\b|metas|motiv|hobb|interess|habilidad|gosta|aprend|carreira|profiss|futuro|talento|dedic|supera/i;
const FORM_VAL_MAX = 300;
const FORM_KEYS_MAX = 5;

function linha(rotulo, valor) {
  const v = (valor ?? "").trim();
  return v ? `${rotulo}: ${v}` : "";
}

function trechoFormBruto(form) {
  if (!form || typeof form !== "object") return [];
  const out = [];
  for (const [k, v] of Object.entries(form)) {
    if (out.length >= FORM_KEYS_MAX) break;
    if (!FORM_KEY_DOC.test(normaliza(k))) continue;
    const texto = Array.isArray(v)
      ? v.filter((x) => typeof x === "string").join(", ")
      : typeof v === "string"
        ? v
        : "";
    const val = texto.trim().slice(0, FORM_VAL_MAX);
    if (val) out.push(`Resposta "${k.trim()}": ${val}`);
  }
  return out;
}

function montarDoc(tipo, d) {
  const partes = [];
  const interesses = (d.interesses ?? []).filter(Boolean).join(", ");
  if (interesses) partes.push(`Interesses: ${interesses}`);
  if (tipo === "mentor") {
    partes.push(linha("Motivação para ser mentor", d.motivacao));
    partes.push(linha("Experiência com mentoria", d.experiencia_previa));
    partes.push(linha("Formação e estudos", d.formacao_externa));
    const areas = (d.areas ?? []).filter(Boolean).join(", ");
    if (areas) partes.push(`Áreas de atuação: ${areas}`);
    const atuacao = [d.cargo, d.empresa].filter(Boolean).join(" na empresa ");
    partes.push(linha("Atuação profissional", atuacao || null));
    partes.push(linha("Sobre", d.bio));
  } else {
    partes.push(linha("Motivação para participar", d.motivacao));
    partes.push(linha("Objetivos no programa", d.objetivos));
    partes.push(
      linha(
        "Escolaridade",
        d.escolaridade ? ESCOLARIDADE_LABELS[d.escolaridade] : null
      )
    );
    partes.push(linha("ONG de origem", d.ong_origem));
  }
  partes.push(...trechoFormBruto(d.form_bruto));
  return partes.filter(Boolean).join("\n");
}

// ---------- temas (vocab fechado — mesmo do runtime) ----------

const TEMAS = [
  "tecnologia", "carreira", "esporte", "concursos", "artes", "idiomas",
  "saúde", "empreendedorismo", "família", "finanças", "educação", "games",
  "música", "fé", "voluntariado", "escrita", "leitura", "ciência",
  "meio ambiente", "cultura",
];
const TEMAS_MAX = 6;
const temaNorm = new Map(TEMAS.map((t) => [normaliza(t), t]));

function sanitizarTemas(content) {
  const m = /\[[\s\S]*\]/.exec(content ?? "");
  if (!m) return [];
  let arr;
  try {
    arr = JSON.parse(m[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const vistos = new Set();
  const out = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const canon = temaNorm.get(normaliza(item));
    if (!canon || vistos.has(canon)) continue;
    vistos.add(canon);
    out.push(canon);
    if (out.length >= TEMAS_MAX) break;
  }
  return out;
}

const IA_BASE = process.env.IA_API_BASE || envLocal("IA_API_BASE");
const IA_KEY = process.env.IA_API_KEY || envLocal("IA_API_KEY");
const IA_MODEL = process.env.IA_MODEL || envLocal("IA_MODEL");

async function extrairTemas(doc) {
  if (!IA_BASE || !IA_KEY || !doc.trim()) return null;
  try {
    const res = await fetch(`${IA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${IA_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "realiza-vetorizar/1.0",
        // Go exige a sessão mesmo em batch — id fixo agrupa o backfill
        "x-opencode-session": "vetorizar-pessoas-backfill",
      },
      body: JSON.stringify({
        model: IA_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você extrai temas de perfis de um programa de mentoria pra pareamento. " +
              `Responda SOMENTE com um array JSON de até ${TEMAS_MAX} strings escolhidas desta lista fechada: ` +
              `${TEMAS.join(", ")}. Nada além do array.`,
          },
          { role: "user", content: doc },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`  temas HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return null;
    }
    const content = (await res.json())?.choices?.[0]?.message?.content;
    return sanitizarTemas(content);
  } catch (e) {
    console.error(`  temas: ${e.message}`);
    return null;
  }
}

// ---------- embedding (mesma config do embed.ts/ingerir) ----------

const EMBED_KEY = process.env.IA_EMBED_API_KEY || envLocal("IA_EMBED_API_KEY");
const EMBED_MODEL = process.env.IA_EMBED_MODEL ?? "text-embedding-3-small";
const EMBED_DIM = Number(process.env.IA_EMBED_DIM ?? 512);

async function embedUm(texto) {
  if (!EMBED_KEY || !texto.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EMBED_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: texto, dimensions: EMBED_DIM }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`  embed HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return null;
    }
    return (await res.json())?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error(`  embed: ${e.message}`);
    return null;
  }
}

// ---------- main ----------

const mentores = await sql`
  select p.id, p.interesses, p.motivacao, p.bio, p.cargo, p.empresa, p.form_bruto,
         mp.experiencia_previa, mp.formacao_externa, mp.areas
    from public.profiles p
    left join public.mentor_profiles mp on mp.profile_id = p.id
   where p.ativo
     and (p.role in ('mentor_dpp', 'mentor_especialista')
          or exists (select 1 from public.profile_papeis pp
                      where pp.profile_id = p.id
                        and pp.papel in ('mentor_dpp', 'mentor_especialista')))`;

const mentorados = await sql`
  select id, interesses, motivacao, objetivos, escolaridade, ong_origem, form_bruto
    from public.mentorados
   where situacao = 'ativo'`;

const existentes = await sql`
  select dono_tipo, dono_id, doc_hash, temas from public.matching_perfis`;
const atual = new Map(
  existentes.map((r) => [`${r.dono_tipo}:${r.dono_id}`, r])
);

const alvos = [
  ...mentores.map((p) => ({ tipo: "mentor", id: p.id, dados: p })),
  ...mentorados.map((m) => ({ tipo: "mentorado", id: m.id, dados: m })),
];

const comIA = Boolean(IA_BASE && IA_KEY);
console.log(
  `${mentores.length} mentores + ${mentorados.length} mentorados ativos; ` +
    `${atual.size} perfis já vetorizados. Temas via LLM: ${comIA ? "sim" : "não (sem IA_API_* — embeddings apenas)"}.`
);

if (CALIBRA) {
  const rows = await sql`
    select dono_tipo, dono_id, embedding::text as emb
      from public.matching_perfis
     where embedding is not null`;
  const porTipo = { mentor: [], mentorado: [] };
  for (const r of rows) porTipo[r.dono_tipo]?.push(JSON.parse(r.emb));
  const cos = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s; // embeddings da OpenAI já vêm normalizados — produto = cosseno
  };
  const sims = [];
  for (const m of porTipo.mentor)
    for (const j of porTipo.mentorado) sims.push(cos(m, j));
  sims.sort((a, b) => b - a);
  const pct = (p) => sims[Math.floor(sims.length * p)]?.toFixed(3);
  console.log(
    `pares possíveis: ${sims.length} | top1%: ${pct(0.01)} | p5: ${pct(0.05)} | ` +
      `mediana: ${pct(0.5)} | p95: ${pct(0.95)} | max: ${sims[0]?.toFixed(3)}`
  );
  await sql.end();
  process.exit(0);
}

let pulados = 0;
let gravados = 0;
let soTemas = 0;
for (const alvo of alvos) {
  const doc = montarDoc(alvo.tipo, alvo.dados);
  const hash = createHash("sha256").update(doc, "utf8").digest("hex");
  const chave = `${alvo.tipo}:${alvo.id}`;
  const ex = atual.get(chave);
  if (ex?.doc_hash === hash) {
    // hash igual mas temas vazios + creds presentes → preenche só os temas
    if (APPLY && comIA && (!ex.temas || ex.temas.length === 0) && doc.trim()) {
      const temas = await extrairTemas(doc);
      if (temas?.length) {
        await sql`update public.matching_perfis set temas = ${temas}, gerado_em = now()
                   where dono_tipo = ${alvo.tipo} and dono_id = ${alvo.id}`;
        soTemas++;
        console.log(`  ~ ${chave} — temas preenchidos: ${temas.join(", ")}`);
      }
    }
    pulados++;
    continue;
  }
  if (!doc.trim()) {
    console.log(`  ~ ${chave} — doc vazio (perfil sem dados de matching)`);
    continue;
  }
  if (!APPLY) {
    console.log(`  + ${chave} — ${doc.split("\n").length} linhas, ${doc.length} chars`);
    gravados++;
    continue;
  }
  const [temas, vec] = await Promise.all([extrairTemas(doc), embedUm(doc)]);
  const emb = vec ? `[${vec.join(",")}]` : null;
  const temasVal = temas ?? ex?.temas ?? [];
  await sql`
    insert into public.matching_perfis
      (dono_tipo, dono_id, doc, doc_hash, temas, embedding, gerado_em)
    values (${alvo.tipo}, ${alvo.id}, ${doc}, ${hash}, ${temasVal}, ${emb}::vector, now())
    on conflict (dono_tipo, dono_id) do update set
      doc = excluded.doc, doc_hash = excluded.doc_hash,
      temas = excluded.temas, embedding = excluded.embedding,
      gerado_em = excluded.gerado_em`;
  gravados++;
  console.log(
    `  ✓ ${chave} — temas: ${temas?.length ?? "·"}, vetor: ${vec ? "sim" : "não"}`
  );
}
console.log(
  `${APPLY ? "gravados" : "a gravar (--apply)"}: ${gravados} · só temas: ${soTemas} · sem mudança: ${pulados}`
);
await sql.end();
