import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /materiais (REALIZA-173): header + ação, card da trilha de
// cobertura (células size-7), linhas de encontro colapsadas (min-h-11) e um
// card de transversais (bloco da linha = ícone + título; trailing = badge).
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

      {/* trilha de cobertura — título + 16 células numeradas */}
      <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <Skeleton className="h-4 w-44" />
        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} className="size-7 shrink-0 rounded-md" />
          ))}
        </div>
      </section>

      {/* linhas <details> de encontro, colapsadas */}
      <section className="space-y-2">
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

      {/* transversais — overline + card de linhas */}
      <section className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
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
    </div>
  );
}
