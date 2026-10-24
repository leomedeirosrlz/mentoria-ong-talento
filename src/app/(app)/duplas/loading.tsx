import { Skeleton } from "@/components/ui/skeleton";

// Espelho da lista de duplas (v6a — visão coord, o caso comum; a do
// supervisor agrupa por turma mas carrega a mesma geometria de linhas):
// page-head (título + "hoje" + busca + ações), card ResumoSemaforo
// (barra proporcional + posição das turmas), régua de chips por
// categoria (cards p-3, não pills) e a lista densa — cabeçalho de
// colunas em lg + linhas (pill de estado | avatares+nomes | réguinha de
// encontros | sinais | ações). No mobile cada linha é um card.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* page-head — título + "hoje, ..." à esquerda; busca + 3 ações */}
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

      {/* ResumoSemaforo — card 2-col: título overline + barra segmentada +
          legenda à esquerda; posição das turmas à direita (sm+) */}
      <section className="grid gap-2.5 rounded-xl border border-border bg-card px-4 py-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(230px,0.9fr)] sm:gap-x-6">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-1.5 sm:block">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* régua de categorias — cards flex-col p-3 com dot+nome+contagem e
          a régua em texto; o chip "Apoio" (eixo separado) fecha a linha */}
      <div className="flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex min-h-11 flex-[1.15] basis-[165px] flex-col gap-1 rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-6" />
            </div>
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        ))}
      </div>

      {/* lista densa — cabeçalho de colunas só em lg + linhas; mobile cada
          linha é um card flex-wrap */}
      <section className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] max-sm:contents">
        {/* CabecalhoColunas — 6 colunas fixas em lg */}
        <div className="hidden items-center gap-x-4 border-b border-border px-5 py-2.5 lg:grid lg:grid-cols-[96px_minmax(190px,1.2fr)_minmax(140px,0.85fr)_minmax(195px,1.35fr)_120px_minmax(118px,0.55fr)]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-2.5 w-14" />
          ))}
        </div>
        <div className="divide-y divide-border/60 max-sm:space-y-3 max-sm:divide-y-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 lg:grid lg:grid-cols-[96px_minmax(190px,1.2fr)_minmax(140px,0.85fr)_minmax(195px,1.35fr)_120px_minmax(118px,0.55fr)] lg:items-center lg:gap-x-4 lg:gap-y-0 lg:rounded-none lg:border-0 lg:px-5 lg:py-2.5"
            >
              {/* estado */}
              <div className="order-1 lg:order-none">
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              {/* ações (topo-direita no mobile, última coluna em lg) */}
              <div className="order-2 ml-auto flex items-center gap-1.5 lg:order-none lg:ml-0 lg:flex-col lg:items-end lg:gap-0.5">
                <Skeleton className="size-9 rounded-lg lg:size-auto lg:h-5 lg:w-16" />
                <Skeleton className="hidden h-4 w-16 lg:block" />
              </div>
              {/* a dupla — avatares sobrepostos + nomes */}
              <div className="order-3 flex min-w-0 basis-full items-center gap-2.5 lg:order-none lg:basis-auto">
                <span className="inline-flex shrink-0">
                  <Skeleton className="size-8 rounded-full ring-2 ring-card" />
                  <Skeleton className="-ml-2 size-8 rounded-full ring-2 ring-card" />
                </span>
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-1 h-2.5 w-3/5" />
                </div>
              </div>
              {/* réguinha de encontros — 16 segmentos + tick */}
              <Skeleton className="order-4 h-2 w-full basis-[35%] rounded-[2px] lg:order-none lg:basis-auto" />
              {/* sinais */}
              <Skeleton className="order-5 h-3 w-2/3 basis-[55%] lg:order-none lg:basis-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
