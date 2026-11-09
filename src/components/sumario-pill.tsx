"use client";

import { CaretDown, ListBullets } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sumário do documento como pill sticky no mobile: botão + painel
 *  flutuante absoluto (não empurra o texto ao abrir). Fecha em clique
 *  fora, Esc e clique em link do sumário. A animação é grid-rows
 *  0fr→1fr + opacity — o <details> nativo esconde o conteúdo na hora
 *  e não deixa animar o fechamento. O children (SumarioLista) chega
 *  já renderizado do server component pai. */
export function SumarioPill({
  total,
  children,
}: {
  total: number;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div
      ref={ref}
      className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-30 mt-6 md:top-3 xl:hidden print:hidden"
    >
      <Button
        variant="outline"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="w-full justify-start gap-2.5 rounded-full bg-card/95 px-4 text-sm font-medium shadow-[var(--shadow-border)] backdrop-blur active:scale-100"
      >
        <ListBullets
          size={16}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
        Neste documento
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {total} seções
        </span>
        <CaretDown
          size={14}
          className={cn(
            "ml-auto shrink-0 text-muted-foreground transition-transform duration-200",
            aberto && "rotate-180"
          )}
          aria-hidden
        />
      </Button>

      <div
        className={cn(
          "absolute inset-x-0 top-full mt-1.5 grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
          aberto
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden rounded-2xl bg-card/95 shadow-[var(--shadow-border)] backdrop-blur">
          <nav
            aria-label="Sumário do documento"
            className="scroll-fina max-h-[60dvh] overflow-y-auto px-3 py-3"
            // clique em qualquer link navega e fecha o painel
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setAberto(false);
            }}
          >
            {children}
          </nav>
        </div>
      </div>
    </div>
  );
}
