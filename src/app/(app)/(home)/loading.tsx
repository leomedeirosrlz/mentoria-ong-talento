import { Skeleton } from "@/components/ui/skeleton";

// Espelho do DashboardCoordenacao (home de coordenação/supervisor):
// header com marcador da semana e, em xl, duas colunas — stats + cards de
// dupla na principal; avisos e resumo da semana no rail de ~340px.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-8">
      {/* header — título + linha "Semana do Nº encontro" */}
      <header>
        <Skeleton className="h-8 w-40" />
        <div className="mt-2 flex items-center gap-1.5">
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </header>

      {/* mesma geometria do grid real: 1 coluna até xl, depois main + rail */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="min-w-0 space-y-8">
          {/* stats — grid 2 cols → 4 em xl, cards com label + número grande */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border border-transparent bg-card px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-8 w-10" />
              </div>
            ))}
          </div>

          {/* cards de dupla — dot + nomes + motivo à esquerda; contador, barra
              e badge à direita; poço na base com lembrete + ação */}
          <section className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border border-transparent bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Skeleton className="size-2.5 shrink-0 rounded-full" />
                      <span className="inline-flex shrink-0">
                        <Skeleton className="size-8 rounded-full ring-2 ring-card" />
                        <Skeleton className="-ml-2 size-8 rounded-full ring-2 ring-card" />
                      </span>
                      <Skeleton className="h-4 w-52 max-w-full" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
                    <Skeleton className="mt-1.5 h-3 w-36" />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-1 w-16 rounded-full sm:w-20" />
                    <Skeleton className="h-5 w-14 rounded-4xl" />
                  </div>
                </div>
                <div className="-mx-4 -mb-4 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-b-xl border-t border-border/60 bg-muted/50 px-4 pb-3 pt-2.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-11 w-24 rounded-lg md:h-7" />
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* rail — avisos (título + itens) e o resumo da semana em números */}
        <aside className="min-w-0 space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="divide-y divide-border/60 rounded-xl bg-card shadow-[var(--shadow-border)]">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="px-4 py-3.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="mt-2 h-3.5 w-full" />
                  <Skeleton className="mt-1 h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-1.5 h-6 w-8" />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
