import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha de pessoa: capa alta de banner + avatar sobreposto,
// nome/meta embaixo, chips/ações à direita da base do avatar; strip de
// mentoria e as duas colunas de cards (conteúdo à esquerda, rail à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      {/* VoltarLink real vem antes do header — sem ele o topo dá CLS */}
      <Skeleton className="h-4 w-16" />

      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-28 w-full rounded-none sm:h-36" />
        <div className="px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            {/* -mt-10/ring-card repetem a sobreposição real do avatar no
                banner — sem isso o layout pula quando o conteúdo chega */}
            <Skeleton className="size-20 -mt-10 shrink-0 rounded-full ring-4 ring-card sm:size-24 sm:-mt-12" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <Skeleton className="mt-3 h-7 w-56 max-w-full" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
      </header>

      {/* resumo da mentoria — faixa de 4 stats */}
      <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <Skeleton className="h-3.5 w-28" />
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1 h-4.5 w-20" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
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
