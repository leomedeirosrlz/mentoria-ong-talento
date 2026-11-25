"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Legenda de fieldset do modal de filtros (mesma régua do "Turma"/grupo
 *  de chips das barras). */
export const OVERLINE =
  "text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]";

/** Opção compacta (grade de encontros / avaliações) — radio nativo sr-only
 *  mantém setas do teclado e leitura de tela de graça. */
export function OpcaoPilula({
  nome,
  valor,
  atual,
  onSelect,
  children,
  className,
}: {
  nome: string;
  valor: string;
  atual: string;
  onSelect: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm transition-colors sm:min-h-9",
        "hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:font-medium has-checked:text-background",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
        className
      )}
    >
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={atual === valor}
        onChange={() => onSelect(valor)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/** Checkbox do fieldset Sinal — mesmo truque do radio: input sr-only dentro
 *  do label, estilo via has-checked. */
export function OpcaoCheck({
  marcado,
  onChange,
  children,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors sm:min-h-10",
        "hover:bg-muted has-checked:bg-muted",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring"
      )}
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
          marcado
            ? "border-foreground bg-foreground text-background"
            : "border-input bg-card"
        )}
      >
        <Check
          size={11}
          weight="bold"
          className={marcado ? "opacity-100" : "opacity-0"}
        />
      </span>
      <span className="flex-1">{children}</span>
    </label>
  );
}
