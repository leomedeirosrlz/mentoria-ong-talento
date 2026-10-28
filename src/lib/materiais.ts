import type { AppRole } from "./types";
import { temPapel } from "./types";

/** Audiências possíveis de um material — uma por papel, na ordem do select.
 *  `todos` continua sendo o "para todo mundo" (inclui o jovem); os demais
 *  são cumulativos: um material pode valer pra coordenação E auxiliares. */
export const AUDIENCIAS = [
  "todos",
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
] as const;

export type Audiencia = (typeof AUDIENCIAS)[number];

export const AUDIENCIA_LABEL: Record<Audiencia, string> = {
  todos: "Todos",
  coordenacao: "Coordenação",
  supervisor: "Auxiliar executivo",
  mentor_dpp: "Mentor DPP",
  mentor_especialista: "Mentor especialista",
  mentorado: "Mentorando(a)",
};

/** Público-alvo de um material. A coluna nova (`audiencias`) é a verdade;
 *  `audiencia` é o legado de valor único — normalizado aqui pra que demo,
 *  fixtures e rows antigas continuem lendo. */
export function audienciasDe(m: {
  audiencias?: readonly string[] | null;
  audiencia?: string | null;
}): Audiencia[] {
  const lista = (m.audiencias ?? []).filter((a): a is Audiencia =>
    (AUDIENCIAS as readonly string[]).includes(a)
  );
  if (lista.length) return lista;
  switch (m.audiencia) {
    case "dpp":
      return ["mentor_dpp"];
    case "especialista":
      return ["mentor_especialista"];
    case "coordenacao":
      return ["coordenacao"];
    default:
      return ["todos"];
  }
}

/** O material aparece pra esta pessoa? Coordenação vê tudo (a policy também
 *  libera); os demais veem `todos` ou o próprio papel (primário ou
 *  secundário — híbrido incluso). */
export function veMaterial(
  audiencias: readonly string[],
  pessoa: { role: AppRole | null; papeis?: AppRole[] | null } | null | undefined
): boolean {
  if (!pessoa?.role) return false;
  if (audiencias.includes("todos")) return true;
  if (temPapel(pessoa, "coordenacao")) return true;
  return audiencias.some((a) => temPapel(pessoa, a as AppRole));
}

/** Valor legado (`audiencia` de uma coluna) derivado do array — o código
 *  antigo que ainda estiver rodando durante o deploy continua funcionando. */
export function audienciaLegada(audiencias: readonly string[]): string {
  if (audiencias.includes("todos")) return "todos";
  if (audiencias.includes("mentor_dpp")) return "dpp";
  if (audiencias.includes("mentor_especialista")) return "especialista";
  return "coordenacao";
}
