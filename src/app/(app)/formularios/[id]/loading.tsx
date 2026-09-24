import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha: header com badges/ações + faixa de status + seções
// (perguntas em leitura, links, respostas) empilhadas.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto max-w-3xl space-y-8">
      <header>
        <Skeleton className="h-5 w-16" />
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
          <Skeleton className="h-7 w-56 rounded-lg" />
        </div>
      </header>
      <Skeleton className="h-4 w-72" />
      <div>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="space-y-2.5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      </div>
    </div>
  );
}
