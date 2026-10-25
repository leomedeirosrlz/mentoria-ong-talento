// Abas da ficha da dupla (?aba=). Módulo sem "use client" de propósito: a
// página (servidor) lê as constantes e o componente cliente das abas importa
// as mesmas — importar valor de um módulo "use client" no servidor daria
// referência de cliente, não o array.

export const ABAS = ["agora", "encontros", "instrumentos", "pessoas"] as const;

export type AbaFicha = (typeof ABAS)[number];

export const ROTULO_ABA: Record<AbaFicha, string> = {
  agora: "Agora",
  encontros: "Encontros",
  instrumentos: "Instrumentos",
  pessoas: "Pessoas",
};

/** Aba pedida na URL; qualquer valor desconhecido (ou ausente) cai em "Agora". */
export function parseAba(valor: string | undefined): AbaFicha {
  return (ABAS as readonly string[]).includes(valor ?? "")
    ? (valor as AbaFicha)
    : "agora";
}
