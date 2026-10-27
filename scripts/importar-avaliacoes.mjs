#!/usr/bin/env node
// importar-avaliacoes — importa as respostas do form externo do JOVEM
// ("Avaliação de Encontro Semanal - Mentorandos" — Google Forms) pra
// avaliacoes_encontro (0071), criando o encontro born-realizado quando a
// plataforma ainda não tem aquele (dupla, numero) — molde importar_registros
// (0082): origem 'externo', data_hora = realizado_em = data do form.
//
// O form do MENTOR ("Avaliação semanal das Mentorias") é outro formato —
// entra por scripts/importar-registros.mjs (RPC importar_registros). Este
// script detecta e recusa aquele CSV.
//
// Uso:
//   node scripts/importar-avaliacoes.mjs --csv=respostas.csv            # dry-run
//   node scripts/importar-avaliacoes.mjs --csv=respostas.csv --apply    # grava
//   node scripts/importar-avaliacoes.mjs --csv=respostas.csv --apply \
//        --resolve 17=<encontro-uuid>   # linha 'revisar' resolvida à mão
//
// Sem --apply NADA escreve — imprime o que faria, linha a linha. Linhas
// 'revisar' (nome ambíguo/ausente, encontro incerto) não entram no apply a
// menos que você as resolva com --resolve <n>=<encontro_id> (n = número da
// linha do relatório, o mesmo L<n> impresso).
//
// Idempotente: encontro_id já presente em avaliacoes_encontro é pulado;
// o link de avaliação mintado pelo trigger vira 'respondido' no apply.
// Escrita é insert direto via service_role (não existe RPC de import pra
// avaliações — submeter_avaliacao exige posse do token/vínculo). Como os
// mentorados ainda não têm profile_id, o trigger de prompt não dispara
// notificação — só minta o link, que o apply marca como respondido.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// aceita as duas formas: --resolve=17=uuid e --resolve 17=uuid
const argv = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--resolve" && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    argv.push(`--resolve=${process.argv[++i]}`);
  } else {
    argv.push(a);
  }
}

const APPLY = argv.includes("--apply");
const csvArg = argv.find((a) => a.startsWith("--csv="));
const CSV = csvArg?.slice(6) ?? "";
const RESOLVE = new Map(
  argv
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
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!CSV) {
  console.error("uso: --csv=<arquivo> [--apply] [--resolve <n>=<encontro_id>,...]");
  process.exit(2);
}
if (!URL || !KEY) {
  console.error("precisa de SUPABASE_URL (ou .env.local) e SUPABASE_SERVICE_ROLE_KEY (env ou .env.local).");
  process.exit(2);
}

// ---------- CSV ----------

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// '2026/10/06 6:50:33 PM GMT-3' → ISO
function parseTs(s) {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?\s*GMT([+-]\d{1,2})?/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[4]);
  if (m[8]) {
    const pm = m[8].toUpperCase() === "PM";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  const off = m[9] ? `${m[9].padStart(3, "+0")}:00` : "-03:00";
  const offFix = off.length === 6 ? off : `${off.slice(0, 3)}${off.slice(3)}`;
  return `${m[1]}-${m[2]}-${m[3]}T${String(h).padStart(2, "0")}:${m[5]}:${m[6]}${offFix}`;
}

// ---------- normalização de nomes ----------

const STOP = new Set(["de", "da", "do", "das", "dos", "des", "e"]);
const norm = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

function candidatos(lista, nome) {
  const alvo = tokens(nome);
  if (!alvo.length) return [];
  return (lista ?? []).filter((p) => {
    const t = tokens(p.nome);
    const ts = tokens(p.nome_social ?? "");
    const contido = alvo.every((x) => t.includes(x)) || alvo.every((x) => ts.includes(x));
    const inverso = t.length && t.every((x) => alvo.includes(x));
    return contido || inverso;
  });
}

// aliases do form (typos/abreviações) → nome canônico cadastrado
const ALIAS_MENTOR = {
  "daniela sebee": "daniela seber abuhab",
  "daniela abuhad": "daniela seber abuhab",
  "meire fiusa": "meiriane archangelo fiuza",
  "meire fiuza": "meiriane archangelo fiuza",
};
const ALIAS_MENTORADO = {
  "leila gomes des souza": "leila gomes de souza",
};

// ---------- campos do form ----------

