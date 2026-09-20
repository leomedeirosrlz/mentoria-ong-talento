"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleEncaminhamento } from "@/lib/actions";
import { formatDate } from "@/lib/ciclo";
import type { Encaminhamento } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EncaminhamentosList({
  itens,
  duplaId,
  podeEditar,
  hoje,
  encontroNumeroPorRegistroId,
}: {
  itens: Encaminhamento[];
  duplaId: string;
  podeEditar: boolean;
  /** "YYYY-MM-DD" no fuso do programa — vem do server pra hidratar igual. */
  hoje: string;
  /** registro_id → número do encontro; itens criados à mão não têm registro_id. */
  encontroNumeroPorRegistroId?: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  if (itens.length === 0)
    // vazio explica de onde os combinados nascem (o registro do encontro) —
    // não há ação solta aqui porque criar encaminhamento é parte do follow-up
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhum combinado por aqui ainda — eles saem do registro de cada encontro.
      </p>
    );

  const ordenados = [...itens].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
  });

  return (
    <ul className="divide-y divide-border">
      {ordenados.map((t) => {
        const vencido = t.status === "pendente" && t.prazo && t.prazo < hoje;
        const criadoNo = t.registro_id ? encontroNumeroPorRegistroId?.[t.registro_id] : undefined;
        const texto = (
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm", t.status === "feito" && "line-through text-muted-foreground")}>
              {t.descricao}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {/* dot de papel só no mentorado (§1); mentor fica só no texto */}
              {t.responsavel === "mentor" ? (
                "Mentor"
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                  Mentorado
                </span>
              )}
              {t.prazo && (
                <span className={vencido ? "text-[var(--danger)] font-medium" : ""}>
                  {" "}· até {formatDate(t.prazo)}{vencido ? " (vencido)" : ""}
                </span>
              )}
              {criadoNo != null && (
                <span className="text-[11px] text-muted-foreground"> · criado no {criadoNo}º encontro</span>
              )}
            </p>
          </div>
        );

        return (
          <li key={t.id}>
            {podeEditar ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={t.status === "feito"}
                disabled={pending && pendingId === t.id}
                onClick={() => {
                  setPendingId(t.id);
                  start(async () => {
                    try {
                      const res = await toggleEncaminhamento(t.id, t.status !== "feito", duplaId);
                      if (res?.error) toast.error(res.error);
                      else router.refresh();
                    } catch {
                      toast.error("Sem conexão — tente de novo.");
                    } finally {
                      setPendingId(null);
                    }
                  });
                }}
                className="group flex w-full items-start gap-3 py-3 text-left transition-colors disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4.5 rounded-md border shrink-0 grid place-items-center transition-colors",
                    t.status === "feito"
                      ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                      : "border-muted-foreground/40 group-hover:border-foreground"
                  )}
                >
                  {t.status === "feito" && (
                    <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
                      <path d="M1 4l2.5 2.5L9 1" />
                    </svg>
                  )}
                </span>
                {texto}
              </button>
            ) : (
              <div className="flex items-start gap-3 py-3">
                {/* anel fino = gramática de leitura, não de controle — o dot
                    cheio redondo parecia o checkbox interativo desabilitado */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-2.5 rounded-full border-2 shrink-0",
                    t.status === "feito"
                      ? "border-[var(--ok)]"
                      : vencido
                        ? "border-[var(--danger)]"
                        : "border-[var(--warn)]"
                  )}
                />
                {texto}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
