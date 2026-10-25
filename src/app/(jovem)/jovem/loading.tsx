import { Skeleton } from "@/components/ui/skeleton";

// Espelho da home do jovem (grid gap-5), na ordem nova: saudação, hero do
// próximo encontro (fundo de destaque), "Para fazer agora" com 2 linhas, a
// linha de ajuda, a jornada (título + barra + contagem), Minha mentoria,
// Combinados e Documentos.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-5">
      <header>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-1 h-4 w-64 max-w-full" />
      </header>

      {/* Seu próximo encontro — rótulo, título, data e uma ação */}
      <div className="rounded-xl border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] p-5 sm:p-6">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-3 h-6 w-3/5" />
        <Skeleton className="mt-2 h-4 w-44" />
        <Skeleton className="mt-4 h-11 w-full rounded-lg sm:w-44" />
      </div>

      {/* Para fazer agora — duas linhas de ação */}
      <section>
        <Skeleton className="mb-3 h-5 w-40" />
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-3 py-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-1 h-3 w-1/4" />
            </div>
            <Skeleton className="h-11 w-24 shrink-0 rounded-lg" />
          </div>
          <div className="flex items-center gap-3 py-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-1 h-3 w-2/5" />
            </div>
          </div>
        </div>
      </section>

      {/* Precisa de ajuda? — uma linha */}
      <Skeleton className="h-11 w-full rounded-lg" />

      {/* Sua jornada — título, barra e contagem */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </section>

      {/* Minha mentoria — avatar, nome e WhatsApp */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 py-1">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-1 h-3 w-1/3" />
              </div>
              <Skeleton className="size-11 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      {/* Meus combinados — linhas de check */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          {[0, 1].map((i) => (
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
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="mt-1 h-3 w-4/5" />
              </div>
              <Skeleton className="h-11 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
