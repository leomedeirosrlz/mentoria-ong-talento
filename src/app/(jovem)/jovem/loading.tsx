import { Skeleton } from "@/components/ui/skeleton";

// Espelho da home do jovem (grid gap-5), na ordem da onda de superfícies:
// saudação, hero do próximo encontro (fundo de destaque), "Para fazer agora"
// com 2 linhas, a linha de ajuda, a jornada compacta (card), Minha mentoria
// com 3 contatos, os headers das seções recolhíveis (combinados, avaliações,
// documentos) e o cartão-resumo de materiais.
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

      {/* Sua jornada — card compacto: título + link, barra e contagem */}
      <section className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-2 h-2 w-full rounded-full" />
        <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
      </section>

      {/* Minha mentoria — avatar, nome e WhatsApp (3 contatos + link) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="rounded-xl bg-card px-5 py-2 shadow-[var(--shadow-border)]">
          <div className="divide-y divide-border/60">
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
          <Skeleton className="my-2 h-4 w-24" />
        </div>
      </section>

      {/* Seções recolhíveis — header com ícone, título, resumo e caret */}
      {["w-36", "w-32", "w-28"].map((w, i) => (
        <section key={i} className="flex min-h-11 items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className={`h-5 ${w}`} />
          <Skeleton className="ms-auto h-4 w-16" />
          <Skeleton className="size-4 rounded" />
        </section>
      ))}

      {/* Materiais — cartão-resumo de uma linha */}
      <section className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <div className="flex min-h-11 items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </div>
      </section>
    </div>
  );
}
