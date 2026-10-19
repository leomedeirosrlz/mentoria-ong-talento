import { diffDias, toDateStr, TRILHA_LEN } from "./ciclo";
import { prazoTrilhaEspecialista } from "./encerramento";
import { efetivoDe } from "./jovem-especialista";
import type { Dupla, Encontro, SolicitacaoEspecialista } from "./types";

/** Painel read-only da coordenação sobre trilhas de especialista (WP6 item
 *  8): KPIs, lista de trilhas e alertas de pedido parado no mural. A ação
 *  de exceção (encerramento antecipado) mora na ficha da dupla — o painel
 *  só observa e linka. */

export type TrilhaCoordRow = {
  duplaId: string;
  jovemNome: string;
  espNome: string;
  /** sessões com registro/estado realizado na trilha */
  sessoesFeitas: number;
  /** sessões que o calendário já esperava até hoje (0–5) */
  sessoesEsperadas: number;
  /** ISO da próxima sessão agendada, ou null */
  proximaSessao: string | null;
  /** ISO do prazo (aceite + ~3 meses), ou null */
  prazo: string | null;
  status: "ativa" | "pausada" | "concluida" | "encerrada";
};

export type AlertaPedido = {
  solicitacaoId: string;
  jovemNome: string;
  turma: string | null;
  demanda: string;
  diasParado: number;
  /** nome do especialista preferido no pedido, se dirigido */
  preferenciaNome: string | null;
  /** onde o pedido está parado — dita o rótulo ("no mural" / "em triagem"
   *  / "horário expirado") */
  onde: "mural" | "triagem" | "expirada";
};

export type PainelTrilhas = {
  kpis: {
    trilhasAtivas: number;
    pedidosParados: number;
    concluidas: number;
    sessoesFeitas: number;
  };
  trilhas: TrilhaCoordRow[];
  alertas: AlertaPedido[];
};

/** A sessão que a dupla combinou e cuja hora já passou sem desfecho —
 *  "já deveria ter acontecido". A trilha esp não tem calendário oficial:
 *  a régua honesta é o próprio agendamento dela (nao_aconteceu/cancelado
 *  já tiveram desfecho, não entram). */
function sessaoVencida(e: Encontro, agoraMs: number): boolean {
  return (
    (e.status === "agendado" || e.status === "remarcado") &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agoraMs
  );
}

export function painelTrilhasCoord({
  duplas,
  solicitacoes,
  hoje = new Date(),
  limiteDiasAlerta = 5,
}: {
  duplas: Dupla[];
  solicitacoes: SolicitacaoEspecialista[];
  hoje?: Date;
  limiteDiasAlerta?: number;
}): PainelTrilhas {
  const agoraMs = hoje.getTime();
  const hojeStr = toDateStr(hoje);

  const esp = duplas.filter((d) => d.trilha === "especialista");

  const trilhas = esp
    .map((d): TrilhaCoordRow => {
      const feitas = d.encontros.filter(
        (e) => e.status === "realizado"
      ).length;
      // a próxima sessão marcada — remarcado vale junto (tem data nova)
      const proxima = d.encontros
        .filter(
          (e) =>
            (e.status === "agendado" || e.status === "remarcado") &&
            e.data_hora != null &&
            new Date(e.data_hora).getTime() > agoraMs
        )
        .sort(
          (a, b) =>
            new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime()
        )[0];
      return {
        duplaId: d.id,
        jovemNome: d.mentorado?.nome_social || d.mentorado?.nome || "Jovem",
        espNome: d.mentor?.nome_social || d.mentor?.nome || "Especialista",
        sessoesFeitas: feitas,
        // o que já deveria ter rolado = feitas + marcadas vencidas —
        // teto é o budget da trilha
        sessoesEsperadas: Math.min(
          feitas + d.encontros.filter((e) => sessaoVencida(e, agoraMs)).length,
          TRILHA_LEN.especialista
        ),
        proximaSessao: proxima?.data_hora ?? null,
        prazo: prazoTrilhaEspecialista(d.iniciada_em, hoje)?.fim ?? null,
        status: d.status,
      };
    })
    // prazo mais apertado primeiro; quem nunca iniciou não tem marco e vai
    // pro fim — não se cobra data que não existe
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  const alertas = solicitacoes
    .map((s): AlertaPedido | null => {
      const e = efetivoDe(s);
      // parada = esperando aceite/triagem além do limite, OU expirada lazy
      // (slot vencido: não aceita mais nada, segura dedup e teto até alguém
      // cancelar — é o pedido mais parado de todos). sugerida nem entrou
      // no mural (espera o jovem confirmar) e contra_proposta é negociação
      // viva — nenhuma das duas é pedido esquecido
      if (e !== "aberta" && e !== "aguardando_coord" && e !== "expirada")
        return null;
      // dias de calendário no fuso do programa, não fração de 24h
      const dias = diffDias(hojeStr, toDateStr(new Date(s.created_at)));
      if (dias < limiteDiasAlerta) return null;
      return {
        solicitacaoId: s.id,
        // a view achata mentorado_nome → mentorado.nome (o embed de
        // profiles não resolve pra todo leitor)
        jovemNome: s.mentorado?.nome ?? "Jovem",
        turma: s.turma,
        demanda: s.demanda ?? s.motivo ?? "",
        diasParado: dias,
        // a preferência é o desejado; sem o embed (RLS), honesto é null
        preferenciaNome: s.desejado?.nome ?? null,
        onde:
          e === "expirada"
            ? "expirada"
            : e === "aguardando_coord"
              ? "triagem"
              : "mural",
      };
    })
    .filter((a): a is AlertaPedido => a != null)
    .sort((a, b) => b.diasParado - a.diasParado);

  return {
    kpis: {
      trilhasAtivas: esp.filter(
        (d) => d.status === "ativa" || d.status === "pausada"
      ).length,
      pedidosParados: alertas.length,
      concluidas: esp.filter(
        (d) => d.status === "concluida" || d.status === "encerrada"
      ).length,
      sessoesFeitas: trilhas.reduce((acc, t) => acc + t.sessoesFeitas, 0),
    },
    trilhas,
    alertas,
  };
}
