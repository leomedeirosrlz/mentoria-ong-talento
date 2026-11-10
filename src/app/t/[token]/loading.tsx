import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { Logo } from "@/components/logo";

// Espelho de /t/[token] (público, avaliação por terceiros): mesmo shell das
// irmãs por token — logo + kicker e um card único com saudação, duas
// perguntas abertas (label + dica + textarea) e o submit w-full.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col"
    >
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="m-auto w-full max-w-xl">
          <header className="mb-6">
            <Logo size="lg" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Programa de Mentoria Social
            </p>
          </header>

          <div className="space-y-5 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
            <div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="mt-2.5 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-3/4" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-11 w-full rounded-lg md:h-10" />
          </div>
          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