// "Como você avalia o desempenho do seu mentor na mentoria realizada?" → ★
const MAP_ESTRELAS = {
  excelente: 5,
  otimo: 5,
  "muito bom": 5,
  bom: 4,
  boa: 4,
  regular: 3,
  ruim: 2,
  baixa: 2,
  pessimo: 1,
  pessima: 1,
};

// "Você sente que a mentoria têm te ajudado…?" — resposta livre. Mapeia o
// óbvio pro enum avancei (sim/um_pouco/nao, CHECK do banco); o texto cru
// vai pro comentário pra não perder a voz do jovem.
function mapAvancei(v) {
  const t = norm(v).trim();
  if (!t) return null;
  if (/^por enquanto nao/.test(t) || /^nao\b/.test(t) && !/\bmas\b/.test(t)) return "nao";
  if (/nao/.test(t) && /\b(mas|acredito|por enquanto|ate o momento|ainda)\b/.test(t)) return "um_pouco";
  if (/\bainda nao\b|\bnem sempre\b|\bmais ou menos\b|processo de/.test(t)) return "um_pouco";
  if (/^(sim|simm|muito|claro|com certeza|com certeza)/.test(t)) return "sim";
  if (/\bsim\b|certeza|adorei|gostei|excelente|proveitoso|enriquecedor|positiv|ajudou|motivad|amando/.test(t)) return "sim";
  return "um_pouco";
}

// texto "curto demais pra agregar" que não precisa poluir o comentário
const AFIRMACAO_CURTA = new Set(["sim", "simm", "sim!", "sim,com certeza", "nao"]);

// ---------- leitura do CSV ----------

const rows = parseCsvText(readFileSync(CSV, "utf-8").replace(/^﻿/, ""));
const header = (rows[0] ?? []).map((h) => h.trim());

const ehFormMentor = header.some((h) => h === "Nome do Mentorando" || h.startsWith("O que foi realizado"));
const ehFormJovem = header.some((h) => h.startsWith("Como você avalia o desempenho do seu mentor"));
if (ehFormMentor && !ehFormJovem) {
  console.error(
    "Este CSV é o form do MENTOR (\"Avaliação semanal das Mentorias\") — importa por\n" +
      "  scripts/importar-registros.mjs (RPC importar_registros). Este script cobre o form do JOVEM."
  );
  process.exit(2);
}
if (!ehFormJovem) {
  console.error("Cabeçalho não reconhecido — esperava o form do jovem (\"Avaliação de Encontro Semanal - Mentorandos\").");
  process.exit(2);
}

const idx = {
  ts: header.findIndex((h) => h.startsWith("Carimbo")),
  nome: header.findIndex((h) => h.startsWith("Qual o seu nome")),
  data: header.findIndex((h) => h === "Data do encontro"),
  mentor: header.findIndex((h) => h.startsWith("Nome do seu Mentor")),
  numero: header.findIndex((h) => h.startsWith("Qual encontro")),
  nota: header.findIndex((h) => h.startsWith("Como você avalia")),
  ajudou: header.findIndex((h) => h.startsWith("Você sente")),
  obs: header.findIndex((h) => h.startsWith("Observações")),
};
if (Object.values(idx).some((i) => i < 0)) {
  console.error(`coluna faltando no CSV: ${JSON.stringify(idx)}`);
  process.exit(2);
}

const data = rows.slice(1).filter((r) => r[idx.nome]?.trim() || r[idx.ts]?.trim());

// ---------- universo (service_role lê tudo; ainda assim só leitura em dry) ----------

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [{ data: mentores }, { data: mentorados }, { data: duplas }, { data: encs }, { data: avals }, { data: links }] =
  await Promise.all([
    supabase.from("profiles").select("id, nome, nome_social, role"),
    supabase.from("mentorados").select("id, nome, nome_social, profile_id"),
    supabase.from("duplas").select("id, mentor_id, mentorado_id, status, trilha"),
    supabase.from("encontros").select("id, dupla_id, numero, status, data_hora, realizado_em"),
    supabase.from("avaliacoes_encontro").select("encontro_id"),
    supabase.from("avaliacao_links").select("encontro_id, status"),
  ]);

const jaAvaliado = new Set((avals ?? []).map((a) => a.encontro_id));
const linkPorEncontro = new Map((links ?? []).map((l) => [l.encontro_id, l.status]));
const encPorDupla = new Map();
for (const e of encs ?? []) {
  let m = encPorDupla.get(e.dupla_id);
  if (!m) encPorDupla.set(e.dupla_id, (m = []));
  m.push(e);
}

