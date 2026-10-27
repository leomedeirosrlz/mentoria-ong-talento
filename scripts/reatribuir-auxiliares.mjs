/** Reatribui as duplas às auxiliares executivas conforme o Plantão de
 *  Duplas (REALIZA-226 — Marcela saiu; o plantão é a fonte da verdade).
 *
 *  Uso:
 *    node scripts/reatribuir-auxiliares.mjs                 # dry-run
 *    node scripts/reatribuir-auxiliares.mjs --apply         # escreve
 *    node scripts/reatribuir-auxiliares.mjs --url=https://<staging>.supabase.co \
 *      --key=…  # alvo explícito (sem isso, lê .env.local)
 *
 *  Sem --apply é dry-run: resolve as duplas, mostra o plano e sai sem
 *  escrever. Com --apply, só faz PATCH das duplas cujo `supervisor_id`
 *  diverge — rodar de novo não muda nada (idempotente).
 *
 *  Fonte: `Plantão de Duplas - Contatos.xlsx` (aba "Todas as duplas"),
 *  atualizado em 22/10/2026. Nomes abaixo são o par mentor × jovem como
 *  está no arquivo; o casamento com o banco é por tokens do nome (os
 *  nomes do plantão são mais curtos que os do cadastro: "Priscila Stuani"
 *  × "Priscila Stuani" ok, "Izabel Trindade" × "Izabel Cristina Manzano
 *  Trindade" ok). O plantão lista 27 duplas ativas; dupla ativa fora
 *  dessa lista é reportada pra revisão, nunca reatribuída às cegas.
 *
 *  O campo é `duplas.supervisor_id` — na interface é "Auxiliar
 *  executivo". Duplas encerradas mantêm quem era o auxiliar (o plantão
 *  só fala das ativas).
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const arg = (nome) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit?.slice(nome.length + 3);
};

function envLocal(chave) {
  try {
    const m = new RegExp(`^${chave}=(.+)$`, "m").exec(
      readFileSync(".env.local", "utf-8")
    );
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const URL = arg("url") || process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY = arg("key") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "local";

if (!URL) {
  console.error("SUPABASE_URL ausente (nem --url, nem env, nem .env.local).");
  process.exit(2);
}
if (APPLY && !KEY) {
  console.error("--apply precisa da service role key (--key= ou SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(2);
}

const supabase = createClient(URL, KEY || envLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

// ---------- o plantão (22/10/2026) ----------
// Apelido → nome do perfil no banco. "Dricca" é a Adriana no programa —
// o plantão usa o apelido, o cadastro o nome completo.
const AUXILIARES = {
  Daiara: "Daiara Cristina Damasceno Silva",
  Thiago: "Thiago",
  Dricca: "Adriana Silva Dias",
  Davison: "Davison Roberto da Silva Ferreira",
};

const PLANTAO = [
  // Cronograma 1 · 15 duplas
  { aux: "Daiara", crono: 1, mentor: "Priscila Stuani", jovem: "Adrielle Ferreira Souza dos Santos" },
  { aux: "Daiara", crono: 1, mentor: "Izabel Trindade", jovem: "Louise Rocha" },
  { aux: "Daiara", crono: 1, mentor: "Stéphanie Santos", jovem: "Yaleh Nóbrega" },
  // plantão diz "Andressa Venâncio" (nome artístico); o cadastro é o civil
  { aux: "Daiara", crono: 1, mentor: "Gustavo Gelli", jovem: "Andressa Silva Oliveira" },
  { aux: "Thiago", crono: 1, mentor: "Fernando Toledo", jovem: "Nicolly Rodrigues" },
  { aux: "Thiago", crono: 1, mentor: "Meiriane Fiuza", jovem: "Juliana Novaes" },
  { aux: "Thiago", crono: 1, mentor: "Kelyng Coelho", jovem: "Daniel Cordeiro" },
  { aux: "Thiago", crono: 1, mentor: "Dayane Silva de Freitas", jovem: "Vinícius Cardoso" },
  { aux: "Dricca", crono: 1, mentor: "Evelyn Garcia", jovem: "Wendel Araujo" },
  { aux: "Dricca", crono: 1, mentor: "Bruna Caroline da Silva", jovem: "Juliana Matsuda" },
  { aux: "Dricca", crono: 1, mentor: "Elisabeth Dias", jovem: "Tayná Gomes" },
  { aux: "Dricca", crono: 1, mentor: "Crislayne Andrade", jovem: "Eduarda Carvalho" },
  { aux: "Dricca", crono: 1, mentor: "Jhonatan Matos", jovem: "Rogério Lima" },
  { aux: "Davison", crono: 1, mentor: "Edivaldo Alves", jovem: "Assis Pires Neto" },
  { aux: "Davison", crono: 1, mentor: "Amilcar Santos", jovem: "Clara" },
  // Cronograma 2 · 12 duplas
  { aux: "Daiara", crono: 2, mentor: "Carolina Brito", jovem: "Ana Carolina Vieira" },
  { aux: "Daiara", crono: 2, mentor: "Fernanda Arrelaro Santos", jovem: "Ruthe Aquino" },
  { aux: "Daiara", crono: 2, mentor: "Vanessa Carvalho", jovem: "Beatriz Oliveira" },
  { aux: "Thiago", crono: 2, mentor: "Fernanda Telles", jovem: "Eduarda Alves" },
  { aux: "Thiago", crono: 2, mentor: "Kelvin Pedrozo", jovem: "Marcello Santana" },
  { aux: "Thiago", crono: 2, mentor: "Natalia Carcione", jovem: "Regiane Reis" },
  { aux: "Dricca", crono: 2, mentor: "Julio Almeida", jovem: "Gustavo Marciano" },
  { aux: "Dricca", crono: 2, mentor: "Bianca Honório", jovem: "Leila Gomes" },
  { aux: "Davison", crono: 2, mentor: "João Francisco Padua", jovem: "Erik Souza" },
  { aux: "Davison", crono: 2, mentor: "Isabella Paulo", jovem: "Nicolly Albuquerque" },
  { aux: "Davison", crono: 2, mentor: "Tainara dos Passos", jovem: "Gabriela Pardinho" },
  { aux: "Davison", crono: 2, mentor: "Daniela Abuhab", jovem: "Lucas Marques" },
];

// ---------- casamento por nome ----------
// O plantão usa nome curto ("Izabel Trindade", "Juliana Matsuda"); o
// cadastro, o nome inteiro. Compara tokens (sem acento, sem partícula) e
// exige que TODOS os tokens do lado mais curto existam no outro — o nome
// curto é abreviação do completo, nunca um homônimo mais longo.
const PARTICULAS = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "del", "la", "le",
]);

function tokens(nome) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !PARTICULAS.has(t));
}

/** true quando o nome curto está contido no completo (token a token). */
function nomeCasa(curto, completo) {
  const a = tokens(curto);
  const b = new Set(tokens(completo));
  if (!a.length) return false;
  return a.every((t) => b.has(t));
}

