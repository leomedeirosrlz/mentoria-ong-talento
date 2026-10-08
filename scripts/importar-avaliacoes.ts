/** Importa as avaliações semanais (form "Avaliação semanal das Mentorias")
 *  como encontros realizados + registros pós-encontro.
 *
 *  Uso:
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-avaliacoes.ts --csv=...
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/importar-avaliacoes.ts --csv=... --apply
 *
 *  Sem --apply é dry-run. Idempotente: encontro (dupla, numero) com
 *  registro já existente pula; encontro sem registro ganha o registro
 *  anexado. Conflito de numeração (o form conta encontros realizados, a
 *  plataforma conta os oficiais) resolve por data na mesma dupla.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normNome } from "../src/lib/importar";

// o normNome do importar só faz trim — aqui a resolução precisa ignorar
// acento e caixa (o form externo traz "Stuanni", "cordeiro", "Nucolly")
const norm = (s: string) =>
  normNome(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const APPLY = process.argv.includes("--apply");
const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const CSV = csvArg?.slice(6) ?? "";

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
if (!URL || !CSV) {
  console.error("precisa de SUPABASE_URL/.env.local e --csv=<arquivo>");
  process.exit(1);
}
if (APPLY && !KEY) {
  console.error("--apply precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const supabase = createClient(
  URL,
  KEY || envLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

// ---------- CSV ----------

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

// ---------- resolução de pessoas ----------

const { data: profiles } = await supabase.from("profiles").select("id,nome");
const { data: mentorados } = await supabase.from("mentorados").select("id,nome");
const { data: duplas } = await supabase
  .from("duplas")
  .select("id,mentor_id,mentorado_id,turma,status,cronograma_id");

const normAll = (s: string) => norm(s.trim());
const tokens = (s: string) => normAll(s).split(/\s+/).filter(Boolean);

function findPessoa(
  lista: { id: string; nome: string }[] | null,
  nome: string
) {
  const alvo = tokens(nome);
  if (!alvo.length) return undefined;
  return (lista ?? []).find((p) =>
    alvo.every((t) => tokens(p.nome).includes(t))
  );
}

// aliases do form (typos/abreviações) -> nome canônico cadastrado
const ALIAS: Record<string, string> = {
  "nucolly jesus": "nicolly jesus bento rodrigues",
  "nicolly barbosa": "nicolly jesus bento rodrigues",
  "priscila stuanni": "priscila stuani",
  "gustavo salamoni gelli": "gustavo salamoni gelli",
  "izabel": "izabel cristina manzano trindade",
  "andressa": "andressa silva oliveira",
};

function resolveNome(nome: string): string {
  return ALIAS[normAll(nome)] ?? nome;
}

// ---------- campos do form ----------

const MAP_AVAL: Record<string, string> = {
  excelente: "excelente",
  boa: "boa",
  regular: "regular",
  baixa: "baixa",
};

function mapDificuldade(v: string): { dificuldade: string; detalhe: string | null } {
  const t = normAll(v);
  if (!t || t === "nao") return { dificuldade: "nenhuma", detalhe: null };
  if (t.includes("organizacao") || t.includes("rotina"))
    return { dificuldade: "organizacao", detalhe: v };
  if (t.includes("comportamental"))
    return { dificuldade: "comportamental", detalhe: v };
  if (t.includes("aprendiz")) return { dificuldade: "aprendizagem", detalhe: v };
  if (t.includes("participa")) return { dificuldade: "participacao", detalhe: v };
  return { dificuldade: "outro", detalhe: v };
}

function mapProximo(v: string): { proximo_passo: string; detalhe: string | null } {
  const t = normAll(v);
  if (t.includes("continuar")) return { proximo_passo: "continuar", detalhe: null };
  if (t.includes("reforcar") || t.includes("reforco"))
    return { proximo_passo: "reforcar", detalhe: v };
  if (t.includes("acompanhamento mais proximo") || t.includes("de perto"))
    return { proximo_passo: "acompanhar_de_perto", detalhe: v };
  if (t.includes("individual"))
    return { proximo_passo: "conversa_individual", detalhe: v };
  if (t.includes("feedback"))
    return { proximo_passo: "novo_feedback", detalhe: v };
  return { proximo_passo: "outro", detalhe: v || null };
}

// ---------- linhas ----------

const rows = parseCsvText(readFileSync(CSV, "utf-8").replace(/^﻿/, ""));
const header = rows[0];
const data = rows.slice(1).filter((r) => r[2]?.trim());

const idx = {
  mentor: header.findIndex((h) => h.trim() === "Nome"),
  mentorado: header.findIndex((h) => h.trim() === "Nome do Mentorando"),
  numero: header.findIndex((h) => h.startsWith("Qual encontro")),
  data: header.findIndex((h) => h.trim() === "Data do encontro"),
  feito: 14,
  avaliacao: 17,
  dificuldade: 20,
  proximo: 23,
  obs: 26,
};

console.log(`\n== ${data.length} avaliações no CSV`);

let criadosEncontros = 0;
let criadosRegistros = 0;
let pulados = 0;
const avisos: string[] = [];

for (const r of data) {
  const mentorNome = resolveNome(r[idx.mentor]);
  const mdoNome = resolveNome(r[idx.mentorado]);
  const numero = Number(r[idx.numero].match(/(\d+)/)?.[1]);
  let dataStr = r[idx.data].trim();
  if (/^\d{4}-/.test(dataStr) && !dataStr.startsWith("2026") && !dataStr.startsWith("2027")) {
    dataStr = "2026" + dataStr.slice(4); // typo de ano no form (ex.: 1960)
    avisos.push(`data corrigida ${r[idx.data]} -> ${dataStr} (${mdoNome})`);
  }

  const mentor = findPessoa(profiles, mentorNome);
  const mdo = findPessoa(mentorados, mdoNome);
  if (!mentor || !mdo || !numero) {
    avisos.push(
      `não resolvido: ${r[idx.mentor].trim()} + ${r[idx.mentorado].trim()} (encontro ${r[idx.numero]})`
    );
    continue;
  }

  let dupla = (duplas ?? []).find(
    (d) => d.mentor_id === mentor.id && d.mentorado_id === mdo.id
  );

  // dupla histórica da desistência (Julio+Ednilson): encontro aconteceu
  // antes da saída — nasce 'encerrada' só pra segurar o registro
  if (!dupla && normAll(mdoNome).includes("ednilson")) {
    const row = {
      turma: "2026/2027",
      mentor_id: mentor.id,
      mentorado_id: mdo.id,
      status: "encerrada",
      trilha: "dpp",
      iniciada_em: "2026-09-08",
      // encerrada_em/motivo_encerramento são campos da trilha especialista
      // (duplas_encerramento_esp) — DPP encerra só pelo status
      cronograma_id: (duplas ?? []).find((d) => d.turma === "2026/2027")
        ?.cronograma_id,
    };
    if (APPLY) {
      const { data: novo, error } = await supabase
        .from("duplas")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        avisos.push(`dupla encerrada falhou (${mdoNome}): ${error.message}`);
        continue;
      }
      dupla = { ...novo, ...row };
      avisos.push(`dupla histórica criada encerrada: ${mdoNome}`);
    } else {
      avisos.push(`a criar dupla histórica encerrada: ${mdoNome} (desistência)`);
      dupla = { id: "dry", ...row } as never;
    }
  }
  if (!dupla) {
    avisos.push(`sem dupla: ${mentor.nome} + ${mdo.nome}`);
    continue;
  }

  // encontro: (dupla, numero) primeiro; sem registro anexa; com registro
  // pula. Se numero não existe na dupla, tenta casar pela data.
  const { data: encs } = await supabase
    .from("encontros")
    .select("id,numero,data_hora,status,registros(id)")
    .eq("dupla_id", dupla.id);

  let encontroId: string | null = null;
  const porNumero = (encs ?? []).find((e) => e.numero === numero);
  // data+realizado primeiro: o form conta "encontros que aconteceram", a
  // plataforma conta os oficiais — numeração diverge quando houve remarcação
  const porData = (encs ?? []).find(
    (e) => e.data_hora?.slice(0, 10) === dataStr && e.status === "realizado"
  );
  const alvo = porData ?? porNumero;

  if (alvo) {
    const regs = alvo.registros as unknown;
    const temRegistro = Array.isArray(regs) ? regs.length > 0 : regs != null;
    if (temRegistro) {
      console.log(
        `  >> ${mdo.nome} ${numero}º (${dataStr}): já tem registro — pulado`
      );
      pulados++;
      continue;
    }
    encontroId = alvo.id;
    if (alvo.numero !== numero)
      avisos.push(
        `${mdo.nome}: form "${numero}º" casado com encontro #${alvo.numero} pela data (${dataStr})`
      );
  } else {
    const row = {
      dupla_id: dupla.id,
      numero,
      data_hora: `${dataStr}T19:00:00-03:00`,
      status: "realizado",
      origem: "externo",
      realizado_em: `${dataStr}T19:00:00-03:00`,
      created_by: mentor.id,
    };
    if (APPLY) {
      const { data: enc, error } = await supabase
        .from("encontros")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        avisos.push(`encontro falhou (${mdo.nome} ${numero}º): ${error.message}`);
        continue;
      }
      encontroId = enc.id;
      criadosEncontros++;
    } else {
      console.log(`  + encontro ${mdo.nome} ${numero}º (${dataStr})`);
      criadosEncontros++;
      encontroId = "dry";
    }
  }

  const dif = mapDificuldade(r[idx.dificuldade]);
  const prox = mapProximo(r[idx.proximo]);
  const registro = {
    encontro_id: encontroId,
    reflexoes: r[idx.feito]?.trim() || null,
    observacoes: r[idx.obs]?.trim() || null,
    avaliacao: MAP_AVAL[normAll(r[idx.avaliacao])] ?? null,
    dificuldade: dif.dificuldade,
    dificuldade_detalhe: dif.detalhe,
    proximo_passo: prox.proximo_passo,
    proximo_passo_detalhe: prox.detalhe,
    created_by: mentor.id,
  };
  if (APPLY && encontroId !== "dry") {
    const { error } = await supabase.from("registros").insert(registro);
    if (error) {
      avisos.push(`registro falhou (${mdo.nome} ${numero}º): ${error.message}`);
      continue;
    }
  }
  criadosRegistros++;
}

for (const a of avisos) console.log(`  !! ${a}`);
console.log(
  `\n== fim (${APPLY ? "APLICADO" : "dry-run"}) — ${criadosEncontros} encontros, ${criadosRegistros} registros, ${pulados} pulados`
);
