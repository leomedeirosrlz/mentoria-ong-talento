import { formatDiaNum, formatMesAbrev, passoEsp } from "./ciclo";
import { prazoTrilhaEspecialista } from "./encerramento";
import type {
  Dupla,
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
    case "sugerida":
      return "Seu mentor sugeriu. Você decide na página de especialistas.";
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
      return "O horário desse pedido passou. Ele expirou.";
    case "recusada":
      return nomeEsp
        ? `${nomeEsp} não pôde pegar esse pedido.`
        : "O pedido foi recusado.";
    case "aceita":
      return "Sessão marcada. Está na sua agenda.";
    case "cancelada":
      return "Pedido cancelado.";
  }
}

// ============ WP6-R2 — cardápio por variante + ciclo de vida ============

/** Estado do card do cardápio — uma variante por especialista pra aquele
 *  jovem. Precedência: sua trilha > pedido em andamento > sem vagas >
 *  agenda não aberta > disponível. */
export type VarianteCardEsp =
  | "sua"         // trilha ativa/pausada com esse especialista
  | "andamento"   // pedido em aberto dirigido a ele
  | "sem_vagas"   // capacidade cheia — só pedido pro mural
  | "sem_agenda"  // com vagas mas sem grade_resumo — idem mural
  | "disponivel";

export function varianteDoCard(
  e: JovemEspecialista,
  ctx: {
    /** mentor_ids das trilhas esp ativas/pausadas do jovem */
    trilhasAtivas: string[];
    /** pedidos em aberto do jovem (pedidoEmAberto) */
    pedidosAbertos: SolicitacaoEspecialista[];
  }
): VarianteCardEsp {
  // andamento antes de "sua": trilha ativa + pedido follow-up em aberto
  // pro mesmo par → "Pedir próxima sessão" morreria na dedup da RPC; a
  // resposta honesta é "seu pedido tá na mesa acima"
  if (pedidoAbertoComEsp(ctx.pedidosAbertos, e.id)) return "andamento";
  if (ctx.trilhasAtivas.includes(e.id)) return "sua";
  if (e.vagas != null && e.vagas <= 0) return "sem_vagas";
  // vagas sem janela publicada: pedido dirigido não tem horário pra
  // aterrissar — cai no mural como se a agenda estivesse cheia
  if (!e.grade_resumo?.length) return "sem_agenda";
  return "disponivel";
}

export type PassoVida = {
  rotulo: string;
  /** "12 set" — null = ainda não aconteceu (ou data a projetar, como o
   *  prazo) */
  data: string | null;
  estado: "feito" | "atual" | "futuro";
};

/** "12 set" — dia + mês abreviado sem ano nem ponto: o formato das datas do
 *  stepper no mock v6 (ol.life). Compõe os helpers existentes; null quando
 *  a entrada não é uma data. */
function diaMes(iso: string | null | undefined): string | null {
  const d = formatDiaNum(iso);
  const m = formatMesAbrev(iso);
  return d && m ? `${d} ${m}` : null;
}

/** Stepper do ciclo de vida do pedido→trilha com datas (mock v6 ol.life):
 *  Pedido → No mural → Aceite → Em andamento → Concluída+devolutiva. Um nó
 *  "atual" por vez: ele marca a fase onde o pedido/trilha está parado —
 *  estados mortos (recusada/cancelada) ficam sem nó vivo, o stepper não é
 *  pra eles. `hoje` só alimenta a projeção do prazo. */
