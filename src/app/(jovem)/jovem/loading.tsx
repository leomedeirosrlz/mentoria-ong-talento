import { Skeleton } from "@/components/ui/skeleton";

// Espelho da home do jovem (grid gap-8): header de saudação, card de ajuda
// (disco + texto + ações), Minha mentoria (avatar+linhas), Encontros (uma
// linha + CTA), Combinados e Documentos (linhas com ação à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-8">
      <header>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-1 h-4 w-64 max-w-full" />
      </header>

      {/* Precisa de ajuda? — disco + texto + dois botões */}
      <div className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center gap-4 px-4 py-5">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 basis-52">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-1.5 h-3.5 w-full" />
            <Skeleton className="mt-1 h-3.5 w-4/5" />
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-48 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Minha mentoria — título + linhas de contato (avatar, nome, WhatsApp) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-1 h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      {/* Encontros — título + link de agenda + card do próximo */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4.5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="rounded-xl bg-card px-5 py-3.5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1 basis-52">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1.5 h-3.5 w-44" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      </section>

      {/* Meus combinados — linhas de check */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-5 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-1 h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Documentos — linha + ação à direita */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
              <div className="min-w-0 flex-1 basis-48">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-1 h-3 w-4/5" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
