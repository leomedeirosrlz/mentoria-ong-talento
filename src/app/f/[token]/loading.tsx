import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { Logo } from "@/components/logo";

// Espelho de /f/[token] (público): navegação fria via WhatsApp + RPC mostrava
// só o spinner do browser. Mesma anatomia do form — logo + kicker, pill de
// progresso, card de título com a faixa lime e cards de pergunta — até o
// rodapé institucional.
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

          {/* pill de progresso — ocupa o lugar do sticky real */}
          <div className="flex items-center gap-3 rounded-full bg-card/90 px-4 py-2.5 shadow-[var(--shadow-border)]">
            <Skeleton className="h-1 flex-1 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>

          {/* card de título — a faixa lime é real, como no form */}
          <div className="mt-3 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
            <div className="p-5 sm:p-7">
              <Skeleton className="h-7 w-3/5 max-w-full" />
              <Skeleton className="mt-2 h-3 w-44" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-2/3" />
            </div>
          </div>

          {/* cards de pergunta — label + controle de altura real */}
          {[0, 1].map((i) => (
            <div
              key={i}
              className="mt-3 space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
            >
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}

          <Skeleton className="mt-3 h-11 w-full rounded-lg" />
          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
