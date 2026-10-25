"use client";

import { BookOpenText } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/** "Como conduzir" / "O que cobre" dos cards da semana. O texto do guia tem
 *  um parágrafo inteiro: expandido dentro de um card de 236px virava uma
 *  coluna estreita e alta. No popover ele lê numa medida confortável e o
 *  card não muda de tamanho. */
export function GuiaPopover({
  rotulo,
  texto,
  titulo,
}: {
  rotulo: string;
  texto: string;
  /** o encontro/evento do card, pro título do popover */
  titulo: string;
}) {
  return (
    <Popover>
      <PopoverTrigger className="-mx-1.5 flex min-h-11 w-[calc(100%+0.75rem)] items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8">
        <BookOpenText aria-hidden size={14} className="shrink-0" />
        <span className="shrink-0">{rotulo}</span>
        <span className="min-w-0 flex-1 truncate font-normal">
          {texto.slice(0, 42).trimEnd()}…
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] p-4"
      >
        <PopoverTitle className="text-sm font-semibold">{rotulo}</PopoverTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">{titulo}</p>
        <p className="mt-3 text-sm leading-relaxed">{texto}</p>
      </PopoverContent>
    </Popover>
  );
}
