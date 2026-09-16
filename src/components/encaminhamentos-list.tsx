"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleEncaminhamento } from "@/lib/actions";
import { formatDate, toDateStr } from "@/lib/ciclo";
import type { Encaminhamento } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EncaminhamentosList({
  itens,
  duplaId,
  podeEditar,
}: {
  itens: Encaminhamento[];
  duplaId: string;
  podeEditar: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const hoje = toDateStr(new Date());

  if (itens.length === 0)
    return <p className="text-sm text-muted-foreground py-4">Nenhum encaminhamento registrado.</p>;

  const ordenados = [...itens].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
  });

  return (
    <ul className="divide-y divide-border">
      {ordenados.map((t) => {
        const vencido = t.status === "pendente" && t.prazo && t.prazo < hoje;
        return (
          <li key={t.id} className="flex items-start gap-3 py-3">
            {podeEditar ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await toggleEncaminhamento(t.id, t.status !== "feito", duplaId);
                    if (res?.error) toast.error(res.error);
                    else router.refresh();
                  })
                }
                className={cn(
                  "mt-0.5 size-4.5 rounded-md border shrink-0 grid place-items-center transition-colors",
                  t.status === "feito"
                    ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                    : "border-muted-foreground/40 hover:border-foreground"
                )}
                aria-label={t.status === "feito" ? "Reabrir" : "Marcar como feito"}
              >
                {t.status === "feito" && (
                  <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
                    <path d="M1 4l2.5 2.5L9 1" />
                  </svg>
                )}
              </button>
            ) : (
              <span
                className={cn(
                  "mt-1 size-2 rounded-full shrink-0",
                  t.status === "feito" ? "bg-[var(--ok)]" : vencido ? "bg-[var(--danger)]" : "bg-[var(--warn)]"
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", t.status === "feito" && "line-through text-muted-foreground")}>
                {t.descricao}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.responsavel === "mentor" ? "Mentor(a)" : "Mentorado(a)"}
                {t.prazo && (
                  <span className={vencido ? "text-[var(--danger)] font-medium" : ""}>
                    {" "}· ate {formatDate(t.prazo)}{vencido ? " (vencido)" : ""}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
