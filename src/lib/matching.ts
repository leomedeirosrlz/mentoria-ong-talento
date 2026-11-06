// Núcleo puro do pareamento semântico (REALIZA-338) — composição do
// documento, vocabulário de temas e ordenação por ranking. Sem imports
// de servidor: o FilaEspera (client) e os testes usam daqui; a máquina
// de recompute (fetch, LLM, embedding, escrita) fica em ia/matching.ts.
//
// Por que assimétrico: o doc do jovem pesa ASPIRAÇÃO (pra onde ele quer
// ir — motivação, objetivos, escolaridade, respostas temáticas do
// form_bruto) e o do mentor pesa OFERTA (o que ele traz — experiência,
// formação, áreas, cargo, bio). A similaridade entre os dois mede a
// interseção aspiração × oferta — o que o pareamento quer — em vez de
// "quem parece com quem", que rankearia o mentor mais parecido, não o
// mais útil.
//
// O que NÃO entra no doc: nome, gênero, cor/raça, cidade — são dimensões
// de regra/exibição (o card de afinidade já os cruza de forma visível);
// dentro do vetor eles influenciariam o ranking invisivelmente, o que
// é exatamente o tipo de viés opaco que o desenho evita.

import { ESCOLARIDADE_LABELS } from "@/lib/ciclo";
import { normaliza } from "@/lib/utils";
import type { Escolaridade } from "@/lib/types";

export type DonoTipo = "mentor" | "mentorado";

/** Vocabulário fechado de temas — o LLM só pode escolher daqui; qualquer
 *  tag inventada é descartada na sanitização. Curto de propósito: cada
 *  tema vira chip no card de afinidade ("N temas em comum"). */
export const TEMAS_MATCHING = [
  "tecnologia",
  "carreira",
  "esporte",
  "concursos",
  "artes",
  "idiomas",
  "saúde",
  "empreendedorismo",
  "família",
  "finanças",
  "educação",
  "games",
  "música",
  "fé",
  "voluntariado",
  "escrita",
  "leitura",
  "ciência",
  "meio ambiente",
  "cultura",
] as const;

// ---------- composição do documento ----------

/** Campos do doc por lado. Os dados chegam de um select já resolvido
 *  (o recompute lê a tabela direto com service role, sem recorte de
 *  grants). */
export type DadosMentor = {
  interesses?: string[] | null;
  motivacao?: string | null;
  bio?: string | null;
  cargo?: string | null;
  empresa?: string | null;
  form_bruto?: Record<string, unknown> | null;
  mentor_profiles?: {
    experiencia_previa?: string | null;
    formacao_externa?: string | null;
    areas?: string[] | null;
  } | null;
};

export type DadosMentorado = {
  interesses?: string[] | null;
  motivacao?: string | null;
  objetivos?: string | null;
  escolaridade?: Escolaridade | null;
  ong_origem?: string | null;
  form_bruto?: Record<string, unknown> | null;
};

/** Whitelist de chaves do form_bruto que valem pro vetor: respostas
 *  temáticas/aspiracionais do intake. Qualquer chave fora do padrão fica
 *  de fora — é a trava contra vazar dado civil (CPF, endereço…) pro
 *  provedor de embedding. Comparação na chave normalizada. */
const FORM_KEY_DOC =
  /sonh|objetiv|meta\b|metas|motiv|hobb|interess|habilidad|gosta|aprend|carreira|profiss|futuro|talento|dedic|supera/i;

const FORM_VAL_MAX = 300;
const FORM_KEYS_MAX = 5;

function linha(rotulo: string, valor: string | null | undefined): string {
  const v = (valor ?? "").trim();
  return v ? `${rotulo}: ${v}` : "";
}

function trechoFormBruto(
  form: Record<string, unknown> | null | undefined
): string[] {
  if (!form || typeof form !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(form)) {
    if (out.length >= FORM_KEYS_MAX) break;
    if (!FORM_KEY_DOC.test(normaliza(k))) continue;
    const texto = Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").join(", ")
      : typeof v === "string"
        ? v
        : "";
    const val = texto.trim().slice(0, FORM_VAL_MAX);
    if (val) out.push(`Resposta "${k.trim()}": ${val}`);
  }
  return out;
}

/** Documento-matching etiquetado — o texto exato que o embedding vê (e
 *  que fica gravado em matching_perfis.doc pra auditoria). */
export function montarDocMatching(
  tipo: DonoTipo,
  dados: DadosMentor | DadosMentorado
): string {
  const partes: string[] = [];
  const interesses = (dados.interesses ?? []).filter(Boolean).join(", ");
  if (interesses) partes.push(`Interesses: ${interesses}`);

  if (tipo === "mentor") {
    const d = dados as DadosMentor;
    partes.push(linha("Motivação para ser mentor", d.motivacao));
    const mp = d.mentor_profiles ?? null;
    partes.push(linha("Experiência com mentoria", mp?.experiencia_previa));
    partes.push(linha("Formação e estudos", mp?.formacao_externa));
    const areas = (mp?.areas ?? []).filter(Boolean).join(", ");
    if (areas) partes.push(`Áreas de atuação: ${areas}`);
    const atuacao = [d.cargo, d.empresa].filter(Boolean).join(" na empresa ");
    partes.push(linha("Atuação profissional", atuacao || null));
    partes.push(linha("Sobre", d.bio));
  } else {
    const d = dados as DadosMentorado;
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
  partes.push(...trechoFormBruto(dados.form_bruto));
  return partes.filter(Boolean).join("\n");
}

// ---------- temas (vocabulário fechado via LLM) ----------

const TEMAS_MAX = 6;

/** Extrai e sanitiza os temas da resposta do modelo: procura o array
 *  JSON, filtra pro vocabulário, deduplica normalizado e corta em
 *  TEMAS_MAX. Resposta quebrada/ausente → [] (nunca inventa). */
export function sanitizarTemas(
  content: string | null | undefined
): string[] {
  if (!content) return [];
  const m = /\[[\s\S]*\]/.exec(content);
  if (!m) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(m[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const norm = normaliza(item);
    // a comparação é no vocab normalizado, mas o chip exibe a forma
    // canônica do vocab ("saúde", "música"), não a do modelo ("saude")
    const canon = TEMAS_MATCHING.find((t) => normaliza(t) === norm);
    if (!canon || vistos.has(canon)) continue;
    vistos.add(canon);
    out.push(canon);
    if (out.length >= TEMAS_MAX) break;
  }
  return out;
}

// ---------- ordenação (aplicada na UI) ----------

/** Reordena o pool pelo ranking semântico: ranqueados primeiro na ordem
 *  do RPC, não-ranqueados mantêm a ordem de entrada intacta — quem não
 *  tem vetor nunca "some" nem muda de lugar por causa do recurso novo. */
export function ordenarPorRank<T extends { id: string }>(
  itens: readonly T[],
  rank: readonly string[] | null | undefined
): T[] {
  if (!rank?.length) return [...itens];
  const pos = new Map(rank.map((id, i) => [id, i]));
  return [...itens].sort((a, b) => {
    const pa = pos.get(a.id);
    const pb = pos.get(b.id);
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });
}
