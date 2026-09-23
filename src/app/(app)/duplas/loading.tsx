import { Skeleton } from "@/components/ui/skeleton";

// Espelho da lista de duplas: header, busca + "Nova dupla", card com linhas
// (dot do semáforo + nomes + motivo | contagem + barra | status).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>
      </header>

      {/* busca + ação */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 min-w-0 flex-1 basis-full rounded-lg sm:basis-0 sm:max-w-sm md:h-8" />
        <Skeleton className="h-11 w-24 shrink-0 rounded-lg max-sm:w-full md:h-7" />
      </div>

      {/* lista */}
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <span className="inline-flex shrink-0">
              <Skeleton className="size-9 rounded-full ring-2 ring-card" />
              <Skeleton className="-ml-2.5 size-9 rounded-full ring-2 ring-card" />
            </span>
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-1.5 h-3 w-3/5" />
            </div>
            <div className="flex w-16 shrink-0 flex-col items-end gap-1.5 max-sm:order-4 max-sm:basis-full max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:gap-2 max-sm:pl-20 sm:w-20">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-1 w-full rounded-full" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
