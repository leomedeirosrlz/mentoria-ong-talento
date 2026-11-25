// Avaliação da busca nos guias (tool guia_consulta): roda as perguntas de
// docs/rag/avaliacao-busca.json contra a RPC match_ia_chunks e confere se o
// trecho esperado aparece entre os 4 que o modelo recebe. Usa as mesmas
// regras da tool (src/lib/ia/busca-guias.ts, importado direto: Node faz o
// type stripping), então mede a busca real, não uma cópia.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/avaliar-busca-guias.mjs
//   … --vetor              → braço vetorial também (precisa de IA_EMBED_API_KEY)
//   … --json saida.json    → grava o resultado por pergunta (comparar antes × depois)
//
// Só lê (RPC + select). Não cai no .env.local de propósito: lá é produção, e
// o alvo tem de ser escolhido explicitamente pelo ambiente.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { perguntaFts, topSecoes } from "../src/lib/ia/busca-guias.ts";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VETOR = process.argv.includes("--vetor");
const iJson = process.argv.indexOf("--json");
const SAIDA = iJson > -1 ? process.argv[iJson + 1] : null;

if (!URL_ || !KEY) {
  console.error("precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(2);
}
const EMBED_KEY = process.env.IA_EMBED_API_KEY;
if (VETOR && !EMBED_KEY) {
  console.error("--vetor precisa de IA_EMBED_API_KEY.");
  process.exit(2);
}

const { perguntas } = JSON.parse(
  readFileSync(new URL("../docs/rag/avaliacao-busca.json", import.meta.url), "utf-8")
);
const supabase = createClient(URL_, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// mesmo modelo/dimensão do ingerir-guias.mjs e do embedQuery da tool
async function embed(texto) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${EMBED_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.IA_EMBED_MODEL ?? "text-embedding-3-small",
      input: texto,
      dimensions: Number(process.env.IA_EMBED_DIM ?? 512),
    }),
  });
  if (!res.ok) throw new Error(`embeddings HTTP ${res.status}`);
  return (await res.json()).data[0].embedding;
}

const casa = (f, alvo) =>
  f.guia === alvo.guia &&
  (!alvo.secao_contem ||
    (f.secao ?? "").toLowerCase().includes(alvo.secao_contem.toLowerCase()));

console.log(`alvo: ${new URL(URL_).hostname.split(".")[0]} · ${VETOR ? "híbrida" : "só FTS"} · ${perguntas.length} perguntas\n`);

const resultado = [];
for (const p of perguntas) {
  const vetor = VETOR ? await embed(p.pergunta) : null;
  const { data, error } = await supabase.rpc("match_ia_chunks", {
    p_query: perguntaFts(p.pergunta),
    p_limit: 10,
    ...(vetor ? { p_embedding: `[${vetor.join(",")}]` } : {}),
  });
  if (error) {
    console.error(`✗ ${p.id}: RPC falhou: ${error.message}`);
    process.exit(1);
  }
  const top = topSecoes(data ?? [], 4);
  const pos = top.findIndex((f) => p.esperado.some((e) => casa(f, e)));
  const ok = pos > -1;
  resultado.push({
    id: p.id,
    ok,
    posicao: ok ? pos + 1 : null,
    top: top.map((f) => `${f.guia} · ${f.secao ?? ""}`),
  });
  console.log(`${ok ? "✓" : "✗"} ${p.id.padEnd(32)} ${ok ? `#${pos + 1}` : "  "}  ${p.pergunta}`);
  if (!ok) for (const t of top) console.log(`      ${t.guia} · ${t.secao ?? ""}`);
}

const acertos = resultado.filter((r) => r.ok).length;
const primeiro = resultado.filter((r) => r.posicao === 1).length;
console.log(
  `\n== ${acertos}/${resultado.length} no top-4 · ${primeiro}/${resultado.length} em 1º`
);
if (SAIDA) {
  writeFileSync(SAIDA, JSON.stringify({ alvo: URL_, vetor: VETOR, resultado }, null, 2) + "\n");
  console.log(`resultado em ${SAIDA}`);
}
