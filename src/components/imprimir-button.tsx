"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Imprime a ficha — no print, o CSS isola o bloco .resumo-jornada, então o
 *  que sai no papel é o relatório, não a tela. */
export function ImprimirButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-my-1 text-muted-foreground print:hidden"
      onClick={() => window.print()}
    >
      <Printer size={14} />
      Imprimir
    </Button>
  );
}
