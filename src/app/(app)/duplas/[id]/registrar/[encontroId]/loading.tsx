import { Skeleton } from "@/components/ui/skeleton";

// Espelho da rota de registro: voltar, h1 + meta, cartão de contexto do
// encontro e o cartão do form — mesmo desenho pra não deslocar na entrada.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto max-w-3xl space-y-5"
    >
      <div>
        <Skeleton className="h-4 w-16" />
      </div>
      <header>
        <Skeleton className="mt-2 h-8 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </header>

      {/* cartão de contexto do encontro */}
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-1.5 h-4 w-full" />
        <Skeleton className="mt-2 h-8 w-44 rounded-lg" />
      </section>

      {/* cartão do form */}
      <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-4 h-4 w-48" />
        <Skeleton className="mt-4 h-11 w-full rounded-lg" />
        <Skeleton className="mt-2 h-11 w-full rounded-lg" />
        <Skeleton className="mt-4 h-11 w-32 rounded-lg" />
      </div>
    </div>
  );
}
