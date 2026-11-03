import { Skeleton } from "@/components/ui/skeleton";

// Espelho do hub "Minha jornada" (v6a): hero slim (título + meta + badge
// + N/16 + barra + "próxima parada"), sub-nav sticky (Jornada | Acervo),
// "Meus instrumentos" (heading + grade de cards — linha no mobile, card
// com capa h-24 no desktop) e o acervo agrupado (overline + grade de
// cards-linha: ícone size-9 + título/descrição + ícone à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* hero slim — um card só */}
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

      {/* sub-nav sticky — dois links-pill "Jornada | Acervo" */}
      <div className="flex gap-1 border-b border-border pb-0">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>

      {/* "Meus instrumentos" — heading + caption + grade de cards-produto
          (capa símbolo h-24, título+sub, descrição, chip de janela + tag
          de estado) */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
        </div>
        {/* banner da avaliação pendente — slot reservado */}
        <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] sm:flex-col"
            >
              {/* lombada mobile / capa símbolo desktop */}
              <Skeleton className="w-14 shrink-0 rounded-none sm:h-24 sm:w-auto" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-1 hidden h-3 w-full sm:block" />
                <Skeleton className="hidden h-3 w-2/3 sm:block" />
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* bandeira terminal — "Encontro 16 · Celebração da jornada" */}
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </section>

      {/* acervo — overline de grupo + grade de cards-linha */}
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
                className="flex items-center gap-x-4 rounded-xl bg-card px-5 py-3.5 shadow-[var(--shadow-border)]"
              >
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-1 h-3 w-4/5" />
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
