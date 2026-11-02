import type { Encontro } from "@/lib/types";
import { limboAberto } from "@/lib/agenda-minha";

/** Estado visual de um encontro de dupla no calendário (REALIZA-342) — um
 *  status só, no lugar de "status do encontro" + "status do registro":
 *  - agendado: marcado e ainda por vir
 *  - pendente: já devia ter acontecido e falta o registro (realizado sem
 *    registro OU limbo: agendado vencido sem registro)
 *  - registrado: realizado com o registro do mentor entregue
 *  - nao_aconteceu: não aconteceu/cancelado
 *  O limbo entra como pendente pra cor bater com a contagem dos buckets. */
export type EstadoEncontro = "agendado" | "pendente" | "registrado" | "nao_aconteceu";

export function estadoDoEncontro(e: Encontro, agoraMs: number): EstadoEncontro {
  if (e.status === "realizado") return e.registro ? "registrado" : "pendente";
  if (limboAberto(e, agoraMs)) return "pendente";
  if (e.status === "agendado" || e.status === "remarcado") return "agendado";
  return "nao_aconteceu";
}

export const ROTULO_ESTADO_ENCONTRO: Record<EstadoEncontro, string> = {
  agendado: "agendado",
  pendente: "falta o registro",
  registrado: "registrado",
  nao_aconteceu: "não aconteceu",
};

/** Estado do encontro previsto pra uma semana, visto pelo mentor — agrega
 *  as duplas dele (uma entrada por dupla: o encontro daquele nº ou null se
 *  ainda não existe). A semana já começou e o encontro não foi marcado nem
 *  registrado → pendente (laranja); semana futura sem agendamento → por vir.
 *  Lista vazia (coord/sup, sem dupla) → null: o indicador fica neutro. */
export type EstadoSemana = "pendente" | "por_vir" | "agendado" | "registrado";

export function estadoDaSemana(
  encontrosPorDupla: (Encontro | null)[],
  semanaComecou: boolean,
  agoraMs: number
): EstadoSemana | null {
  if (encontrosPorDupla.length === 0) return null;
  const porDupla = encontrosPorDupla.map((e): EstadoSemana => {
    const estado = e ? estadoDoEncontro(e, agoraMs) : null;
    if (estado === "registrado") return "registrado";
    if (estado === "agendado") return "agendado";
    if (estado === "pendente") return "pendente";
    // sem encontro ou não aconteceu: o nº segue devendo reposição
    return semanaComecou ? "pendente" : "por_vir";
  });
  // o pior estado acionável manda — uma dupla devendo já pinta a semana
  for (const s of ["pendente", "por_vir", "agendado"] as const)
    if (porDupla.includes(s)) return s;
  return "registrado";
}
