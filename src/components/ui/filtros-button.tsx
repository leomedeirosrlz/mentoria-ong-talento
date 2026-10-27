"use client";

import { Funnel } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Gatilho do painel de filtros — a gramática de /registros: funil +
 *  contagem de ativos num disco ink (lime-sobre-lime apagaria o número). */
export function FiltrosButton({
  ativos,
  onClick,
}: {
  ativos: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="default"
      onClick={onClick}
      aria-label={
        ativos > 0
          ? `Filtros, ${ativos} ${ativos === 1 ? "ativo" : "ativos"}`
          : "Filtros"
      }
    >
      <Funnel size={16} aria-hidden />
      Filtros
      {ativos > 0 && (
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full bg-[var(--brand-ink)] text-[11px] font-bold text-white"
        >
          {ativos}
        </span>
      )}
    </Button>
  );
}
