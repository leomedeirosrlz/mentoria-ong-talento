"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";

import { toggleEncaminhamento } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Item "combinado aberto" da home do mentor: marca feito na hora (o mesmo
 *  toggleEncaminhamento da ficha) e ainda oferece o link direto pro item —
 *  o checkbox cobre o gesto comum, a ficha cobre o contexto. Gramática do
 *  EncaminhamentosList: checkbox nativo dentro do label. */
export function CombinadoCheck({
  id,
  duplaId,
  descricao,
  prazoLabel,
  vencido,
}: {
  id: string;
  duplaId: string;
  descricao: string;
  /** já formatado ("até 12/03") ou null quando o combinado não tem prazo */
  prazoLabel: string | null;
  vencido: boolean;
}) {
  const router = useRouter();
  const [feito, setFeito] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="flex items-start gap-2">
      <label
        className={cn(
          "group flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-2 sm:py-1 transition-colors",
          pending && "opacity-60"
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={feito}
          disabled={pending}
          aria-label={`marcar combinado como feito: ${descricao}`}
          onChange={() => {
            if (feito) return; // já fechado — o refresh remove da lista
            setFeito(true);
            start(async () => {
              try {
                const res = await toggleEncaminhamento(id, true, duplaId);
                if (res?.error) {
                  setFeito(false);
                  toast.error(res.error);
                } else router.refresh();
              } catch {
                setFeito(false);
                toast.error("Sem conexão. Tente de novo.");
              }
            });
          }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
            feito
              ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]"
              : "border-muted-foreground/40 group-hover:border-foreground"
          )}
        >
          {feito && (
            <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
              <path d="M1 4l2.5 2.5L9 1" />
            </svg>
          )}
        </span>
        <span className="min-w-0 text-sm">
          {descricao}
          {prazoLabel && (
            <span
              className={cn(
                vencido
                  ? "font-medium text-[var(--danger)]"
                  : "text-muted-foreground"
              )}
            >
              {" "}
              · {prazoLabel}
              {vencido ? " (vencido)" : ""}
            </span>
          )}
        </span>
      </label>
      <Link
        href={`/duplas/${duplaId}#combinado-${id}`}
        aria-label="Ver combinado na ficha da dupla"
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
      >
        <ArrowSquareOut size={15} aria-hidden />
      </Link>
    </li>
  );
}
