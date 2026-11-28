/** Recovery-plan pacing metadata for the DPP guide steps, curated from the
 *  weekly guides (docs/rag/roteiro-encontro-*.md). Titles, phases and dates
 *  are NOT here — those come from `ciclo_eventos` via `passosDaTrilha`, the
 *  official guide being the source of truth. This file only annotates what
 *  the program demands BETWEEN encounters: elapsed practice time, concrete
 *  tasks the next session consumes, milestones and external prerequisites. */

export type MetaPassoPlano = {
  /** Interval the NEXT encounter needs after this one:
   *  - "pratica" (4–8): the following session debriefs real-world practice
   *    and the obstacles of the week — elapsed time IS the content (~7d)
   *  - "tarefa" (1,2,3,11,12,13): the following session consumes a concrete
   *    task/instrument assigned here — a couple days suffices (~2d)
   *  - undefined: only the 2-day double-week floor applies */
  exige?: "pratica" | "tarefa";
  /** Hard milestone of the journey — 1 kick-off, 9 half-way review, 16 close. */
  marco?: boolean;
  /** Work/instrument that must exist BEFORE this encounter — external
   *  action (youth answering a link, coordination issuing a form, third
   *  parties responding), never schedulable by the pair itself. Surfaced
   *  on the step as a visible prerequisite, not a silent block. */
  precondicao?: string;
};

/** Keyed by encounter number — a step absent here has no rule beyond the
 *  double-week floor. Guard every read with `total === 16`-style checks in
 *  the caller: the planner may serve other track lengths. */
export const META_PASSOS_PLANO: Record<number, MetaPassoPlano> = {
  1: { exige: "tarefa", marco: true },
  2: {
    exige: "tarefa",
    precondicao: "Visão/Declaração consolidada e avaliação de terceiros respondida",
  },
  3: {
    exige: "tarefa",
    precondicao: "Metas definidas pelo jovem por conta própria",
  },
  4: { exige: "pratica" },
  5: { exige: "pratica" },
  6: { exige: "pratica" },
  7: { exige: "pratica" },
  8: { exige: "pratica" },
  9: { marco: true },
  11: { exige: "tarefa" },
  12: {
    exige: "tarefa",
    precondicao: "Roda da Vida respondida pelo jovem",
  },
  13: { exige: "tarefa" },
  16: {
    marco: true,
    precondicao: "Avaliação 360º emitida pela coordenação",
  },
};

/** Minimum days after a step before the next one may be scheduled — the
 *  value `exige` resolves to. "tarefa" matches the ≥2-day spacing rule of a
 *  double week; "pratica" keeps the practice interval that the official
 *  calendar itself encodes between the 4–8 block. */
export const GAP_DIAS_EXIGE: Record<
  NonNullable<MetaPassoPlano["exige"]>,
  number
> = {
  pratica: 7,
  tarefa: 2,
};

/** Floor between any two encounters of the same pair — the "terça + quinta"
 *  spacing the official double weeks use. */
export const GAP_MINIMO_DIAS = 2;

/** Folga entre o 8º e o 9º: o calendário oficial da Turma 1 deixa duas
 *  semanas (8º 27/10 → 9º 10/11) para a prática das submetas antes da
 *  revisão de meio de percurso. A recuperação desce em degraus quando o
 *  calendário não fecha: oficial → 7 dias → piso da semana dupla. */
export const GAP_89_OFICIAL = 14;
export const GAP_89_DEGRAUS = [GAP_89_OFICIAL, 7, GAP_MINIMO_DIAS] as const;

/** Ritmos que o plano sonda pra NOMEAR o nível de flexibilização, do mais
 *  leve ao mais pesado (encontros por semana): o de sempre, a semana dupla,
 *  a semana tripla e, no topo, 1 por dia. É a escada de nomeação, não o
 *  conjunto permitido — a 518 torna o ritmo escolha livre da dupla e a
 *  alternativa honesta procura o primeiro inteiro acima que fecha. */
export const RITMOS_PLANO = [1, 2, 3, 7] as const;

/** "1 encontro por dia" = até 7 na semana (REALIZA-513). Acima de 7 o
 *  teto semanal deixa de limitar: uma semana só tem 7 dias e o piso de
 *  1 dia já impede dois encontros na mesma data — por isso 7 é também o
 *  teto da sondagem de alternativa (r>7 nunca desloca uma data que r=7
 *  não deslocaria). */
export const RITMO_UM_POR_DIA = 7;

/** Piso entre dois encontros no ritmo de 1 por dia: dias seguidos. Só cai o
 *  piso genérico da semana dupla; prática (7d) e tarefa (2d) seguem valendo,
 *  porque são conteúdo do guia, não cadência. */
export const GAP_UM_POR_DIA = 1;

/** Duração padrão da sessão combinada (018): 2h cobrindo os passos do
 *  grupo. A marca do escopo já nasce com ela; o catálogo da agenda
 *  (30–120) segue valendo pra quando a dupla ajustar na aplicação. */
export const DURACAO_SESSAO_MIN = 120;
