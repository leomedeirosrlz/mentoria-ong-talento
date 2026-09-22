import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /formularios: header com ação + lista de cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </header>
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5"
          >
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
