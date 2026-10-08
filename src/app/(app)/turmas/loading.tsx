import { Skeleton } from "@/components/ui/skeleton";

// Espelho da lista de turmas: header + grid de cards de cronograma.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-4 w-32" />
            <Skeleton className="mt-6 h-3 w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}
