/** Desfecho de uma dupla quando ela sai da ativa/pausada — o que o filtro
 *  e o semáforo usam pra separar "concluída com êxito" de "desistiu no
 *  meio". `null` = dupla ainda em curso (ativa/pausada). */
export type DuplaDesfecho =
  | "concluida"
  | "desistencia_jovem"
  | "desistencia_mentor"
  | "remanejada"
  | "outro";

export const DESFECHOS: readonly DuplaDesfecho[] = [
  "concluida",
  "desistencia_jovem",
  "desistencia_mentor",
  "remanejada",
  "outro",
];

export const DESFECHO_LABEL: Record<DuplaDesfecho, string> = {
  concluida: "Concluída com êxito",
  desistencia_jovem: "Desistência do jovem",
  desistencia_mentor: "Desistência do mentor",
  remanejada: "Remanejada",
  outro: "Outro motivo",
};

/** Motivos estruturados por tipo de desfecho — o que o dialog oferece. */
export const DESFECHO_MOTIVOS: Record<DuplaDesfecho, readonly string[]> = {
  concluida: [],
  desistencia_jovem: [
    "Abandono (sumiu, não responde)",
    "Mudança de cidade/escola",
    "Não se adaptou à metodologia",
    "Problemas de saúde",
    "Problemas familiares",
  ],
  desistencia_mentor: [
    "Sobrecarga de trabalho",
    "Mudança de cidade",
    "Problemas de saúde",
    "Desalinhamento com a metodologia",
  ],
  remanejada: ["Remanejamento de mentor", "Remanejamento de jovem", "Troca de turma"],
  outro: [],
};

/** A dupla conta como "concluída com êxito" (terminou o programa)? */
export function ehConcluida(d: { desfecho?: DuplaDesfecho | null | undefined } | null | undefined): boolean {
  return d?.desfecho === "concluida";
}

/** A dupla conta como "desistente" (interrompeu no meio)? */
export function ehDesistente(d: { desfecho?: DuplaDesfecho | null | undefined; status?: string | null } | null | undefined): boolean {
  if (!d) return false;
  if (d.desfecho && d.desfecho !== "concluida") return true;
  // legado: encerrada sem desfecho = tratamos como desistência (não sucesso)
  return d.desfecho == null && d.status === "encerrada";
}

/** Deriva o desfecho a partir do status antigo — usado por linhas legadas
 *  e por filtros que ainda não sabem do desfecho. */
export function desfechoLegacy(status: string | null | undefined): DuplaDesfecho | null {
  if (status === "concluida") return "concluida";
  if (status === "encerrada") return "outro";
  return null;
}

/** Desfecho exige motivo quando não é "concluída" (e "outro" exige obs). */
export function desfechoValido(d: { desfecho: DuplaDesfecho | null; motivo?: string | null; obs?: string | null }): string | null {
  if (!d.desfecho) return "Escolha o desfecho da dupla.";
  if (d.desfecho !== "concluida" && !(d.motivo ?? "").trim()) {
    return "Informe o motivo.";
  }
  if (d.desfecho === "outro" && !(d.obs ?? "").trim()) {
    return "Descreva o motivo em 'Outro'.";
  }
  return null;
}
