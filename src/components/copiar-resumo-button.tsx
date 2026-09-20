"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const EASE = "ease-[cubic-bezier(0.2,0,0,1)]";

/** Copia o resumo da semana (texto montado no server) pra área de transferência. */
export function CopiarResumoButton({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar} className={className}>
      <span aria-hidden="true" className="relative inline-flex size-3.5 items-center justify-center">
        <Copy
          className={cn(
            `transition-all duration-150 ${EASE}`,
            copiado && "scale-25 opacity-0 blur-[4px]"
          )}
        />
        <Check
          weight="bold"
          className={cn(
            `absolute text-(--ok) transition-all duration-150 ${EASE}`,
            copiado ? "scale-100 opacity-100 blur-[0px]" : "scale-25 opacity-0 blur-[4px]"
          )}
        />
      </span>
      <span className="grid">
        <span
          aria-hidden={copiado}
          className={cn(
            `col-start-1 row-start-1 transition-opacity duration-150 ${EASE}`,
            copiado && "opacity-0"
          )}
        >
          Copiar resumo
        </span>
        <span
          aria-hidden={!copiado}
          className={cn(
            `col-start-1 row-start-1 transition-opacity duration-150 ${EASE}`,
            copiado ? "opacity-100" : "opacity-0"
          )}
        >
          Copiado
        </span>
      </span>
    </Button>
  );
}
