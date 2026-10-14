import { Skeleton } from "@/components/ui/skeleton";

// Espelho do perfil de pessoa do /jovem: link "Pessoas" de volta, card de
// capa (banner + avatar sobreposto + nome/badge/meta) e a seção única de
// detalhe (linhas de dl + botões de contato). Mesmo cap max-w-3xl.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto max-w-3xl space-y-6"
    >
      <Skeleton className="h-4 w-20" />

      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-28 w-full rounded-none sm:h-36" />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          {/* -mt-10/ring-card repetem a sobreposição real do avatar */}
          <Skeleton className="relative z-10 -mt-10 size-20 shrink-0 rounded-full ring-4 ring-card sm:-mt-12 sm:size-24" />
          <Skeleton className="mt-3 h-7 w-48 max-w-full" />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </header>

      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <Skeleton className="h-3 w-16" />
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
            >
              <Skeleton className="h-4 w-24 shrink-0 sm:w-32" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Skeleton className="h-11 w-40 rounded-lg md:h-7" />
            <Skeleton className="h-11 w-32 rounded-lg md:h-7" />
          </div>
        </div>
      </section>
    </div>
  );
}
