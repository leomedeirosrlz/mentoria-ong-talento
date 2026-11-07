/** Slug determinístico da âncora de uma seção do corpus RAG
 *  (docs/rag/*.md — seção = "##" ou "## › ###", como em ia_chunks.secao).
 *  O mesmo valor sai no `id` do heading em /materiais/documento/<slug> e
 *  no fragmento `#` dos links de citação do assistente — os dois lados
 *  ficam alinhados por construção enquanto esta função for a fonte única.
 *  Mantenha-a pura e estável: ex.: "PDM › Onde fica na plataforma" →
 *  "pdm-onde-fica-na-plataforma". */
export function secaoAnchor(secao: string): string {
  return secao
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
