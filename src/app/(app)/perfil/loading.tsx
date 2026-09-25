import { Skeleton } from "@/components/ui/skeleton";

// Espelho da página de perfil: header + card da foto + card do perfil
// público (campos abertos) + linhas de disclosure (cadastro/mentoria/senha).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="max-w-lg space-y-6">
      <div>
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-28" />
      </div>

      {/* foto */}
      <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <Skeleton className="h-5 w-12" />
        <div className="mt-4 flex items-center gap-4">
          <Skeleton className="size-[72px] shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
      </div>

      {/* perfil público — campos abertos em 2 colunas */}
      <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-9 w-24 rounded-lg" />
      </div>

      {/* disclosures fechados — uma linha cada (cadastro, mentoria, senha) */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-xl bg-card px-6 py-4 shadow-[var(--shadow-border)]"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="ml-auto size-4 rounded-full" />
        </div>
      ))}

      {/* barra única de save + sessão */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-[var(--shadow-border)]">
        <Skeleton className="h-4 w-36 flex-1" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}
