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

      {/* trilha — rail à esquerda (pl-12/left-5) + nó size-7 + recibo */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative pb-4 pl-12">
          <Skeleton className="absolute left-5 top-4 size-7 -translate-x-1/2 rounded-full" />
          <div className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="ml-auto size-4 rounded" />
            </div>
          </div>
        </div>
      ))}

      {/* acervo — overline da seção + grid de cards (capa h-36 + linha) */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
              >
                <Skeleton className="h-36 rounded-none" />
                <div className="flex items-center gap-x-4 px-5 py-3.5">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="mt-1 h-3 w-4/5" />
                  </div>
                  <Skeleton className="size-4 shrink-0 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
