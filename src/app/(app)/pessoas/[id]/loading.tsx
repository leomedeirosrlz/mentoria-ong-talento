import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha de pessoa: header (avatar + nome + meta) + duas colunas de
// seções de texto.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* VoltarLink real vem antes do header — sem ele o topo dá CLS */}
      <Skeleton className="h-4 w-16" />
      <header className="flex flex-wrap items-center gap-4">
        <Skeleton className="size-[72px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-52 max-w-full" />
          <Skeleton className="mt-2 h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {[0, 1].map((i) => (
          <section key={i} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
