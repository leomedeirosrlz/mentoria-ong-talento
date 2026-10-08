import { Skeleton } from "@/components/ui/skeleton";

// Espelho do detalhe do cronograma: header com ações + lista de eventos.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-12" />
          <div className="mt-2 flex items-center gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </header>

      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${i > 0 ? "border-t" : ""}`}
          >
            <Skeleton className="h-3 w-4" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-1 h-3 w-2/5" />
            </div>
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