// ---------- match linha a linha ----------

console.log(`\n== ${data.length} respostas no CSV (form do jovem)`);

const aImportar = [];
const avisos = [];
const vistos = new Map(); // encontro_id → L<n> (dedup no arquivo)
let pulados = 0;

for (let i = 0; i < data.length; i++) {
  const r = data[i];
  const n = i + 1; // L<n> do relatório = ordem da linha de dados
  const rotuloBase = `${r[idx.nome]?.trim() || "?"} × ${r[idx.mentor]?.trim() || "?"} — ${r[idx.numero]?.trim() || "?"}º`;

  const ts = parseTs(r[idx.ts] ?? "");
  const numero = Number(/(\d+)/.exec(r[idx.numero] ?? "")?.[1]);
  const nota = MAP_ESTRELAS[norm(r[idx.nota]).trim()];
  // data do form só é confiável com ano do programa — várias linhas trazem
  // a data de nascimento do jovem (2003-08-10 etc.) digitada no campo
  const dataForm = (r[idx.data] ?? "").trim();
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(dataForm) && (dataForm.startsWith("2025") || dataForm.startsWith("2026"));

  const l = {
    n,
    status: "revisar",
    motivo: "",
    candidatos: [],
    duplaId: null,
    encontroId: null,
    criaEncontro: null,
    marcaRealizado: null,
    avisos: [],
    rotulo: `${rotuloBase}${dataForm ? ` (${dataForm})` : ""}`,
  };
  const falha = (motivo) => {
    l.motivo = motivo;
    aImportar.push(l);
  };

  if (!ts) {
    falha(`timestamp ilegível: ${r[idx.ts]}`);
    continue;
  }
  if (!numero) {
    falha(`nº do encontro ilegível: ${r[idx.numero]}`);
    continue;
  }
  if (!nota) {
    falha(`nota não mapeada: ${r[idx.nota]}`);
    continue;
  }

  // ----- pessoas: mentorado decide; mentor desempata/confirma -----
  const nomeMdo = ALIAS_MENTORADO[norm(r[idx.nome]).trim()] ?? r[idx.nome];
  const nomeMen = ALIAS_MENTOR[norm(r[idx.mentor]).trim()] ?? r[idx.mentor];
  const mdoCand = candidatos(mentorados, nomeMdo);
  const menCand = candidatos(
    (mentores ?? []).filter((p) => p.role !== "mentorado"),
    nomeMen
  );
  if (!mdoCand.length) {
    falha(`mentorado não encontrado: ${r[idx.nome].trim()}`);
    continue;
  }
  if (menCand.length === 0) l.avisos.push(`mentor "${r[idx.mentor].trim()}" sem match — desambiguação só pelo jovem`);

  let cand = (duplas ?? []).filter((d) => mdoCand.some((m) => m.id === d.mentorado_id));
  if (menCand.length) {
    const c2 = cand.filter((d) => menCand.some((m) => m.id === d.mentor_id));
    if (c2.length) cand = c2;
    else if (cand.length)
      l.avisos.push(
        `mentor do form não é o da dupla (form: "${r[idx.mentor].trim()}") — dupla seguiu pelo jovem`
      );
  }
  // mais de uma dupla pro mesmo jovem (remanejo): prefere a ativa
  if (cand.length > 1) {
    const ativas = cand.filter((d) => d.status === "ativa");
    if (ativas.length) cand = ativas;
  }
  l.candidatos = cand.map((d) => ({
    id: d.id,
    status: d.status,
    mentorNome: (mentores ?? []).find((p) => p.id === d.mentor_id)?.nome ?? "?",
    mentoradoNome: (mentorados ?? []).find((m) => m.id === d.mentorado_id)?.nome ?? "?",
  }));

  if (cand.length === 0) {
    falha(
      `sem dupla pra ${r[idx.nome].trim()} (cands jovem: ${mdoCand.map((m) => m.nome).join("/")})`
    );
    continue;
  }
  if (cand.length > 1) {
    falha(`dupla ambígua — ${cand.length} candidatas; resolva escolhendo o encontro`);
    continue;
  }
  const dupla = cand[0];
  l.duplaId = dupla.id;
  const mdo = (mentorados ?? []).find((m) => m.id === dupla.mentorado_id);

  // ----- encontro: (dupla, numero) → data confiável → criar → revisar -----
  const encsDupla = encPorDupla.get(dupla.id) ?? [];
  const porNumero = encsDupla.find((e) => e.numero === numero);
  const dataDoEnc = (e) => (e.realizado_em ?? e.data_hora ?? "").slice(0, 10);
  const porData = dataOk
    ? encsDupla.find((e) => e.status === "realizado" && dataDoEnc(e) === dataForm)
    : undefined;

  if (porNumero && porNumero.status === "realizado") {
    l.encontroId = porNumero.id;
    if (porNumero.numero !== numero) l.avisos.push("numeração diverge");
    if (dataOk && dataDoEnc(porNumero) !== dataForm)
      l.avisos.push(`data do form (${dataForm}) ≠ data do encontro (${dataDoEnc(porNumero)})`);
  } else if (porData) {
    l.encontroId = porData.id;
    l.avisos.push(
      `nº do form (${numero}º) casado com encontro #${porData.numero} pela data (${dataForm})`
    );
  } else if (porNumero && porNumero.status !== "realizado") {
    // a dupla agendou mas não marcou — o jovem avaliando prova que aconteceu
    l.encontroId = porNumero.id;
    l.marcaRealizado = {
      id: porNumero.id,
      realizado_em: dataOk ? `${dataForm}T19:00:00-03:00` : porNumero.data_hora,
    };
    l.avisos.push(`encontro #${numero} estava "${porNumero.status}" — vira realizado`);
  } else {
    const maxNum = Math.max(0, ...encsDupla.map((e) => e.numero ?? 0));
    if (encsDupla.length === 0 || numero <= maxNum + 1) {
      // lacuna consistente: a dupla só respondeu forms, nunca agendou na
      // plataforma (ou o form conta um encontro a mais, sequência mantida)
      l.criaEncontro = {
        dupla_id: dupla.id,
        numero,
        data_hora: dataOk ? `${dataForm}T19:00:00-03:00` : null,
        duracao_min: 60,
        status: "realizado",
        origem: "externo",
        realizado_em: dataOk ? `${dataForm}T19:00:00-03:00` : null,
        created_by: dupla.mentor_id,
      };
      if (!dataOk) l.avisos.push(`data do form ilegível/DN (${dataForm}) — encontro nasce sem data`);
    } else {
      l.motivo =
        `encontro ${numero}º não existe e extrapola a sequência da dupla ` +
        `(plataforma vai até #${maxNum}) — a contagem do form diverge; confira se é o #${maxNum}`;
      l.candidatos = encsDupla
        .filter((e) => e.status === "realizado" && !jaAvaliado.has(e.id))
        .map((e) => ({
          id: e.id,
          status: `encontro #${e.numero} realizado ${dataDoEnc(e)}`,
          mentorNome: "",
          mentoradoNome: "",
        }));
      aImportar.push(l);
      continue;
    }
  }

  // ----- já avaliado? -----
  const alvoId = l.encontroId ?? `novo:${dupla.id}|${numero}`;
  if (l.encontroId && jaAvaliado.has(l.encontroId)) {
    console.log(`  = L${n} ${l.rotulo} — encontro já tem avaliação, pulado`);
    pulados++;
    continue;
  }
  if (vistos.has(alvoId)) {
    falha(`mesmo encontro da linha ${vistos.get(alvoId)} — duplicata no CSV`);
    continue;
  }
  vistos.set(alvoId, n);

  // ----- payload -----
  const partesComentario = [];
  const ajudouTxt = (r[idx.ajudou] ?? "").trim();
  const obsTxt = (r[idx.obs] ?? "").trim();
  if (ajudouTxt && !AFIRMACAO_CURTA.has(norm(ajudouTxt).trim())) partesComentario.push(ajudouTxt);
  if (obsTxt) partesComentario.push(obsTxt);

  l.avaliacao = {
    dupla_id: dupla.id,
    encontro_id: l.encontroId, // preenchido após criar encontro quando novo
    estrelas: nota,
    sentimento: null,
    avancei: mapAvancei(ajudouTxt),
    temas: null,
    comentario: partesComentario.join("\n\n") || null,
    pedir_apoio: false,
    avaliacao_visivel_mentor: false,
    respondido_por_profile_id: mdo?.profile_id ?? null,
    created_at: ts,
  };
  l.status = "ok";
  aImportar.push(l);
}

