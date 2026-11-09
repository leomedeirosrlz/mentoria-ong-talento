// Leitura dos guias pra guia_consulta, com cache (cache.ts). O corpus é
// institucional e só muda quando o ingest roda; o recorte por papel sai da
// audiência do frontmatter (manifest docs/rag/fontes.json) — então a mesma pergunta não
// precisa repetir embedding + RPC + leitura dos chunks a cada vez, e o
// catálogo (view ia_guias_catalogo) não precisa ser relido por chamada.
//
// Custo por pergunta inédita: 1 embedding + 2 queries. Pergunta repetida
// (chip de sugestão, dúvida comum) dentro de 10 min: zero.

import type { SupabaseClient } from "@supabase/supabase-js";
import manifesto from "../../../docs/rag/fontes.json";
import { veMaterial } from "@/lib/materiais";
import { secaoAnchor } from "@/lib/materiais/corpus-anchor";
import { temPapel, type AppRole } from "@/lib/types";
import { CacheTtl, chavePergunta } from "./cache";
import { embedConfigurado, embedQuery } from "./embed";
import { topSecoes } from "./busca-guias";
import { limparTrecho } from "./fontes";
import { matchGuiaIa, textosChunksIa, type ChunkCitavel } from "./queries";

export type FonteCitavel = {
  guia: string;
  secao: string | null;
  /** âncora da seção no documento nativo — sufixo # do link da fonte.
   *  Sai da coluna ia_chunks.secao_anchor quando o chunk é pós-0165;
   *  nos chunks antigos cai na slugify da seção calculada na hora
   *  (mesma regra, corpus-anchor.ts) até o re-ingest rodar. */
  ancora: string | null;
  /** slug do documento nativo (ia_chunks.material) — a metaFonte monta
   *  /materiais/documento/<material> a partir dele */
  material: string | null;
  trecho: string;
};

// 10 min: um re-ingest aparece na busca em até 10 min sem deploy
const RESULTADO_TTL_MS = 10 * 60_000;
// o vetor de uma pergunta não muda enquanto o modelo de embedding não
// mudar — 24h só limita a memória de perguntas que não voltam
const VETOR_TTL_MS = 24 * 60 * 60_000;

const cacheResultado = new CacheTtl<FonteCitavel[]>(RESULTADO_TTL_MS, 300);
// 512 floats por vetor (~4 KB): 500 vetores ficam em ~2 MB
const cacheVetor = new CacheTtl<number[] | null>(VETOR_TTL_MS, 500);
const cacheCatalogo = new CacheTtl<string[]>(RESULTADO_TTL_MS, 1);

export type LeitorGuia = { role: AppRole | null; papeis: AppRole[] };

const AUDIENCIA = new Map<string, string[]>(
  manifesto.fontes.map((f) => [f.guia, f.audiencia])
);

/** Mesma regra do corpusServePapel: audiência vazia serve a todos. Guia
 *  fora do manifest (chunk de ingest antigo) fica só pra coordenação. */
export function guiaVisivel(guia: string, leitor: LeitorGuia): boolean {
  const aud = AUDIENCIA.get(guia);
  if (!aud) return temPapel(leitor, "coordenacao");
  return aud.length === 0 || veMaterial(aud, leitor);
}

export function limparCacheGuias() {
  cacheResultado.limpar();
  cacheVetor.limpar();
  cacheCatalogo.limpar();
}

/** Vetor da pergunta com cache. Falha de embedding (null) não é guardada:
 *  a próxima chamada tenta de novo em vez de ficar 24h só no FTS. */
function vetorDaPergunta(chave: string, pergunta: string) {
  return cacheVetor.obter(chave, () => embedQuery(pergunta), (v) => v !== null);
}

/** Top 4 seções citáveis da pergunta: busca híbrida (ou só FTS), 4 seções
 *  únicas e o chunk inteiro de cada uma (~900 chars, não a janela de 40
 *  palavras do headline — falha na leitura cai no trecho da RPC). */
export function buscarNosGuias(
  supabase: SupabaseClient,
  pergunta: string,
  busca: "fts" | "hibrida",
  /** sem leitor = corpus inteiro (eval/admin) */
  leitor?: LeitorGuia
): Promise<FonteCitavel[]> {
  const chave = chavePergunta(pergunta);
  // sem chave de embedding o ambiente é só FTS — conta como "fts" pro
  // cache em vez de toda busca parecer degradada e nunca ser guardada
  const modo = embedConfigurado() ? busca : "fts";
  // híbrida sem vetor (embedding falhou) é resultado degradado: serve a
  // resposta desta vez mas não fica guardado, senão a busca ficava só no
  // FTS por 10 min por causa de uma falha passageira
  let degradado = false;
  const filtra = leitor && !temPapel(leitor, "coordenacao");
  const recorte = filtra
    ? [...new Set([leitor.role, ...leitor.papeis])].sort().join(",")
    : "*";
  return cacheResultado.obter(`${modo}|${recorte}|${chave}`, async () => {
    const vetor = modo === "fts" ? null : await vetorDaPergunta(chave, pergunta);
    degradado = modo === "hibrida" && vetor === null;
    // pede 10 e fica com 4 seções únicas (topSecoes, busca-guias.ts); com
    // recorte pede mais, senão os docs de staff ocupavam o top inteiro
    const brutos = await matchGuiaIa(supabase, pergunta, filtra ? 30 : 10, vetor);
    const top = topSecoes(
      filtra ? brutos.filter((f) => guiaVisivel(f.guia, leitor)) : brutos,
      4
    );
    // sem o texto inteiro o trecho cai no headline da RPC: serve agora,
    // mas não fica 10 min guardado
    const textos = await textosChunksIa(supabase, top).catch(() => {
      degradado = true;
      return new Map<string, ChunkCitavel>();
    });
    // score e pagina saem fora — ranking não ajuda a citar e pagina é o id
    // sintético do chunk (lia como "pág. 200"); trecho limpo, sem <b> do
    // headline nem markdown cru
    return top.map((f) => {
      const chunk = textos.get(`${f.guia}|${f.pagina}`);
      return {
        guia: f.guia,
        secao: f.secao,
        // coluna da 0165 quando o chunk é novo; calculada da seção nos
        // chunks antigos (e quando a leitura degradou) — mesma slugify
        ancora:
          chunk?.secaoAnchor ?? (f.secao ? secaoAnchor(f.secao) : null),
        material: chunk?.material ?? null,
        trecho: limparTrecho(chunk?.texto ?? f.trecho, 1100),
      };
    });
  }, () => !degradado);
}

/** Os documentos do corpus (nomes únicos, ordenados). Erro devolve lista
 *  vazia sem guardar — a busca em si não depende do catálogo. */
export async function catalogoGuias(
  supabase: SupabaseClient,
  leitor?: LeitorGuia
): Promise<string[]> {
  let falhou = false;
  const todos = await cacheCatalogo.obter(
    "catalogo",
    async () => {
      // a view (0162) já deduplica no banco: uma linha por guia em vez de
      // todos os chunks, longe do corte de max_rows do PostgREST
      const { data, error } = await supabase.from("ia_guias_catalogo").select("guia");
      if (error) {
        console.error("catalogoGuias:", error);
        falhou = true;
        return [];
      }
      return [...new Set((data ?? []).map((r) => r.guia as string | null))]
        .filter((g): g is string => !!g)
        .sort();
    },
    () => !falhou
  );
  return leitor ? todos.filter((g) => guiaVisivel(g, leitor)) : todos;
}
