"use client";

import { cn } from "@/lib/utils";

/** Célula da trilha de cobertura — âncora numerada pro <details> do
 *  encontro. O clique abre o details junto do salto: sem isso a âncora
 *  cai numa linha colapsada e o "o que falta" que a célula sinaliza
 *  continua escondido (detalhe é o estado do material, não o summary). */
export function CelulaCobertura({
  n,
  estado,
  rotulo,
}: {
  n: number;
  estado: "vazio" | "parcial" | "coberto";
  rotulo: string;
}) {
  return (
    <a
      href={`#mat-encontro-${n}`}
      title={rotulo}
      aria-label={rotulo}
      onClick={() => {
        const alvo = document.getElementById(`mat-encontro-${n}`);
        alvo?.setAttribute("open", "");
        // o encontro mora dentro do grupo "Por encontro" (REALIZA-184) —
        // fechado por padrão no mobile; sem abrir o pai o salto da âncora
        // cai numa linha que continua escondida
        alvo?.parentElement?.closest("details")?.setAttribute("open", "");
      }}
      className={cn(
        "grid size-11 sm:size-9 place-items-center rounded-md text-xs font-semibold tabular-nums transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        estado === "coberto" && "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
        estado === "parcial" &&
          "border border-[var(--warn)]/50 bg-[var(--warn)]/15 text-[var(--warn-text)]",
        estado === "vazio" &&
          "border border-dashed border-input text-muted-foreground/70 hover:border-muted-foreground/40 hover:text-muted-foreground"
      )}
    >
      {n}
    </a>
  );
}
