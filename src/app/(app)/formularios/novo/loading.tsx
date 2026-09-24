import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /formularios/novo: header + card título/descrição + card de
// pergunta + ações do builder (adicionar / criar).
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto max-w-2xl space-y-6"
    >
      <header>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="mt-2 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </header>
      <div className="space-y-4">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-52" />
        </div>
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
    </div>
  );
}
