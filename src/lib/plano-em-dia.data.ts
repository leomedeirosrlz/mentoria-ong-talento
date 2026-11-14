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
  /** Informational load — light steps combine naturally as the second slot
   *  of a double week; dense ones deserve their own day. */
  densidade: "leve" | "media" | "densa";
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
  1: { exige: "tarefa", marco: true, densidade: "media" },
  2: {
    exige: "tarefa",
    densidade: "media",
    precondicao: "Visão/Declaração consolidada e avaliação de terceiros respondida",
  },
  3: {
    exige: "tarefa",
    densidade: "media",
    precondicao: "Metas definidas pelo jovem por conta própria",
  },
  4: { exige: "pratica", densidade: "media" },
  5: { exige: "pratica", densidade: "media" },
  6: { exige: "pratica", densidade: "media" },
  7: { exige: "pratica", densidade: "media" },
  8: { exige: "pratica", densidade: "media" },
  9: { marco: true, densidade: "media" },
  10: { densidade: "leve" },
  11: { exige: "tarefa", densidade: "leve" },
  12: {
    exige: "tarefa",
    densidade: "media",
    precondicao: "Roda da Vida respondida pelo jovem",
  },
  13: { exige: "tarefa", densidade: "media" },
  14: { densidade: "leve" },
  15: { densidade: "media" },
  16: {
    marco: true,
    densidade: "densa",
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
