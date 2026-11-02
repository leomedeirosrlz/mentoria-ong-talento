"use client";

import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ABAS_AJUDA, type AbaAjuda } from "./ajuda-abas";

/** Abas da Ajuda: links com ?aba= (o voltar do navegador troca de aba),
 *  mesmo padrão da ficha da dupla e de /materiais. Setas, Home e End movem
 *  o foco e ativam a aba; o painel remonta com .animate-enter a cada troca.
 *  `base` é o prefixo da rota — "/ajuda" pra staff, "/jovem/ajuda" pro jovem. */
export function AjudaAbas({
  ativa,
  base,
  children,
}: {
  ativa: AbaAjuda;
  base: string;
  /** Conteúdo já renderizado no servidor, só da aba ativa. */
  children: ReactNode;
}) {
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, i: number) {
    let proximo: number | null = null;
    if (e.key === "ArrowRight") proximo = (i + 1) % ABAS_AJUDA.length;
    else if (e.key === "ArrowLeft")
      proximo = (i - 1 + ABAS_AJUDA.length) % ABAS_AJUDA.length;
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = ABAS_AJUDA.length - 1;
    if (proximo == null) return;
    e.preventDefault();
    const alvo = refs.current[ABAS_AJUDA[proximo]!.id];
    alvo?.focus();
    // o clique do Link é quem navega — ativação automática, como no tablist
    alvo?.click();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Seções de ajuda"
        className="scroll-fina -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border/70 px-4 sm:mx-0 sm:px-0"
      >
        {ABAS_AJUDA.map((a, i) => {
          const selecionada = a.id === ativa;
          return (
            <Link
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              id={`aba-ajuda-${a.id}`}
              role="tab"
              aria-selected={selecionada}
              aria-controls={`painel-ajuda-${a.id}`}
              tabIndex={selecionada ? 0 : -1}
              href={`${base}?aba=${a.id}`}
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

      {/* key = aba: trocar de aba remonta o painel e a entrada roda de novo */}
      <div
        key={ativa}
        id={`painel-ajuda-${ativa}`}
        role="tabpanel"
        aria-labelledby={`aba-ajuda-${ativa}`}
        className="animate-enter mt-5 space-y-5"
      >
        {children}
      </div>
    </>
  );
}
