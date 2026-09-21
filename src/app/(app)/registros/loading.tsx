import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /registros: header, resumo operacional, barra busca+filtros e a
// timeline (rail dia/mês + nó + linha) com cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto max-w-3xl space-y-6">
      <header>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg sm:h-8 sm:max-w-md" />
        <Skeleton className="h-11 w-24 rounded-lg sm:h-8" />
      </div>
      <ol>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 sm:gap-4">
            <div className="flex w-10 shrink-0 flex-col items-center sm:w-12">
              <Skeleton className="mt-4 h-4 w-5" />
              <Skeleton className="mt-1 h-2.5 w-6" />
              <Skeleton className="mt-2 size-2 rounded-full" />
              {i < 2 && <div className="mt-1.5 w-px flex-1 bg-border" />}
            </div>
            <div className={i < 2 ? "min-w-0 flex-1 pb-5" : "min-w-0 flex-1"}>
              <div className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="mt-2 h-4 w-2/5" />
                <Skeleton className="mt-1.5 h-3 w-4/5" />
                <Skeleton className="mt-2 h-4 w-full" />
                <div className="mt-2 flex gap-1.5">
                  <Skeleton className="h-5 w-28 rounded-4xl" />
                  <Skeleton className="h-5 w-20 rounded-4xl" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
