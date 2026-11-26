import { Skeleton } from "@/components/ui/skeleton";

// Espelho da "Minha dupla": saudação, card de contatos, encontros,
// combinados/plano, PDM e a lista do que fazer.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      {[
        { linhas: 3, avatar: true },
        { linhas: 4, avatar: false },
        { linhas: 4, avatar: false },
      ].map((secao, s) => (
        <section key={s} className="space-y-2.5">
          <Skeleton className="h-5 w-44" />
          <div className="divide-y divide-border/60 rounded-xl bg-card px-4 py-0 shadow-[var(--shadow-border)]">
            {Array.from({ length: secao.linhas }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                {secao.avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-1 h-3 w-2/5" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
