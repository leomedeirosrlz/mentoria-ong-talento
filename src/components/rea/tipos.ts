/** Contrato único dos conceitos de mascote da Rea (assistente). Os três
 *  protótipos (Disco, Blob, Balão) aceitam exatamente estas props, então a
 *  troca de conceito no FAB/painel é só trocar o import. */

export type ReaEstado =
  | "parado" // ocioso: pisca, segue o cursor (desktop) ou dá olhadas (toque)
  | "atento" // hover/foco no FAB
  | "aberto" // painel acabou de abrir
  | "consultando" // ferramenta rodando
  | "escrevendo" // resposta em streaming
  | "pronto" // resposta terminou com o painel fechado (pula uma vez)
  | "erro"
  | "sonolento"; // ocioso há muito tempo

export type ReaProps = {
  estado: ReaEstado;
  /** lado do quadrado em px (o SVG escala pelo viewBox) */
  tamanho: number;
  /** olhos acompanham o ponteiro (mouse/caneta). Padrão: true */
  seguirCursor?: boolean;
  className?: string;
};
