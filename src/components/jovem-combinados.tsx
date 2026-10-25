"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown, ListChecks } from "@phosphor-icons/react";
import { toast } from "sonner";
import { marcarCombinadoFeito } from "@/lib/actions";
import { formatDate } from "@/lib/ciclo";
import type { JovemEncaminhamento } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Combinados do jovem (REALIZA-108) — versão enxuta da lista da dupla:
 *  o único write é o checkbox (RPC marcar_combinado, transição
 *  pendente↔feito). Sem editar/excluir: quem criou o combinado foi o mentor
 *  no registro do encontro; o jovem marca o que fez. "Vencido" é derivado
 *  de prazo aqui na UI — 'atrasado' é valor-fantasma do enum, não se grava.
 *  Os abertos ficam à vista; os feitos recolhem em "Ver N feitos". */
export function JovemCombinados({
  itens,
  hoje,
}: {
  itens: JovemEncaminhamento[];
  /** "YYYY-MM-DD" no fuso do programa — vem do server pra hidratar igual. */
  hoje: string;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  if (itens.length === 0) {
    return (
      <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <ListChecks size={18} aria-hidden />
        </span>
        Nenhum combinado por aqui ainda: eles saem do papo com seu mentor em
        cada encontro.
      </p>
    );
  }

  // views geradas são all-nullable — encaminhamentos.id é NOT NULL no
  // banco; o filter estreita o tipo sem esconder rows inesperadas
  const ordenados = itens
    .filter((t): t is JovemEncaminhamento & { id: string } => t.id != null)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
      return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
    });
  const abertos = ordenados.filter((t) => t.status !== "feito");
  const feitos = ordenados.filter((t) => t.status === "feito");

  function renderItem(t: JovemEncaminhamento & { id: string }) {
    const feito = t.status === "feito";
    const vencido = !feito && t.prazo != null && t.prazo < hoje;
    return (
      <li key={t.id} className="flex items-start gap-1">
        <label
          className={cn(
            "group flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3 transition-colors",
            pending && pendingId === t.id && "opacity-60"
          )}
        >
          {/* checkbox nativo + label — teclado e clique no texto de graça;
              o quadrado estilizado é só a representação (mesmo padrão da
              lista de staff) */}
          <input
            type="checkbox"
            className="peer sr-only"
            checked={feito}
            disabled={pending && pendingId === t.id}
            onChange={() => {
              setPendingId(t.id);
              start(async () => {
                try {
                  const res = await marcarCombinadoFeito(t.id, !feito);
                  if (res?.error) toast.error(res.error);
                  else {
                    if (!feito) toast.success("Combinado marcado como feito.");
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                } finally {
                  setPendingId(null);
                }
              });
            }}
          />
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
              feito
                ? "border-[var(--ok-text)] bg-[var(--ok-text)] text-white"
                : "border-muted-foreground/40 group-hover:border-foreground"
            )}
          >
            {feito && (
              <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
                <path d="M1 4l2.5 2.5L9 1" />
              </svg>
            )}
          </span>
          <span className="block min-w-0 flex-1">
            <span
              className={cn(
                "block break-words text-sm",
                feito && "text-muted-foreground line-through"
              )}
            >
              {t.descricao}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {feito ? (
                "Feito"
              ) : t.prazo ? (
                <span className={vencido ? "font-medium text-[var(--warn-text)]" : ""}>
                  até {formatDate(t.prazo)}
                  {vencido ? ", passou do prazo, vale fazer mesmo assim" : ""}
                </span>
              ) : (
                "Sem prazo"
              )}
            </span>
          </span>
        </label>
      </li>
    );
  }

  return (
    <div>
      {abertos.length > 0 ? (
        <ul className="divide-y divide-border/60">{abertos.map(renderItem)}</ul>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">
          Tudo em dia. Nenhum combinado aberto.
        </p>
      )}

      {feitos.length > 0 && (
        <Collapsible.Root
          className={cn(abertos.length > 0 && "border-t border-border/60")}
        >
          <Collapsible.Trigger className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&[aria-expanded=true]>svg]:rotate-180">
            Ver {feitos.length} {feitos.length === 1 ? "feito" : "feitos"}
            <CaretDown size={16} aria-hidden className="shrink-0 transition-transform" />
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <ul className="divide-y divide-border/60">{feitos.map(renderItem)}</ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </div>
  );
}
