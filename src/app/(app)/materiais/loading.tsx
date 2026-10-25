import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /materiais: cabeçalho + ação, faixa de abas e o painel da aba
// padrão (Jornada na coordenação, Biblioteca no mentor). Sem a caixa de
// escopo — a página não se explica mais no topo.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg md:h-8" />
      </header>

      <div className="-mx-4 flex gap-2 border-b border-border/70 px-4 sm:mx-0 sm:px-0">
        <Skeleton className="my-2 h-7 w-24 rounded-md" />
        <Skeleton className="my-2 h-7 w-28 rounded-md" />
        <Skeleton className="my-2 h-7 w-28 rounded-md" />
      </div>

      <section className="space-y-5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-3 w-72 max-w-full" />
        </div>
        <div className="-mx-1 flex gap-2.5 overflow-hidden px-1 pb-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="w-44 shrink-0 rounded-lg border border-border/70 p-3"
            >
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-1 h-3 w-3/5" />
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
