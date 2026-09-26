import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha de pessoa: header compacto (faixa de marca + avatar em
// linha com nome/meta + chips/ações), stat strip de mentoria e as duas
// colunas de cards (conteúdo à esquerda, rail operacional à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      {/* VoltarLink real vem antes do header — sem ele o topo dá CLS */}
      <Skeleton className="h-4 w-16" />

      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-3 w-full rounded-none" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 basis-56">
            <Skeleton className="h-6 w-52 max-w-full" />
            <Skeleton className="mt-2 h-4 w-44" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </header>

      {/* resumo da mentoria — faixa de 4 stats */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="mt-1.5 h-5 w-20" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </section>
          ))}
        </div>
        <aside className="min-w-0 space-y-4">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <Skeleton className="h-4 w-20" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
