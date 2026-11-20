import { efetivoDe } from "./jovem-especialista";
import type {
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
} from "./types";

/** A triagem saiu do fluxo de especialista na 0158: 'aguardando_coord'
 *  sobrevive só como histórico no CHECK, e toda superfície lê o pedido como
 *  'aberta' (no mural). */
export function statusDoPedido(
  status: SolicitacaoEspecialistaStatus
): SolicitacaoEspecialistaStatus {
  return status === "aguardando_coord" ? "aberta" : status;
}

/** Status efetivo do pedido com a expiração lazy aplicada e o legado
 *  normalizado — a régua única das telas de coordenação. */
export function statusEfetivoDoPedido(s: {
  status: SolicitacaoEspecialistaStatus;
  status_efetivo?: SolicitacaoEspecialistaStatus;
}): SolicitacaoEspecialistaStatus {
  return statusDoPedido(efetivoDe(s));
}

/** O que ainda pede ação de alguém na home da coordenação: o pedido no
 *  mural (aberta), a negociação viva (contra_proposta) e o slot vencido
 *  (expirada — segura o par e o teto até alguém cancelar). */
const ACIONAVEIS: ReadonlySet<SolicitacaoEspecialistaStatus> = new Set([
  "aberta",
  "contra_proposta",
  "expirada",
]);

export function pedidoAcionavel(s: {
  status: SolicitacaoEspecialistaStatus;
  status_efetivo?: SolicitacaoEspecialistaStatus;
}): boolean {
  return ACIONAVEIS.has(statusEfetivoDoPedido(s));
}

/** A lista que alimenta contador e card juntos: o contador da home é o
 *  length daqui e o card renderiza desta mesma lista, então "N", os itens
 *  visíveis e o "e mais N" nunca divergem. */
export function pedidosAcionaveis(
  solicitacoes: readonly SolicitacaoEspecialista[]
): SolicitacaoEspecialista[] {
  return solicitacoes.filter(pedidoAcionavel);
}
