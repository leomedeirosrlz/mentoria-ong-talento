"use client";

import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";

/** 0084: o "pedir apoio" do mentor virou chamado — o mesmo dialog das outras
 *  portas, com a dupla já fixada como contexto. Mantido o nome do export pra
 *  não espalhar rename pelos pontos que já o usavam. */
export function PedirApoioDialog({
  duplaId,
  trigger,
}: {
  duplaId: string;
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
}) {
  return (
    <NovoChamadoDialog papel="mentor_dpp" duplaId={duplaId} trigger={trigger} />
  );
}
