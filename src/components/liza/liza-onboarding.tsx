"use client";

import { LizaBlob } from "@/components/liza/liza-blob";

/** Liza dos onboardings — staff (coordenação, supervisão, mentor DPP,
 *  especialista, híbrido) e jovem compartilham esta instância. O slot é 48px
 *  no mobile e 64px a partir de sm; a pose neutra/atenta é a mesma nos dois
 *  fluxos. Mudou aqui, mudou em todos. */
export function LizaOnboarding({ ultimo }: { ultimo: boolean }) {
  return (
    <LizaBlob
      responsivo
      estado={ultimo ? "pronto" : "atento"}
      tamanho={48}
      className="mb-1 size-12 shrink-0 sm:size-16"
    />
  );
}
