"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ABAS, ROTULO_ABA, type AbaFicha } from "./ficha-abas";

/** Abas da ficha: links com ?aba= (cada aba entra no histórico, o voltar
 *  do navegador volta pra aba anterior) no mesmo padrão de /agenda.
 *  Setas, Home e End movem o foco e ativam a aba; o painel remonta com
 *  .animate-enter a cada troca. */
export function FichaAbas({
  ativa,
  children,
}: {
  ativa: AbaFicha;
  /** Conteúdo já renderizado no servidor, só da aba ativa. */
  children: ReactNode;
}) {
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, i: number) {
    let proximo: number | null = null;
    if (e.key === "ArrowRight") proximo = (i + 1) % ABAS.length;
    else if (e.key === "ArrowLeft") proximo = (i - 1 + ABAS.length) % ABAS.length;
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = ABAS.length - 1;
    if (proximo == null) return;
    e.preventDefault();
    const alvo = refs.current[ABAS[proximo]];
    alvo?.focus();
    // o clique do Link é quem navega — ativação automática, como no tablist
    alvo?.click();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Seções da dupla"
        className="scroll-fina flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
      >
        {ABAS.map((v, i) => {
          const selecionada = v === ativa;
          return (
            <Link
              key={v}
              ref={(el) => {
                refs.current[v] = el;
              }}
              id={`aba-${v}`}
              role="tab"
              aria-selected={selecionada}
              aria-controls={`painel-${v}`}
              tabIndex={selecionada ? 0 : -1}
              href={`?aba=${v}`}
              scroll={false}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
                selecionada
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ROTULO_ABA[v]}
            </Link>
          );
        })}
      </div>

      {/* key = aba: trocar de aba remonta o painel e a entrada roda de novo */}
      <div
        key={ativa}
        id={`painel-${ativa}`}
        role="tabpanel"
        aria-labelledby={`aba-${ativa}`}
        className="animate-enter mt-4 space-y-4"
      >
        {children}
      </div>
    </>
  );
}
