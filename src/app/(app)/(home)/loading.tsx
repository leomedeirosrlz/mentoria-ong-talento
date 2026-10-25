import { Skeleton } from "@/components/ui/skeleton";

// Espelho da home de coordenação/supervisão: saudação → situação das duplas
// (título, frase, barra e legenda) → grid com a fila "Precisa de você hoje" e
// "Esta semana" na coluna principal, e os recolhidos (avisos, pedidos,
// trilhas) no rail de ~340px. Mesma ordem do DOM que aparece no celular.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header>
        <Skeleton className="h-8 w-48" />
      </header>

      {/* situação das duplas */}
      <div className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          {/* precisa de você hoje: título + linhas de dupla */}
          <section className="space-y-3">
            <Skeleton className="h-5 w-44" />
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3"
                >
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex min-w-0 basis-full items-center gap-2.5 sm:basis-auto sm:flex-1">
                    <span className="inline-flex shrink-0">
                      <Skeleton className="size-8 rounded-full ring-2 ring-card" />
                      <Skeleton className="-ml-2 size-8 rounded-full ring-2 ring-card" />
                    </span>
                    <Skeleton className="h-4 w-52 max-w-full" />
                  </div>
                  <Skeleton className="h-11 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          </section>

          {/* esta semana: uma linha por turma, com a barra fina */}
          <section className="space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:px-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Skeleton className="h-4 w-72 max-w-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="mt-2.5 h-2 w-full rounded-full" />
              </div>
            ))}
          </section>
        </div>

        {/* recolhidos: avisos, pedidos e trilhas, com o contador no título */}
        <aside className="min-w-0 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex min-h-11 items-center gap-2 py-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="ms-auto size-3.5 rounded-sm" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
