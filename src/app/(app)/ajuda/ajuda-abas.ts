// Abas da Ajuda (?aba=). Módulo sem "use client" de propósito: a página
// (servidor) lê as constantes e o componente cliente das abas importa as
// mesmas — importar valor de um módulo "use client" no servidor daria
// referência de cliente, não o array.

export const ABAS_AJUDA = [
  { id: "perguntas", rotulo: "Perguntas frequentes" },
  { id: "como-funciona", rotulo: "Como funciona" },
] as const;

export type AbaAjuda = (typeof ABAS_AJUDA)[number]["id"];

/** Aba pedida na URL; qualquer valor desconhecido (ou ausente) cai no FAQ. */
export function parseAbaAjuda(valor: string | undefined): AbaAjuda {
  return ABAS_AJUDA.some((a) => a.id === valor)
    ? (valor as AbaAjuda)
    : "perguntas";
}
