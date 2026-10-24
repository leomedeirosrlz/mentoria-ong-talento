import { Skeleton } from "@/components/ui/skeleton";

// Espelho do hub "Minha jornada" (v5c): hero slim (título + meta + badge
// + N/16 + barra + "próxima parada"), sub-nav sticky (Jornada | Acervo),
// "Meus instrumentos" (heading + caixa de escopo + grade 2col/lg4 de
// cards com capa h-24) e o acervo agrupado (overline + grade de cards-
// linha: ícone size-9 + título/descrição + ícone à direita).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* hero slim — um card só */}
      <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-44" />
            <Skeleton className="mt-2 h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-9 w-14" />
        </div>
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
      </div>

      {/* sub-nav sticky — dois links-pill "Jornada | Acervo" */}
      <div className="flex gap-1 border-b border-border pb-0">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>

      {/* "Meus instrumentos" — heading + caption + caixa de escopo +
          grade de cards-produto (capa símbolo h-24, título+sub,
          descrição, chip de janela + tag de estado) */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
          <Skeleton className="mt-1.5 h-4 w-64 max-w-full" />
          {/* escopo — caixa bg-muted/40 com 2 linhas "você vê / não vê" */}
          <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
            >
              {/* capa símbolo */}
              <Skeleton className="h-24 rounded-none" />
              <div className="flex flex-col gap-1.5 p-3.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-1 h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* bandeira terminal — "Encontro 16 · Celebração da jornada" */}
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </section>

      {/* acervo — overline de grupo + grade de cards-linha */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-x-4 rounded-xl bg-card px-5 py-3.5 shadow-[var(--shadow-border)]"
              >
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-1 h-3 w-4/5" />
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
