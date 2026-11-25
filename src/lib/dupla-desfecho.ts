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

/** Motivos estruturados por tipo de desfecho — o que o dialog oferece.
 *  A coluna é texto livre (`desfecho_motivo` é `text`, não enum): editar
 *  aqui não exige migration. Lista vazia em `outro` é de propósito — o
 *  motivo ali é texto livre, não opção fechada (o dialog rende input). */
export const DESFECHO_MOTIVOS: Record<DuplaDesfecho, readonly string[]> = {
  concluida: [],
  desistencia_jovem: [
    "Abandono (sumiu, não responde)",
    "Mudança de cidade/escola",
    "Não se adaptou à metodologia",
    "Nunca iniciou",
    "Problemas de saúde",
    "Problemas familiares",
    "Rompimento da relação (conflito/perda de confiança)",
  ],
  desistencia_mentor: [
    "Abandono (sumiu, não responde)",
    "Desalinhamento com a metodologia",
    "Mudança de cidade",
    "Nunca iniciou (não compareceu)",
    "Problemas de saúde",
    "Rompimento da relação (conflito/perda de confiança)",
    "Sobrecarga de trabalho",
  ],
  remanejada: ["Remanejamento de mentor", "Remanejamento de jovem", "Troca de turma"],
  outro: [],
};

/** A dupla conta como "concluída com êxito" (terminou o programa)? */
export function ehConcluida(d: { desfecho?: DuplaDesfecho | null | undefined } | null | undefined): boolean {
  return d?.desfecho === "concluida";
}

/** A dupla conta como "desistente" (o jovem ou o mentor saiu antes do
 *  fim)? Só `desistencia_*` + legado `encerrada` sem desfecho —
 *  remanejada/outro são encerramento formal da coordenação, fatia própria
 *  ("Encerrada"), não desistência. */
export function ehDesistente(d: { desfecho?: DuplaDesfecho | null | undefined; status?: string | null } | null | undefined): boolean {
  if (!d) return false;
  if (d.desfecho === "desistencia_jovem" || d.desfecho === "desistencia_mentor") return true;
  // legado: encerrada sem desfecho = tratamos como desistência (não sucesso)
  return d.desfecho == null && d.status === "encerrada";
}

/** Situação canônica da dupla — o "como ela se chama" derivado de
 *  status + desfecho. Única fonte do conceito: toda tela que mostra a
 *  situação da dupla lê daqui (ou do mapa de rótulos abaixo), nunca de
 *  um mapa local. Semáforo (risco/atenção/em dia) e apoio aberto são
 *  eixos à parte — refinam a situação "andamento", não a substituem. */
export type SituacaoDupla =
  | "andamento"
  | "pausada"
  | "concluida"
  | "desistente"
  | "encerrada";

export const SITUACAO_DUPLA_LABEL: Record<SituacaoDupla, string> = {
  andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  desistente: "Desistente",
  encerrada: "Encerrada",
};

/** status + desfecho → a fatia canônica. Qualquer valor fora dos
 *  conhecidos (ou nulo) cai em "andamento" — o único balde não
 *  terminal, idem ao "desconhecido é ativo" do saudadeDaDupla. */
export function situacaoDaDupla(
  d: { status?: string | null; desfecho?: DuplaDesfecho | null } | null | undefined
): SituacaoDupla {
  if (d?.status === "pausada") return "pausada";
  if (ehConcluida(d) || d?.status === "concluida") return "concluida";
  if (ehDesistente(d)) return "desistente";
  // desfecho preenchido sempre termina a dupla — remanejada/outro aqui
  // (concluida e desistencia_* já saíram acima)
  if (d?.status === "encerrada" || d?.desfecho != null) return "encerrada";
  return "andamento";
}

/** Deriva o desfecho a partir do status antigo — usado por linhas legadas
 *  e por filtros que ainda não sabem do desfecho. */
export function desfechoLegacy(status: string | null | undefined): DuplaDesfecho | null {
  if (status === "concluida") return "concluida";
  if (status === "encerrada") return "outro";
  return null;
}

/** Desfecho exige motivo quando não é "concluída" — select quando há
 *  vocabulário, texto livre quando não há ('outro'). A observação é
 *  sempre opcional: 'outro' já exigia ela no lugar do motivo, o que
 *  colava o motivo no campo errado (desfecho_obs) e deixava
 *  desfecho_motivo vazio. */
export function desfechoValido(d: { desfecho: DuplaDesfecho | null; motivo?: string | null; obs?: string | null }): string | null {
  if (!d.desfecho) return "Escolha o desfecho da dupla.";
  if (d.desfecho !== "concluida" && !(d.motivo ?? "").trim()) {
    return "Informe o motivo.";
  }
  return null;
}
