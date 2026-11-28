import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Seção de pessoas — h2 com a contagem + grade de cards/linhas. É a
 *  estrutura única da leitura por papel em /pessoas e /jovem/pessoas: as
 *  duas superfícies mudam os rótulos e os cards, não o modelo mental.
 *  A key da grade vem de fora e muda com os filtros — remontar re-roda a
 *  cascata de entrada (convenção de movimento: troca de filtro sempre
 *  anima). grid-cols-1 explícito: sem template abaixo de sm a coluna
 *  implícita dimensiona por max-content e alarga a página; items-start
 *  porque um card aberto cresce sem esticar o vizinho vazio. */
export function SecaoPessoas({
  titulo,
  total,
  chaveGrade,
  cards = false,
  children,
}: {
  /** Rótulo do grupo na voz da superfície (staff: papel; jovem: faceta). */
  titulo: ReactNode;
  /** Itens exibidos no grupo — aparece como "(n)" ao lado do título. */
  total: number;
  /** Key da grade — inclui os filtros pra re-animar a entrada na troca. */
  chaveGrade: string;
  /** cards = respiro de card grande (gap-4); padrão linha (gap-2). */
  cards?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tabular-nums">
        {titulo}{" "}
        <span className="font-normal text-muted-foreground">({total})</span>
      </h2>
      <div
        key={chaveGrade}
        className={cn(
          "grid grid-cols-1 items-start sm:grid-cols-2",
          cards ? "gap-4" : "gap-2"
        )}
      >
        {children}
      </div>
    </section>
  );
}
