import { Skeleton } from "@/components/ui/skeleton";

// Espelho da biblioteca do jovem: header + grupos com overline e card de
// linhas (ícone quadrado + título/descrição + ícone/badge à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-1 h-4 w-56 max-w-full" />
      </header>

      {[3, 2].map((rows, g) => (
        <section key={g} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center pr-3">
                <div className="flex min-w-0 flex-1 items-center gap-x-4 px-5 py-3.5">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="mt-1 h-3 w-3/5" />
                  </div>
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