// aplica --resolve nas linhas 'revisar'
for (const l of aImportar) {
  if (l.status === "revisar" && RESOLVE.has(l.n) && l.duplaId) {
    const encId = RESOLVE.get(l.n);
    const enc = (encs ?? []).find((e) => e.id === encId && e.dupla_id === l.duplaId);
    if (enc) {
      l.encontroId = encId;
      l.criaEncontro = null;
      l.status = "ok";
      l.resolvida = true;
    }
  }
}

// ---------- relatório ----------

for (const l of aImportar) {
  if (l.status === "ok") {
    const acao = l.criaEncontro
      ? `encontro novo n${l.criaEncontro.numero}${l.criaEncontro.data_hora ? ` ${l.criaEncontro.data_hora.slice(0, 10)}` : " (sem data)"}`
      : l.marcaRealizado
        ? `encontro existente → vira realizado`
        : `anexa ao encontro`;
    console.log(
      `  ✓ L${l.n} ${l.rotulo} → ★${l.avaliacao.estrelas} · avancei=${l.avaliacao.avancei ?? "—"} [${acao}]` +
        (l.resolvida ? " [resolvida com --resolve]" : "")
    );
    for (const a of l.avisos) console.log(`      · ${a}`);
  } else {
    console.log(`  ? L${n(l)} ${l.rotulo} — ${l.motivo}`);
    for (const c of l.candidatos.slice(0, 4))
      console.log(`      candidata: ${c.mentoradoNome} × ${c.mentorNome} (${c.status}) ${c.id}`);
  }
}
for (const [nn, id] of RESOLVE) {
  const l = aImportar.find((x) => x.n === nn);
  if (!l || l.encontroId !== id) console.log(`  !! --resolve ${nn}=… não aplicado (linha não estava em revisar ou encontro não é da dupla)`);
}
for (const a of avisos) console.log(`  !! ${a}`);

