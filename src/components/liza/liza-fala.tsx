"use client";

// Balão de fala da Liza com o painel fechado (regras em lib/liza-falas.ts).
// Mora dentro do container fixo do FAB e nasce dele: canto inferior direito
// reto + cauda apontando pro rosto, entrada de baixo pra cima a partir da
// bolha. Não rouba foco nem prende o teclado; só o "Respondi" é anunciado
// (role=status) — apresentação e dica não interrompem o leitor de tela.
// O guard global de prefers-reduced-motion já zera a entrada.

import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { FalaLiza } from "@/lib/liza-falas";
import { cn } from "@/lib/utils";

export function LizaFala({
  fala,
  onPergunta,
  onAbrir,
  onDispensar,
  onPausar,
}: {
  fala: FalaLiza;
  /** chip: abre a Liza e envia a pergunta */
  onPergunta: (pergunta: string) => void;
  /** "Ver resposta" do `pronto` */
  onAbrir: () => void;
  onDispensar: () => void;
  /** hover/foco dentro do balão segura o relógio de sumir */
  onPausar: (pausado: boolean) => void;
}) {
  const pronto = fala.tipo === "pronto";
  return (
    <div
      // key por tipo no pai: trocar de fala re-roda a entrada
      role={pronto ? "status" : undefined}
      onPointerEnter={() => onPausar(true)}
      onPointerLeave={() => onPausar(false)}
      onFocus={() => onPausar(true)}
      onBlur={() => onPausar(false)}
      className={cn(
        "absolute right-0 bottom-full mb-3 w-max max-w-[min(17.5rem,calc(100vw-2rem))] origin-bottom-right",
        "animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-90 duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
        "print:hidden"
      )}
    >
      <div className="relative rounded-2xl rounded-br-md border border-border/70 bg-popover py-2.5 pr-11 pl-3.5 md:pr-10 text-popover-foreground shadow-[var(--shadow-overlay)]">
        <p className="text-sm leading-snug text-pretty">{fala.texto}</p>
        {pronto ? (
          <Button size="sm" onClick={onAbrir} className="mt-2 rounded-full px-3">
            Ver resposta
          </Button>
        ) : fala.pergunta ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPergunta(fala.pergunta!)}
            // a pergunta é o convite: quebra linha em vez de truncar
            className="mt-2 h-auto min-h-11 max-w-full justify-start whitespace-normal rounded-2xl px-3 py-1.5 text-left leading-snug shadow-[var(--shadow-border)] md:h-auto md:min-h-7"
          >
            {fala.pergunta}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDispensar}
          aria-label="Dispensar mensagem da Liza"
          className="absolute top-0 right-0 rounded-full text-muted-foreground md:top-1 md:right-1"
        >
          <X size={14} weight="bold" />
        </Button>
        {/* cauda: quadrado girado, metade escondida sob o balão, apontando
            pro centro do FAB (24px no mobile, 28px no desktop) */}
        <span
          aria-hidden
          className="absolute -bottom-[5px] right-4 size-2.5 rotate-45 border-r border-b border-border/70 bg-popover md:right-5"
        />
      </div>
    </div>
  );
}

/** Rótulo curto do hover/foco no FAB: diz o que é antes do clique. Visual
 *  só (o FAB já tem aria-label); não intercepta o ponteiro. */
export function LizaRotulo() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-border/70 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-[var(--shadow-border)] animate-in fade-in-0 slide-in-from-right-1 duration-150 print:hidden"
    >
      Pergunte à Liza
    </span>
  );
}
