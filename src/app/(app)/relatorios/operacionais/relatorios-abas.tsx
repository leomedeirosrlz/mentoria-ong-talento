"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFadeX } from "@/lib/use-fade-x";

export type AbaRelatorios =
  | "visao"
  | "aderencia"
  | "assinaturas"
  | "interacoes"
  | "solicitacoes"
  | "encerramento"
  | "formularios";

export type AbaRelatoriosItem = { id: AbaRelatorios; rotulo: string };

/** Abas de /relatorios/operacionais (REALIZA-178; a 375 tirou a grade
 *  daqui e ela virou a página principal): links com ?aba= preservando
 *  turma/cronograma do recorte — o voltar do navegador troca de aba e o
 *  recorte não se perde entre seções. Setas/Home/End movem o foco e
 *  ativam; o painel remonta com .animate-enter a cada troca — mesmo
 *  padrão de MateriaisAbas. */
export function RelatoriosAbas({
  abas,
  ativa,
  extraParams,
  children,
}: {
  abas: AbaRelatoriosItem[];
  ativa: AbaRelatorios;
  /** Recorte ativo (turma/cronograma) — entra na query de toda aba. */
  extraParams?: string;
  children: ReactNode;
}) {
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const { ref, maskStyle } = useFadeX<HTMLDivElement>();

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, i: number) {
    let proximo: number | null = null;
    if (e.key === "ArrowRight") proximo = (i + 1) % abas.length;
    else if (e.key === "ArrowLeft") proximo = (i - 1 + abas.length) % abas.length;
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = abas.length - 1;
    if (proximo == null) return;
    e.preventDefault();
    const alvo = refs.current[abas[proximo]!.id];
    alvo?.focus();
    alvo?.click();
  }

  const href = (id: string) =>
    `/relatorios/operacionais?aba=${id}${extraParams ? `&${extraParams}` : ""}`;

  return (
    <>
      <div className="relative -mx-4 border-b border-border/70 sm:mx-0">
        <div
          role="tablist"
          aria-label="Seções de relatórios"
          ref={ref}
          style={maskStyle}
          className="flex items-center gap-1 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-0"
        >
          {abas.map((a, i) => {
            const selecionada = a.id === ativa;
            return (
              <Link
                key={a.id}
                ref={(el) => {
                  refs.current[a.id] = el;
                }}
                id={`aba-${a.id}`}
                role="tab"
                aria-selected={selecionada}
                aria-controls={`painel-${a.id}`}
                tabIndex={selecionada ? 0 : -1}
                href={href(a.id)}
                scroll={false}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "relative inline-flex min-h-11 shrink-0 items-center rounded-t-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10",
                  selecionada
                    ? "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--brand-lime)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </div>
      </div>

      <div
        key={ativa}
        id={`painel-${ativa}`}
        role="tabpanel"
        aria-labelledby={`aba-${ativa}`}
        className="animate-enter mt-5 space-y-5"
      >
        {children}
      </div>
    </>
  );
}
