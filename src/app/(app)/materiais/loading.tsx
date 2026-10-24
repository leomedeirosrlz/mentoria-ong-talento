import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /materiais na visão staff (coord/supervisor — caso comum;
// o mentor troca o painel pela biblioteca primeiro e o catálogo por
// último — mesma hierarquia, ordem menor): header + ação, caixa de
// escopo ("você vê / você não vê"), card "Progresso da jornada" (faixa
// rolável com um segmento por instrumento + legenda + lista "fora da
// janela"), seção "Instrumentos do programa" (grade sm:2 xl:4 de cards
// borda-t-3) e a biblioteca (faixa de KPIs, trilha de cobertura, chips,
// grupos "Por encontro" e "Transversais").
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg md:h-7" />
      </header>

      {/* caixa de escopo — parágrafo com borda-l-4 no topo da página */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/70 border-l-4 bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>

      {/* "Progresso da jornada" — card com a faixa de 7 segmentos por
          instrumento (w-44, rola no mobile / estica em lg), legenda e a
          lista "fora da janela" com teto */}
      <section className="space-y-5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1.5 h-3 w-72 max-w-full" />
          <Skeleton className="mt-1.5 h-3 w-96 max-w-full" />
        </div>
        <div className="-mx-1 flex gap-2.5 overflow-hidden px-1 pb-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="w-44 shrink-0 rounded-lg border border-border/70 p-3 lg:min-w-0 lg:flex-1"
            >
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-1 h-3 w-3/5" />
              <div className="mt-2.5 space-y-2.5">
                {[0, 1].map((j) => (
                  <div key={j}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-9" />
                    </div>
                    <Skeleton className="mt-1 h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* legenda — ícone + palavra, 6 itens */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {["w-16", "w-24", "w-16", "w-12", "w-24", "w-20"].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className={`h-2.5 ${w}`} />
            </div>
          ))}
        </div>
        {/* "Fora da janela do guia" — título âmbar + linhas acionáveis */}
        <div>
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-md" />
          <ul className="mt-2 divide-y divide-border/60">
            {[0, 1].map((i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
              >
                <div className="min-w-40 flex-1">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-1 h-3 w-4/5" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* "Instrumentos do programa" — heading + grade de cards (emblema +
          título + chips + descrição + ação no rodapé) */}
      <section>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-1.5 h-4 w-full max-w-lg" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-xl border border-border/70 border-t-[3px] bg-card p-3.5"
            >
              <div className="flex items-start gap-2.5">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-4/5" />
                  <div className="mt-1.5 flex gap-1.5">
                    <Skeleton className="h-4 w-14 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/5" />
              <div className="mt-auto pt-1">
                <Skeleton className="h-7 w-32 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* faixa de KPIs da biblioteca — 4 stats em linha (2×2 no mobile) */}
      <section className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* trilha de cobertura — summary do grupo + 16 células numeradas */}
      <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <div className="flex items-center gap-x-2.5">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        <div className="mt-3 flex justify-end gap-3">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} className="size-9 shrink-0 rounded-md" />
          ))}
        </div>
      </section>

      {/* chips de filtro */}
      <div className="flex flex-wrap gap-1.5">
        {[56, 88, 96, 110, 92].map((w, i) => (
          <Skeleton key={i} className="h-11 rounded-full sm:h-8" style={{ width: w }} />
        ))}
      </div>

      {/* grupo "Por encontro" — summary + linhas <details> colapsadas */}
      <section className="space-y-2">
        <div className="flex min-h-11 items-center gap-x-2 px-1.5 sm:min-h-9">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {[5, 2, 3].map((w, i) => (
          <div
            key={i}
            className="flex min-h-11 items-center gap-x-2.5 rounded-xl bg-card px-4 py-2 shadow-[var(--shadow-border)]"
          >
            <Skeleton className="size-3.5 shrink-0 rounded" />
            <Skeleton className="h-3.5" style={{ width: `${18 + w * 6}%` }} />
            <Skeleton className="ml-auto h-5 w-16 rounded-4xl" />
          </div>
        ))}
      </section>

      {/* grupo "Transversais" — summary + card de linhas */}
      <section className="space-y-2">
        <div className="flex min-h-11 items-center gap-x-2 px-1.5 sm:min-h-9">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-wrap items-center pr-2">
              <div className="flex min-w-0 flex-1 basis-full items-center gap-x-4 px-5 py-3.5 sm:basis-auto">
                <Skeleton className="h-20 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-1 h-3 w-3/5" />
                </div>
              </div>
              <div className="flex basis-full items-center justify-end gap-2 px-5 pb-3 sm:basis-auto sm:px-0 sm:pb-0">
                <Skeleton className="h-5 w-16 rounded-4xl" />
                <Skeleton className="size-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
