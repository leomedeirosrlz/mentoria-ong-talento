import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /ia: header, seção do plano (card de alerta + lista compacta
// dos modelos com folga), chips de filtro, 3 gráficos, 4 KPIs e as listas.
// Os filtros são Link (server render), então o skeleton dá o feedback do
// toque no mobile.
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1.5 h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-3 space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j}>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-3 w-3/4" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-full" />
            <div className="mt-2 space-y-2.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center gap-3 border-t border-border/60 pt-2.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="ml-auto h-1.5 w-12 rounded-full sm:w-16" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-3 h-3 w-36" />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 sm:space-y-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-11 w-40 rounded-full sm:h-7" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-11 w-44 rounded-full sm:h-7" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <section key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-7 w-24" />
            <Skeleton className="mt-1.5 h-3 w-44" />
            <Skeleton className="mt-6 h-[150px] w-full rounded-lg" />
            <Skeleton className="mt-3 h-3 w-28" />
          </section>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* "Por modelo" — full-width: tabela + barra de tiers */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-5 w-32" />
        <div className="mt-3 flex gap-x-3 border-b border-border/60 pb-1.5">
          <Skeleton className="hidden h-3 flex-1 sm:block" />
          <Skeleton className="ml-auto h-3 w-8 sm:ml-0" />
          <Skeleton className="h-3 w-20 sm:w-24" />
          <Skeleton className="h-3 w-20 sm:w-24" />
          <Skeleton className="h-3 w-12 sm:w-14" />
        </div>
        <div className="divide-y divide-border/60">
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-wrap items-baseline gap-x-2 py-2.5 sm:gap-x-3">
              <Skeleton className="h-4 w-full sm:w-40 sm:flex-1" />
              <Skeleton className="ml-auto h-3 w-8 sm:ml-0" />
              <Skeleton className="h-3 w-20 sm:w-24" />
              <Skeleton className="h-3 w-20 sm:w-24" />
              <Skeleton className="h-3 w-12 sm:w-14" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-3 w-32" />
        <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  );
}
