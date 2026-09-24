"use client";

import { cn } from "@/lib/utils";

/** Linha de destinatário com checkbox — mesma gramática nos dois dialogs de
 *  envio: alvo de toque ≥44px (compacta no desktop), nome trunca e o
 *  detalhe/papel vai à direita. */
export function DestinoCheckRow({
  nome,
  detalhe,
  checked,
  onToggle,
  disabled,
}: {
  nome: string;
  /** chip discreto à direita — papel, contexto ou "já tem link" */
  detalhe?: string | null;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm transition-colors sm:min-h-10",
        disabled
          ? "cursor-default text-muted-foreground"
          : "cursor-pointer hover:bg-muted"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 flex-1 truncate">{nome}</span>
      {detalhe && (
        <span className="text-xs text-muted-foreground">{detalhe}</span>
      )}
    </label>
  );
}
