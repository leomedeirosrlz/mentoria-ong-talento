/** Régua do registro retroativo (QA 1125b item 25) — pura pra teste e
 *  compartilhada pelas actions. `base` é a data oficial do passo no DPP;
 *  na trilha de especialista é a data da própria sessão/tentativa. */
export function avaliarRetroativo({
  base,
  hoje,
}: {
  base: string | null;
  hoje: string;
}): { bloqueado: string | null; tardio: boolean } {
  if (!base) return { bloqueado: null, tardio: false };
  if (base > hoje) {
    return {
      bloqueado: "Esse encontro ainda não chegou na data oficial do guia.",
      tardio: false,
    };
  }
  const ms = new Date(`${hoje}T00:00:00-03:00`).getTime() -
    new Date(`${base}T00:00:00-03:00`).getTime();
  return { bloqueado: null, tardio: ms > 7 * 24 * 60 * 60 * 1000 };
}

