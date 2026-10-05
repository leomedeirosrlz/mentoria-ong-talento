"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = "ease-[cubic-bezier(0.2,0,0,1)]";

/** Copia o link da chamada pra quem monitora (coord/sup) — o "entrar" é da
 *  dupla. Feedback: LinkSimple → Check verde por ~1,6s (mesmo padrão do
 *  CopiarResumoButton); falha → toast (clipboard pode estar indisponível
 *  fora de contexto seguro). `icone` = ghost size-8 pra slot de linha (a
 *  gramática do WhatsAppRapido icone); senão, outline sm com label. */
export function CopiarChamada({
  url,
  icone = false,
}: {
  url: string;
  /** Só o glifo — pra fileiras apertadas onde o nome da dupla precisa de espaço. */
  icone?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não consegui copiar o link da chamada.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("Não consegui copiar o link da chamada.");
    }
  }

  if (icone) {
    return (
      <button
        type="button"
        onClick={copiar}
        aria-label={copiado ? "Copiado" : "Copiar link da chamada"}
        title="Copiar link da chamada"
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copiado ? (
          <Check size={16} weight="bold" className="text-[var(--ok)]" aria-hidden />
        ) : (
          <LinkSimple size={16} aria-hidden />
        )}
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar}>
      <span
        aria-hidden="true"
        className="relative inline-flex size-3.5 items-center justify-center"
      >
        <LinkSimple
          className={cn(
            `transition-all duration-150 ${EASE}`,
            copiado && "scale-25 opacity-0 blur-[4px]"
          )}
        />
        <Check
          weight="bold"
          className={cn(
            `absolute text-[var(--ok)] transition-all duration-150 ${EASE}`,
            copiado
              ? "scale-100 opacity-100 blur-[0px]"
              : "scale-25 opacity-0 blur-[4px]"
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
          Copiar link da chamada
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
