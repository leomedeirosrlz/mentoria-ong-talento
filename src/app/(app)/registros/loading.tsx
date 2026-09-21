import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /registros: header, chips de triagem, barra de filtros e grupos
// com overline + card de linhas (nomes, meta, preview, badges).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-44 rounded-full" />
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Skeleton className="col-span-2 h-11 rounded-lg sm:h-8 sm:flex-1" />
        <Skeleton className="h-11 rounded-lg sm:h-8 sm:w-36" />
        <Skeleton className="h-11 rounded-lg sm:h-8 sm:w-36" />
        <Skeleton className="h-11 rounded-lg sm:h-8 sm:w-36" />
        <Skeleton className="h-11 rounded-lg sm:h-8 sm:w-44" />
      </div>
      {[3, 2].map((rows, g) => (
        <section key={g} className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-1.5 h-3 w-1/3" />
                <Skeleton className="mt-1.5 h-4 w-4/5" />
                <div className="mt-2 flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-4xl" />
                  <Skeleton className="h-5 w-24 rounded-4xl" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
