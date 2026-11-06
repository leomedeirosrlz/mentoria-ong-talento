import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /ia: header, linha de chips de filtro, grade de 6 KPIs e as
// seções em 2 colunas — os filtros são Link (server render), então o
// skeleton dá o feedback do toque que faltava no mobile.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-11 w-40 rounded-full sm:h-7" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-11 w-44 rounded-full sm:h-7" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-11 w-56 rounded-full sm:h-7" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
        ))}
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="ml-auto h-3 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
