import { Skeleton } from "@/components/ui/skeleton";

// Espelho de /turmas/novo: PageHeader com VoltarLink de kicker, três cards
// de parâmetros do CronogramaBuilder (A turma · Mentoria ativa · Antes e
// depois) e o botão "Gerar prévia" alinhado à direita.
function Campo({ hint }: { hint?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-9 w-full" />
      {hint && <Skeleton className="h-3 w-48 max-w-full" />}
    </div>
  );
}

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <header>
        {/* VoltarLink no kicker — min-h-11 no toque, some o respiro no md */}
        <Skeleton className="h-11 w-16 md:h-5" />
        <div className="mt-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-1.5 h-4 w-[26rem] max-w-full" />
        </div>
      </header>

      {/* A turma — 2 colunas de campos */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Skeleton className="h-4 w-16" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo hint />
          <Campo hint />
          <Campo />
          <Campo />
        </div>
      </section>

      {/* Mentoria ativa — 3 colunas + exceções + recesso */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo hint />
          <Campo />
          <Campo hint />
        </div>
        <div className="mt-5 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-11 w-40 rounded-lg md:h-7" />
        </div>
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </section>

      {/* Antes e depois — dois switches com rótulo longo */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Skeleton className="h-11 w-52 rounded-lg md:h-8" />
      </div>
    </div>
  );
}
