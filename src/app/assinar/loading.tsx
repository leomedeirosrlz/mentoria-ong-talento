import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { Logo } from "@/components/logo";

// Espelho de /assinar/[token] (público): página fora do shell — logo real,
// kicker + título + índice de etapas, card do documento e card do form de
// dados/assinatura; rodapé institucional em faixa border-t.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col bg-background"
    >
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Logo />

        <Skeleton className="mt-8 h-3 w-32" />
        <Skeleton className="mt-2 h-8 w-4/5" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/5" />
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-32" />
          ))}
        </div>

        {/* o documento — card de leitura longa */}
        <div className="mt-8 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
          <Skeleton className="mx-auto h-4 w-72 max-w-full" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="mt-4 h-4 w-2/5" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
            <Skeleton className="h-3.5 w-3/5" />
          </div>
          <div className="mt-6 border-t border-border pt-5 text-center">
            <Skeleton className="mx-auto h-4 w-44" />
          </div>
        </div>

        {/* dados + assinatura */}
        <div className="mt-6 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-1.5 h-4 w-4/5" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="mt-6 h-11 w-full rounded-lg md:h-8" />
        </div>
      </main>

      <div className="border-t border-border px-4 py-6 sm:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
