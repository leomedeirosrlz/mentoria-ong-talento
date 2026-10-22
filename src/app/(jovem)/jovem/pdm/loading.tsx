import { Skeleton } from "@/components/ui/skeleton";

// Espelho do /jovem/pdm: voltar, card da visão, barra de progresso e a
// árvore de metas (linhas com círculo + texto + overflow).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <Skeleton className="h-11 w-36 rounded-full" />
      <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
        <div className="mt-4 rounded-xl border border-border/60 p-3.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-3/5" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2 flex-1 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-muted/40 px-1.5 py-1.5"
            >
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-1 h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
