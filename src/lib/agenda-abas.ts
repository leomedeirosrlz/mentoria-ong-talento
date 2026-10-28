import type { AppRole } from "@/lib/types";

/** Modos que a agenda pode mostrar — um id por destino, nunca por papel:
 *  "Calendário" é o mesmo destino pra coordenação, supervisor e mentor. */
export type AbaAgendaId =
  | "monitoramento"
  | "turma"
  | "consolidada"
  | "minha"
  | "por-mentorado"
  | "calendario"
  | "especialista";

export type AbaAgendaItem = {
  id: AbaAgendaId;
  rotulo: string;
  href: string;
};

/** O painel que TODA aba controla (aria-controls). Uma aba por página ⇒ um
 *  painel só: ele é o conteúdo da aba ativa, e troca junto com ela. */
export const PAINEL_AGENDA = "painel-agenda";

/** Id do link-tab. O painel aponta de volta pra ele em aria-labelledby. */
export const idDaAba = (id: AbaAgendaId) => `aba-agenda-${id}`;

const ROTULO: Record<AbaAgendaId, string> = {
  monitoramento: "Monitoramento",
  turma: "Por turma",
  consolidada: "Consolidada",
  minha: "Minha agenda",
  "por-mentorado": "Por mentorado",
  calendario: "Calendário",
  especialista: "Especialista",
};

/** A barra de modos da agenda, montada por inteiro — uma lista, um tablist.
 *
 *  A ordem é a da aterrissagem: a superfície do papel primário primeiro, a
 *  visão de especialista por último. `mentor` = a pessoa tem os modos do
 *  mentor DPP (Minha agenda / Por mentorado / Calendário) e `especialista` =
 *  a visão própria de especialista existe (híbrido com trilha). Com uma aba
 *  só a barra não renderiza — o componente devolve null.
 *
 *  Os links do lado DPP carregam o `?visao=dpp` explícito quando o default da
 *  página cai na outra superfície: staff+mentor (o ramo do mentor exige o
 *  param) e híbrido de primário especialista (a aterrissagem é a visão esp).
 *  O Calendário do staff sai sem o param — ele é o calendário de equipe. */
export function abasDaAgenda({
  papel,
  mentor,
  especialista,
}: {
  /** Papel primário — decide a superfície de aterrissagem (staff × mentor). */
  papel: AppRole | null;
  /** Os modos do mentor DPP existem pra esta pessoa. */
  mentor: boolean;
  /** A visão própria de especialista existe (híbrido com trilha). */
  especialista: boolean;
}): AbaAgendaItem[] {
  const staff = papel === "coordenacao" || papel === "supervisor";
  // só o híbrido de primário especialista precisa do param no Calendário:
  // sem ele a página recai na visão esp e o calendário fica inalcançável
  const dppNoCalendario = papel === "mentor_especialista" && especialista;
  const dppNosModos = staff || dppNoCalendario;
  const hrefDpp = (aba: string, calendario = false) =>
    (calendario ? dppNoCalendario : dppNosModos)
      ? `/agenda?visao=dpp&aba=${aba}`
      : `/agenda?aba=${aba}`;

  const itens: AbaAgendaItem[] = [];

  if (papel === "coordenacao") {
    itens.push({ id: "monitoramento", href: "/agenda", rotulo: ROTULO.monitoramento });
  }
  if (papel === "supervisor") {
    itens.push({ id: "turma", href: "/agenda", rotulo: ROTULO.turma });
    itens.push({
      id: "consolidada",
      href: "/agenda?aba=consolidada",
      rotulo: ROTULO.consolidada,
    });
  }

  if (mentor) {
    itens.push(
      { id: "minha", href: hrefDpp("minha"), rotulo: ROTULO.minha },
      {
        id: "por-mentorado",
        href: hrefDpp("por-mentorado"),
        rotulo: ROTULO["por-mentorado"],
      },
      {
        id: "calendario",
        href: hrefDpp("calendario", true),
        rotulo: ROTULO.calendario,
      }
    );
  } else if (papel === "coordenacao") {
    // a coordenação sem papel de mentor segue com o calendário oficial, sem
    // os modos do mentor no meio
    itens.push({
      id: "calendario",
      href: "/agenda?aba=calendario",
      rotulo: ROTULO.calendario,
    });
  }

  if (especialista) {
    itens.push({
      id: "especialista",
      href: "/agenda?visao=especialista",
      rotulo: ROTULO.especialista,
    });
  }

  return itens;
}
