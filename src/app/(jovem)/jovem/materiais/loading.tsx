import { Skeleton } from "@/components/ui/skeleton";

// Espelho do hub "Minha jornada": hero de um card (título + meta + barra) e
// a trilha com nós numerados + cards; o acervo é o mesmo conjunto de linhas
// de sempre (ícone quadrado + título/descrição + ícone/badge à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* hero slim */}
      <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-44" />
            <Skeleton className="mt-2 h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-9 w-14" />
        </div>
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
      </div>

      {/* trilha — nó à esquerda + card */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative pl-16">
          <Skeleton className="absolute left-6 top-4 size-11 -translate-x-1/2 rounded-full" />
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <Skeleton className="h-3 w-36" />
            <div className="mt-2 flex items-center gap-3">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </div>
        </div>
      ))}

      {/* acervo */}
      <section className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
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
    </div>
  );
}
