import type { AppRole } from "./types";

/** Vínculo mínimo de uma dupla que a troca de papel pode quebrar — as
 *  policies de escrita amarram `mentor_id`/`supervisor_id`, não o papel. */
export type VinculoDupla = {
  mentor_id: string | null;
  supervisor_id: string | null;
};

/** O que a troca de papel quebraria — `null` = pode trocar. */
export type BloqueioTrocaPapel = "mentor" | "auxiliar" | null;

/** Papéis do RoleSelect que ainda conduzem a dupla como mentor. */
const CONDUZ_COMO_MENTOR = ["mentor_dpp", "mentor_especialista", "mentor_hibrido"];

/** Papéis que enxergam/atendem a dupla pelo lado do acompanhamento. A
 *  coordenação entra porque vê tudo (RLS por papel), então trocar
 *  coordenação → auxiliar de quem já acompanha as mesmas duplas não perde
 *  acesso nenhum — era o falso bloqueio da troca da Adriana. */
const CONDUZ_COMO_AUXILIAR = ["supervisor", "coordenacao"];

/** Trocar o papel de quem sustenta uma dupla ativa/pausada só é bloqueio
 *  quando o papel NOVO deixa a dupla sem quem a conduza. Redeclarar o mesmo
 *  lado (auxiliar → auxiliar, coordenação → auxiliar que segue com as
 *  duplas) passa; virar o lado que não sustenta o vínculo trava. */
export function bloqueioTrocaPapel(
  profileId: string,
  novoPapel: AppRole | "mentor_hibrido" | null,
  vinculos: readonly VinculoDupla[]
): BloqueioTrocaPapel {
  const comoMentor = vinculos.some((v) => v.mentor_id === profileId);
  const comoAuxiliar = vinculos.some((v) => v.supervisor_id === profileId);

  if (comoMentor && !(novoPapel && CONDUZ_COMO_MENTOR.includes(novoPapel))) {
    return "mentor";
  }
  if (comoAuxiliar && !(novoPapel && CONDUZ_COMO_AUXILIAR.includes(novoPapel))) {
    return "auxiliar";
  }
  return null;
}
