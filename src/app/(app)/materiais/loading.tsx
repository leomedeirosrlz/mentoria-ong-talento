import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /materiais: header + ação, faixa de KPIs, card da trilha de
// cobertura (summary + células size-9), chips de filtro, grupo "Por
// encontro" (summary + linhas <details> min-h-11) e grupo "Transversais"
// (summary + card de linhas: ícone + título; trailing = badge).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg md:h-7" />
      </header>

      {/* faixa de KPIs — 4 stats em linha (2×2 no mobile) */}
      <section className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* trilha de cobertura — summary do grupo + 16 células numeradas */}
      <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <div className="flex items-center gap-x-2.5">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        <div className="mt-3 flex justify-end gap-3">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} className="size-9 shrink-0 rounded-md" />
          ))}
        </div>
      </section>

      {/* chips de filtro */}
      <div className="flex flex-wrap gap-1.5">
        {[56, 88, 96, 110, 92].map((w, i) => (
          <Skeleton key={i} className="h-11 rounded-full sm:h-8" style={{ width: w }} />
        ))}
      </div>

      {/* grupo "Por encontro" — summary + linhas <details> colapsadas */}
      <section className="space-y-2">
        <div className="flex min-h-11 items-center gap-x-2 px-1.5 sm:min-h-9">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {[5, 2, 3].map((w, i) => (
          <div
            key={i}
            className="flex min-h-11 items-center gap-x-2.5 rounded-xl bg-card px-4 py-2 shadow-[var(--shadow-border)]"
          >
            <Skeleton className="size-3.5 shrink-0 rounded" />
            <Skeleton className="h-3.5" style={{ width: `${18 + w * 6}%` }} />
            <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
          </div>
        ))}
      </section>

      {/* grupo "Transversais" — summary + card de linhas */}
      <section className="space-y-2">
        <div className="flex min-h-11 items-center gap-x-2 px-1.5 sm:min-h-9">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-wrap items-center pr-2">
              <div className="flex min-w-0 flex-1 basis-full items-center gap-x-4 px-5 py-3.5 sm:basis-auto">
                <Skeleton className="h-20 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-1 h-3 w-3/5" />
                </div>
              </div>
              <div className="flex basis-full items-center justify-end gap-2 px-5 pb-3 sm:basis-auto sm:px-0 sm:pb-0">
                <Skeleton className="h-5 w-16 rounded-4xl" />
                <Skeleton className="size-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
