import type {
  JovemEspecialista,
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
} from "./types";

// Domínio puro do lado do jovem (REALIZA-112 PR2) — deriváveis que as
// superfícies /jovem compartilham. O banco segura as regras de verdade
// (pedir_especialista_jovem + trigger solicitacao_integridade); aqui é a
// projeção pra UI honesta — nada que o PostgREST não revalidaria.

/** Status com a expiração lazy aplicada — a coluna `status_efetivo` só
 *  existe na view solicitacoes_mural; sem ela vale o status cru. */
export function efetivoDe(s: {
  status: SolicitacaoEspecialistaStatus;
  status_efetivo?: SolicitacaoEspecialistaStatus;
}): SolicitacaoEspecialistaStatus {
  return s.status_efetivo ?? s.status;
}

/** "Em aberto" do ponto de vista do jovem: ocupa o teto de 3 pedidos e a
 *  dedup por par — e aparece na home. A `expirada` lazy conta também: a
 *  RPC lê o status cru da tabela (que segue em aberto até o cancelamento),
 *  então um pedido expirado ainda bloqueia um novo pro mesmo especialista. */
export function pedidoEmAberto(s: {
  status: SolicitacaoEspecialistaStatus;
  status_efetivo?: SolicitacaoEspecialistaStatus;
}): boolean {
  const e = efetivoDe(s);
  return (
    e === "aberta" ||
    e === "aguardando_coord" ||
    e === "contra_proposta" ||
    e === "expirada"
  );
}

/** Gate da demanda (0074): a PRIMEIRA solicitação do PAR precisa do porquê
 *  — sessões seguintes na mesma trilha são motivo-curto. O trigger pede
 *  demanda quando `demanda is null` e `dupla_id is null` e não existe
 *  dupla esp ativa/pausada do jovem que case o alvo — pra pedido dirigido
 *  o par é (jovem × desejado); broadcast (sem alvo) já se resolve com
 *  qualquer trilha viva. `trilhasAtivas` = os profile_ids dos
 *  especialistas com dupla esp ativa/pausada dele; `especialistaId` = o
 *  alvo dirigido em tela (null = broadcast ou ainda não escolhido). */
export function pedidoPrecisaDemanda(
  trilhasAtivas: Iterable<string>,
  especialistaId?: string | null
): boolean {
  const trilhas = new Set(trilhasAtivas);
  if (trilhas.size === 0) return true;
  // broadcast: o trigger aceita qualquer dupla esp viva do jovem
  if (especialistaId == null) return false;
  // dirigido: só a trilha DESSE especialista libera o motivo-curto —
  // um nome novo é "primeiro pedido do par" e pede a demanda rica
  return !trilhas.has(especialistaId);
}

/** O pedido em aberto que já amarra o par jovem×especialista — a dedup da
 *  RPC usa `coalesce(especialista_desejado_id, especialista_id)`: o alvo é
 *  quem recebeu o pedido ou quem engajou num broadcast. */
export function pedidoAbertoComEsp(
  solicitacoes: SolicitacaoEspecialista[],
  especialistaId: string | null | undefined
): SolicitacaoEspecialista | undefined {
  if (!especialistaId) return undefined;
  return solicitacoes.find(
    (s) =>
      pedidoEmAberto(s) &&
      (s.especialista_desejado_id ?? s.especialista_id) === especialistaId
  );
}

/** Nome do especialista do pedido pro jovem. Os embeds de profiles não
 *  passam pela RLS do papel mentorado (a view mural só denormaliza
 *  `especialista_nome`, do engajado) — o direcionado resolve pelo catálogo
 *  jovem_especialistas, que a página sempre traz junto. */
export function nomeEspDoPedido(
  s: SolicitacaoEspecialista,
  catalogo: JovemEspecialista[]
): string | null {
  const porId = new Map(catalogo.map((e) => [e.id, e.nome_social || e.nome]));
  return (
    s.especialista?.nome ??
    s.desejado?.nome ??
    (s.especialista_id
      ? (porId.get(s.especialista_id) ?? null)
      : null) ??
    (s.especialista_desejado_id
      ? (porId.get(s.especialista_desejado_id) ?? null)
      : null)
  );
}

/** Frase de estado do pedido na voz do jovem — uma linha que diz onde o
 *  pedido está e com quem a bola está, sem jargão de staff. `nomeEsp` = o
 *  nome resolvido pelo catálogo (null = broadcast ainda sem engajado). */
export function resumoPedidoJovem(
  efetivo: SolicitacaoEspecialistaStatus,
  nomeEsp: string | null
): string {
  switch (efetivo) {
    case "aguardando_coord":
      return "A coordenação tá olhando seu pedido antes de liberar.";
    case "aberta":
      return nomeEsp
        ? `Esperando ${nomeEsp} responder.`
        : "Seu pedido tá no mural dos especialistas.";
    case "contra_proposta":
      return nomeEsp
        ? `Negociando horário com ${nomeEsp}.`
        : "Negociando horário.";
    case "expirada":
      return "O horário desse pedido passou — ele expirou.";
    case "recusada":
      return nomeEsp
        ? `${nomeEsp} não pôde pegar esse pedido.`
        : "O pedido foi recusado.";
    case "aceita":
      return "Sessão marcada — tá na sua agenda.";
    case "cancelada":
      return "Pedido cancelado.";
  }
}
