import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /relatorios: PageHeader (kicker + título + meta), barra de
// configuração (grupos overline + chips de filtro + linha de ações) e o
// canvas — faixa border-y bg-card/40 com a grade (header bg-muted + linhas
// com gutter de nº e células de largura fixa).
const COLS = ["w-44", "w-40", "w-36", "w-44", "w-28"];
const ROWS = ["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4", "w-1/2", "w-4/5", "w-3/5"];

function LinhaGrade({ w }: { w: string }) {
  return (
    <div className="flex border-t border-border/60">
      <div className="w-10 shrink-0 px-2 py-1.5">
        <Skeleton className="mx-auto h-3.5 w-4" />
      </div>
      {COLS.map((c, i) => (
        <div key={i} className={`${c} shrink-0 px-2.5 py-1.5`}>
          <Skeleton className={`h-3.5 ${i % 2 === 0 ? w : "w-3/4"}`} />
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* PageHeader — kicker overline + título + meta */}
      <header>
        <Skeleton className="h-3 w-16" />
        <div className="mt-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-1.5 h-4 w-[26rem] max-w-full" />
        </div>
      </header>

      <div className="space-y-5">
        {/* barra de configuração — 3 grupos overline + chips, depois ações */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-3 w-12" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-28 rounded-full sm:h-8" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-3 w-12" />
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-11 w-32 rounded-full sm:h-8" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-3 w-14" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-24 rounded-full sm:h-8" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-11 w-28 rounded-lg md:h-7" />
            <Skeleton className="h-11 w-52 rounded-lg md:h-7" />
            <Skeleton className="h-11 w-44 md:h-7" />
            <Skeleton className="ml-auto h-11 w-36 rounded-full sm:h-8" />
          </div>
        </div>

        {/* canvas — a faixa border-y que sangra o padding da página */}
        <div className="-mx-4 border-y border-border bg-card/40 px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="overflow-hidden">
            {/* header da grade — gutter + colunas fixas sobre bg-muted */}
            <div className="flex bg-muted">
              <div className="w-10 shrink-0 px-2 py-1.5" />
              {COLS.map((c, i) => (
                <div key={i} className={`${c} shrink-0 px-2.5 py-1.5`}>
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              ))}
            </div>
            {ROWS.map((w, i) => (
              <LinhaGrade key={i} w={w} />
            ))}
          </div>
          <Skeleton className="mt-2 h-3 w-[30rem] max-w-full" />
        </div>
      </div>
    </div>
  );
}
