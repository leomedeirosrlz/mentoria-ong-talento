import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /pessoas: header com 3 ações, busca + filtro "Sem dupla",
// seção "Com acesso" (linhas com nome/email + badges + role select + ações)
// e seção "Mentorados" (linhas com nome/ONG + ações).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-28 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-32 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-28 rounded-lg md:h-7" />
        </div>
      </header>

      {/* busca + toggle "Sem dupla" */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 w-full rounded-lg sm:max-w-sm md:h-8" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* ===== com acesso ===== */}
      <section className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0 flex-1 basis-48">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-1.5 h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0 rounded-4xl" />
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="h-11 w-40 rounded-lg md:h-8" />
                <Skeleton className="size-11 rounded-lg md:size-8" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== mentorados ===== */}
      <section className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0 flex-1 basis-48">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-1.5 h-3 w-44 max-w-full" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="size-11 rounded-lg md:size-8" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
