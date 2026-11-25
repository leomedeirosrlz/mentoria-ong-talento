// Third-party evaluation ruler (REALIZA-387): free mix up to 9 total.
// The guide's 3+3+3 is now a composition suggestion shown in copy —
// vínculo stays an informational label, and nothing in app or DB
// enforces a minimum count or a per-vínculo mix (migration 0195
// dropped the raise; only the total-of-9 cap remains).

export const TERCEIROS_MAX = 9;
export const TERCEIROS_PISO_SUGERIDO = 3;

/** Remaining invitation slots against the total cap. */
export function vagasTerceiros(indicados: number): number {
  return Math.max(0, TERCEIROS_MAX - indicados);
}

/** Panel intro: what the instrument is and how the new ruler reads. */
export const RESUMO_TERCEIROS =
  `Guia semana 1→2: o jovem indica pelo menos ${TERCEIROS_PISO_SUGERIDO} ` +
  `pessoas que o conhecem bem, até ${TERCEIROS_MAX} no total; o guia ` +
  `sugere misturar amigos, familiares e colegas. Cada uma responde 2 ` +
  `perguntas por link próprio. Você lê identificado e consolida ` +
  `anônimo. O jovem só vê a síntese publicada.`;

/** New-contact dialog description: suggested floor + free mix + cap. */
export function descricaoIndicacao(vagas: number): string {
  return (
    `Indique pelo menos ${TERCEIROS_PISO_SUGERIDO} pessoas que conhecem ` +
    `o jovem bem, até ${TERCEIROS_MAX} no total (restam ${vagas}). ` +
    `O guia sugere misturar amigos, familiares e colegas. ` +
    `Cada uma recebe um link próprio, sem login.`
  );
}
