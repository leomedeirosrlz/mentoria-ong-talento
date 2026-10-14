import { Skeleton } from "@/components/ui/skeleton";

// Espelho do /jovem/perfil: card de capa (banner + avatar + nome/badge),
// "Seus dados" (overline + dl), gaveta da ficha, Privacidade e Conta —
// mesma pilha max-w-3xl da página real.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* card de capa — banner + avatar sobreposto + nome/meta */}
      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="h-28 w-full rounded-none sm:h-36" />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <Skeleton className="relative z-10 -mt-10 size-20 shrink-0 rounded-full ring-4 ring-card sm:-mt-12 sm:size-24" />
          <Skeleton className="mt-3 h-7 w-48 max-w-full" />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </header>

      {/* Seus dados — overline + lápis + linhas de dl */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
        <div className="mt-4 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
            >
              <Skeleton className="h-4 w-24 shrink-0 sm:w-32" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </section>

      {/* ficha — gaveta fechada (summary + caret) */}
      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="flex min-h-11 items-center gap-2.5 px-6 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto size-4 shrink-0 rounded" />
        </div>
      </section>

      {/* Privacidade — overline + caixa do switch + nota */}
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border px-3.5 py-3">
            <Skeleton className="mt-0.5 h-5 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-1.5 h-3.5 w-full" />
              <Skeleton className="mt-1 h-3.5 w-4/5" />
            </div>
          </div>
          <Skeleton className="h-3 w-4/5" />
        </div>
      </section>

      {/* Conta — overline + linhas credenciais com ação à direita */}
      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <Skeleton className="mx-6 mt-5 h-3 w-12" />
        <div className="mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-1 h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-11 w-24 rounded-lg md:h-7" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
