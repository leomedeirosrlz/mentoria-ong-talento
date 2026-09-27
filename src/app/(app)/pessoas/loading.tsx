import { Skeleton } from "@/components/ui/skeleton";

// Espelho neutro de /pessoas — a página agora abre pra todos os papéis (a
// coordenação tem CTAs e filtros de gestão; os demais veem o diretório), então
// o skeleton mostra só o que é comum: título, busca e linhas com avatar+nome.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-8">
      <header>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>

      {/* busca */}
      <Skeleton className="h-11 w-full rounded-lg sm:max-w-sm md:h-8" />

      {/* ===== pessoas ===== */}
      <section className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-1.5 h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-5 w-24 shrink-0 rounded-4xl" />
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
              className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-1.5 h-3 w-44 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