/** Melhor par (mentor, jovem) da lista — null se não casar exatamente um. */
function acharDupla(duplas, alvo) {
  const porMentor = duplas.filter(
    (d) => nomeCasa(alvo.mentor, d.mentor) && nomeCasa(alvo.jovem, d.jovem)
  );
  if (porMentor.length === 1) return porMentor[0];
  if (porMentor.length > 1) {
    // homônimo: só resolve se resta um ativo
    const ativas = porMentor.filter((d) => d.status === "ativa");
    return ativas.length === 1 ? ativas[0] : null;
  }
  // mentor só, ou jovem só — indício de erro no plantão, não casa
  return null;
}

const { data: perfis, error: errPerfis } = await supabase
  .from("profiles")
  .select("id, nome, role, ativo");
if (errPerfis) throw errPerfis;

const { data: duplasRaw, error: errDuplas } = await supabase
  .from("duplas")
  .select(
    "id, status, turma, cronograma_id, supervisor_id, mentor:profiles!duplas_mentor_id_fkey(nome), mentorado:mentorados!duplas_mentorado_id_fkey(nome), cronograma:cronogramas(nome)"
  );
if (errDuplas) throw errDuplas;

const duplas = (duplasRaw ?? []).map((d) => ({
  id: d.id,
  status: d.status,
  cronograma: d.cronograma?.nome ?? null,
  supervisor_id: d.supervisor_id ?? null,
  supervisor:
    perfis?.find((p) => p.id === d.supervisor_id)?.nome ?? null,
  mentor: d.mentor?.nome ?? "",
  jovem: d.mentorado?.nome ?? "",
}));

// ---------- plano ----------
const supervisores = (perfis ?? []).filter(
  (p) => (p.role === "supervisor" || p.role === "coordenacao") && p.ativo !== false
);

