"use client";

import { useFormStatus } from "react-dom";
import { CircleNotch } from "@phosphor-icons/react";

/** Botão submit dos cards da /demo — dentro do <form> pai o useFormStatus dá
 *  o pending só daquele card (dev compila a rota alvo sob demanda e sem
 *  spinner o clique parece morto). Ícone e textos vêm renderizados do server. */
export function DemoEnterButton({
  icon,
  titulo,
  persona,
  descricao,
}: {
  icon: React.ReactNode;
  titulo: string;
  persona: string;
  descricao: string;
}) {
  const { pending } = useFormStatus();
  return (
    /* o card visual mora dentro do botão: group-hover acerta a área toda e o
       focus-visible cai no elemento focável de verdade */
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="group w-full rounded-xl text-left outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none"
    >
      <div className="flex h-full flex-col rounded-xl border border-transparent bg-card p-4 shadow-[var(--shadow-border)] transition-[border-color,box-shadow] ease-snappy group-hover:border-[var(--brand-lime)]/60 group-hover:shadow-[var(--shadow-border-hover)] group-disabled:opacity-70">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
            {pending ? (
              <CircleNotch size={18} className="animate-spin" aria-hidden />
            ) : (
              icon
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{titulo}</p>
            <p className="truncate text-xs text-muted-foreground">{persona}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-snug text-muted-foreground">
          {descricao}
        </p>
      </div>
    </button>
  );
}
