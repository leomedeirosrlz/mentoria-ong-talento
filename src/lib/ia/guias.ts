// Leitura dos guias pra guia_consulta, com cache (cache.ts). O corpus é
// institucional e igual pra todo mundo (ia_chunks não tem recorte por
// pessoa) e só muda quando o ingest roda — então a mesma pergunta não
// precisa repetir embedding + RPC + leitura dos chunks a cada vez, e o
// catálogo (view ia_guias_catalogo) não precisa ser relido por chamada.
//
// Custo por pergunta inédita: 1 embedding + 2 queries. Pergunta repetida
// (chip de sugestão, dúvida comum) dentro de 10 min: zero.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CacheTtl, chavePergunta } from "./cache";
import { embedConfigurado, embedQuery } from "./embed";
import { topSecoes } from "./busca-guias";
import { limparTrecho } from "./fontes";
import { matchGuiaIa, textosChunksIa } from "./queries";

export type FonteCitavel = {
  guia: string;
  secao: string | null;
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
  busca: "fts" | "hibrida"
): Promise<FonteCitavel[]> {
  const chave = chavePergunta(pergunta);
  // sem chave de embedding o ambiente é só FTS — conta como "fts" pro
  // cache em vez de toda busca parecer degradada e nunca ser guardada
  const modo = embedConfigurado() ? busca : "fts";
  // híbrida sem vetor (embedding falhou) é resultado degradado: serve a
  // resposta desta vez mas não fica guardado, senão a busca ficava só no
  // FTS por 10 min por causa de uma falha passageira
  let degradado = false;
  return cacheResultado.obter(`${modo}|${chave}`, async () => {
    const vetor = modo === "fts" ? null : await vetorDaPergunta(chave, pergunta);
    degradado = modo === "hibrida" && vetor === null;
    // pede 10 e fica com 4 seções únicas (topSecoes, busca-guias.ts)
    const top = topSecoes(await matchGuiaIa(supabase, pergunta, 10, vetor), 4);
    // sem o texto inteiro o trecho cai no headline da RPC: serve agora,
    // mas não fica 10 min guardado
    const textos = await textosChunksIa(supabase, top).catch(() => {
      degradado = true;
      return new Map<string, string>();
    });
    // score e pagina saem fora — ranking não ajuda a citar e pagina é o id
    // sintético do chunk (lia como "pág. 200"); trecho limpo, sem <b> do
    // headline nem markdown cru
    return top.map((f) => ({
      guia: f.guia,
      secao: f.secao,
      trecho: limparTrecho(textos.get(`${f.guia}|${f.pagina}`) ?? f.trecho, 1100),
    }));
  }, () => !degradado);
}

/** Os documentos do corpus (nomes únicos, ordenados). Erro devolve lista
 *  vazia sem guardar — a busca em si não depende do catálogo. */
export async function catalogoGuias(supabase: SupabaseClient): Promise<string[]> {
  let falhou = false;
  return cacheCatalogo.obter(
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
}
