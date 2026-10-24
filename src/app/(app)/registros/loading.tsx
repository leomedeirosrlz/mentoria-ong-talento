import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /registros: header, barra busca+filtros, faixa "Panorama" do
// painel (pills de recorte + cards de gráfico), resumo operacional e a
// timeline (rail dia/mês + nó + linha) com cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto max-w-5xl space-y-6">
      <header>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      <div className="flex items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg sm:h-8 sm:max-w-md" />
        <Skeleton className="h-11 w-24 rounded-lg sm:h-8" />
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>
      {/* faixa do painel: linha de pills + três cards (barras | semáforo na
          1ª linha do desktop, linha embaixo) — reserva a dobra pro layout
          não pular quando os dados chegarem */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-56 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-7">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1.5 h-5 w-56" />
            <Skeleton className="mt-3 h-7 w-44 rounded-full" />
            <div className="mt-4 flex h-44 items-end gap-[3px] pl-6">
              {[48, 62, 40, 70, 55, 80, 34, 50].map((h, i) => (
                <Skeleton
                  key={i}
                  className="min-w-0 flex-1 rounded-t-md"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1.5 h-5 w-40" />
            <div className="mt-4 flex items-center justify-center gap-6">
              <Skeleton className="size-36 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-12">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-1.5 h-5 w-52" />
            <Skeleton className="mt-4 h-36 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <Skeleton className="h-4 w-72 max-w-full" />
      <ol>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 sm:gap-4">
            <div className="flex w-10 shrink-0 flex-col items-center sm:w-12">
              <Skeleton className="mt-4 h-4 w-5" />
              <Skeleton className="mt-1 h-2.5 w-6" />
              <Skeleton className="mt-2 size-2 rounded-full" />
              {i < 2 && <div className="mt-1.5 w-px flex-1 bg-border" />}
            </div>
            <div className={i < 2 ? "min-w-0 flex-1 pb-5" : "min-w-0 flex-1"}>
              <div className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="mt-2 h-4 w-2/5" />
                <Skeleton className="mt-1.5 h-3 w-4/5" />
                <Skeleton className="mt-2 h-4 w-full" />
                <div className="mt-2 flex gap-1.5">
                  <Skeleton className="h-5 w-28 rounded-4xl" />
                  <Skeleton className="h-5 w-20 rounded-4xl" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
