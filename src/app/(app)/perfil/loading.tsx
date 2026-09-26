import { Skeleton } from "@/components/ui/skeleton";

// Espelho da página de perfil: card de capa (banner + avatar + nome/meta),
// depois o grid 1fr×340px — perfil público na coluna principal, disclosures
// de cadastro e conta no rail. Mesmo cap max-w-5xl do conteúdo real.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto w-full max-w-5xl space-y-6"
    >
      {/* card de capa — banner + avatar sobreposto + nome/meta/ação */}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-24 rounded-none sm:h-28" />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="flex items-end justify-between gap-3">
            <Skeleton className="-mt-10 size-20 shrink-0 rounded-full ring-4 ring-card sm:-mt-12 sm:size-24" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-48 max-w-full" />
          <div className="mt-2.5 flex items-center gap-2.5">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
      </div>

      {/* grid 1fr×340 — perfil público à esquerda, cadastro/conta no rail */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* perfil público — linhas de leitura (rótulo fixo + valor) */}
          <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            <div className="mt-5 space-y-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-32 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {/* dados de cadastro — gaveta aberta com o grid de campos */}
          <div className="rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-2.5 px-6 py-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="ml-auto size-4 rounded-full" />
            </div>
            <div className="border-t border-border px-6 pb-6 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-4 w-24 shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
              <Skeleton className="mt-5 h-12 rounded-lg" />
            </div>
          </div>

          {/* conta — label + linha de senha + sessão */}
          <div className="rounded-xl bg-card shadow-[var(--shadow-border)]">
            <Skeleton className="mx-6 mt-5 h-4 w-14" />
            <div className="flex items-center gap-2.5 px-6 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto size-4 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
