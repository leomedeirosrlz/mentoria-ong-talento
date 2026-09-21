import { Skeleton } from "@/components/ui/skeleton";

// Espelho da página de perfil: header (avatar + nome/papel) + card do form
// (campos em 2 colunas) + card de segurança.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="max-w-lg space-y-6">
      <header className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      </header>

      <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-9 w-28 rounded-lg" />
      </div>

      <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
        <Skeleton className="mt-4 h-9 w-40 rounded-lg" />
      </div>
    </div>
  );
}
