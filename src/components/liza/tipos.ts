/** Contrato único dos conceitos de mascote da Liza (assistente). Os três
 *  protótipos (Disco, Blob, Balão) aceitam exatamente estas props, então a
 *  troca de conceito no FAB/painel é só trocar o import. */

export type LizaEstado =
  | "parado" // ocioso: pisca, segue o cursor (desktop) ou dá olhadas (toque)
  | "atento" // hover/foco no FAB
  | "aberto" // painel acabou de abrir
  | "consultando" // ferramenta rodando
  | "escrevendo" // resposta em streaming
  | "falando" // falando de verdade: boca tagarela (streaming com voz)
  | "pronto" // resposta terminou com o painel fechado (pula uma vez)
  | "erro"
  | "sonolento"; // ocioso há muito tempo

export type LizaProps = {
  estado: LizaEstado;
  /** lado do quadrado em px (o SVG escala pelo viewBox) */
  tamanho: number;
  /** olhos acompanham o ponteiro (mouse/caneta). Padrão: true */
  seguirCursor?: boolean;
  className?: string;
};
