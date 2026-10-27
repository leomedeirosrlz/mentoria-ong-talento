"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PAINEL_AGENDA,
  idDaAba,
  type AbaAgendaId,
  type AbaAgendaItem,
} from "@/lib/agenda-abas";

/** O alternador de visão da agenda — UM por página, no header.
 *
 *  É link (cada modo entra no histórico e o `?aba=`/`?visao=` é a fonte da
 *  verdade), mas com a mecânica de um tablist de verdade: `aria-selected`,
 *  `aria-controls` pro painel (`PAINEL_AGENDA`, renderizado pela página) e
 *  tabindex rotativo — só a aba ativa é parada de Tab, setas/Home/End movem o
 *  foco e ativam. Abaixo de `sm` a barra rola na horizontal com alvos de
 *  44px; nunca quebra em duas linhas.
 *
 *  Com menos de duas abas o controle não tem o que alternar e some (o
 *  especialista puro, por exemplo: a agenda dele é uma superfície só). */
export function AbasAgenda({
  abas,
  ativa,
}: {
  abas: AbaAgendaItem[];
  ativa: AbaAgendaId;
}) {
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  if (abas.length < 2) return null;

  // a aba ativa é a única parada de Tab; se o id não estiver na lista (param
  // inesperado) a primeira assume pra barra não virar armadilha de foco
  const indiceAtivo = Math.max(
    0,
    abas.findIndex((a) => a.id === ativa)
  );

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
    // o clique do Link é quem navega — ativação automática, como no tablist
    alvo?.click();
  }

  return (
    <div
      role="tablist"
      aria-label="Modos da agenda"
      className="scroll-fina flex w-fit max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1"
    >
      {abas.map((aba, i) => {
        const selecionada = aba.id === ativa;
        return (
          <Link
            key={aba.id}
            ref={(el) => {
              refs.current[aba.id] = el;
            }}
            id={idDaAba(aba.id)}
            role="tab"
            aria-selected={selecionada}
            aria-controls={PAINEL_AGENDA}
            tabIndex={i === indiceAtivo ? 0 : -1}
            href={aba.href}
            scroll={false}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:min-h-8",
              selecionada
                ? // lima da marca = item ativo (mesma régua da nav): tinta
                  // sobre o preenchimento passa de 5:1, não é só um degrau
                  // de branco sobre o muted (que ficava em ~1.2:1)
                  "bg-[var(--brand-lime)] font-semibold text-[var(--brand-ink)] shadow-sm"
                : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
