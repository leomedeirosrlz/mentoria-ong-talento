import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /assinar logado: max-w-2xl, header com índice de etapas,
// card do termo (doc serifado longo) e card "Confira seus dados" com o
// form de assinatura.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto max-w-2xl space-y-6"
    >
      <header>
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-5/6" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-28" />
          ))}
        </div>
      </header>

      {/* o termo — card de leitura longa com link âncora no pé */}
      <div className="rounded-xl bg-card px-5 py-6 shadow-[var(--shadow-border)] sm:px-8">
        <Skeleton className="mx-auto h-4 w-64 max-w-full" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="mt-4 h-4 w-2/5" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
          <Skeleton className="h-3.5 w-3/5" />
        </div>
        <div className="mt-6 border-t border-border pt-5 text-center">
          <Skeleton className="mx-auto h-4 w-44" />
        </div>
      </div>

      {/* dados + assinatura — campos em grade e botão largo */}
      <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-1.5 h-4 w-4/5" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="mt-6 h-11 w-full rounded-lg md:h-8" />
      </div>
    </div>
  );
}
