import type { ReactNode } from "react";
import { AVALIACAO_LABEL } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

/** Item de legenda: o swatch repete o glifo do gráfico (dot redondo por
 *  padrão; `swatch` recebe o desenho alternativo — bloco, anel, hatch
 *  retangular) e `rotulo` diz o significado em texto. Nunca só cor:
 *  a mesma regra "status nunca só por cor" da BarraSegmentada. */
export type PontoLegenda = {
  rotulo: string;
  cls?: string;
  swatch?: ReactNode;
};

/** Legenda curta cor → significado pras visualizações de pontos/blocos
 *  (REALIZA-444), na gramática da legenda da BarraSegmentada: swatch
 *  aria-hidden + texto xs muted. Server-safe, sem hooks. */
export function LegendaPontos({
  itens,
  className,
}: {
  itens: PontoLegenda[];
  className?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      {itens.map((it) => (
        <span key={it.rotulo} className="inline-flex items-center gap-1">
          {it.swatch ?? (
            <span aria-hidden className={cn("size-2 rounded-full", it.cls)} />
          )}
          {it.rotulo}
        </span>
      ))}
    </p>
  );
}

/** A rampa cor → avaliação de encontro dos dots/blocos (a mesma do
 *  SemaforoDot): verde excelente, lima boa, âmbar regular, vermelho
 *  baixa. Fonte única — trajetória, contexto e retrospectiva importam
 *  daqui em vez de repetir o mapa. */
export const COR_AVALIACAO: Record<string, string> = {
  excelente: "bg-[var(--ok)]",
  boa: "bg-[var(--brand-lime)]",
  regular: "bg-[var(--warn)]",
  baixa: "bg-[var(--danger)]",
};

const ORDEM_AVALIACAO = ["excelente", "boa", "regular", "baixa"] as const;

/** A legenda da rampa de avaliação filtrada às notas presentes — a chave
 *  só explica o que está na tela (mesma régua dos segmentos zerados). */
export function itensAvaliacao(presentes: Iterable<string>): PontoLegenda[] {
  const set = new Set(presentes);
  return ORDEM_AVALIACAO.filter((k) => set.has(k)).map((k) => ({
    rotulo: AVALIACAO_LABEL[k] ?? k,
    cls: COR_AVALIACAO[k],
  }));
}
