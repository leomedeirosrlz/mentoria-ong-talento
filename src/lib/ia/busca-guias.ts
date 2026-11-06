// Regras puras da busca nos guias (tool guia_consulta): o que vai pro
// braço FTS e como os 10 candidatos da RPC viram os 4 trechos. Sem
// imports de propósito: scripts/avaliar-busca-guias.mjs roda este mesmo
// arquivo (Node com type stripping) pra medir a busca com a regra real.

/** Palavras da moldura da pergunta ("o que o guia diz sobre…") que
 *  viram lexema e casam em quase todo chunk: "gui" está no slug de
 *  ~150 chunks dos guias e dava hit gratuito a eles, empurrando o doc
 *  dedicado pra fora do top-4 (.auditoria-rag/A-pipeline.md, P6). Só o
 *  braço FTS recebe a pergunta aparada; o vetor usa a original. Se não
 *  sobrar termo, a original segue. */
const MOLDURA_FTS = /\b(guias?|diz(em)?)\b/gi;

export function perguntaFts(pergunta: string): string {
  const aparada = pergunta.replace(MOLDURA_FTS, " ").replace(/\s+/g, " ").trim();
  return /[\p{L}\d]{3,}/u.test(aparada) ? aparada : pergunta;
}

/** Pede 10 e fica com `n` SEÇÕES únicas: sem o dedup, 3 slots iam pro
 *  mesmo capítulo ("12 · Avaliação" repetia 3×) e o roteiro diverso
 *  ficava de fora do contexto do modelo. Com a seção "## › ###" da
 *  ingestão, subseções distintas do mesmo capítulo contam separado. */
export function topSecoes<T extends { guia: string; secao: string | null }>(
  fontes: T[],
  n = 4
): T[] {
  const vistas = new Set<string>();
  return fontes
    .filter((f) => {
      const chave = `${f.guia}|${f.secao ?? ""}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    })
    .slice(0, n);
}
