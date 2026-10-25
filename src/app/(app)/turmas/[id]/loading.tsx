import { Skeleton } from "@/components/ui/skeleton";

// Espelho do detalhe do cronograma (perfil v1a): Voltar + capa com banner
// ink (~118–132px) + título/sigla/status + meta + ações; depois a lista
// de duplas e o calendário oficial de eventos.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <Skeleton className="h-5 w-16" />

      {/* capa do perfil — banner ink + cabeçalho */}
      <section className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-[118px] w-full rounded-none sm:h-[132px]" />
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-5 w-9 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </section>

      {/* "N duplas seguem este calendário" */}
      <div>
        <Skeleton className="h-4 w-56" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* calendário oficial — linhas de evento */}
      <div>
        <Skeleton className="h-4 w-64" />
        <div className="mt-3 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${i > 0 ? "border-t" : ""}`}
            >
              <Skeleton className="h-3 w-4" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-1 h-3 w-2/5" />
              </div>
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
