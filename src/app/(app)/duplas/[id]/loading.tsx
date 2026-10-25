import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Espelho da ficha da dupla: voltar, cabeçalho (nomes, meta, estado e a
// ação), faixa de abas e a aba "Agora" (jornada, próximo encontro, combinados).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-5">
      {/* link Voltar */}
      <div>
        <Skeleton className="h-4 w-16" />
      </div>

      {/* cabeçalho: faixa de papel da dupla no topo, nomes, meta, estado e ação */}
      <header className="relative overflow-hidden rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <Skeleton className="absolute inset-x-0 top-0 h-1 rounded-none" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 w-44 rounded-lg md:h-7" />
          <Skeleton className="h-11 w-24 rounded-lg md:h-7" />
        </div>
      </header>

      {/* abas: pills dentro de uma faixa de fundo muted */}
      <div className="flex items-center gap-1 overflow-hidden rounded-lg bg-muted p-1">
        <Skeleton className="h-11 w-20 shrink-0 rounded-md md:h-8" />
        <Skeleton className="h-11 w-24 shrink-0 rounded-md md:h-8" />
        <Skeleton className="h-11 w-28 shrink-0 rounded-md md:h-8" />
        <Skeleton className="h-11 w-24 shrink-0 rounded-md md:h-8" />
      </div>

      {/* aba Agora: jornada com o rail de 16 discos */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="mt-2 flex items-center overflow-hidden pt-2.5 pb-1">
          {Array.from({ length: 16 }, (_, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span aria-hidden className="h-px min-w-1 flex-1 bg-border" />
              )}
              <Skeleton className="size-6 shrink-0 rounded-full sm:size-7" />
            </Fragment>
          ))}
        </div>
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </section>

      {/* próximo encontro */}
      <section className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-1.5 h-3 w-4/5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-36 rounded-lg md:h-7" />
        </div>
      </section>

      {/* combinados */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <Skeleton className="h-5 w-28" />
        <ul className="mt-3 divide-y divide-border">
          {[0, 1].map((i) => (
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
    </div>
  );
}
