import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha da dupla: voltar + header (dois nomes + meta + ações),
// coluna de encontros (cards com disco numerado) e aside com 2 cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* link Voltar */}
      <div>
        <Skeleton className="h-4 w-16" />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-80 max-w-full" />
          {/* meta: semáforo + contagem + supervisor */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 w-40 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-36 rounded-lg md:h-7" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ===== timeline de encontros ===== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-32 rounded-lg md:h-7" />
          </div>

          {/* encontro com registro expandido */}
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-1.5 h-3 w-4/5" />
              </div>
            </div>
            <div className="space-y-2 border-t bg-muted/40 px-4 py-3.5">
              <Skeleton className="h-3 w-44" />
              <div className="flex items-center gap-2 pb-0.5">
                <Skeleton className="h-5 w-16 rounded-4xl" />
                <Skeleton className="h-5 w-28 rounded-4xl" />
              </div>
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>

          {/* encontros seguintes — linha simples, um com badge */}
          {[true, false].map((badge, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-1.5 h-3 w-3/4" />
                </div>
                {badge && <Skeleton className="h-5 w-24 shrink-0 rounded-4xl" />}
              </div>
            </div>
          ))}

          {/* expansor "Próximos N encontros" */}
          <div className="flex min-h-11 items-center gap-1.5 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="size-3.5 rounded" />
          </div>
        </section>

        {/* ===== aside ===== */}
        <aside className="space-y-6">
          {/* encaminhamentos */}
          <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-36 rounded-lg md:h-7" />
            </div>
            <ul className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-start gap-3 py-3">
                  <Skeleton className="mt-0.5 size-4.5 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="mt-1.5 h-3 w-1/2" />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* mentorado */}
          <section className="space-y-2 rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </section>
        </aside>
      </div>
    </div>
  );
}