const alvoPorAux = new Map();
for (const [apelido, nomeAux] of Object.entries(AUXILIARES)) {
  const achados = supervisores.filter(
    (p) => nomeCasa(nomeAux, p.nome) && nomeCasa(p.nome, nomeAux)
  );
  if (achados.length !== 1) {
    console.error(
      achados.length
        ? `auxiliar ambígua no cadastro: ${nomeAux} (${achados.length} perfis) — use o nome completo`
        : `perfil da auxiliar não encontrado: ${nomeAux} (${apelido})`
    );
    process.exit(2);
  }
  alvoPorAux.set(apelido, achados[0]);
}

const naoAchadas = [];
const pares = [];

for (const item of PLANTAO) {
  const perfil = alvoPorAux.get(item.aux);
  const dupla = acharDupla(duplas, item);
  if (!dupla) {
    naoAchadas.push(item);
    continue;
  }
  pares.push({ item, dupla, perfil });
}

const mudancas = pares.filter(({ dupla, perfil }) => dupla.supervisor_id !== perfil.id);
const citadas = new Set(pares.map(({ dupla }) => dupla.id));
const foraDoPlantao = duplas.filter((d) => d.status === "ativa" && !citadas.has(d.id));

console.log(`\nplantão de duplas (22/10) · ${PLANTAO.length} duplas · alvo ${REF}\n`);

for (const [aux, perfil] of alvoPorAux) {
  const meus = pares.filter((p) => p.item.aux === aux);
  const c1 = meus.filter((p) => p.item.crono === 1).length;
  const c2 = meus.filter((p) => p.item.crono === 2).length;
  const fora = meus.filter(({ dupla }) => dupla.supervisor_id !== perfil.id).length;
  console.log(
    `  ${aux.padEnd(8)} ${String(meus.length).padStart(2)} duplas · crono 1: ${c1} · crono 2: ${c2}` +
      (fora ? `   (${fora} divergente${fora > 1 ? "s" : ""})` : "   ok")
  );
}

if (naoAchadas.length) {
  console.log("\ndupla do plantão sem par no banco:");
  for (const i of naoAchadas) {
    console.log(`  ! ${i.aux} · crono ${i.crono} · ${i.mentor} × ${i.jovem}`);
  }
}

if (foraDoPlantao.length) {
  console.log("\ndupla ativa fora do plantão (revisar, não reatribuir):");
  for (const d of foraDoPlantao) {
    console.log(`  ? ${d.mentor} × ${d.jovem} · sup=${d.supervisor ?? "—"} · ${d.cronograma ?? "—"}`);
  }
}

if (!mudancas.length) {
  console.log("\nnada a fazer — as atribuições já batem com o plantão.");
  process.exit(naoAchadas.length ? 1 : 0);
}

console.log(`\n${mudancas.length} mudança${mudancas.length > 1 ? "s" : ""}:`);
for (const { item, dupla, perfil } of mudancas) {
  console.log(
    `  ${dupla.mentor} × ${dupla.jovem}: ${dupla.supervisor ?? "—"} → ${perfil.nome}` +
      `  (crono ${item.crono}, ${item.aux})`
  );
}

if (!APPLY) {
  console.log("\ndry-run — rode com --apply pra escrever.");
  process.exit(naoAchadas.length ? 1 : 0);
}

let falhas = 0;
for (const { dupla, perfil } of mudancas) {
  const { error } = await supabase
    .from("duplas")
    .update({ supervisor_id: perfil.id })
    .eq("id", dupla.id);
  if (error) {
    falhas++;
    console.error(`  ! ${dupla.mentor} × ${dupla.jovem}: ${error.message}`);
  }
}

// confere o resultado relendo — PATCH barrado por RLS não pode passar batido
const { data: relido, error: errRelido } = await supabase
  .from("duplas")
  .select("id, supervisor_id");
if (errRelido) throw errRelido;

const restantes = pares.filter(({ dupla, perfil }) => {
  const atual = relido?.find((d) => d.id === dupla.id)?.supervisor_id ?? null;
  return atual !== perfil.id;
});

console.log(
  `\naplicado: ${mudancas.length - restantes.length}/${mudancas.length}` +
    ` · restantes divergentes: ${restantes.length} · falhas: ${falhas}`
);
process.exit(restantes.length || falhas ? 1 : 0);
