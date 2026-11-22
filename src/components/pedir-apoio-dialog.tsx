"use client";

import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";

/** 0084: o "pedir apoio" do mentor virou chamado — o mesmo dialog das outras
 *  portas, com a dupla já fixada como contexto. Mantido o nome do export pra
 *  não espalhar rename pelos pontos que já o usavam. */
export function PedirApoioDialog({
  duplaId,
  trigger,
  open,
  onOpenChange,
}: {
  duplaId: string;
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. `null`
   *  suprime: o host abre de forma controlada (item do ⋯ da ficha). */
  trigger: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <NovoChamadoDialog
      papel="mentor_dpp"
      duplaId={duplaId}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
