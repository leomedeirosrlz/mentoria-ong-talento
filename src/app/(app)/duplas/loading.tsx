import { Skeleton } from "@/components/ui/skeleton";
import { GRID_DUPLA_LG } from "@/components/dupla-linha";

// Espelho da lista de duplas da coordenação (o caso comum): título + busca
// e ações, o resumo "Situação das duplas" (título, linha de denominador,
// barra e legenda), a régua de chips por situação e a lista densa na mesma
// grade da linha canônica. No celular cada linha é um card.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-1 h-4 w-40" />
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <Skeleton className="h-11 min-w-0 flex-1 rounded-lg sm:max-w-xs sm:flex-none md:h-8" />
          <Skeleton className="h-11 w-28 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-28 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-24 rounded-lg md:h-7" />
        </div>
      </header>

      {/* situação das duplas — título, denominador, barra e legenda */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* chips por situação — rolam na horizontal no celular */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full sm:h-8" />
        ))}
      </div>

      {/* lista densa — cabeçalho de colunas só em @4xl (container) + linhas */}
      <section className="@container">
        <div className="@4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]">
          <div
            className={`hidden items-center gap-x-3 border-b border-border px-5 py-2.5 @4xl:grid ${GRID_DUPLA_LG}`}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-2.5 w-14" />
            ))}
          </div>
          <div className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 @4xl:grid @4xl:gap-x-3 @4xl:gap-y-0 @4xl:rounded-none @4xl:border-0 @4xl:bg-transparent @4xl:px-5 @4xl:py-3 ${GRID_DUPLA_LG}`}
              >
                {/* situação */}
                <div className="order-1 @4xl:order-none">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                {/* ações (topo-direita no celular, última coluna em @4xl) */}
                <div className="order-2 ml-auto flex items-center gap-1.5 @4xl:order-none @4xl:ml-0 @4xl:flex-col @4xl:items-end @4xl:gap-1">
                  <Skeleton className="h-11 w-24 rounded-lg @4xl:h-7 @4xl:w-20" />
                </div>
                {/* a dupla — avatares sobrepostos + nomes */}
                <div className="order-3 flex min-w-0 basis-full items-start gap-2.5 @4xl:order-none @4xl:basis-auto">
                  <span className="inline-flex shrink-0">
                    <Skeleton className="size-8 rounded-full ring-2 ring-card" />
                    <Skeleton className="-ml-2.5 size-8 rounded-full ring-2 ring-card" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="mt-1 h-3 w-3/5" />
                  </div>
                </div>
                {/* motivo */}
                <Skeleton className="order-4 h-3.5 w-2/3 basis-full @4xl:order-none @4xl:basis-auto" />
                {/* encontros */}
                <Skeleton className="order-5 h-2 w-full basis-full @4xl:order-none @4xl:basis-auto" />
                <div className="order-6 @max-4xl:hidden @4xl:order-none" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
