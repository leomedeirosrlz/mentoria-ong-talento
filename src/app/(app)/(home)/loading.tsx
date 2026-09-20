import { Skeleton } from "@/components/ui/skeleton";

// Espelho do DashboardCoordenacao (home de coordenação/supervisor):
// header com marcador da semana, stats 2×4, faixa de resumo e cards de dupla.
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

      {/* stats — grid 2 cols → 4 cols, cards com label + número grande */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* faixa "Esta semana" — linha de contagens + botão de copiar à direita */}
      <section className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
        </div>
      </section>

      {/* cards de dupla — dot + nomes + motivo à esquerda; contador,
          barra de progresso, badge e botão à direita */}
      <section className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-transparent bg-card p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-52 max-w-full" />
                </div>
                <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
                <Skeleton className="mt-1.5 h-3 w-36" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-1 w-16 rounded-full sm:w-20" />
                <Skeleton className="h-5 w-14 rounded-4xl" />
                <Skeleton className="h-11 w-24 rounded-lg md:h-7" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
