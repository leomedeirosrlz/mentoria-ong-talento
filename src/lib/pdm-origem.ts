import type { FormularioCampo, RespostaValor } from "@/lib/forms/schema";
import {
  normalizaTituloPdm,
  parseSubmetasLinhas,
  type PdmItem,
} from "@/lib/pdm";

/** Recorte serializável dos instrumentos da dupla usado pra abrir a
 *  resposta de onde um item projetado veio. Não é schema novo: é o mesmo
 *  payload de instrumentos_da_dupla/jovem_jornada, reduzido às entregas
 *  respondidas. */
export type PdmEntregaOrigem = {
  linkId: string;
  destino: string | null;
  respondidoEm: string | null;
  respostas: Record<string, RespostaValor>;
};

export type PdmInstrumentoOrigem = {
  sistema: "metas" | "pdm" | "visao";
  titulo: string;
  campos: FormularioCampo[];
  entregas: PdmEntregaOrigem[];
};

export type PdmOrigemResolvida = {
  instrumento: PdmInstrumentoOrigem;
  entrega: PdmEntregaOrigem;
  /** âncora dentro da leitura estruturada — a meta que gerou o item. */
  ancora: string | null;
  /** `exata` quando o título do item ainda confere com o slot da resposta;
   *  `provavel` quando a dupla editou o item depois e a origem é inferida
   *  pelo instrumento/slot mais recente (não existe FK resposta_id). */
  certeza: "exata" | "provavel";
};

type EntregaBruta = {
  link_id: string;
  destino?: string | null;
  status: string;
  respondido_em?: string | null;
  usado_em?: string | null;
  created_at?: string | null;
  respostas?: Record<string, unknown> | null;
};

type InstrumentoBruto = {
  sistema: string;
  titulo: string;
  campos: unknown;
  entregas: EntregaBruta[];
};

/** Reduce os instrumentos já lidos pela página às entregas respondidas que
 *  podem ter projetado o PDM. Ordena da resposta mais nova pra mais velha —
 *  a projeção reescreve slots intocados, então a mais recente é o fallback
 *  honesto quando a dupla já editou o item. */
export function instrumentosOrigemPdm(
  instrumentos: InstrumentoBruto[]
): PdmInstrumentoOrigem[] {
  return instrumentos
    .filter(
      (i): i is InstrumentoBruto & { sistema: "metas" | "pdm" | "visao" } =>
        i.sistema === "metas" || i.sistema === "pdm" || i.sistema === "visao"
    )
    .map((i) => ({
      sistema: i.sistema,
      titulo: i.titulo,
      campos: (Array.isArray(i.campos) ? i.campos : []) as FormularioCampo[],
      entregas: i.entregas
        .filter((e) => e.status === "respondido" && e.respostas != null)
        .map((e) => ({
          linkId: e.link_id,
          destino: e.destino ?? null,
          respondidoEm: e.respondido_em ?? e.usado_em ?? null,
          respostas: e.respostas as Record<string, RespostaValor>,
        }))
        .sort((a, b) =>
          (b.respondidoEm ?? "").localeCompare(a.respondidoEm ?? "")
        ),
    }))
    .filter((i) => i.entregas.length > 0);
}

function textoDoSlot(
  respostas: Record<string, RespostaValor>,
  origemCampo: string | null
): { texto: string | null; metaN: number | null } {
  if (!origemCampo) return { texto: null, metaN: null };
  const meta = /^meta_(\d+)$/.exec(origemCampo);
  if (meta) {
    const v = respostas[origemCampo];
    return {
      texto: typeof v === "string" ? v : null,
      metaN: Number(meta[1]),
    };
  }
  const sub = /^sub_(\d+)_(\d+)$/.exec(origemCampo);
  if (sub) {
    const v = respostas[`submetas_${sub[1]}`];
    const linha =
      typeof v === "string"
        ? parseSubmetasLinhas(v)[Number(sub[2]) - 1]
        : undefined;
    return { texto: linha ?? null, metaN: Number(sub[1]) };
  }
  return { texto: null, metaN: null };
}

/** Resolve item → resposta sem depender de migration: compara o título do
 *  item com o slot (`meta_N`/`sub_N_i`) de cada resposta daquele
 *  instrumento. Quando a dupla já editou o título, cai na resposta mais
 *  recente do sistema e marca a inferência como `provavel`. */
export function respostaOrigemDoItem(
  item: Pick<PdmItem, "titulo" | "origem" | "origemCampo">,
  instrumentos: PdmInstrumentoOrigem[]
): PdmOrigemResolvida | null {
  if (item.origem === "manual") return null;
  const instrumento = instrumentos.find((i) => i.sistema === item.origem);
  if (!instrumento) return null;

  const titulo = normalizaTituloPdm(item.titulo);
  let ancora: string | null = null;
  for (const entrega of instrumento.entregas) {
    const slot = textoDoSlot(entrega.respostas, item.origemCampo);
    if (slot.metaN != null) ancora = `pdm-resposta-meta-${slot.metaN}`;
    if (
      slot.texto != null &&
      titulo &&
      normalizaTituloPdm(slot.texto) === titulo
    ) {
      return { instrumento, entrega, ancora, certeza: "exata" };
    }
  }

  const entrega = instrumento.entregas[0];
  if (!entrega) return null;
  const slot = textoDoSlot(entrega.respostas, item.origemCampo);
  return {
    instrumento,
    entrega,
    ancora: slot.metaN != null ? `pdm-resposta-meta-${slot.metaN}` : ancora,
    certeza: "provavel",
  };
}
