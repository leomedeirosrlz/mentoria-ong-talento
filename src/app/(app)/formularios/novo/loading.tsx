import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /formularios/novo: header + card título/descrição + card de
// pergunta (enunciado + tipo na linha, mock do tipo, rodapé com ações e
// switch) + ações do builder (adicionar / pré-visualizar / criar).
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
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)]">
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-11 flex-1 md:h-8" />
              <Skeleton className="h-11 w-full sm:w-44 md:h-8" />
            </div>
            <Skeleton className="h-8 w-full max-w-sm" />
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-7 w-40 rounded-lg" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