export function stepperCicloDeVida({
  solicitacao,
  dupla,
  hoje = new Date(),
}: {
  solicitacao: SolicitacaoEspecialista | null;
  dupla: Dupla | null;
  hoje?: Date;
}): PassoVida[] {
  const sol = solicitacao;
  const efetivo = sol ? efetivoDe(sol) : null;
  // status cru: 'sugerida' nunca é override lazy (a expiração só existe pra
  // aberta/contra_proposta com slot vencido)
  const sugerida = sol?.status === "sugerida";
  // a dupla esp nasce no aceite atômico — dupla na mão = aceite acontecido
  const aceite = dupla != null || efetivo === "aceita";
  const viva =
    dupla != null &&
    (dupla.status === "ativa" || dupla.status === "pausada");
  const fechada = dupla != null && !viva;
  const encontros = dupla?.encontros ?? [];
  const temEncontros = encontros.length > 0;

  // o primeiro nome de uso de quem aceitou: mentor da dupla; sem ela, o
  // engajado/desejado do pedido (o jovem não lê profiles — vem do embed)
  const nomeEsp =
    (
      dupla?.mentor?.nome_social ??
      dupla?.mentor?.nome ??
      sol?.especialista?.nome ??
      sol?.desejado?.nome
    )?.split(/\s+/)[0] ?? null;

  // o carimbo do aceite é respondida_em do pedido; sem ele cai na
  // iniciada_em da dupla (a RPC grava current_date no aceite — o tipo
  // Dupla não expõe created_at)
  const dataAceite = sol?.respondida_em ?? dupla?.iniciada_em ?? null;

  // marco de ~3 meses do guia — o "até" projetado do último passo enquanto
  // a trilha não fecha (null sem início registrado)
  const prazo = prazoTrilhaEspecialista(dupla?.iniciada_em, hoje);

  // "sessão N" = o passo que a próxima tentativa cobriria — passoEsp sobre
  // um hipotético nº novo dá o rank entre realizados direto (o nº gravado é
  // tentativa, não passo — um nao_aconteceu não queima passo)
  const sessaoAtual = passoEsp(
    {
      numero: encontros.reduce((m, e) => Math.max(m, e.numero), 0) + 1,
      status: "agendado",
    },
    encontros
  );

  // mural em jogo enquanto o pedido está vivo e ninguém aceitou — inclui a
  // expirada lazy (ela ainda ocupa o mural até o cancelamento) e a
  // contra_proposta (o aceite é o desfecho que a mesa negocia)
  const muralEmJogo =
    efetivo === "aberta" ||
    efetivo === "aguardando_coord" ||
    efetivo === "contra_proposta" ||
    efetivo === "expirada";

  const emAndamentoAtual = viva && temEncontros;
  const dataAndamento =
    [
      diaMes(dupla?.iniciada_em),
      emAndamentoAtual ? `sessão ${sessaoAtual}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  return [
    {
      rotulo: sugerida ? "Sugestão do mentor" : "Pedido",
      data: diaMes(sol?.created_at),
      // a sugestão espera a resposta do jovem — o nó vivo é ela mesma
      // (sugerida && !aceite: o !aceite blinda o pareamento acidental com
      // uma trilha viva, que deixaria dois nós "atual")
      estado: sugerida && !aceite ? "atual" : sol || dupla ? "feito" : "futuro",
    },
    {
      rotulo: efetivo === "aguardando_coord" ? "Em triagem" : "No mural",
      // a data do passo é a entrada no mural — sugerida ainda não entrou
      data: sugerida ? null : diaMes(sol?.created_at),
      estado: aceite
        ? "feito"
        : !sol || sugerida
          ? "futuro"
          : muralEmJogo
            ? "atual"
            : "feito", // recusada/cancelada: a passagem pelo mural se fechou
    },
    {
      rotulo: aceite
        ? nomeEsp
          ? `${nomeEsp} aceitou`
          : "Especialista aceitou"
        : "Especialista aceita",
      data: aceite ? diaMes(dataAceite) : null,
      estado: !aceite
        ? "futuro"
        : // aceite registrado mas a dupla não chegou na query (view sem a
          // linha ainda) — o nó vivo fica aqui em vez de sumir
          !viva && !fechada
          ? "atual"
          : viva && !temEncontros
            ? "atual" // aceite fresco é o marco vivo até a 1ª sessão existir
            : "feito",
    },
    {
      rotulo: "Em andamento",
      data: dataAndamento,
      estado: fechada ? "feito" : emAndamentoAtual ? "atual" : "futuro",
    },
    {
      // trilha encerrada antes do fim não "concluiu" — rótulo honesto
      rotulo:
        dupla?.status === "encerrada"
          ? "Encerrada"
          : "Concluída + devolutiva",
      data: diaMes(dupla?.encerrada_em ?? prazo?.fim),
      estado: fechada ? "feito" : "futuro",
    },
  ];
}