function n(l) {
  return l.n;
}

const ok = aImportar.filter((l) => l.status === "ok");
const aRevisar = aImportar.filter((l) => l.status === "revisar");
const encNovos = ok.filter((l) => l.criaEncontro).length;
const marcaRealiz = ok.filter((l) => l.marcaRealizado).length;

if (!APPLY) {
  console.log(
    `\n== dry-run: ${ok.length} a importar (${encNovos} encontros novos, ${marcaRealiz} a marcar realizado) · ` +
      `${aRevisar.length} a revisar · ${pulados} já avaliados.` +
      `\n   Nada foi escrito. Rode com --apply pra gravar (linhas a revisar só entram com --resolve <n>=<encontro_id>).`
  );
  process.exit(0);
}

// ---------- apply ----------

let feitos = 0;
let erros = 0;
for (const l of ok) {
  // 1) encontro novo
  if (l.criaEncontro) {
    const { data: enc, error } = await supabase
      .from("encontros")
      .insert(l.criaEncontro)
      .select("id")
      .single();
    if (error) {
      erros++;
      console.log(`  ✗ L${l.n} encontro novo falhou: ${error.message}`);
      continue;
    }
    l.encontroId = enc.id;
  }
  // 2) agendado → realizado
  if (l.marcaRealizado) {
    const { error } = await supabase
      .from("encontros")
      .update({ status: "realizado", realizado_em: l.marcaRealizado.realizado_em })
      .eq("id", l.marcaRealizado.id);
    if (error) {
      erros++;
      console.log(`  ✗ L${l.n} marcação de realizado falhou: ${error.message}`);
      continue;
    }
  }
  // 3) a avaliação em si
  const payload = { ...l.avaliacao, encontro_id: l.encontroId };
  const { error } = await supabase.from("avaliacoes_encontro").insert(payload);
  if (error) {
    erros++;
    console.log(`  ✗ L${l.n} avaliação falhou: ${error.message}`);
    continue;
  }
  // 4) consome o link mintado pelo trigger (mesmo efeito do caminho do form)
  if (linkPorEncontro.get(l.encontroId) === "pendente") {
    await supabase
      .from("avaliacao_links")
      .update({
        status: "respondido",
        respondido_em: l.avaliacao.created_at,
        respondido_por_profile_id: l.avaliacao.respondido_por_profile_id,
      })
      .eq("encontro_id", l.encontroId)
      .eq("status", "pendente");
  }
  feitos++;
  console.log(`  ✓ L${l.n} avaliação gravada`);
}

console.log(
  `\n== APLICADO — ${feitos} avaliações gravadas · ${encNovos} encontros novos · ${marcaRealiz} marcados realizado · ${erros} erros · ${aRevisar.length} ficaram pra revisão`
);
