import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /materiais: header + ação, grupos com overline e card de linhas
// (bloco do link = ícone + título/descrição; zona trailing = badge + ícone,
// caindo inteira pra linha de baixo no mobile, como na row real).
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

      {[3, 2].map((rows, g) => (
        <section key={g} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex flex-wrap items-center pr-2">
                <div className="flex min-w-0 flex-1 basis-full items-center gap-x-4 px-5 py-3.5 sm:basis-auto">
                  <Skeleton className="size-4.5 shrink-0 rounded" />
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
      ))}
    </div>
  );
}
