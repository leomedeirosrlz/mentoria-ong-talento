import { Skeleton } from "@/components/ui/skeleton";

// Espelho da agenda do jovem: header com CTA de agendar, seção "Próximos"
// e "Histórico" — cards de linhas (disco de status + nº/data + ações).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40 rounded-lg md:h-7" />
      </header>

      {[3, 4].map((rows, g) => (
        <section key={g} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-0 shadow-[var(--shadow-border)]">
            {Array.from({ length: rows }, (_, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5"
              >
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 basis-48">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-1 h-3 w-40" />
                </div>
                <div className="ms-auto flex items-center gap-2">
                  {g === 0 && i === 0 ? (
                    <>
                      <Skeleton className="h-8 w-20 rounded-lg" />
                      <Skeleton className="h-8 w-24 rounded-lg" />
                    </>
                  ) : (
                    <Skeleton className="h-5 w-20 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
