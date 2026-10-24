import { Skeleton } from "@/components/ui/skeleton";

// Espelho da lista de turmas (card v1a): header + grid de cards com
// banner ink (~118–132px) + sigla + bloco funcional + faixa de stats.
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
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
          >
            {/* faixa ink do banner (TurmaBanner) */}
            <Skeleton className="h-[118px] w-full rounded-none sm:h-[132px]" />
            <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-9 rounded-md" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-44" />
              {/* bloco funcional tintado ("semana do encontro N") */}
              <Skeleton className="h-[4.5rem] w-full rounded-[10px]" />
            </div>
            {/* stats em faixa — duplas | mentores | jovens */}
            <div className="grid grid-cols-3 border-t border-border">
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className={`px-3.5 py-2.5 ${j > 0 ? "border-l border-border" : ""}`}
                >
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="mt-1 h-3 w-12" />
                  <Skeleton className="mt-1 h-3 w-16 max-w-full" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
