import { Skeleton } from "@/components/ui/skeleton";

// Espelho do DashboardCoordenacao (home de coordenação/supervisor):
// saudação → faixa-resumo da semana (frase + barra segmentada + legenda) →
// grid lg com saúde + radar na coluna principal e avisos no topo do rail
// de ~340px. As larguras/ordens seguem o layout real, não o antigo rail xl.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-8">
      {/* header — saudação "Olá, Fulana" */}
      <header>
        <Skeleton className="h-8 w-48" />
      </header>

      {/* faixa-resumo da semana — título + ações; subtítulo; frase-fato;
          barra segmentada; legenda nomeada */}
      <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="mt-1.5 h-4 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-56 max-w-full" />
        <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </section>

      {/* mesma geometria do grid real: coluna única até lg, depois main +
          rail; avisos pina no topo do rail (col 2, row 1) */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start">
        {/* saúde das duplas — headline + barra semáforo + legenda + chips */}
        <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 lg:col-start-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-10" />
          </div>
          <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-11 w-16 rounded-full sm:h-8" />
            <Skeleton className="h-11 w-24 rounded-full sm:h-8" />
            <Skeleton className="h-11 w-28 rounded-full sm:h-8" />
            <Skeleton className="h-11 w-36 rounded-full sm:h-8" />
          </div>
        </section>

        {/* avisos — rail topo em lg+, depois do card-saúde no fluxo mobile */}
        <section className="lg:col-start-2 lg:row-start-1">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="divide-y divide-border/60 rounded-xl bg-card shadow-[var(--shadow-border)]">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-4xl" />
                  <Skeleton className="h-4 min-w-0 flex-1" />
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
                <Skeleton className="mt-2 h-3.5 w-full" />
                <Skeleton className="mt-1 h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        </section>

        {/* radar — cards de dupla com dot + nomes + motivo à esquerda;
            contador, barra e badge à direita; poço na base com lembrete
            + ação */}
        <section className="space-y-3 lg:col-start-1">
          <Skeleton className="h-3 w-16" />
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
                <div className="flex w-20 shrink-0 flex-col items-end gap-2 sm:w-24">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-1 w-full rounded-full" />
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
    </div>
  );
}
