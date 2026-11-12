import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /relatorios/operacionais: PageHeader (VoltarLink + título +
// meta), tabstrip de abas, chips de recorte e a prévia tabular na faixa
// border-y do padrão grade livre (header bg-muted + gutter de nº).
const COLS = ["w-44", "w-40", "w-36", "w-28", "w-44", "w-52"];
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
      {/* VoltarLink + PageHeader */}
      <header>
        <Skeleton className="h-4 w-14" />
        <div className="mt-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
        </div>
      </header>

      {/* tabstrip — fileira de tabs na borda */}
      <div className="flex items-center gap-1 border-b border-border/70">
        {["w-14", "w-24", "w-24", "w-24", "w-28", "w-28", "w-24"].map((w, i) => (
          <Skeleton key={i} className={`h-10 ${w} rounded-t-md`} />
        ))}
      </div>

      <div className="space-y-5">
        {/* chips de recorte por turma */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>

        {/* título da seção + botão de CSV */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-[26rem] max-w-full" />
          </div>
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>

        {/* prévia — faixa border-y com a tabela no padrão grade livre */}
        <div className="-mx-4 border-y border-border bg-card/40 px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="overflow-hidden">
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
          <Skeleton className="mt-2 h-3 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}
